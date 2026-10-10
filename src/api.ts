import { parseSearch, validateSearch } from '../shared/search';
import { DEFAULT_SETTINGS, type SavedSearch, type Item, type NotchAPI, type Settings } from '../shared/types';

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
  items = items.map(item => ({ ...item, archivedAt: item.archivedAt ?? null, deletedAt: item.deletedAt ?? null }));
  let saved: SavedSearch[];
  try { saved = JSON.parse(localStorage.getItem('notch-preview-searches') ?? '[]'); } catch { saved = []; }
  let settings = { ...DEFAULT_SETTINGS };
  const listeners = new Set<() => void>();
  const notify = () => { localStorage.setItem(key, JSON.stringify(items)); localStorage.setItem('notch-preview-searches', JSON.stringify(saved)); listeners.forEach(fn => fn()); };
  const unavailable = async () => { throw new Error('This is the browser preview. Use the desktop app for AI, system tray, and file operations.'); };
  return {
    async search(input) {
      const {query, eligible} = parseSearch(validateSearch(input));
      const {sort} = input;
      const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
      return items.filter(eligible).map(item => {
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
      if (existing) { existing.deletedAt = null; existing.archivedAt = null; existing.description = input.description.trim(); existing.updatedAt = new Date().toISOString(); notify(); return { item: existing, duplicate: true }; }
      const kind = /^https?:/i.test(locator) ? 'link' : /\.[a-z0-9]+$/i.test(locator) ? 'file' : 'folder';
      const item: Item = { archivedAt: null, deletedAt: null, id: crypto.randomUUID(), locator, title: kind === 'link' ? new URL(locator).hostname : locator.split(/[\\/]/).filter(Boolean).at(-1)!, description: input.description.trim(), kind, tags: input.tags ?? [], keywords: [], summary: '', favorite: false, status: 'local', error: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), embedding: null, embeddingModel: null };
      items.unshift(item); notify(); return { item, duplicate: false };
    },
    async stats() {
      const active = items.filter(i => !i.archivedAt && !i.deletedAt);
      return { total: active.length, links: active.filter(i => i.kind === 'link').length, folders: active.filter(i => i.kind === 'folder').length, files: active.filter(i => i.kind === 'file').length, favorites: active.filter(i => i.favorite).length, enriched: 0, indexing: 0, errors: 0, archived: items.filter(i => i.archivedAt && !i.deletedAt).length, trash: items.filter(i => i.deletedAt).length, tags: [...new Set(active.flatMap(i => i.tags))].sort() };
    },
    async favorite(id) { const item = items.find(i => i.id === id); if (item) item.favorite = !item.favorite; notify(); },
    async remove(id) { const item = items.find(i => i.id === id); if (item) item.deletedAt = new Date().toISOString(); notify(); },
    async restore(id) { const item = items.find(i => i.id === id); if (item) { item.deletedAt = null; item.archivedAt = null; } notify(); },
    async archive(id) { const item = items.find(i => i.id === id); if (item) item.archivedAt = item.archivedAt ? null : new Date().toISOString(); notify(); },
    async edit(id, input) {
      const item = items.find(i => i.id === id);
      if (!item || item.deletedAt) throw new Error('Restore the item before editing.');
      if (!input.title.trim() || !input.description.trim()) throw new Error('Add a title and description.');
      if (items.some(i => i.id !== id && i.locator === input.locator.trim())) throw new Error('That link or path is already saved.');
      if (item.kind === 'link') { const url = new URL(input.locator); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use a safe http or https link.'); }
      else if (!/^(?:[a-z]:[\\/]|\\\\|\/)/i.test(input.locator)) throw new Error('Use an absolute path.');
      Object.assign(item, { title: input.title.trim(), locator: input.locator.trim(), description: input.description.trim(), tags: input.tags ?? [], kind: input.kind ?? item.kind, updatedAt: new Date().toISOString() }); notify(); return item;
    },
    async related(id) {
      const source = items.find(i => i.id === id);
      return items.filter(i => i.id !== id && !i.deletedAt && !i.archivedAt).map(i => ({ ...i, reasons: i.tags.filter(t => source?.tags.includes(t)).map(t => `Shared tag: #${t}`) })).filter(i => i.reasons.length).sort((a,b) => b.reasons.length-a.reasons.length).slice(0,5);
    },
    async savedSearches() { return saved; },
    async saveSearch(name, input) {
      if (!name.trim() || name.length > 60 || saved.length >= 40) throw new Error('Use a short name; you can keep up to 40 searches.');
      const entry = {id: crypto.randomUUID(), name: name.trim(), input: validateSearch(input), createdAt: new Date().toISOString()}; saved.push(entry); notify(); return entry;
    },
    async deleteSearch(id) { saved = saved.filter(s => s.id !== id); notify(); },
    retryFailed: unavailable,
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
function examples(): Item[] { return exampleItems.map((item, i) => ({ archivedAt: null, deletedAt: null, id: `demo-${i}`, summary: '', keywords: [], tags: [], favorite: false, status: 'local', error: '', embedding: null, embeddingModel: null, createdAt: new Date(Date.now() - i * 86400000).toISOString(), updatedAt: new Date().toISOString(), ...item } as Item)); }
export const api: NotchAPI = window.notch ?? demoAPI();
