import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const payloadSchema = z.object({
  type: z.enum(['article', 'category', 'site']),
  slug: z.string().optional(),
  paths: z.array(z.string()).optional()
});

function computePaths(payload: z.infer<typeof payloadSchema>) {
  if (payload.paths?.length) return payload.paths;
  if (payload.type === 'site') return ['/', '/categories'];
  if (!payload.slug) return ['/'];
  if (payload.type === 'article') {
    return ['/', '/categories', `/articles/${payload.slug}`];
  }
  return ['/', '/categories', `/categories/${payload.slug}`];
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret') || request.nextUrl.searchParams.get('secret');

  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Invalid payload', issues: parsed.error.flatten() }, { status: 400 });
  }

  const revalidatedPaths = Array.from(new Set(computePaths(parsed.data)));
  for (const path of revalidatedPaths) {
    revalidatePath(path);
  }

  return NextResponse.json({
    ok: true,
    revalidatedPaths,
    timestamp: new Date().toISOString()
  });
}
