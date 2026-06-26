import type { ScoredStory } from '../shared/types';

const RELATED_COUNT = 5;

interface PickResult {
  indices: number[];
  theme: string;
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
      temperature: 0.5,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0].message.content;
}

function parsePick(raw: string, max: number): PickResult {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const obj = JSON.parse(cleaned) as Partial<PickResult>;
  const indices = (Array.isArray(obj.indices) ? obj.indices : [])
    .map((n) => Number(n))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < max)
    .slice(0, RELATED_COUNT);
  if (indices.length < RELATED_COUNT) throw new Error('LLM returned fewer than 5 valid indices');
  return { indices, theme: String(obj.theme ?? 'today\'s chaos') };
}

/** Pick 5 thematically related stories from the crawled pool. */
export async function pickFiveRelated(stories: ScoredStory[]): Promise<{
  picked: ScoredStory[];
  theme: string;
}> {
  if (stories.length < RELATED_COUNT) {
    throw new Error(`need at least ${RELATED_COUNT} stories after dedup, got ${stories.length}`);
  }

  const pool = stories.slice(0, Math.min(25, stories.length));
  const list = pool.map((s, i) => `${i}. [${s.source}] ${s.title}`).join('\n');

  const system = `You pick news headlines that belong in the same meme. Return ONLY valid JSON:
{ "indices": [0,1,2,3,4], "theme": "short theme label" }
Pick exactly 5 indices that are thematically related — same crisis, same vibe, or hilariously connected.`;

  let raw = await callLlm(system, `Headlines:\n${list}`);
  let pick: PickResult;
  try {
    pick = parsePick(raw, pool.length);
  } catch {
    raw = await callLlm(
      system,
      `Headlines:\n${list}\n\nReturn ONLY JSON with exactly 5 indices from 0-${pool.length - 1}.`,
    );
    pick = parsePick(raw, pool.length);
  }

  return {
    picked: pick.indices.map((i) => pool[i]),
    theme: pick.theme,
  };
}