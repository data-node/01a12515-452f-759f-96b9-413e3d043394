import { DatabaseSync } from 'node:sqlite';
import { chmodSync } from 'node:fs';
import { parseSearch, validateSearch } from '../shared/search.js';
import { randomUUID } from 'node:crypto';
import { cleanWords, cosine, ftsQuery, normalizeCapture } from '../shared/domain.js';
import type { CaptureInput, EditInput, Item, RelatedHit, SavedSearch, SaveResult, SearchHit, SearchInput, Stats } from '../shared/types.js';

type Row = Record<string, unknown>;
export class Store {
  readonly db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version ?? 0);
    if (version > 2) { this.db.close(); throw new Error('This library needs a newer version of Notch.'); }
    if (version === 1 && filename !== ':memory:') {
      const backup = `${filename}.pre-v2-${Date.now()}.bak`;
      this.db.prepare('VACUUM INTO ?').run(backup);
      chmodSync(backup, 0o600);
    }
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY, canonical TEXT UNIQUE NOT NULL, locator TEXT NOT NULL,
        title TEXT NOT NULL, description TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', keywords TEXT NOT NULL DEFAULT '[]',
        favorite INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'local', error TEXT NOT NULL DEFAULT '',
        embedding TEXT, embedding_model TEXT
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
        title, locator, description, summary, tags, keywords,
        content='items', content_rowid='rowid', tokenize='porter unicode61'
      );
      CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid,title,locator,description,summary,tags,keywords)
          VALUES(new.rowid,new.title,new.locator,new.description,new.summary,new.tags,new.keywords);
      END;
      CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
        INSERT INTO items_fts(items_fts,rowid,title,locator,description,summary,tags,keywords)
          VALUES('delete',old.rowid,old.title,old.locator,old.description,old.summary,old.tags,old.keywords);
      END;
      CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
        INSERT INTO items_fts(items_fts,rowid,title,locator,description,summary,tags,keywords)
          VALUES('delete',old.rowid,old.title,old.locator,old.description,old.summary,old.tags,old.keywords);
        INSERT INTO items_fts(rowid,title,locator,description,summary,tags,keywords)
          VALUES(new.rowid,new.title,new.locator,new.description,new.summary,new.tags,new.keywords);
      END;
      CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);

    `);
    if (version < 2) {
      this.db.exec(`BEGIN;
        ALTER TABLE items ADD COLUMN title_locked INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE items ADD COLUMN archived_at TEXT;
        ALTER TABLE items ADD COLUMN deleted_at TEXT;
        CREATE TABLE saved_searches (id TEXT PRIMARY KEY, name TEXT NOT NULL, input TEXT NOT NULL, created_at TEXT NOT NULL);
        PRAGMA user_version = 2;
        COMMIT;`);
    }
    // A process may have stopped while an asynchronous provider request was in flight.
    this.db.exec("UPDATE items SET status='error', error='Indexing was interrupted. Retry when your AI provider is available.' WHERE status='indexing'");
  }
  close() { this.db.close(); }
  get(id: string): Item | undefined {
    const row = this.db.prepare('SELECT * FROM items WHERE id=?').get(id);
    return row ? fromRow(row) : undefined;
  }
  capture(input: CaptureInput): SaveResult {
    const normalized = normalizeCapture(input);
    const existing = this.db.prepare('SELECT * FROM items WHERE canonical=?').get(normalized.canonical);
    const now = new Date().toISOString();
    if (existing) {
      const previous = fromRow(existing);
      this.db.prepare(`UPDATE items SET description=?, tags=?, updated_at=?, status='local', error='', summary='', keywords='[]', embedding=NULL, embedding_model=NULL, archived_at=NULL, deleted_at=NULL WHERE id=?`)
        .run(normalized.description, JSON.stringify(cleanWords([...previous.tags, ...normalized.tags])), now, previous.id);
      return { item: this.get(previous.id)!, duplicate: true };
    }
    const id = randomUUID();
    this.db.prepare('INSERT INTO items(id,canonical,locator,title,description,kind,tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(id, normalized.canonical, normalized.locator, normalized.title, normalized.description, normalized.kind, JSON.stringify(normalized.tags), now, now);
    return { item: this.get(id)!, duplicate: false };
  }
  enrich(id: string, metadata: { title: string; summary: string; tags: string[]; keywords: string[] }, embedding: number[] | null, model: string | null) {
    const current = this.get(id);
    if (!current) return;
    this.db.prepare(`UPDATE items SET title=?,summary=?,tags=?,keywords=?,embedding=?,embedding_model=?,status='ready',error='' WHERE id=?`)
      .run(current.titleLocked ? current.title : metadata.title.slice(0, 180) || current.title, metadata.summary.slice(0, 2000), JSON.stringify(cleanWords([...current.tags, ...metadata.tags])), JSON.stringify(cleanWords(metadata.keywords)), embedding ? JSON.stringify(embedding) : null, model, id);
  }
  setStatus(id: string, status: Item['status'], error = '') { this.db.prepare('UPDATE items SET status=?,error=? WHERE id=?').run(status, error.slice(0, 500), id); }
  favorite(id: string) { this.db.prepare('UPDATE items SET favorite=1-favorite WHERE id=?').run(id); }
  remove(id: string) { this.db.prepare('UPDATE items SET deleted_at=? WHERE id=?').run(new Date().toISOString(), id); }
  restore(id: string) { this.db.prepare('UPDATE items SET deleted_at=NULL, archived_at=NULL WHERE id=?').run(id); }
  archive(id: string) { this.db.prepare('UPDATE items SET archived_at=CASE WHEN archived_at IS NULL THEN ? ELSE NULL END WHERE id=? AND deleted_at IS NULL').run(new Date().toISOString(), id); }
  edit(id: string, input: EditInput): Item {
    if (!this.get(id) || this.get(id)!.deletedAt) throw new Error('Restore the item before editing.');
    if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 180) throw new Error('Add a title under 180 characters.');
    const value = normalizeCapture(input);
    const collision = this.db.prepare('SELECT id FROM items WHERE canonical=? AND id!=?').get(value.canonical, id);
    if (collision) throw new Error('That link or path is already saved. Edit the existing item instead.');
    this.db.prepare(`UPDATE items SET title_locked=1,canonical=?,locator=?,title=?,description=?,kind=?,tags=?,updated_at=?,summary='',keywords='[]',embedding=NULL,embedding_model=NULL,status='local',error='' WHERE id=?`)
      .run(value.canonical, value.locator, input.title.trim(), value.description, value.kind, JSON.stringify(value.tags), new Date().toISOString(), id);
    return this.get(id)!;
  }
  related(id: string): RelatedHit[] {
    const source = this.get(id);
    if (!source || source.deletedAt) return [];
    return this.all().filter(item => item.id !== id && !item.deletedAt && !item.archivedAt).map(item => {
      const shared = item.tags.filter(tag => source.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
      const similarity = source.embedding && item.embedding && source.embeddingModel === item.embeddingModel ? cosine(source.embedding, item.embedding) : 0;
      return { ...item, reasons: [...shared.map(t => `Shared tag: #${t}`), ...(similarity > 0.65 ? ['Similar meaning (local vectors)'] : [])], weight: shared.length + (similarity > 0.65 ? similarity : 0) };
    }).filter(item => item.weight > 0).sort((a,b) => b.weight-a.weight || b.updatedAt.localeCompare(a.updatedAt)).slice(0,5).map(({weight, ...item}) => item);
  }
  savedSearches(): SavedSearch[] {
    return this.db.prepare('SELECT * FROM saved_searches ORDER BY created_at, rowid').all().map(row => ({ id: String(row.id), name: String(row.name), input: JSON.parse(String(row.input)), createdAt: String(row.created_at) }));
  }
  saveSearch(name: string, input: SearchInput): SavedSearch {
    const safe = validateSearch(input);
    if (typeof name !== 'string' || !name.trim() || name.length > 60) throw new Error('Name your search in 60 characters or fewer.');
    if (this.savedSearches().length >= 40) throw new Error('You can keep up to 40 saved searches.');
    const result = { id: randomUUID(), name: name.trim(), input: safe, createdAt: new Date().toISOString() };
    this.db.prepare('INSERT INTO saved_searches VALUES(?,?,?,?)').run(result.id,result.name,JSON.stringify(result.input),result.createdAt);
    return result;
  }
  deleteSearch(id: string) { this.db.prepare('DELETE FROM saved_searches WHERE id=?').run(id); }
  all(): Item[] { return this.db.prepare('SELECT * FROM items ORDER BY created_at DESC, rowid DESC').all().map(fromRow); }
  search(input: SearchInput, queryVector?: number[], model?: string): SearchHit[] {
    const { query, eligible } = parseSearch(validateSearch(input));
    const expression = ftsQuery(query);
    if (!query) return this.all().filter(eligible).sort((a, b) => input.sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)).map(item => ({ ...item, score: 0, match: 'recent' }));
    if (!expression) return [];
    const lexical = this.db.prepare(`SELECT items.* FROM items_fts JOIN items ON items.rowid=items_fts.rowid WHERE items_fts MATCH ? ORDER BY bm25(items_fts,8,2,5,3,4,4), items.created_at DESC`).all(expression).map(fromRow).filter(eligible);
    const vector = queryVector && model ? this.all().filter(eligible).filter(x => x.embedding && x.embeddingModel === model).map(item => ({ item, similarity: cosine(item.embedding!, queryVector) })).filter(x => x.similarity > 0.25).sort((a, b) => b.similarity - a.similarity).slice(0, 100) : [];
    const hits = new Map<string, SearchHit>();
    lexical.forEach((item, rank) => hits.set(item.id, { ...item, score: 1 / (60 + rank + 1), match: 'text' }));
    vector.forEach(({ item }, rank) => {
      const hit = hits.get(item.id);
      hits.set(item.id, { ...item, score: (hit?.score ?? 0) + 1 / (60 + rank + 1), match: hit ? 'hybrid' : 'semantic' });
    });
    return [...hits.values()].sort((a, b) => input.sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : input.sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.score - a.score).slice(0, 200);
  }
  stats(): Stats {
    const all = this.all();
    const items = all.filter(x => !x.archivedAt && !x.deletedAt);
    return { archived: all.filter(x => x.archivedAt && !x.deletedAt).length, trash: all.filter(x => x.deletedAt).length, indexing: items.filter(x => x.status === 'indexing').length, errors: items.filter(x => x.status === 'error').length, total: items.length, links: items.filter(x => x.kind === 'link').length, folders: items.filter(x => x.kind === 'folder').length, files: items.filter(x => x.kind === 'file').length, favorites: items.filter(x => x.favorite).length, enriched: items.filter(x => x.status === 'ready').length, tags: [...new Set(items.flatMap(x => x.tags))].sort() };
  }
  preference(key: string): string | undefined { return this.db.prepare('SELECT value FROM preferences WHERE key=?').get(key)?.value as string | undefined; }
  setPreference(key: string, value: string) { this.db.prepare('INSERT INTO preferences(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }
  exportData() { return { format: 'notch', version: 2, savedSearches: this.savedSearches(), exportedAt: new Date().toISOString(), items: this.all().map(({ embedding, embeddingModel, ...item }) => item) }; }
  importData(data: unknown): number {
    if (!data || typeof data !== 'object' || !('format' in data) || data.format !== 'notch' || !('version' in data) || ![1, 2].includes(data.version as number) || !('items' in data) || !Array.isArray(data.items) || data.items.length > 10000) throw new Error('Choose a Notch JSON export with up to 10,000 items.');
    this.db.exec('BEGIN');
    try {
      let count = 0;
      for (const row of data.items) {
        if (!row || typeof row !== 'object') throw new Error('Invalid item in export. Nothing was imported.');
        const normalized = normalizeCapture({ locator: row.locator, description: row.description, tags: cleanWords(row.tags), kind: row.kind });
        // Import is additive and never overwrites an existing capture.
        if (this.db.prepare('SELECT id FROM items WHERE canonical=?').get(normalized.canonical)) continue;
        const { item } = this.capture(normalized);
        if (typeof row.title === 'string' && typeof row.summary === 'string') {
          this.db.prepare('UPDATE items SET title=?,summary=?,keywords=?,favorite=?,title_locked=? WHERE id=?').run(row.title.slice(0, 180), row.summary.slice(0, 2000), JSON.stringify(cleanWords(row.keywords)), row.favorite === true ? 1 : 0, row.titleLocked === true ? 1 : 0, item.id);
        }
        if (typeof row.archivedAt === 'string' && !Number.isNaN(Date.parse(row.archivedAt))) this.db.prepare('UPDATE items SET archived_at=? WHERE id=?').run(row.archivedAt, item.id);
        if (typeof row.deletedAt === 'string' && !Number.isNaN(Date.parse(row.deletedAt))) this.db.prepare('UPDATE items SET deleted_at=? WHERE id=?').run(row.deletedAt, item.id);
        count++;
      }
      if ('savedSearches' in data && Array.isArray(data.savedSearches)) {
        if (data.savedSearches.length > 40) throw new Error('Too many saved searches in backup.');
        for (const saved of data.savedSearches) {
          if (!this.savedSearches().some(x => x.name === saved.name)) this.saveSearch(saved.name, saved.input);
        }
      }
      this.db.exec('COMMIT');
      return count;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}

function fromRow(row: Row): Item {
  return { titleLocked: Boolean(row.title_locked), archivedAt: row.archived_at ? String(row.archived_at) : null, deletedAt: row.deleted_at ? String(row.deleted_at) : null, id: String(row.id), locator: String(row.locator), title: String(row.title), description: String(row.description), summary: String(row.summary), kind: row.kind as Item['kind'], tags: JSON.parse(String(row.tags)), keywords: JSON.parse(String(row.keywords)), favorite: Boolean(row.favorite), createdAt: String(row.created_at), updatedAt: String(row.updated_at), status: row.status as Item['status'], error: String(row.error), embedding: row.embedding ? JSON.parse(String(row.embedding)) : null, embeddingModel: row.embedding_model ? String(row.embedding_model) : null };
}
