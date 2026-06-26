import { access, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { PromptPackage } from './types';

const OUTPUT_DIR = join(process.cwd(), 'output');

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function listLocalOutput(): Promise<PromptPackage[]> {
  if (!(await exists(OUTPUT_DIR))) return [];

  const dirs = await readdir(OUTPUT_DIR, { withFileTypes: true });
  const stories: PromptPackage[] = [];

  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    const storyId = entry.name;
    const dir = join(OUTPUT_DIR, storyId);
    const hasFinal = await exists(join(dir, 'final.mp4'));
    const hasVideo = await exists(join(dir, 'clip.mp4'));
    const hasImage = await exists(join(dir, 'captioned.png')) || (await exists(join(dir, 'base.png')));
    const mtime = (await stat(hasFinal ? join(dir, 'final.mp4') : dir)).mtime.toISOString();

    let status: PromptPackage['status'] = 'pending';
    if (hasFinal) status = 'published';
    else if (hasVideo) status = 'video_done';
    else if (hasImage) status = 'image_done';

    stories.push({
      story_id: storyId,
      headline: storyId.replace(/-/g, ' '),
      tone: 'absurd',
      meme_score: 8,
      image_prompt: '',
      motion_prompt: '',
      caption_top: 'LOCAL',
      caption_bottom: 'PIPELINE',
      voiceover_script: '',
      status,
      image_url: hasImage
        ? `/api/local-asset?storyId=${encodeURIComponent(storyId)}&file=captioned.png`
        : '',
      video_url: hasVideo
        ? `/api/local-asset?storyId=${encodeURIComponent(storyId)}&file=clip.mp4`
        : '',
      output_url: hasFinal
        ? `/api/local-asset?storyId=${encodeURIComponent(storyId)}&file=final.mp4`
        : '',
      created_at: mtime,
    });
  }

  return stories.sort((a, b) => b.created_at.localeCompare(a.created_at));
}