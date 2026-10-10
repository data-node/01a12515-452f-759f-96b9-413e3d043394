import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../electron/store.ts';
import { LibraryService } from '../electron/service.ts';
import { DEFAULT_SETTINGS } from '../shared/types.ts';

test('real v1 database migrates once, preserves FTS/preferences, and creates an independently readable backup', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'notch-migrate-'));
  const filename = path.join(directory, 'notch.sqlite');
  try {
    const old = new DatabaseSync(filename);
    old.exec(readFileSync(new URL('./fixtures/v1.sql', import.meta.url), 'utf8'));
    old.prepare('INSERT INTO items(id,canonical,locator,title,description,kind,tags,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run('original', 'c:\\claude', 'C:\\Claude', 'Claude', 'Claude root folder', 'folder', '["ai"]', '2026-01-01', '2026-01-01');
    old.prepare('INSERT INTO preferences VALUES(?,?)').run('anthropic-key', 'encrypted-test-value'); old.close();
    const db = new Store(filename);
    assert.equal(db.search({query: 'claude root folder'})[0].id, 'original');
    assert.equal(db.preference('anthropic-key'), 'encrypted-test-value');
    assert.equal(db.db.prepare('PRAGMA user_version').get()!.user_version, 2);
    db.saveSearch('AI folders', {query: 'type:folder tag:ai'}); db.close();
    const backups = readdirSync(directory).filter(n => n.endsWith('.bak')); assert.equal(backups.length, 1);
    const backup = new DatabaseSync(path.join(directory, backups[0]), {readOnly: true});
    assert.equal(backup.prepare('PRAGMA user_version').get()!.user_version, 1);
    assert.equal(backup.prepare('SELECT description FROM items').get()!.description, 'Claude root folder'); backup.close();
    const reopened = new Store(filename); assert.equal(reopened.savedSearches()[0].name, 'AI folders'); reopened.close();
    assert.equal(readdirSync(directory).filter(n => n.endsWith('.bak')).length, 1);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

test('a newer schema is refused without changing its version', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'notch-new-schema-')); const filename = path.join(directory,'db.sqlite');
  try {
    const newer = new DatabaseSync(filename); newer.exec('PRAGMA user_version=99'); newer.close();
    assert.throws(() => new Store(filename), /newer version/);
    const untouched = new DatabaseSync(filename); assert.equal(untouched.prepare('PRAGMA user_version').get()!.user_version,99); untouched.close();
  } finally { rmSync(directory,{recursive:true,force:true}); }
});

test('editing refreshes FTS, enforces unique locators, corrects path type, and keeps user titles through AI enrichment', () => {
  const db = new Store(':memory:');
  const a = db.capture({locator:'C:\\Project.v2',description:'old words'}).item;
  db.capture({locator:'C:\\Other',description:'another item'});
  const updated = db.edit(a.id,{locator:a.locator,title:'My Claude root',description:'new retrieval phrase',tags:['AI'],kind:'folder'});
  assert.equal(updated.kind,'folder'); assert.equal(db.search({query:'old words'}).length,0); assert.equal(db.search({query:'retrieval'})[0].id,a.id);
  db.enrich(a.id,{title:'Unwanted AI title',summary:'Helpful context',tags:['agents'],keywords:[]},null,null);
  assert.equal(db.get(a.id)!.title,'My Claude root'); assert.equal(db.get(a.id)!.summary,'Helpful context');
  assert.throws(() => db.edit(a.id,{locator:'C:\\Other',title:'Collision',description:'nope'}), /already saved/);
  assert.equal(db.get(a.id)!.locator,a.locator);
  assert.throws(() => db.edit(a.id,{locator:'javascript:alert(1)',title:'Unsafe',description:'nope'})); db.close();
});

test('archive, trash, restore, and duplicate recapture preserve data and isolate lexical and vector results', () => {
  const db = new Store(':memory:'); const a = db.capture({locator:'https://example.org',description:'design reference'}).item;
  db.favorite(a.id); db.enrich(a.id,{title:'Design',summary:'reference',tags:[],keywords:[]},[1,0],'test');
  db.archive(a.id); assert.equal(db.search({query:'design'},[1,0],'test').length,0); assert.equal(db.stats().archived,1);
  assert.equal(db.search({query:'',scope:'archived'})[0].id,a.id);
  db.remove(a.id); assert.equal(db.stats().archived,0); assert.equal(db.stats().trash,1); assert.equal(db.search({query:'design',scope:'trash'})[0].id,a.id);
  db.restore(a.id); assert.equal(db.search({query:'design'})[0].favorite,true); assert.equal(db.stats().total,1);
  db.remove(a.id); const recapture = db.capture({locator:a.locator,description:'back again'}); assert.equal(recapture.duplicate,true); assert.equal(db.stats().trash,0); assert.equal(db.stats().total,1); db.close();
});

