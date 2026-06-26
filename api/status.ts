import { getDailySpend } from '../shared/cost_tracker';
import { listAll, listPending } from '../shared/queue';
import { listLocalOutput } from '../shared/local_output';
import type { PromptPackage, Status } from '../shared/types';

function budgetUsd(): number {
  const parsed = Number(process.env.DAILY_VIDEO_BUDGET_USD ?? '5');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

function countByStatus(stories: PromptPackage[]): Record<Status, number> {
  return stories.reduce(
    (acc, s) => {
      acc[s.status] += 1;
      return acc;
    },
    { pending: 0, image_done: 0, video_done: 0, published: 0 },
  );
}

export async function GET(): Promise<Response> {
  let stories: PromptPackage[] = [];
  let source: 'kv' | 'local' = 'kv';
  let kvConnected = true;

  try {
    stories = await listAll();
    if (stories.length === 0) {
      const local = await listLocalOutput();
      if (local.length > 0) {
        stories = local;
        source = 'local';
      }
    }
  } catch {
    kvConnected = false;
    stories = await listLocalOutput();
    source = 'local';
  }

  let pendingIds: string[] = [];
  try {
    pendingIds = await listPending();
  } catch {
    pendingIds = stories.filter((s) => s.status !== 'published').map((s) => s.story_id);
  }

  let spendUsd = 0;
  try {
    spendUsd = await getDailySpend();
  } catch {
    spendUsd = 0;
  }

  const counts = countByStatus(stories);

  return Response.json(
    {
      source,
      kv_connected: kvConnected,
      budget_usd: budgetUsd(),
      spend_usd: spendUsd,
      pending_count: pendingIds.length,
      published_count: counts.published,
      counts,
      total_stories: stories.length,
      updated_at: new Date().toISOString(),
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}