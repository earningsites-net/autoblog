#!/usr/bin/env node

/**
 * Simulate monthly burn and publish quota throttling.
 * Usage: node scripts/budget-simulator.mjs <spentUsd> [capUsd=100]
 */

const spent = Number(process.argv[2] || 0);
const cap = Number(process.argv[3] || 100);

if (!Number.isFinite(spent) || !Number.isFinite(cap) || cap <= 0) {
  console.error('Invalid numbers');
  process.exit(1);
}

const ratio = spent / cap;
let budgetMode = 'normal';
let publishQuota = 8;

if (ratio >= 1) {
  budgetMode = 'stop';
  publishQuota = 0;
} else if (ratio >= 0.85) {
  budgetMode = 'throttle';
  publishQuota = 4;
} else if (ratio >= 0.60) {
  budgetMode = 'economy';
  publishQuota = 6;
}

console.log(JSON.stringify({ spent, cap, ratio, budgetMode, publishQuota }, null, 2));
