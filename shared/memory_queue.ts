import type { PromptPackage } from './types';

const store = new Map<string, PromptPackage>();
const pending = new Set<string>();
const all = new Set<string>();

export const memoryQueue = {
  enqueue(pkg: PromptPackage) {
    store.set(pkg.story_id, pkg);
    pending.add(pkg.story_id);
    all.add(pkg.story_id);
  },
  get(id: string) {
    return store.get(id) ?? null;
  },
  update(id: string, patch: Partial<PromptPackage>) {
    const cur = store.get(id);
    if (!cur) throw new Error(`unknown story ${id}`);
    const next = { ...cur, ...patch };
    store.set(id, next);
    if (patch.status === 'published') pending.delete(id);
    return next;
  },
  listPending() {
    return [...pending];
  },
  listAll() {
    return [...all]
      .map((id) => store.get(id))
      .filter((p): p is PromptPackage => p != null)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
};