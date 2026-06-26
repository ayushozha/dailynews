import { listAll } from '../shared/queue';
import { listLocalOutput } from '../shared/local_output';
import type { PromptPackage } from '../shared/types';

async function loadStories(): Promise<{ stories: PromptPackage[]; source: 'kv' | 'local' }> {
  const hasKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  try {
    const stories = await listAll();
    if (stories.length > 0) return { stories, source: hasKv ? 'kv' : 'local' };
  } catch {
    // fall through
  }
  const local = await listLocalOutput();
  if (local.length > 0) return { stories: local, source: 'local' };
  return { stories: [], source: hasKv ? 'kv' : 'local' };
}

export async function GET(): Promise<Response> {
  const payload = await loadStories();
  return Response.json(payload, {
    headers: { 'cache-control': 'no-store' },
  });
}