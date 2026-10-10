export type Kind = 'link' | 'folder' | 'file';
export type IndexStatus = 'local' | 'indexing' | 'ready' | 'error';
export interface Item {
  id: string; locator: string; title: string; description: string; summary: string;
  kind: Kind; tags: string[]; keywords: string[]; favorite: boolean;
  createdAt: string; updatedAt: string; status: IndexStatus; error: string;
  embedding: number[] | null; embeddingModel: string | null;
  titleLocked?: boolean; archivedAt: string | null; deletedAt: string | null;
}
export interface SearchHit extends Item { score: number; match: 'text' | 'semantic' | 'hybrid' | 'recent' }
export interface CaptureInput { locator: string; description: string; tags?: string[]; kind?: Kind }
export interface EditInput extends CaptureInput { title: string }
export interface SavedSearch { id: string; name: string; input: SearchInput; createdAt: string }
export interface RelatedHit extends Item { reasons: string[] }
export interface SearchInput { scope?: 'active' | 'archived' | 'trash'; query: string; filter?: 'all' | 'favorites' | Kind; tag?: string; sort?: 'relevance' | 'newest' | 'oldest' }
export interface Settings {
  provider: 'none' | 'anthropic' | 'ollama'; anthropicModel: string;
  ollamaUrl: string; ollamaModel: string; embeddings: boolean; embeddingModel: string;
  shortcut: string; launchAtLogin: boolean; hasApiKey: boolean; canStoreApiKey: boolean;
}
export type SettingsUpdate = Partial<Omit<Settings, 'hasApiKey' | 'canStoreApiKey'>> & { apiKey?: string };
export interface Stats { total: number; links: number; folders: number; files: number; favorites: number; enriched: number; archived: number; trash: number; indexing: number; errors: number; tags: string[] }
export interface SaveResult { item: Item; duplicate: boolean }
export interface NotchAPI {
  search(input: SearchInput): Promise<SearchHit[]>;
  capture(input: CaptureInput): Promise<SaveResult>;
  stats(): Promise<Stats>;
  favorite(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  edit(id: string, input: EditInput): Promise<Item>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  related(id: string): Promise<RelatedHit[]>;
  savedSearches(): Promise<SavedSearch[]>;
  saveSearch(name: string, input: SearchInput): Promise<SavedSearch>;
  deleteSearch(id: string): Promise<void>;
  retryFailed(): Promise<number>;
  open(id: string): Promise<void>;
  copy(text: string): Promise<void>;
  settings(): Promise<Settings>;
  saveSettings(settings: SettingsUpdate): Promise<Settings>;
  testAI(): Promise<string>;
  retry(id: string): Promise<void>;
  exportData(): Promise<string | null>;
  importData(): Promise<number | null>;
  showCapture(): Promise<void>;
  showLibrary(): Promise<void>;
  hide(): Promise<void>;
  hideLibrary(): Promise<void>;
  minimize(): Promise<void>;
  onChanged(callback: () => void): () => void;
  onCaptureOpened(callback: () => void): () => void;
}
export const DEFAULT_SETTINGS: Settings = {
  provider: 'none', anthropicModel: 'claude-haiku-4-5-20251001',
  ollamaUrl: 'http://127.0.0.1:11434', ollamaModel: 'qwen3:4b',
  embeddings: false, embeddingModel: 'nomic-embed-text',
  shortcut: 'Control+I', launchAtLogin: false, hasApiKey: false, canStoreApiKey: false,
};
