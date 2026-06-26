export type StoryStatus = 'pending' | 'image_done' | 'video_done' | 'published';

export interface Story {
  story_id: string;
  headline: string;
  tone: 'absurd' | 'political' | 'wholesome';
  meme_score: number;
  status: StoryStatus;
  image_url: string;
  video_url: string;
  output_url: string;
  caption_top: string;
  caption_bottom: string;
  created_at: string;
}

export interface DashboardStatus {
  source: 'kv' | 'local';
  kv_connected: boolean;
  budget_usd: number;
  spend_usd: number;
  pending_count: number;
  published_count: number;
  counts: Record<StoryStatus, number>;
  total_stories: number;
  updated_at: string;
}

export interface RunAResult {
  crawled: number;
  deduped: number;
  considered: number;
  enqueued: number;
  story_ids: string[];
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const fetchStatus = () => api<DashboardStatus>('/api/status');
export const fetchStories = () =>
  api<{ stories: Story[]; source: 'kv' | 'local' }>('/api/stories');

export const triggerRunA = (dry: boolean) =>
  api<RunAResult>('/api/run-a', {
    method: 'POST',
    body: JSON.stringify({ dry }),
  });

export const triggerRunB = () =>
  api<{ ok: boolean; message: string }>('/api/run-b', { method: 'POST' });