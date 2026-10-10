import type { CaptureInput, EditInput, SearchInput, Settings } from '../shared/types.js';
import { embed, enrichItem } from './ai.js';
import { parseSearch } from '../shared/search.js';
import { Store } from './store.js';

export class LibraryService {
  private versions = new Map<string, number>();
  private pending = new Map<string, number>();
  private workers = 0;
  private idleWaiters: (() => void)[] = [];
  constructor(readonly store: Store, private settings: () => Settings, private key: () => string | undefined, private changed: () => void) {}
  capture(input: CaptureInput) {
    const result = this.store.capture(input);
    this.changed();
    this.retry(result.item.id);
    return { ...result, item: this.store.get(result.item.id)! };
  }
  edit(id: string, input: EditInput) {
    const item = this.store.edit(id, input);
    this.retry(id);
    this.changed();
    return item;
  }
  retryFailed() {
    const items = this.store.all().filter(x => !x.deletedAt && !x.archivedAt && x.status === 'error');
    items.forEach(x => this.retry(x.id));
    return items.length;
  }
  retry(id: string) {
    if (!this.store.get(id) || this.store.get(id)!.deletedAt) return;
    const version = (this.versions.get(id) ?? 0) + 1;
    this.versions.set(id, version);
    const settings = this.settings();
    if (settings.provider === 'none' && !settings.embeddings) { this.store.setStatus(id, 'local'); this.pending.delete(id); this.changed(); return; }
    this.store.setStatus(id, 'indexing');
    this.pending.set(id, version);
    this.changed();
    this.pump();
  }
  remove(id: string) {
    this.versions.set(id, (this.versions.get(id) ?? 0) + 1);
    this.pending.delete(id);
    if (this.store.get(id)?.status === 'indexing') this.store.setStatus(id, 'local');
    this.store.remove(id);
    this.changed();
  }
  private pump() {
    while (this.workers < 2 && this.pending.size) {
      const [id, version] = this.pending.entries().next().value!;
      this.pending.delete(id);
      this.workers++;
      void this.index(id, version).finally(() => {
        this.workers--;
        this.pump();
        if (!this.workers && !this.pending.size) this.idleWaiters.splice(0).forEach(resolve => resolve());
      });
    }
  }
  private async index(id: string, version: number) {
    const item = this.store.get(id);
    if (!item || item.deletedAt) return;
    const settings = this.settings();
    try {
      const metadata = await enrichItem(item, settings, this.key());
      const vector = settings.embeddings ? await embed(`${item.titleLocked ? item.title : metadata.title}\n${item.description}\n${metadata.summary}\n${metadata.keywords.join(' ')}\n${item.locator}`, settings) : null;
      if (this.versions.get(id) !== version) return;
      this.store.enrich(id, metadata, vector, vector ? settings.embeddingModel : null);
    } catch (error) {
      if (this.versions.get(id) !== version) return;
      const message = error instanceof Error ? error.message : 'AI indexing failed.';
      this.store.setStatus(id, 'error', message.includes('fetch failed') ? 'Could not reach the AI provider. Check Settings and retry. Your item is saved.' : message);
    }
    this.changed();
  }
  async search(input: SearchInput) {
    const settings = this.settings();
    const query = parseSearch(input).query;
    if (query && settings.embeddings) {
      try { return this.store.search(input, await embed(query, settings, 3500), settings.embeddingModel); }
      catch { /* Keep local full-text search available if the semantic provider is offline. */ }
    }
    return this.store.search(input);
  }
  idle(): Promise<void> { return !this.workers && !this.pending.size ? Promise.resolve() : new Promise(resolve => this.idleWaiters.push(resolve)); }
}
