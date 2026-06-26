import { waitUntil } from '@vercel/functions';
import { generateMeme } from '../generation/generate_meme';

export async function POST(request: Request): Promise<Response> {
  let query: string | undefined;
  try {
    const body = (await request.json()) as { query?: string };
    query = body.query?.trim();
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
    generateMeme({ query })
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