test('search operators combine with text and saved searches keep live filters', () => {
  const db = new Store(':memory:'); const a = db.capture({locator:'C:\\Claude',description:'Claude root folder',tags:['AI','team work']}).item;
  db.capture({locator:'https://claude.ai',description:'Claude reference',tags:['AI']}); db.favorite(a.id); db.setStatus(a.id,'error','offline');
  const input = {query:'claude type:folder tag:ai tag:"team work" is:favorite status:error'};
  assert.deepEqual(db.search(input).map(x=>x.id),[a.id]);
  assert.equal(db.search({query:'type:folder'}).length,1);
  const saved = db.saveSearch('Project roots',input); assert.deepEqual(db.savedSearches()[0].input,saved.input);
  db.restore(a.id); assert.equal(db.search(saved.input).length,1);
  db.deleteSearch(saved.id); assert.equal(db.savedSearches().length,0);
  assert.throws(() => db.saveSearch('x',{query:'',scope:'unknown'} as any), /Invalid search/); db.close();
});

test('related suggestions explain evidence and never leak trashed, archived, or incompatible vectors', () => {
  const db = new Store(':memory:'); const a = db.capture({locator:'C:\\Claude',description:'workspace',tags:['AI']}).item;
  const b = db.capture({locator:'https://example.org/agents',description:'agents',tags:['ai']}).item;
  const c = db.capture({locator:'https://example.org/fonts',description:'fonts'}).item;
  db.enrich(a.id,{title:'Claude',summary:'',tags:[],keywords:[]},[1,0],'a');
  db.enrich(c.id,{title:'Fonts',summary:'',tags:[],keywords:[]},[1,0],'b');
  assert.deepEqual(db.related(a.id).map(x=>x.id),[b.id]); assert.match(db.related(a.id)[0].reasons[0], /Shared tag/);
  db.archive(b.id); assert.equal(db.related(a.id).length,0); db.archive(b.id); db.remove(b.id); assert.equal(db.related(a.id).length,0); db.close();
});

test('v2 export/import restores saved searches, custom titles, archive and trash while accepting v1', () => {
  const db = new Store(':memory:'); const a = db.capture({locator:'C:\\Archive',description:'keep me'}).item;
  db.edit(a.id,{locator:a.locator,title:'My custom title',description:'keep me',kind:'folder'}); db.archive(a.id);
  const b = db.capture({locator:'https://example.org/trash',description:'restore me'}).item; db.remove(b.id);
  db.saveSearch('Archived folders',{query:'type:folder',scope:'archived'});
  const copy = new Store(':memory:'); assert.equal(copy.importData(db.exportData()),2); assert.equal(copy.stats().archived,1); assert.equal(copy.stats().trash,1); assert.equal(copy.savedSearches().length,1);
  assert.equal(copy.search(copy.savedSearches()[0].input)[0].titleLocked,true);
  assert.equal(copy.importData({format:'notch',version:1,items:[{locator:'https://example.org/legacy',description:'legacy item'}]}),1);
  assert.throws(() => copy.importData({format:'notch',version:2,items:[{locator:'https://example.org/rollback',description:'valid'}],savedSearches:[{name:'invalid',input:{query:7}}]}));
  assert.equal(copy.all().some(i => i.locator.endsWith('/rollback')),false); copy.close(); db.close();
});

test('AI edit races preserve the latest description/title and trash restoration cannot commit stale enrichment', async t => {
  const resolves: ((r:Response)=>void)[] = [];
  t.mock.method(globalThis,'fetch',()=>new Promise<Response>(resolve=>resolves.push(resolve)));
  const db = new Store(':memory:'); const service = new LibraryService(db,()=>({...DEFAULT_SETTINGS,provider:'ollama'}),()=>undefined,()=>{});
  const a = service.capture({locator:'C:\\Claude',description:'old capture'}).item;
  service.edit(a.id,{locator:a.locator,title:'User title',description:'new capture',tags:['ai']});
  const response = (title:string)=>new Response(JSON.stringify({message:{content:JSON.stringify({title,summary:title,tags:[],keywords:[]})}}));
  resolves[1](response('Current context')); resolves[0](response('Old context')); await service.idle();
  assert.equal(db.get(a.id)!.title,'User title'); assert.equal(db.get(a.id)!.description,'new capture'); assert.equal(db.get(a.id)!.summary,'Current context');
  service.retry(a.id); service.remove(a.id); db.restore(a.id); resolves[2](response('Stale restored context')); await service.idle();
  assert.equal(db.get(a.id)!.summary,'Current context'); db.close();
});
