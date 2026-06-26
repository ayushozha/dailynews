import { crawlByQuery } from './crawler';
import { dedupAndScore } from './dedup';
import type { ScoredStory } from '../shared/types';

export const NEWS_PICK_COUNT = 5;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function queryMatchScore(story: ScoredStory, query: string): number {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return 0;
  const docTokens = new Set(tokenize(`${story.title} ${story.summary}`));
  const hits = qTokens.filter((t) => docTokens.has(t)).length;
  return hits / qTokens.length;
}

/** Scrape live news for a query and return exactly 5 deduped, relevance-ranked stories. */
export async function searchNews(query: string): Promise<{
  query: string;
  stories: ScoredStory[];
  sources_used: string[];
}> {
  const trimmed = query.trim();
  if (!trimmed) throw new Error('query is required');

  const raw = await crawlByQuery(trimmed);
  if (raw.length === 0) {
    throw new Error(`No headlines found for "${trimmed}". Try a broader topic.`);
  }

  const deduped = dedupAndScore(raw);
  const ranked = deduped
    .map((s) => ({
      ...s,
      relevance: s.relevance * 0.6 + queryMatchScore(s, trimmed) * 0.4,
    }))
    .sort((a, b) => b.relevance - a.relevance);

  const stories = ranked.slice(0, NEWS_PICK_COUNT);
  if (stories.length < NEWS_PICK_COUNT) {
    throw new Error(
      `Only found ${stories.length} unique stories for "${trimmed}". Try a broader search.`,
    );
  }

  const sources_used = [...new Set(stories.map((s) => s.source))];
  return { query: trimmed, stories, sources_used };
}
