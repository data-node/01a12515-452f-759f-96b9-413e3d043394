import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { cleanWords, cosine, ftsQuery, normalizeCapture } from '../shared/domain.js';
import type { CaptureInput, Item, SaveResult, SearchHit, SearchInput, Stats } from '../shared/types.js';

type Row = Record<string, unknown>;
export class Store {
  readonly db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
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
      PRAGMA user_version = 1;
    `);
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
      this.db.prepare(`UPDATE items SET description=?, tags=?, updated_at=?, status='local', error='', summary='', keywords='[]', embedding=NULL, embedding_model=NULL WHERE id=?`)
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
      .run(metadata.title.slice(0, 180) || current.title, metadata.summary.slice(0, 2000), JSON.stringify(cleanWords([...current.tags, ...metadata.tags])), JSON.stringify(cleanWords(metadata.keywords)), embedding ? JSON.stringify(embedding) : null, model, id);
  }
  setStatus(id: string, status: Item['status'], error = '') { this.db.prepare('UPDATE items SET status=?,error=? WHERE id=?').run(status, error.slice(0, 500), id); }
  favorite(id: string) { this.db.prepare('UPDATE items SET favorite=1-favorite WHERE id=?').run(id); }
  remove(id: string) { this.db.prepare('DELETE FROM items WHERE id=?').run(id); }
  all(): Item[] { return this.db.prepare('SELECT * FROM items ORDER BY created_at DESC, rowid DESC').all().map(fromRow); }
  search(input: SearchInput, queryVector?: number[], model?: string): SearchHit[] {
    const query = input.query.trim().slice(0, 2000);
    const eligible = (item: Item) => (!input.filter || input.filter === 'all' || (input.filter === 'favorites' ? item.favorite : item.kind === input.filter)) && (!input.tag || item.tags.includes(input.tag));
    const expression = ftsQuery(query);
    if (!query) return this.all().filter(eligible).sort((a, b) => input.sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)).map(item => ({ ...item, score: 0, match: 'recent' }));
    if (!expression) return [];
    const lexical = this.db.prepare(`SELECT items.* FROM items_fts JOIN items ON items.rowid=items_fts.rowid WHERE items_fts MATCH ? ORDER BY bm25(items_fts,8,2,5,3,4,4), items.created_at DESC LIMIT 500`).all(expression).map(fromRow).filter(eligible);
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
    const items = this.all();
    return { total: items.length, links: items.filter(x => x.kind === 'link').length, folders: items.filter(x => x.kind === 'folder').length, files: items.filter(x => x.kind === 'file').length, favorites: items.filter(x => x.favorite).length, enriched: items.filter(x => x.status === 'ready').length, tags: [...new Set(items.flatMap(x => x.tags))].sort() };
  }
  preference(key: string): string | undefined { return this.db.prepare('SELECT value FROM preferences WHERE key=?').get(key)?.value as string | undefined; }
  setPreference(key: string, value: string) { this.db.prepare('INSERT INTO preferences(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }
  exportData() { return { format: 'notch', version: 1, exportedAt: new Date().toISOString(), items: this.all().map(({ embedding, embeddingModel, ...item }) => item) }; }
  importData(data: unknown): number {
    if (!data || typeof data !== 'object' || !('format' in data) || data.format !== 'notch' || !('version' in data) || data.version !== 1 || !('items' in data) || !Array.isArray(data.items) || data.items.length > 10000) throw new Error('Choose a Notch JSON export with up to 10,000 items.');
    this.db.exec('BEGIN');
    try {
      let count = 0;
      for (const row of data.items) {
        if (!row || typeof row !== 'object') throw new Error('Invalid item in export. Nothing was imported.');
        const normalized = normalizeCapture({ locator: row.locator, description: row.description, tags: cleanWords(row.tags) });
        // Import is additive and never overwrites an existing capture.
        if (this.db.prepare('SELECT id FROM items WHERE canonical=?').get(normalized.canonical)) continue;
        const { item } = this.capture(normalized);
        if (typeof row.title === 'string' && typeof row.summary === 'string') {
          this.db.prepare('UPDATE items SET title=?,summary=?,keywords=?,favorite=? WHERE id=?').run(row.title.slice(0, 180), row.summary.slice(0, 2000), JSON.stringify(cleanWords(row.keywords)), row.favorite === true ? 1 : 0, item.id);
        }
        count++;
      }
      this.db.exec('COMMIT');
      return count;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}

function fromRow(row: Row): Item {
  return { id: String(row.id), locator: String(row.locator), title: String(row.title), description: String(row.description), summary: String(row.summary), kind: row.kind as Item['kind'], tags: JSON.parse(String(row.tags)), keywords: JSON.parse(String(row.keywords)), favorite: Boolean(row.favorite), createdAt: String(row.created_at), updatedAt: String(row.updated_at), status: row.status as Item['status'], error: String(row.error), embedding: row.embedding ? JSON.parse(String(row.embedding)) : null, embeddingModel: row.embedding_model ? String(row.embedding_model) : null };
}
