#!/usr/bin/env node
import './load-local-env.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = [...argv];
  const flags = {};
  while (args.length) {
    const token = args.shift();
    if (!token) continue;
    if (!token.startsWith('--')) throw new Error(`Unexpected positional argument: ${token}`);
    const key = token.slice(2);
    const value = args[0] && !args[0].startsWith('--') ? args.shift() : 'true';
    flags[key] = value;
  }
  return flags;
}

function printUsage() {
  console.log(
    'Usage: node scripts/portal-postgres-bootstrap.mjs --admin-url <postgres-admin-url> [--database <db>] [--user <user>] [--password <password>] [--host <host>] [--port <port>] [--update-password] [--write-env <file>]'
  );
}

function asBool(value, defaultValue = false) {
  if (value === undefined) return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 63);
}

function generatePassword(length = 32) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
  const bytes = crypto.randomBytes(length);
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += alphabet[bytes[index] % alphabet.length];
  }
  return output;
}

function quoteIdentifier(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

function quoteLiteral(value) {
  return `'${String(value || '').replace(/'/g, "''")}'`;
}

function upsertEnvValue(content, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }
  return `${content.replace(/\s*$/, '')}\n${line}\n`;
}

function writePortalEnv(filePath, databaseUrl) {
  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(WORKSPACE_ROOT, filePath);
  const current = fs.existsSync(resolvedPath) ? fs.readFileSync(resolvedPath, 'utf8') : '';
  const next = upsertEnvValue(current, 'PORTAL_DATABASE_URL', databaseUrl);
  fs.writeFileSync(resolvedPath, next, 'utf8');
  return resolvedPath;
}

function describeUrl(urlValue) {
  const parsed = new URL(urlValue);
  const username = parsed.username ? `${parsed.username}@` : '';
  return `${parsed.protocol}//${username}${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
}

async function roleExists(sql, roleName) {
  const rows = await sql.unsafe('SELECT 1 AS ok FROM pg_roles WHERE rolname = $1 LIMIT 1', [roleName]);
  return Boolean(rows[0]?.ok);
}

async function databaseExists(sql, databaseName) {
  const rows = await sql.unsafe('SELECT 1 AS ok FROM pg_database WHERE datname = $1 LIMIT 1', [databaseName]);
  return Boolean(rows[0]?.ok);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help !== undefined) {
    printUsage();
    return;
  }
  const adminUrl = String(flags['admin-url'] || process.env.PORTAL_PG_ADMIN_URL || '').trim();
  if (!adminUrl) {
    printUsage();
    throw new Error('Missing --admin-url or PORTAL_PG_ADMIN_URL');
  }

  const parsedAdminUrl = new URL(adminUrl);
  const database = slugify(flags.database || process.env.PORTAL_PG_DATABASE || 'autoblog_portal');
  const user = slugify(flags.user || process.env.PORTAL_PG_USER || database);
  const password = String(flags.password || process.env.PORTAL_PG_PASSWORD || generatePassword(32));
  const host = String(flags.host || process.env.PORTAL_PG_HOST || parsedAdminUrl.hostname || '127.0.0.1').trim();
  const port = String(flags.port || process.env.PORTAL_PG_PORT || parsedAdminUrl.port || '5432').trim();
  const updatePassword = asBool(flags['update-password'], false);
  const writeEnv = String(flags['write-env'] || '').trim();

  const adminSql = postgres(adminUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 10,
    connect_timeout: 10,
    onnotice: () => {}
  });

  try {
    const hasRole = await roleExists(adminSql, user);
    if (!hasRole) {
      await adminSql.unsafe(
        `CREATE ROLE ${quoteIdentifier(user)} LOGIN PASSWORD ${quoteLiteral(password)}`
      );
    } else if (updatePassword) {
      await adminSql.unsafe(
        `ALTER ROLE ${quoteIdentifier(user)} WITH LOGIN PASSWORD ${quoteLiteral(password)}`
      );
    }

    const hasDatabase = await databaseExists(adminSql, database);
    if (!hasDatabase) {
      await adminSql.unsafe(
        `CREATE DATABASE ${quoteIdentifier(database)} OWNER ${quoteIdentifier(user)}`
      );
    } else {
      await adminSql.unsafe(
        `ALTER DATABASE ${quoteIdentifier(database)} OWNER TO ${quoteIdentifier(user)}`
      );
    }
  } finally {
    await adminSql.end();
  }

  const targetUrl = `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  const targetSql = postgres(targetUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 10,
    connect_timeout: 10,
    onnotice: () => {}
  });

  try {
    await targetSql.unsafe(`GRANT ALL ON SCHEMA public TO ${quoteIdentifier(user)}`);
    await targetSql.unsafe(`ALTER SCHEMA public OWNER TO ${quoteIdentifier(user)}`);
    await targetSql.unsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${quoteIdentifier(user)}`
    );
    await targetSql.unsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${quoteIdentifier(user)}`
    );
    await targetSql.unsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${quoteIdentifier(user)}`
    );
  } finally {
    await targetSql.end();
  }

  const writtenEnvPath = writeEnv ? writePortalEnv(writeEnv, targetUrl) : '';

  console.log(
    JSON.stringify(
      {
        ok: true,
        admin: describeUrl(adminUrl),
        database,
        user,
        passwordGenerated: !Boolean(flags.password || process.env.PORTAL_PG_PASSWORD),
        databaseUrl: targetUrl,
        envFileUpdated: writtenEnvPath || ''
      },
      null,
      2
    )
  );
}

try {
  await main();
} catch (error) {
  const message =
    error instanceof Error
      ? error.message || JSON.stringify(error, Object.getOwnPropertyNames(error))
      : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
}
