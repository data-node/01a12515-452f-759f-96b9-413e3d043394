import { useEffect, useState } from 'react';
import { Archive, ArrowRight, Bookmark, Check, Command, Search, Sparkles } from 'lucide-react';
import type { Item, Kind, RelatedHit, SavedSearch, SearchInput } from '../shared/types';
import { api } from './api';
import { CloseButton, KindIcon } from './components';

export function ItemEditor({ item, onClose, toast }: { item: Item; onClose: () => void; toast: (message: string) => void }) {
  const [title, setTitle] = useState(item.title);
  const [locator, setLocator] = useState(item.locator);
  const [description, setDescription] = useState(item.description);
  const [tags, setTags] = useState(item.tags.join(', '));
  const [kind, setKind] = useState<Kind>(item.kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try { await api.edit(item.id, { title, locator, description, tags: tags.split(',').map(t => t.trim()).filter(Boolean), kind }); onClose(); toast('Changes saved'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={e => { e.preventDefault(); void save(); }}>
    <div className="modal-header"><div><div className="eyebrow">MAKE IT FINDABLE</div><h2>Edit item</h2></div><CloseButton onClick={onClose} /></div>
    <div className="settings-body edit-fields">
      <label>Title<input data-autofocus value={title} onChange={e => setTitle(e.target.value)} maxLength={180} required /></label>
      <label>Link or path<input value={locator} onChange={e => setLocator(e.target.value)} maxLength={4096} required /></label>
      <label>Description<textarea aria-label="Description" value={description} onChange={e => setDescription(e.target.value)} maxLength={8000} rows={4} required /></label>
      <label>Tags<input value={tags} onChange={e => setTags(e.target.value)} placeholder="project, design, reference" /></label>
      {item.kind !== 'link' && <label>Path type<select aria-label="Path type" value={kind} onChange={e => setKind(e.target.value as Kind)}><option value="folder">Folder</option><option value="file">File</option></select></label>}
      <p className="small-text muted">Your title stays as you write it. AI context refreshes in the background.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div><div className="modal-footer"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy}><Check size={15} />{busy ? 'Saving…' : 'Save changes'}</button></div>
  </form>;
}

export function RelatedItems({ id, revision, onSelect }: { id: string; revision: number; onSelect: (id: string) => void }) {
  const [items, setItems] = useState<RelatedHit[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void api.related(id).then(result => { if (active) { setItems(result); setError(''); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id, revision]);
  return <section className="related-items"><h4><Sparkles size={13} />CONNECTED IN YOUR SPACE</h4>{error ? <p className="form-error">{error}</p> : items.length ? items.map(item => <button key={item.id} onClick={() => onSelect(item.id)}><KindIcon kind={item.kind} size={15} /><span><strong>{item.title}</strong><small>{item.reasons.join(' · ')}</small></span><ArrowRight size={13} /></button>) : <p className="small-text muted">Shared tags and compatible local embeddings connect your items here.</p>}</section>;
}

export function SaveSearchForm({ input, onClose, toast }: { input: SearchInput; onClose: () => void; toast: (message: string) => void }) {
  const [name, setName] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <form onSubmit={e => {
    e.preventDefault(); setBusy(true);
    void api.saveSearch(name, input).then(() => { onClose(); toast('Search saved to your sidebar'); }).catch(e => setError(e.message)).finally(() => setBusy(false));
  }}><div className="modal-header"><div><div className="eyebrow">RETURN IN ONE CLICK</div><h2>Save this search</h2></div><CloseButton onClick={onClose} /></div><div className="settings-body edit-fields"><label>Search name<input data-autofocus required maxLength={60} placeholder="Claude workspace" value={name} onChange={e => setName(e.target.value)} /></label><p className="small-text muted">Keeps the query, tags, item type, collection, and sort order. Results stay up to date as your space grows.</p>{error && <p role="alert" className="form-error">{error}</p>}</div><div className="modal-footer"><span>{input.query || 'Current filters'}</span><button className="primary-button" disabled={busy}><Bookmark size={15} />Save search</button></div></form>;
}

export function CommandPalette({ saved, onClose, search, capture, settings, navigate }: { saved: SavedSearch[]; onClose: () => void; search: () => void; capture: () => void; settings: () => void; navigate: (input: SearchInput) => void }) {
  const [query, setQuery] = useState('');
  const commands = [
    { name: 'Search your space', icon: Search, run: search, hint: 'Ctrl K' },
    { name: 'Capture something', icon: Command, run: capture, hint: 'Global shortcut' },
    { name: 'Open settings', icon: Sparkles, run: settings, hint: 'AI & your data' },
    { name: 'Browse archive', icon: Archive, run: () => navigate({ query: '', scope: 'archived' }), hint: 'Out of the way' },
    { name: 'Restore from trash', icon: Archive, run: () => navigate({ query: '', scope: 'trash' }), hint: 'Nothing lost' },
    ...saved.map(entry => ({ name: entry.name, icon: Bookmark, run: () => navigate(entry.input), hint: 'Saved search' })),
  ].filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
  function run(index: number) { const command = commands[index]; if (command) { onClose(); command.run(); } }
  return <><div className="modal-header"><h2>Jump to anything</h2><CloseButton onClick={onClose} /></div><div className="palette-body"><div className="palette-search"><Search size={18} /><input data-autofocus aria-label="Find a command" placeholder="Search commands and saved searches…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); run(0); } if (e.key === 'ArrowDown') { e.preventDefault(); document.querySelector<HTMLButtonElement>('.palette-command')?.focus(); } }} /></div>{commands.length ? commands.map((command, index) => <button className="palette-command" key={command.name + index} onClick={() => run(index)} onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.palette-command')); buttons[(index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus(); } }}><command.icon size={16} /><span>{command.name}</span><small>{command.hint}</small><ArrowRight size={14} /></button>) : <p className="small-text muted">No matching commands.</p>}<div className="palette-hint">↑ ↓ to move · Enter to open · Escape to close</div></div></>;
}
