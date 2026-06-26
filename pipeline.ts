/**
 * Meme Video Agent — v0 single-file pipeline.
 *
 * Run:  npx tsx pipeline.ts
 * Flow: NewsAPI headlines -> LLM prompt packages -> per story:
 *       MiniMax Image -> sharp captions -> MiniMax Hailuo video -> Vapi TTS -> ffmpeg merge.
 *
 * Endpoint assumptions you may need to adjust for YOUR accounts (left as constants below):
 *   - MINIMAX_BASE uses the international host (api.minimaxi.chat). Use api.minimax.chat for China.
 *   - Hailuo video generation is async: submit -> poll task -> retrieve file download url.
 *   - Vapi has no public "text -> mp3" REST endpoint. VAPI_TTS_URL is a placeholder; point it at
 *     whatever TTS you use. The code accepts either raw audio bytes or a JSON {url} response.
 *   - ffmpeg: spec asked for @ffmpeg/ffmpeg WASM, but that package does not run in Node (browser
 *     only). We use ffmpeg-static (an npm-installed binary) instead — no system ffmpeg required.
 */

import 'dotenv/config';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';

const execFileAsync = promisify(execFile);

// ---------- config ----------
const {
  NEWS_API_KEY,
  LLM_API_KEY,
  LLM_BASE_URL,
  LLM_MODEL,
  MINIMAX_API_KEY,
  VAPI_API_KEY,
} = process.env;

const MINIMAX_BASE = 'https://api.minimaxi.chat/v1';
const VAPI_TTS_URL = 'https://api.vapi.ai/tts'; // placeholder — adjust to your TTS provider
const OUTPUT_DIR = join(process.cwd(), 'output');

interface PromptPackage {
  story_id: string;
  headline: string;
  image_prompt: string;
  motion_prompt: string;
  caption_top: string;
  caption_bottom: string;
  voiceover_script: string;
}

// ---------- tiny helpers ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function requireEnv(name: string, val: string | undefined): string {
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'story';
}

async function downloadTo(url: string, path: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path, buf);
}

// ---------- step 1: headlines ----------
async function getHeadlines(): Promise<string[]> {
  const key = requireEnv('NEWS_API_KEY', NEWS_API_KEY);
  const url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=5&apiKey=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NewsAPI ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { articles?: { title: string }[] };
  const headlines = (json.articles ?? []).map((a) => a.title).filter(Boolean).slice(0, 5);
  if (headlines.length === 0) throw new Error('NewsAPI returned no headlines');
  return headlines;
}

// ---------- step 2: LLM prompt packages ----------
async function generatePackages(headlines: string[]): Promise<PromptPackage[]> {
  const key = requireEnv('LLM_API_KEY', LLM_API_KEY);
  const base = requireEnv('LLM_BASE_URL', LLM_BASE_URL);
  const model = requireEnv('LLM_MODEL', LLM_MODEL);

  const prompt = `You are a meme creator. Given these 5 news headlines, return a JSON array
of 5 prompt packages. Each package must have: story_id, headline,
image_prompt, motion_prompt, caption_top, caption_bottom, voiceover_script.
Return only valid JSON. No prose, no markdown fences.

Headlines:
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}`;

  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  let content = json.choices[0].message.content.trim();
  // strip accidental ```json fences
  content = content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const packages = JSON.parse(content) as PromptPackage[];
  // normalize story_id into a safe slug
  return packages.map((p) => ({ ...p, story_id: slugify(p.story_id || p.headline) }));
}

// ---------- step 3a: MiniMax image ----------
async function generateImage(pkg: PromptPackage, outPath: string): Promise<void> {
  const key = requireEnv('MINIMAX_API_KEY', MINIMAX_API_KEY);
  const res = await fetch(`${MINIMAX_BASE}/image_generation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'image-01',
      prompt: pkg.image_prompt,
      aspect_ratio: '1:1',
      response_format: 'url',
      n: 1,
      prompt_optimizer: true,
    }),
  });
  if (!res.ok) throw new Error(`MiniMax image ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data?: { image_urls?: string[] } };
  const imageUrl = json.data?.image_urls?.[0];
  if (!imageUrl) throw new Error(`MiniMax image: no url in response: ${JSON.stringify(json)}`);
  await downloadTo(imageUrl, outPath);
}

// ---------- step 3b: caption overlay (sharp) ----------
function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!),
  );
}

