import { randomUUID } from 'node:crypto';
import type { PromptPackage, ScoredStory, Tone } from '../shared/types';

const TONES: Tone[] = ['absurd', 'political', 'wholesome'];

interface MemeConcept {
  headline: string;
  punchline: string;
  tone: Tone;
  entities: string[];
  meme_score: number;
  caption_top: string;
  caption_bottom: string;
  voiceover_script: string;
  image_prompt: string;
  motion_prompt: string;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

async function callLlm(system: string, user: string): Promise<string> {
  const key = process.env.LLM_API_KEY;
  const base = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!key || !base || !model) throw new Error('LLM_API_KEY / LLM_BASE_URL / LLM_MODEL not set');

  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.95,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0].message.content;
}

function parseConcept(raw: string): MemeConcept {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const obj = JSON.parse(cleaned) as Partial<MemeConcept>;
  const tone: Tone = TONES.includes(obj.tone as Tone) ? (obj.tone as Tone) : 'absurd';
  if (!obj.punchline || !obj.image_prompt) throw new Error('meme concept missing required fields');

  return {
    headline: String(obj.headline ?? 'Today\'s news dump'),
    punchline: String(obj.punchline),
    tone,
    entities: Array.isArray(obj.entities) ? obj.entities.slice(0, 6).map(String) : [],
    meme_score: Math.max(8, Math.min(10, Math.round(Number(obj.meme_score) || 9))),
    caption_top: truncate(String(obj.caption_top ?? 'BREAKING'), 60),
    caption_bottom: truncate(String(obj.caption_bottom ?? obj.punchline ?? ''), 60),
    voiceover_script: truncate(String(obj.voiceover_script ?? obj.punchline), 200),
    image_prompt: String(obj.image_prompt),
    motion_prompt: String(obj.motion_prompt ?? 'chaotic zoom with meme energy, quick punch-in'),
  };
}

/** Fuse 5 related headlines into one maximally funny meme package. */
export async function synthesizeMemeFromFive(
  stories: ScoredStory[],
  theme: string,
): Promise<PromptPackage> {
  const headlines = stories.map((s, i) => `${i + 1}. ${s.title}`).join('\n');

  const system = `You are an unhinged meme director. Given 5 RELATED news headlines, create ONE
mega-meme that connects them into a single devastatingly funny joke. MAXIMUM humor — absurd,
relatable, internet-brained, punchy. Think "everything is on fire and we're all raccoons in suits."

Return ONLY valid JSON:
{
  "headline": string,
  "punchline": string,
  "tone": "absurd" | "political" | "wholesome",
  "entities": string[],
  "meme_score": number,
  "caption_top": string,
  "caption_bottom": string,
  "voiceover_script": string,
  "image_prompt": string,
  "motion_prompt": string
}

image_prompt: vivid surreal meme scene, 1:1, high detail, no text in image.
captions: Impact-font energy, ALL CAPS, <= 60 chars each.
voiceover_script: deadpan narrator delivering the joke, <= 200 chars.`;

  const user = `Theme: ${theme}\n\nHeadlines:\n${headlines}\n\nMake it SUPER funny.`;

  let raw = await callLlm(system, user);
  let concept: MemeConcept;
  try {
    concept = parseConcept(raw);
  } catch {
    raw = await callLlm(system, `${user}\n\nReturn ONLY the JSON object.`);
    concept = parseConcept(raw);
  }

  return {
    story_id: randomUUID(),
    headline: concept.headline,
    tone: concept.tone,
    meme_score: concept.meme_score,
    image_prompt: `${concept.image_prompt}. Surreal absurdist meme art, exaggerated expressions, vivid colors.`,
    motion_prompt: concept.motion_prompt,
    caption_top: concept.caption_top,
    caption_bottom: concept.caption_bottom,
    voiceover_script: concept.voiceover_script,
    status: 'pending',
    image_url: '',
    video_url: '',
    output_url: '',
    created_at: new Date().toISOString(),
    source_headlines: stories.map((s) => s.title),
  };
}