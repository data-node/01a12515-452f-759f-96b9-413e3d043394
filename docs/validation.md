# Validation — Notch 0.2.0 — 2026-10-10

The current cloud machine is Linux, with Node 24.19.0, Chromium, and a dummy Xorg display. This validates the development environment and shared application behavior, not Windows installation or OS integration.

| Check | Result |
| --- | --- |
| Frozen installation, including Electron's verified binary download | Passed: `npm ci --no-audit --no-fund`, using writable caches and the platform proxy |
| TypeScript and production bundle | Passed: `npm run build` |
| Real SQLite and mocked provider suite | 29 passed, 0 failed, 0 skipped |
| Browser interface suite | 9 passed, 0 failed, 0 skipped |
| Native Electron smoke | Passed: real SQLite capture/search, separate capture window, global shortcut registration on Linux, renderer isolation, editing, saved filters, archive/trash/restore, favorites, and persistence after process restart |
| Original 0.1.0 portable Windows x64 packaging | Passed: `electron-builder --win portable --x64 --config.win.signAndEditExecutable=false` |
| Original 0.1.0 packaged build consistency | Bundled UI, desktop process, preload, fonts, and icons match the current build |
| Windows executable signature | Unsigned; no Authenticode certificate. SHA-256 file generated beside the executable |
| NSIS installer on this machine | Blocked: Wine is unavailable. The incomplete intermediate installer was removed |
| Live Anthropic / Ollama | Not run: no real API key or local model server was configured; HTTP adapter tests are mocked |
| Windows tray, Explorer, login startup, shortcut, portable launch, and installer execution | Not run: needs a real Windows 10/11 machine |

The exact **claude root folder → C:\Projects\Claude** lookup passed against real SQLite, in both backend tests and the native app. Duplicate updates, FTS syntax safety, weighted BM25, semantic rank fusion, fallback when embeddings are offline, transactional import, deletion during AI work, and stale AI responses are covered by the backend suite.

Browser tests cover capture with manual tags, saved-item search, favorites, deletion confirmation, provider/model preferences, view switching, and empty results. Browser sample data is explicitly labeled and separate from desktop SQLite.

Native smoke uses a fresh temporary user-data directory and removes it afterward. This container has no usable Chromium OS sandbox; only this isolated Linux test process used the explicit `NOTCH_SMOKE_NO_SANDBOX=1` flag. Normal development and packaged Windows startup retain their default sandbox configuration.

Reusable `install_script` and `start_skill` were saved to the environment configuration draft. Draft saving does not publish a snapshot or establish fresh-task restoration. Review/save in environment settings and publish separately.

The original executable's SHA-256 still verifies, and the immutable v0.1.0 tag points to the original source. Version 0.2.0 Windows packaging/runtime CI is pending at this stage. The updated workflow keeps failing packaging logs and exposes final diagnostic lines as annotations, so failures can be investigated without claiming a download exists.

New SQLite checks exercise the exact frozen v1 schema, a readable independent pre-migration backup, restart without repeated migration, refusal of newer schemas, custom titles, canonical collision handling, operator search, scoped text/vector results, related-item evidence, V1/V2 round trips and stale provider responses after editing/trash/restoration. UI checks exercise the same new user flows, including Close/Cancel without saving and keyboard saved-search navigation.

The first 0.2.0 Windows CI attempt passed all 25 backend tests and compilation. Packaging completed the executable generation but then failed because electron-builder implicitly attempted publication in CI without a GitHub token. The corrected workflow uses `--publish never` during packaging and a separate least-privilege release job after the packaged-runtime smoke test. Signing is disabled explicitly; native Windows metadata editing is retained.
