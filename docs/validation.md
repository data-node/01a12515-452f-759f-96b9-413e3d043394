# Validation — 2026-10-10

The current cloud machine is Linux, with Node 24.19.0, Chromium, and a dummy Xorg display. This validates the development environment and shared application behavior, not Windows installation or OS integration.

| Check | Result |
| --- | --- |
| Frozen installation, including Electron's verified binary download | Passed: `npm ci --no-audit --no-fund`, using writable caches and the platform proxy |
| TypeScript and production bundle | Passed: `npm run build` |
| Real SQLite and mocked provider suite | 17 passed, 0 failed, 0 skipped |
| Browser interface suite | 5 passed, 0 failed, 0 skipped |
| Native Electron smoke | Passed: real SQLite capture/search, separate capture window, global shortcut registration on Linux, renderer isolation, favorites, and persistence after process restart |
| Portable Windows x64 packaging | Passed: `electron-builder --win portable --x64 --config.win.signAndEditExecutable=false` |
| Packaged build consistency | Bundled UI, desktop process, preload, fonts, and icons match the current build |
| Windows executable signature | Unsigned; no Authenticode certificate. SHA-256 file generated beside the executable |
| NSIS installer on this machine | Blocked: Wine is unavailable. The incomplete intermediate installer was removed |
| Live Anthropic / Ollama | Not run: no real API key or local model server was configured; HTTP adapter tests are mocked |
| Windows tray, Explorer, login startup, shortcut, portable launch, and installer execution | Not run: needs a real Windows 10/11 machine |

The exact **claude root folder → C:\Projects\Claude** lookup passed against real SQLite, in both backend tests and the native app. Duplicate updates, FTS syntax safety, weighted BM25, semantic rank fusion, fallback when embeddings are offline, transactional import, deletion during AI work, and stale AI responses are covered by the backend suite.

Browser tests cover capture with manual tags, saved-item search, favorites, deletion confirmation, provider/model preferences, view switching, and empty results. Browser sample data is explicitly labeled and separate from desktop SQLite.

Native smoke uses a fresh temporary user-data directory and removes it afterward. This container has no usable Chromium OS sandbox; only this isolated Linux test process used the explicit `NOTCH_SMOKE_NO_SANDBOX=1` flag. Normal development and packaged Windows startup retain their default sandbox configuration.

Reusable `install_script` and `start_skill` were saved to the environment configuration draft. Draft saving does not publish a snapshot or establish fresh-task restoration. Review/save in environment settings and publish separately.
