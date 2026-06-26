import { crawl } from '../data/crawler';
import { dedupAndScore } from '../data/dedup';
import { pickFiveRelated } from '../data/pick_related';
import { searchNews } from '../data/search_news';
import { synthesizeMemeFromFive } from '../data/meme_synthesizer';
import { enqueue } from '../shared/queue';
import type { ScoredStory } from '../shared/types';
import { processStoryToCompletion } from './pipeline';

export interface GenerateMemeOptions {
  query?: string;
  stories?: ScoredStory[];
}

export interface GenerateMemeResult {
  story_id: string;
  headline: string;
  theme: string;
  source_headlines: string[];
  status: 'published' | 'failed';
  output_url?: string;
  error?: string;
}

/** Crawl/search → 5 related headlines → one mega-meme → MiniMax image/video/TTS. */
export async function generateMeme(options: GenerateMemeOptions = {}): Promise<GenerateMemeResult> {
  const query = options.query?.trim();
  let picked;
  let theme: string;

  if (options.stories && options.stories.length >= 5) {
    console.log(`▶ [generate-meme] use ${options.stories.length} previewed stories`);
    picked = options.stories.slice(0, 5);
    theme = query || 'selected headlines';
  } else if (query) {
    console.log(`▶ [generate-meme] search news for "${query}"`);
    const search = await searchNews(query);
    picked = search.stories;
    theme = query;
  } else {
    console.log('▶ [generate-meme] crawl');
    const raw = await crawl();
    const deduped = dedupAndScore(raw);

    console.log('▶ [generate-meme] pick 5 related');
    const related = await pickFiveRelated(deduped);
    picked = related.picked;
    theme = related.theme;
  }

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