async function addCaptions(basePath: string, pkg: PromptPackage, outPath: string): Promise<void> {
  const size = 1024;
  const fontSize = 64;
  const textStyle =
    `font-family="Impact, 'Arial Black', sans-serif" font-size="${fontSize}" ` +
    `font-weight="bold" fill="white" stroke="black" stroke-width="3" ` +
    `text-anchor="middle" paint-order="stroke"`;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <text x="${size / 2}" y="90" ${textStyle}>${escapeXml(pkg.caption_top.toUpperCase())}</text>
    <text x="${size / 2}" y="${size - 50}" ${textStyle}>${escapeXml(pkg.caption_bottom.toUpperCase())}</text>
  </svg>`;

  await sharp(basePath)
    .resize(size, size, { fit: 'cover' })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(outPath);
}

// ---------- step 3c: MiniMax Hailuo video (async) ----------
async function generateVideo(pkg: PromptPackage, imagePath: string, outPath: string): Promise<void> {
  const key = requireEnv('MINIMAX_API_KEY', MINIMAX_API_KEY);
  const imgB64 = (await readFile(imagePath)).toString('base64');

  // submit
  const submit = await fetch(`${MINIMAX_BASE}/video_generation`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'I2V-01',
      prompt: pkg.motion_prompt,
      first_frame_image: `data:image/png;base64,${imgB64}`,
    }),
  });
  if (!submit.ok) throw new Error(`Hailuo submit ${submit.status}: ${await submit.text()}`);
  const { task_id } = (await submit.json()) as { task_id?: string };
  if (!task_id) throw new Error('Hailuo: no task_id returned');

  // poll
  let fileId: string | undefined;
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const q = await fetch(`${MINIMAX_BASE}/query/video_generation?task_id=${task_id}`, {
      headers: { authorization: `Bearer ${key}` },
    });
    if (!q.ok) throw new Error(`Hailuo query ${q.status}: ${await q.text()}`);
    const status = (await q.json()) as { status?: string; file_id?: string };
    process.stdout.write(`        ...video ${status.status ?? 'unknown'}\r`);
    if (status.status === 'Success') {
      fileId = status.file_id;
      break;
    }
    if (status.status === 'Fail') throw new Error('Hailuo: generation failed');
  }
  if (!fileId) throw new Error('Hailuo: timed out waiting for video');

  // retrieve download url
  const f = await fetch(`${MINIMAX_BASE}/files/retrieve?file_id=${fileId}`, {
    headers: { authorization: `Bearer ${key}` },
  });
  if (!f.ok) throw new Error(`Hailuo file retrieve ${f.status}: ${await f.text()}`);
  const fileJson = (await f.json()) as { file?: { download_url?: string } };
  const downloadUrl = fileJson.file?.download_url;
  if (!downloadUrl) throw new Error('Hailuo: no download_url');
  await downloadTo(downloadUrl, outPath);
}

// ---------- step 3d: Vapi TTS ----------
async function generateVoiceover(pkg: PromptPackage, outPath: string): Promise<void> {
  const key = requireEnv('VAPI_API_KEY', VAPI_API_KEY);
  const res = await fetch(VAPI_TTS_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ text: pkg.voiceover_script }),
  });
  if (!res.ok) throw new Error(`Vapi TTS ${res.status}: ${await res.text()}`);

  // Accept either raw audio bytes or a JSON {url}/{audioUrl} response.
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const json = (await res.json()) as { url?: string; audioUrl?: string };
    const url = json.url ?? json.audioUrl;
    if (!url) throw new Error(`Vapi TTS: no audio url in response: ${JSON.stringify(json)}`);
    await downloadTo(url, outPath);
  } else {
    await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
  }
}

// ---------- step 3e: merge audio + video ----------
async function mergeAudioVideo(clipPath: string, voPath: string, outPath: string): Promise<void> {
  if (!ffmpegPath) throw new Error('ffmpeg-static binary not found');
  await execFileAsync(ffmpegPath, [
    '-y',
    '-i', clipPath,
    '-i', voPath,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    outPath,
  ]);
}

// ---------- orchestration ----------
async function main() {
  console.log('▶ Fetching headlines from NewsAPI...');
  const headlines = await getHeadlines();
  headlines.forEach((h, i) => console.log(`   ${i + 1}. ${h}`));

  console.log('\n▶ Generating prompt packages with LLM...');
  const packages = await generatePackages(headlines);
  console.log(`   got ${packages.length} packages`);

  let succeeded = 0;
  for (const pkg of packages) {
    const dir = join(OUTPUT_DIR, pkg.story_id);
    console.log(`\n=== ${pkg.story_id} :: ${pkg.headline} ===`);
    try {
      await mkdir(dir, { recursive: true });

      console.log('   [1/5] MiniMax image...');
      await generateImage(pkg, join(dir, 'base.png'));

      console.log('   [2/5] captions (sharp)...');
      await addCaptions(join(dir, 'base.png'), pkg, join(dir, 'captioned.png'));

      console.log('   [3/5] Hailuo video (async, polling)...');
      await generateVideo(pkg, join(dir, 'captioned.png'), join(dir, 'clip.mp4'));
      console.log('   ...video done            ');

      console.log('   [4/5] Vapi voiceover...');
      await generateVoiceover(pkg, join(dir, 'vo.mp3'));

      console.log('   [5/5] ffmpeg merge...');
      await mergeAudioVideo(join(dir, 'clip.mp4'), join(dir, 'vo.mp3'), join(dir, 'final.mp4'));

      console.log(`   ✔ done -> ${join(dir, 'final.mp4')}`);
      succeeded++;
    } catch (err) {
      console.error(`   x FAILED [${pkg.story_id}]: ${(err as Error).message}`);
      continue;
    }
  }

  console.log(`\n▶ Finished: ${succeeded}/${packages.length} final.mp4 files in ./output/`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
