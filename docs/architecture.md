# Architecture

## Desktop boundary

Electron owns two frameless windows. The library is a normal taskbar window that hides to the tray on close. Capture is fixed-size, transparent, always on top, and placed at the top center of the monitor containing the pointer. It is shown by a registered global shortcut, the tray menu/click, or the library action. Reopening capture starts a fresh draft; dismissing without saving discards the draft. Live processes must be started again after cloud snapshot restore.

The renderer is sandboxed with context isolation and no Node integration. A CommonJS preload exposes a narrowly scoped typed IPC bridge. Main-process handlers accept requests only from the two app windows' main frames and validate search, capture, and settings input. Navigation, popups, and permission requests are blocked; links open only through the validated desktop handler. Production CSP restricts code and fonts to bundled files. Development alone permits Vite's inline bootstrap.

## Write and enrichment flow

1. Validate/canonicalize an absolute path or HTTP(S) URL; reject embedded URL credentials and unsupported schemes.
2. Commit the original locator and description to SQLite. Unique canonical locators prevent duplicates. Windows paths compare case-insensitively; URLs retain query parameters and fragments.
3. Notify both windows and immediately acknowledge persistence.
4. If enabled, schedule AI enrichment/embeddings with a concurrency limit of two. Version guards discard stale responses after a duplicate update or deletion.
5. Atomically update metadata and the FTS index via SQLite triggers, or store a useful error while leaving the capture available.

No web scraping or file content ingestion occurs. Metadata prompts explicitly separate supplied data from instructions; outputs are schema-validated and bounded. Request redirects are refused, timeouts are finite, HTTPS verification remains enabled, and remote errors are summarized without reflecting provider bodies. Local Ollama permits loopback HTTP; remote Ollama requires HTTPS.

## Retrieval

SQLite FTS5 indexes title, locator, original description, generated summary, tags, and keywords with `porter unicode61`. User queries are tokenized into quoted prefix terms; FTS operators cannot be injected. An OR query maximizes recall. Weighted BM25 prioritizes titles (8), descriptions (5), tags/keywords (4), summaries (3), and locators (2).

Optional embeddings are numerical arrays stored with their model ID. The initial implementation computes cosine similarity in-process across eligible items, then combines lexical and semantic ranked lists with reciprocal rank fusion. This avoids a native vector-extension packaging dependency. It is suitable for a personal collection; a much larger collection should migrate to a dedicated SQLite vector extension and database-level filtering rather than loading vectors into memory. Results are capped at 200 for nonempty searches. Empty queries list the collection by date. Search has a short renderer debounce, ignores stale responses, and falls back to lexical retrieval when embedding requests fail.

## Storage and backup

The database lives in the OS user-data directory, outside application files. WAL and busy timeout are enabled. Preferences and encrypted key bytes live in a separate table; exports include only collection data. Windows safeStorage uses OS protection. Linux's `basic_text` fallback is rejected for persistent API keys. Environment-injected keys are supported and take precedence over a stored key. Backups omit embedding vectors and credentials; imports validate all entries in a transaction and skip canonical duplicates.

## Current limits

There is no account, sync service, browser extension, content crawler, encrypted collection, vector extension, or bulk re-index UI. The default API model is an editable known Haiku identifier; access to a particular model must be checked with the user's account. Real Anthropic/Ollama requests require a key or a running model server and are not covered by mocked provider tests. Windows-specific tray, hotkey, login behavior, installer execution, and code signing require Windows validation.
