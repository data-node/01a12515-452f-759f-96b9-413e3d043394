import { DEFAULT_SETTINGS, type Item, type NotchAPI, type Settings } from '../shared/types';

declare global { interface Window { notch?: NotchAPI } }
export const isPreview = !window.notch;
const exampleItems: Partial<Item>[] = [
  { title: 'Claude workspace', locator: 'C:\\Projects\\Claude', description: 'The root folder for my Claude experiments. Prompts, agents, and everything I’m building with Claude live here.', kind: 'folder', tags: ['development', 'ai'], keywords: ['claude root folder', 'workspace', 'agents'], favorite: true },
  { title: 'Designing for the quiet moments', locator: 'https://linear.app/blog', description: 'Thoughtful product design, beautifully explained. A reference for interfaces that feel calm and get out of your way.', kind: 'link', tags: ['design', 'inspiration'], favorite: true },
  { title: 'SQLite documentation', locator: 'https://sqlite.org/fts5.html', description: 'Full-text search docs. Keep this close when working on BM25 ranking and our local search index.', kind: 'link', tags: ['development', 'reference'] },
  { title: 'Brand & visual identity', locator: 'C:\\Projects\\Notch\\Brand', description: 'All the Notch brand assets, typography explorations, and final icons. The source of truth for our visual identity.', kind: 'folder', tags: ['design', 'notch'] },
  { title: 'A little inspiration', locator: 'https://www.are.na', description: 'A place for collecting ideas. Interesting visual systems and small things worth returning to.', kind: 'link', tags: ['inspiration', 'design'] },
  { title: 'Product notes', locator: 'C:\\Projects\\Notch\\product-notes.md', description: 'The rough ideas, decisions, and next steps for Notch. Start here when picking up the project again.', kind: 'file', tags: ['notch', 'notes'] },
];
function demoAPI(): NotchAPI {
  const key = 'notch-preview-v1';
  const stored = localStorage.getItem(key);
  let items: Item[];
  try { items = stored ? JSON.parse(stored) : examples(); } catch { items = examples(); }
  let settings = { ...DEFAULT_SETTINGS };
  const listeners = new Set<() => void>();
  const notify = () => { localStorage.setItem(key, JSON.stringify(items)); listeners.forEach(fn => fn()); };
  const unavailable = async () => { throw new Error('This is the browser preview. Use the desktop app for AI, system tray, and file operations.'); };
  return {
    async search({ query, filter, tag, sort }) {
      const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
      return items.filter(item => (!filter || filter === 'all' || (filter === 'favorites' ? item.favorite : item.kind === filter)) && (!tag || item.tags.includes(tag))).map(item => {
        const haystack = `${item.title} ${item.locator} ${item.description} ${item.tags} ${item.keywords}`.toLowerCase();
        return { ...item, score: words.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0), match: query ? 'text' as const : 'recent' as const };
      }).filter(item => !query || item.score > 0).sort((a, b) => sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : sort === 'newest' || !query ? b.createdAt.localeCompare(a.createdAt) : b.score - a.score);
    },
    async capture(input) {
      const locator = input.locator.trim();
      if (!/^https?:\/\//i.test(locator) && !/^(?:[a-z]:[\\/]|\\\\|\/)/i.test(locator)) throw new Error('Use a full https:// link or an absolute folder path.');
      if (!input.description.trim()) throw new Error('Add a description so you can find this later.');
      if (/^https?:\/\//i.test(locator)) { const url = new URL(locator); if (url.username || url.password) throw new Error('Do not include credentials in links.'); }
      const existing = items.find(item => item.locator === locator);
      if (existing) { existing.description = input.description.trim(); existing.updatedAt = new Date().toISOString(); notify(); return { item: existing, duplicate: true }; }
      const kind = /^https?:/i.test(locator) ? 'link' : /\.[a-z0-9]+$/i.test(locator) ? 'file' : 'folder';
      const item: Item = { id: crypto.randomUUID(), locator, title: kind === 'link' ? new URL(locator).hostname : locator.split(/[\\/]/).filter(Boolean).at(-1)!, description: input.description.trim(), kind, tags: input.tags ?? [], keywords: [], summary: '', favorite: false, status: 'local', error: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), embedding: null, embeddingModel: null };
      items.unshift(item); notify(); return { item, duplicate: false };
    },
    async stats() { return { total: items.length, links: items.filter(i => i.kind === 'link').length, folders: items.filter(i => i.kind === 'folder').length, files: items.filter(i => i.kind === 'file').length, favorites: items.filter(i => i.favorite).length, enriched: 0, tags: [...new Set(items.flatMap(i => i.tags))].sort() }; },
    async favorite(id) { const item = items.find(i => i.id === id); if (item) item.favorite = !item.favorite; notify(); },
    async remove(id) { items = items.filter(i => i.id !== id); notify(); },
    async copy(text) { await navigator.clipboard.writeText(text); },
    async open(id) { const item = items.find(i => i.id === id); if (item?.kind === 'link') window.open(item.locator, '_blank', 'noopener,noreferrer'); else throw new Error('Open local paths in the Windows desktop app.'); },
    async settings() { return settings; },
    async saveSettings(input) { if (input.apiKey) throw new Error('API keys can only be saved in the desktop app.'); const { apiKey, ...rest } = input; settings = { ...settings, ...rest } as Settings; notify(); return settings; },
    testAI: unavailable, retry: unavailable, exportData: unavailable, importData: unavailable,
    async showCapture() {}, async showLibrary() {}, async hide() {}, async hideLibrary() {}, async minimize() {},
    onChanged(callback) { listeners.add(callback); return () => { listeners.delete(callback); }; },
    onCaptureOpened() { return () => {}; },
  };
}
function examples(): Item[] { return exampleItems.map((item, i) => ({ id: `demo-${i}`, summary: '', keywords: [], tags: [], favorite: false, status: 'local', error: '', embedding: null, embeddingModel: null, createdAt: new Date(Date.now() - i * 86400000).toISOString(), updatedAt: new Date().toISOString(), ...item } as Item)); }
export const api: NotchAPI = window.notch ?? demoAPI();
