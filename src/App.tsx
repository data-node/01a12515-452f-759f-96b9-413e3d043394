import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, Bookmark, Command, Pencil, RotateCcw, ArrowDownUp, ArrowRight, ArrowUpRight, Check, ChevronDown, Copy, FileText, Folder, Grid2X2, HardDrive, LayoutGrid, Link2, List, LoaderCircle, Minus, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, Sparkles, Star, Trash2, X } from 'lucide-react';
import type { Item, SavedSearch, SearchHit, SearchInput, Stats } from '../shared/types';
import { api, isPreview } from './api';
import { Brand, CloseButton, KindIcon, Modal, niceDate } from './components';
import { CommandPalette, ItemEditor, RelatedItems, SaveSearchForm } from './LibraryTools';
import { version } from '../package.json';
import { Capture } from './Capture';
import { SettingsPanel } from './Settings';

const EMPTY_STATS: Stats = { total: 0, links: 0, folders: 0, files: 0, favorites: 0, enriched: 0, archived: 0, trash: 0, indexing: 0, errors: 0, tags: [] };
export function App() {
  const [scope, setScope] = useState<SearchInput['scope']>('active');
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [items, setItems] = useState<SearchHit[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchInput['filter']>('all');
  const [tag, setTag] = useState<string>();
  const [sort, setSort] = useState<SearchInput['sort']>('relevance');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [captureOpen, setCaptureOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [revision, setRevision] = useState(0);
  const [shortcut, setShortcut] = useState('Control+I');
  const [embeddings, setEmbeddings] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const selected = items.find(item => item.id === selectedId);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const closeSaveSearch = useCallback(() => setSaveSearchOpen(false), []);
  const closeEditing = useCallback(() => setEditing(null), []);
  const closeCapture = useCallback(() => setCaptureOpen(false), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeDetail = useCallback(() => { setSelectedId(null); setDeleteConfirm(false); }, []);
  const toast = useCallback((text: string) => setNotification(text), []);
  useEffect(() => { if (!notification) return; const timer = setTimeout(() => setNotification(''), 6500); return () => clearTimeout(timer); }, [notification]);
  useEffect(() => api.onChanged(() => setRevision(r => r + 1)), []);
  useEffect(() => {
    let active = true;
    void Promise.all([api.stats(), api.settings(), api.savedSearches()]).then(([s, prefs, searches]) => { if (active) { setStats(s); setSaved(searches); setShortcut(prefs.shortcut); setEmbeddings(prefs.embeddings); } }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      void api.search({ query, filter, tag, sort, scope }).then(result => { if (active) { setItems(result); setError(''); setLoading(false); } }).catch(e => { if (active) { setError(e.message); setLoading(false); } });
    }, query ? 160 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query, filter, tag, sort, scope, revision]);
  const openCapture = useCallback(() => { if (isPreview) setCaptureOpen(true); else void api.showCapture().catch(e => toast(e.message)); }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (captureOpen || settingsOpen || selectedId || editing || saveSearchOpen || paletteOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); setPaletteOpen(true); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.current?.focus(); }
      if (isPreview && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); openCapture(); }
      if (e.key === 'Escape') { setQuery(''); input.current?.blur(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [captureOpen, settingsOpen, selectedId, editing, saveSearchOpen, paletteOpen, openCapture]);
  async function act(fn: () => Promise<unknown>, message?: string) { try { await fn(); if (message) toast(message); } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong.'); } }
  function applySearch(value: SearchInput) { setQuery(value.query); setFilter(value.filter ?? 'all'); setTag(value.tag); setSort(value.sort ?? 'relevance'); setScope(value.scope ?? 'active'); closeDetail(); }
  function navigate(value: SearchInput['filter']) { setScope('active'); setFilter(value); setTag(undefined); closeDetail(); }
  const title = scope === 'trash' ? 'Your trash' : scope === 'archived' ? 'Your archive' : tag ? `#${tag}` : filter === 'favorites' ? 'Your favorites' : filter === 'link' ? 'Your links' : filter === 'folder' ? 'Your folders' : filter === 'file' ? 'Your files' : 'Your space';
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><Brand /><span>notch<span className="brand-period">.</span></span></div>
      <div className="workspace-label"><span className="workspace-avatar">N</span><div><strong>Personal space</strong><span>Just for you</span></div><LockGlyph /></div>
      <div className="nav-label">LIBRARY</div>
      <nav aria-label="Library">{([{ id: 'all', label: 'All items', icon: LayoutGrid, count: stats.total }, { id: 'favorites', label: 'Favorites', icon: Star, count: stats.favorites }, { id: 'link', label: 'Links', icon: Link2, count: stats.links }, { id: 'folder', label: 'Folders', icon: Folder, count: stats.folders }, { id: 'file', label: 'Files', icon: FileText, count: stats.files }] as const).map(item => <button key={item.id} className={`nav-item ${scope === 'active' && filter === item.id && !tag ? 'active' : ''}`} onClick={() => navigate(item.id)}><item.icon size={17} /><span>{item.label}</span><span className="nav-count">{item.count}</span></button>)}</nav><div className="scope-navigation">{([{id: 'archived', label: 'Archive', icon: Archive, count: stats.archived}, {id: 'trash', label: 'Trash', icon: Trash2, count: stats.trash}] as const).map(item => <button key={item.id} className={`nav-item ${scope === item.id ? 'active' : ''}`} onClick={() => applySearch({ query: '', scope: item.id })}><item.icon size={16} /><span>{item.label}</span><span className="nav-count">{item.count}</span></button>)}</div>
      {saved.length > 0 && <><div className="nav-label saved-heading">SAVED SEARCHES</div><div className="saved-navigation">{saved.map(entry => <div className="saved-row" key={entry.id}><button title={entry.name} onClick={() => applySearch(entry.input)}><Bookmark size={13} /><span>{entry.name}</span></button><button className="icon-button" aria-label={`Delete saved search ${entry.name}`} onClick={() => void act(() => api.deleteSearch(entry.id), 'Saved search removed')}><X size={12} /></button></div>)}</div></>}
      <div className="nav-label tags-heading">YOUR TAGS<span>{stats.tags.length}</span></div>
      <div className="tag-navigation">{stats.tags.length ? stats.tags.slice(0, 12).map(t => <button className={`tag-nav ${tag === t ? 'active' : ''}`} key={t} onClick={() => { setScope('active'); setTag(t); setFilter('all'); }}><span className="hash">#</span>{t}</button>) : <p className="sidebar-empty">Tags appear as you add them or enable AI.</p>}</div>
      <div className="sidebar-bottom"><div className="capture-tip"><Sparkles size={17} /><strong>Catch it before it’s gone.</strong><p>A link. A folder. A passing thought.<br />Keep it with <kbd>{shortcut.replace(/Control/g, 'Ctrl').replace(/\+/g, ' + ')}</kbd></p><button onClick={openCapture}>Quick capture <ArrowUpRight size={14} /></button></div><button className="nav-item settings-link" onClick={() => setSettingsOpen(true)}><Settings2 size={17} /><span>Settings</span><span className="version">v{version}</span></button><div className="local-note"><span className="status-dot" />Local first. Always yours.</div></div>
    </aside>
    <main className="main-pane">
      <header className="topbar"><div className="breadcrumb"><Grid2X2 size={15} /><span>Personal space</span><span className="slash">/</span><strong>{title}</strong></div><div className="topbar-right">{isPreview && <span className="preview-badge">Preview · sample data</span>}<button className="command-trigger" aria-label="Open command palette" onClick={() => setPaletteOpen(true)}><Command size={13} />Commands <kbd>Ctrl Shift P</kbd></button><span className="private-badge"><ShieldCheck size={13} /> Private by design</span>{!isPreview && <div className="window-controls"><button aria-label="Minimize" onClick={() => void api.minimize()}><Minus size={14} /></button><button aria-label="Close to tray" onClick={() => void api.hideLibrary()}><X size={14} /></button></div>}</div></header>
      <div className="page-content">
        <section className="page-heading"><div><div className="eyebrow"><span className="status-dot" /> A LITTLE LESS TO REMEMBER</div><h1>{title}<span className="heading-period">.</span></h1><p>Save what matters. Find it the way you think.</p></div><button className="primary-button add-button" onClick={openCapture}><Plus size={17} />Add to space<span className="shortcut-small">{shortcut.replace('Control+', 'Ctrl ')}</span></button></section>
        <div className={`search-box ${query ? 'has-query' : ''}`}><Search size={21} /><input ref={input} aria-label="Search your space" placeholder="A link, a folder, a half-remembered idea…" value={query} maxLength={2000} onChange={e => setQuery(e.target.value)} />{query ? <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button> : <kbd>Ctrl K</kbd>}<div className="search-method"><span className="status-dot" />{embeddings ? 'Hybrid search' : 'Local search'}</div></div>
        <div className="search-caption"><Sparkles size={12} /><span>{embeddings ? 'Search words and meaning. Falls back to BM25 when embeddings are offline.' : 'Search titles, descriptions, paths, and tags. Your words are enough.'}</span><span className="search-engine">{embeddings ? 'BM25 + vectors' : 'SQLite · BM25'}</span></div>
        <div className="library-tools"><span>Try <code>type:folder</code> <code>tag:ai</code> <code>is:favorite</code></span><button className="text-button" onClick={() => setSaveSearchOpen(true)}><Bookmark size={13} />Save search</button></div>
        {(stats.errors > 0 || stats.indexing > 0) && <div className="index-health" role="status"><Sparkles size={14} /><span>{stats.indexing} indexing · {stats.errors} need attention</span>{stats.errors > 0 && <><button className="text-button" onClick={() => applySearch({query: 'status:error'})}>View issues</button><button className="text-button" onClick={() => void act(api.retryFailed, 'Failed items queued for retry')}>Retry failed</button></>}</div>}
        {scope === 'trash' && <div className="scope-note"><RotateCcw size={14} />Items stay here until you restore them. Your original files are untouched.</div>}
        <div className="collection-toolbar"><div className="filter-tabs" role="tablist" aria-label="Item type">{([{ id: 'all', label: 'Everything' }, { id: 'link', label: 'Links' }, { id: 'folder', label: 'Folders' }, { id: 'file', label: 'Files' }] as const).map(t => <button key={t.id} role="tab" aria-selected={filter === t.id} className={filter === t.id ? 'active' : ''} onClick={() => navigate(t.id)}>{t.label}{t.id === 'all' && <span>{stats.total}</span>}</button>)}{filter === 'favorites' && <span className="favorites-filter"><Star size={12} />Favorites</span>}</div><div className="view-controls"><label className="sort-select"><ArrowDownUp size={12} /><select aria-label="Sort items" value={sort} onChange={e => setSort(e.target.value as SearchInput['sort'])}><option value="relevance">{query ? 'Relevance' : 'Newest first'}</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><ChevronDown size={12} /></label><div className="view-toggle"><button aria-label="Grid view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={15} /></button><button aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} /></button></div></div></div>
        <div className="results-heading"><span>{query ? `RESULTS FOR “${query}”` : tag ? `TAGGED ${tag.toUpperCase()}` : 'YOUR COLLECTION'}{tag && <button onClick={() => setTag(undefined)} aria-label="Clear tag"><X size={12} /></button>}</span><span>{loading ? 'Searching…' : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}</span></div>
        {error && <div className="error-banner" role="alert">{error}<button onClick={() => setRevision(r => r + 1)}>Try again</button></div>}
        {loading && !items.length ? <div className="empty-state"><LoaderCircle size={26} className="spin" /><p>Opening your space…</p></div> : !items.length ? <div className="empty-state"><div className="empty-orbit">{query ? <Search size={28} /> : <Brand />}</div><h2>{query ? 'Not here. Yet.' : scope === 'trash' ? 'Nothing in the trash.' : scope === 'archived' ? 'Make room without losing things.' : filter === 'favorites' ? 'Keep your go-to items close.' : 'A place for your next thought.'}</h2><p>{query ? 'Try another word, a project name, or a different filter.' : scope === 'trash' ? 'Items you remove stay here so you can restore them.' : scope === 'archived' ? 'Archive items from their details to keep your active collection focused.' : filter === 'favorites' ? 'Tap the star on an item to make it a favorite.' : 'Save a link or folder with a few words about why it matters.'}</p>{query ? <button className="secondary-button" onClick={() => { setQuery(''); navigate('all'); }}>Clear search and filters</button> : scope !== 'active' ? <button className="secondary-button" onClick={() => applySearch({query: ''})}>Back to your space</button> : <button className="primary-button" onClick={openCapture}><Plus size={16} />Save your first item</button>}<span className="empty-hint">Stored locally. Findable later.</span></div> : <div className={`item-grid ${view === 'list' ? 'list-view' : ''}`} aria-busy={loading}>{items.map(item => <article className={`item-card ${item.kind}`} key={item.id}>
          <div className="card-top"><div className={`item-icon ${item.kind}`}><KindIcon kind={item.kind} size={19} /></div><span className="kind-label">{item.kind}</span><button className={`icon-button favorite-button ${item.favorite ? 'is-favorite' : ''}`} aria-label={item.favorite ? `Unfavorite ${item.title}` : `Favorite ${item.title}`} onClick={() => void act(() => api.favorite(item.id))}><Star size={15} fill={item.favorite ? 'currentColor' : 'none'} /></button><button className="icon-button" aria-label={`Details for ${item.title}`} onClick={() => setSelectedId(item.id)}><MoreHorizontal size={17} /></button></div>
          <button className="card-body" onClick={() => setSelectedId(item.id)}><h3>{item.title}</h3><p>{item.description}</p></button>
          <div className="card-tags">{item.tags.slice(0, 3).map(t => <button key={t} onClick={() => { setScope('active'); setTag(t); setFilter('all'); }}>{t}</button>)}{item.status === 'indexing' && <span className="index-state"><LoaderCircle size={10} className="spin" />Indexing</span>}{item.status === 'error' && <button className="needs-attention" onClick={() => setSelectedId(item.id)}>AI needs attention</button>}{item.match === 'semantic' && <span className="semantic-match"><Sparkles size={10} />Meaning match</span>}</div>
          <div className="card-footer"><button className="locator-button" title={item.locator} onClick={() => void act(() => api.copy(item.locator), 'Copied to clipboard')}><span>{item.locator.replace(/^https?:\/\/(www\.)?/, '')}</span><Copy size={11} /></button><span className="card-date">{niceDate(item.createdAt)}</span><button className="open-button" aria-label={`Open ${item.title}`} onClick={() => void act(() => api.open(item.id))}><ArrowUpRight size={14} /></button></div>
        </article>)}</div>}
        {stats.total > 0 && <div className="collection-end"><span /><Brand small /><span /><p>A little space. A clearer mind.</p></div>}
      </div>
      <footer className="statusbar"><span><HardDrive size={12} />{stats.total} {stats.total === 1 ? 'item' : 'items'} kept locally<span className="statusbar-dot">·</span>{stats.enriched} AI enriched</span><span>Made for the way you remember <span className="tiny-orbit" /></span></footer>
    </main>
    {notification && <div className="toast" role="status"><Check size={15} />{notification}{undoId && notification === 'Moved to trash' && <button onClick={() => void act(async () => { await api.restore(undoId); setUndoId(null); }, 'Item restored')}>Undo</button>}</div>}
    {captureOpen && <Modal label="Quick capture" onClose={closeCapture} className="capture-modal"><Capture onClose={closeCapture} /></Modal>}
    {settingsOpen && <Modal label="Settings" onClose={closeSettings} className="settings-modal"><SettingsPanel onClose={closeSettings} toast={toast} /></Modal>}
    {saveSearchOpen && <Modal label="Save search" onClose={closeSaveSearch} className="detail-modal"><SaveSearchForm input={{query, filter, tag, sort, scope}} onClose={closeSaveSearch} toast={toast} /></Modal>}
    {paletteOpen && <Modal label="Command palette" onClose={closePalette} className="palette-modal"><CommandPalette saved={saved} onClose={closePalette} search={() => input.current?.focus()} capture={openCapture} settings={() => setSettingsOpen(true)} navigate={applySearch} /></Modal>}
    {editing && <Modal label="Edit item" onClose={closeEditing} className="detail-modal"><ItemEditor item={editing} onClose={closeEditing} toast={toast} /></Modal>}
    {selected && !editing && <Modal label={`Details for ${selected.title}`} onClose={closeDetail} className="detail-modal">
      <div className="modal-header"><div className={`item-icon ${selected.kind}`}><KindIcon kind={selected.kind} size={22} /></div><CloseButton onClick={closeDetail} /></div>
      <div className="detail-body"><div className="eyebrow">{selected.kind.toUpperCase()} · KEPT {niceDate(selected.createdAt).toUpperCase()}</div><h2>{selected.title}</h2><div className="detail-locator"><span>{selected.locator}</span><button className="icon-button" aria-label="Copy link or path" onClick={() => void act(() => api.copy(selected.locator), 'Copied to clipboard')}><Copy size={16} /></button></div><h4>YOUR DESCRIPTION</h4><p className="detail-description">{selected.description}</p>{selected.summary && selected.status === 'ready' && <div className="ai-summary"><h4><Sparkles size={13} />AI CONTEXT</h4><p>{selected.summary}</p>{selected.keywords.length > 0 && <span>Also findable as: {selected.keywords.join(' · ')}</span>}</div>}<div className="detail-tags">{selected.tags.map(t => <span key={t}>#{t}</span>)}</div><div className="index-detail"><span className={`status-dot ${selected.status === 'error' ? 'warning' : ''}`} /><span>{selected.status === 'ready' ? 'AI enriched · searchable locally' : selected.status === 'indexing' ? 'Saved · adding AI context…' : selected.status === 'error' ? selected.error : 'Saved locally · full-text search ready'}</span><button className="text-button" onClick={() => void act(() => api.retry(selected.id), 'Indexing requested')} disabled={selected.status === 'indexing'}>Re-index</button></div>
      {!selected.deletedAt && <RelatedItems id={selected.id} revision={revision} onSelect={id => { applySearch({query: ''}); setSelectedId(id); }} />}
      {deleteConfirm && <div className="delete-confirm" role="alert"><p>Move this item to Trash? You can restore it later. The original link or file is untouched.</p><button className="text-button" onClick={() => setDeleteConfirm(false)}>Keep it</button><button className="danger-button" onClick={() => void act(async () => { await api.remove(selected.id); setUndoId(selected.id); closeDetail(); }, 'Moved to trash')}>Remove item</button></div>}
      </div><div className="detail-footer">{selected.deletedAt ? <button className="secondary-button" onClick={() => void act(async () => { await api.restore(selected.id); closeDetail(); }, 'Item restored')}><RotateCcw size={15} />Restore</button> : <><button className="icon-button delete-button" aria-label="Remove item" onClick={() => setDeleteConfirm(true)}><Trash2 size={17} /></button><button className="secondary-button" onClick={() => setEditing(selected)}><Pencil size={14} />Edit</button><button className="secondary-button" onClick={() => void act(async () => { await api.archive(selected.id); closeDetail(); }, selected.archivedAt ? 'Moved to your space' : 'Item archived')}><Archive size={14} />{selected.archivedAt ? 'Unarchive' : 'Archive'}</button></>}<button className="secondary-button" onClick={() => void act(() => api.favorite(selected.id))}><Star size={15} fill={selected.favorite ? 'currentColor' : 'none'} />{selected.favorite ? 'Favorited' : 'Favorite'}</button><button className="primary-button" onClick={() => void act(() => api.open(selected.id))}>{selected.kind === 'link' ? 'Open link' : selected.kind === 'folder' ? 'Open folder' : 'Reveal file'}<ArrowRight size={15} /></button></div>
    </Modal>}
  </div>;
}
function LockGlyph() { return <ShieldCheck size={14} className="workspace-lock" />; }
