import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const storyId = String(req.query.storyId ?? '');
  const file = String(req.query.file ?? '');
  if (!storyId || !file || storyId.includes('..') || file.includes('..')) {
    return res.status(400).json({ error: 'invalid_path' });
  }

  const path = join(process.cwd(), 'output', storyId, file);
  try {
    await access(path);
  } catch {
    return res.status(404).json({ error: 'not_found' });
  }

  const ext = extname(file).toLowerCase();
  res.setHeader('content-type', MIME[ext] ?? 'application/octet-stream');
  res.setHeader('cache-control', 'public, max-age=60');
  createReadStream(path).pipe(res);
}