import { waitUntil } from '@vercel/functions';
import { generateMeme } from '../generation/generate_meme';

export async function POST(): Promise<Response> {
  waitUntil(
    generateMeme()
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
      message: 'Fetching 5 related headlines and cooking a mega-meme with MiniMax…',
      steps: ['crawl', 'pick_related', 'synthesize', 'image', 'video', 'voiceover'],
    },
    { status: 202 },
  );
}