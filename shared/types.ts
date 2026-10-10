export type Kind = 'link' | 'folder' | 'file';
export type IndexStatus = 'local' | 'indexing' | 'ready' | 'error';
export interface Item {
  id: string; locator: string; title: string; description: string; summary: string;
  kind: Kind; tags: string[]; keywords: string[]; favorite: boolean;
  createdAt: string; updatedAt: string; status: IndexStatus; error: string;
  embedding: number[] | null; embeddingModel: string | null;
}
export interface SearchHit extends Item { score: number; match: 'text' | 'semantic' | 'hybrid' | 'recent' }
export interface CaptureInput { locator: string; description: string; tags?: string[] }
export interface SearchInput { query: string; filter?: 'all' | 'favorites' | Kind; tag?: string; sort?: 'relevance' | 'newest' | 'oldest' }
export interface Settings {
  provider: 'none' | 'anthropic' | 'ollama'; anthropicModel: string;
  ollamaUrl: string; ollamaModel: string; embeddings: boolean; embeddingModel: string;
  shortcut: string; launchAtLogin: boolean; hasApiKey: boolean; canStoreApiKey: boolean;
}
export type SettingsUpdate = Partial<Omit<Settings, 'hasApiKey' | 'canStoreApiKey'>> & { apiKey?: string };
export interface Stats { total: number; links: number; folders: number; files: number; favorites: number; enriched: number; tags: string[] }
export interface SaveResult { item: Item; duplicate: boolean }
export interface NotchAPI {
  search(input: SearchInput): Promise<SearchHit[]>;
  capture(input: CaptureInput): Promise<SaveResult>;
  stats(): Promise<Stats>;
  favorite(id: string): Promise<void>;
  remove(id: string): Promise<void>;
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
