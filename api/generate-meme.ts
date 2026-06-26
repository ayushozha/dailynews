import { waitUntil } from '@vercel/functions';
import { generateMeme } from '../generation/generate_meme';
import type { ScoredStory } from '../shared/types';

function normalizeStories(value: unknown): ScoredStory[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const stories = value
    .slice(0, 5)
    .map((story) => {
      const s = story && typeof story === 'object' ? (story as Partial<ScoredStory>) : {};
      return {
        title: String(s.title ?? '').slice(0, 300),
        url: String(s.url ?? '').slice(0, 1000),
        source: String(s.source ?? 'preview').slice(0, 80),
        published_at: String(s.published_at ?? new Date().toISOString()).slice(0, 80),
        summary: String(s.summary ?? '').slice(0, 1000),
        relevance: Number.isFinite(Number(s.relevance)) ? Number(s.relevance) : 0,
      };
    })
    .filter((story) => story.title && story.url);

  return stories.length >= 5 ? stories : undefined;
}

export async function POST(request: Request): Promise<Response> {
  let query: string | undefined;
  let stories: ScoredStory[] | undefined;
  try {
    const body = (await request.json()) as { query?: string; stories?: unknown };
    query = body.query?.trim();
    stories = normalizeStories(body.stories);
  } catch {
    /* empty body */
  }

  if (!query) {
    return Response.json(
      {
        error: 'query_required',
        message: 'Pass { "query": "your topic" } to scrape 5 live headlines first.',
      },
      { status: 400 },
    );
  }

  waitUntil(
    generateMeme({ query, stories })
      .then((result) => {
        console.log(JSON.stringify({ ts: new Date().toISOString(), stage: 'generate-meme', ...result }));
      })
      .catch((error) => {
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            stage: 'generate-meme',
            status: 'error',
            detail: error instanceof Error ? error.message : 'unknown_error',
          }),
        );
      }),
  );

  return Response.json(
    {
      ok: true,
      query,
      message: `Scraping 5 live headlines for "${query}" and cooking a mega-meme with MiniMax…`,
      steps: ['search', 'synthesize', 'image', 'video', 'voiceover'],
    },
    { status: 202 },
  );
}
