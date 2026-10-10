import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../electron/store.ts';
import { cosine, ftsQuery, normalizeCapture } from '../shared/domain.ts';

test('Claude root folder is captured, found by description, and returned with its exact path', () => {
  const db = new Store(':memory:');
  const result = db.capture({ locator: 'C:\\Projects\\Claude', description: 'This is the Claude root folder for agents and prompts.' });
  const hits = db.search({ query: 'claude root folder' });
  assert.equal(hits.length, 1); assert.equal(hits[0].locator, 'C:\\Projects\\Claude'); assert.equal(hits[0].id, result.item.id); assert.equal(hits[0].status, 'local'); db.close();
});
test('Windows paths are canonicalized without altering case in the displayed path', () => {
  const db = new Store(':memory:');
  const first = db.capture({ locator: 'C:\\Projects\\Claude\\', description: 'old note', tags: ['ai'] });
  db.favorite(first.item.id);
  const second = db.capture({ locator: 'c:/projects/claude', description: 'updated root folder', tags: ['development'] });
  assert.equal(second.duplicate, true); assert.equal(second.item.id, first.item.id); assert.equal(db.stats().total, 1); assert.equal(second.item.favorite, true); assert.equal(second.item.description, 'updated root folder'); assert.deepEqual(second.item.tags, ['ai', 'development']); assert.equal(db.search({ query: 'old note' }).length, 0); db.close();
});
test('full-text search handles stemming, prefix matches, punctuation and FTS operators safely', () => {
  const db = new Store(':memory:');
  db.capture({ locator: 'https://sqlite.org/fts5.html', description: 'Searching databases and indexing documents.' });
  assert.equal(db.search({ query: 'search database' }).length, 1);
  assert.equal(db.search({ query: 'index' }).length, 1);
  assert.doesNotThrow(() => db.search({ query: '" OR * NOT sqlite); DROP TABLE items; --' }));
  assert.equal(db.stats().total, 1); assert.equal(db.search({ query: '***' }).length, 0); db.close();
});
test('weighted BM25 puts title hits ahead of incidental description hits', () => {
  const db = new Store(':memory:');
  const a = db.capture({ locator: 'https://example.org/a', description: 'An otherwise unrelated reference to Claude.' }).item;
  const b = db.capture({ locator: 'C:\\Claude', description: 'My main project.' }).item;
  const hits = db.search({ query: 'claude' }); assert.equal(hits[0].id, b.id); assert.equal(hits[1].id, a.id); db.close();
});
test('hybrid search fuses lexical and vector ranks and ignores incompatible models', () => {
  const db = new Store(':memory:');
  const a = db.capture({ locator: 'https://example.org/design', description: 'Typography patterns.' }).item;
  const b = db.capture({ locator: 'https://example.org/photo', description: 'Photography references.' }).item;
  db.enrich(a.id, { title: 'Typography', summary: 'Fonts', tags: [], keywords: [] }, [1, 0], 'test');
  db.enrich(b.id, { title: 'Photography', summary: 'Images', tags: [], keywords: [] }, [0.8, 0.2], 'different');
  const hits = db.search({ query: 'typography' }, [1, 0], 'test'); assert.equal(hits[0].match, 'hybrid'); assert.equal(hits.length, 1);
  assert.equal(db.search({ query: 'letterforms' }, [1, 0], 'test')[0].match, 'semantic'); db.close();
});
test('favorites, kind and tags restrict the result set', () => {
  const db = new Store(':memory:');
  const a = db.capture({ locator: 'C:\\Work', description: 'Work projects', tags: ['work'] }).item;
  db.capture({ locator: 'https://example.org', description: 'Work links' }); db.favorite(a.id);
  assert.equal(db.search({ query: 'work', filter: 'favorites' }).length, 1); assert.equal(db.search({ query: '', filter: 'link' }).length, 1); assert.equal(db.search({ query: '', tag: 'work' }).length, 1);
  db.remove(a.id); assert.equal(db.search({ query: 'projects' }).length, 0); assert.equal(db.stats().favorites, 0); db.close();
});
test('export excludes credentials and embeddings; import preserves existing items and rolls back malformed batches', () => {
  const db = new Store(':memory:');
  db.capture({ locator: 'https://example.org', description: 'Keep the original note.' }); db.setPreference('anthropic-key', 'SECRET-TEST');
  const output = db.exportData(); assert.ok(!JSON.stringify(output).includes('SECRET-TEST')); assert.ok(!JSON.stringify(output).includes('embedding'));
  assert.equal(db.importData(output), 0);
  assert.throws(() => db.importData({ format: 'notch', version: 1, items: [{ locator: 'https://valid.example', description: 'valid' }, { locator: 'javascript:alert(1)', description: 'invalid' }] }));
  assert.equal(db.stats().total, 1);
  const copy = new Store(':memory:'); assert.equal(copy.importData(output), 1); assert.equal(copy.all()[0].description, 'Keep the original note.'); copy.close(); db.close();
});
test('normalization rejects credentials, unsafe schemes and relative paths', () => {
  for (const locator of ['javascript:alert(1)', 'file:///C:/hello', 'relative/path', 'https://user:password@example.org']) assert.throws(() => normalizeCapture({ locator, description: 'test' }));
  assert.equal(normalizeCapture({ locator: '"C:\\Work\\notes.md"', description: 'notes' }).kind, 'file');
  assert.equal(normalizeCapture({ locator: '\\\\server\\share\\Team', description: 'team' }).kind, 'folder');
  assert.equal(normalizeCapture({ locator: 'https://example.org/%zz', description: 'odd URL' }).kind, 'link');
  assert.throws(() => normalizeCapture({ locator: 'https://example.org', description: ' ' }));
});
test('cosine handles empty, zero and incompatible vectors; FTS query escapes syntax', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1); assert.equal(cosine([1], [1, 0]), 0); assert.equal(cosine([0], [0]), 0); assert.equal(cosine([], []), 0);
  assert.equal(ftsQuery('Claude "root" folder'), '"Claude"* OR "root"* OR "folder"*');
});
