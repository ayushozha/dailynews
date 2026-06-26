import { listAll } from '../shared/queue';
import { listLocalOutput } from '../shared/local_output';
import type { PromptPackage } from '../shared/types';

async function loadStories(): Promise<{ stories: PromptPackage[]; source: 'kv' | 'local' }> {
  try {
    const stories = await listAll();
    if (stories.length > 0) return { stories, source: 'kv' };
  } catch {
    // KV not configured — fall back to local ./output
  }
  return { stories: await listLocalOutput(), source: 'local' };
}

export async function GET(): Promise<Response> {
  const payload = await loadStories();
  return Response.json(payload, {
    headers: { 'cache-control': 'no-store' },
  });
}