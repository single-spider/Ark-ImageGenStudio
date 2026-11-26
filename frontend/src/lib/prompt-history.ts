export interface PromptEntry { prompt: string; model: string; ratio: string; resolution?: string; createdAt: string; thumb?: string; }
const KEY='ark-submitted-prompts-v1';
export function readPromptHistory(): PromptEntry[] {
  try { const data=JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(data)?data.filter(e=>typeof e?.prompt==='string' && typeof e?.createdAt==='string'):[]; } catch { return []; }
}
export function recordPrompt(entry: PromptEntry) {
  try { localStorage.setItem(KEY,JSON.stringify([entry,...readPromptHistory()].slice(0,300))); } catch { /* Generation must work even without storage. */ }
}
