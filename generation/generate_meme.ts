import { crawl } from '../data/crawler';
import { dedupAndScore } from '../data/dedup';
import { pickFiveRelated } from '../data/pick_related';
import { synthesizeMemeFromFive } from '../data/meme_synthesizer';
import { enqueue } from '../shared/queue';
import { processStoryToCompletion } from './pipeline';

export interface GenerateMemeResult {
  story_id: string;
  headline: string;
  theme: string;
  source_headlines: string[];
  status: 'published' | 'failed';
  output_url?: string;
  error?: string;
}

/** Crawl → 5 related headlines → one mega-meme → MiniMax image/video/TTS. */
export async function generateMeme(): Promise<GenerateMemeResult> {
  console.log('▶ [generate-meme] crawl');
  const raw = await crawl();
  const deduped = dedupAndScore(raw);

  console.log('▶ [generate-meme] pick 5 related');
  const { picked, theme } = await pickFiveRelated(deduped);

  console.log('▶ [generate-meme] synthesize funny meme');
  const pkg = await synthesizeMemeFromFive(picked, theme);
  pkg.source_headlines = picked.map((s) => s.title);

  console.log('▶ [generate-meme] generate with MiniMax');
  await enqueue(pkg);
  const result = await processStoryToCompletion(pkg.story_id);

  return {
    story_id: pkg.story_id,
    headline: pkg.headline,
    theme,
    source_headlines: pkg.source_headlines,
    status: result.status === 'published' ? 'published' : 'failed',
    output_url: result.output_url || undefined,
    error: result.error,
  };
}