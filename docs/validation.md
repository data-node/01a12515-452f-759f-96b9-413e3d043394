# Validation — Notch 0.2.0 — 2026-10-10

The application source released as v0.2.0 is commit `3803bda71a7802b547a56eb9d4a6ad633ad11416`. The original v0.1.0 source is `442b664b96a25a4e29d93bc3100ea390bb757480`; its original executable SHA-256 is `236ca831c77ad9444e301532878f7817e03f41f31880c20556dc62516577c91b`.

| Check | Result |
| --- | --- |
| Frozen dependency installation | Passed on Windows CI: Node 24 and `npm ci --no-audit --no-fund` |
| TypeScript and production bundle | Passed on cloud Linux and Windows CI |
| Real SQLite and mocked provider tests | 25 passed, 0 failed, 0 skipped on Linux and Windows |
| Browser UI tests | 9 passed, 0 failed, 0 skipped on Linux Chromium |
| Native Electron smoke on Linux | Passed in a fresh temporary collection with isolated IPC, capture/search, edits, saved filters, archive/trash/restore, shortcut registration, favorites and restart persistence |
| Native packaged app smoke on Windows | Passed using `release/win-unpacked/Notch.exe`; the same functional assertions executed against the packaged Windows runtime |
| NSIS installer and portable x64 packaging | Passed on native Windows CI |
| Frozen v0.1.0 preservation | Tag still points to the original source. Original repository checksum verifies. Published release asset digest equals the original checksum and its public URL returns a valid executable header |
| Live Anthropic / Ollama | Not run; no live provider credentials/model server configured. Provider adapter tests are mocked |
| Installer install/uninstall and upgrade UX | Not run; installer was generated, while capture/search was checked in the unpacked packaged runtime |
| Explorer opening, startup at login, physical shortcut across apps, portable launcher execution on a user's Windows machine | Manual validation remains; automated smoke checks registration and native app behavior |
| Windows signature | Unsigned, with signing explicitly disabled. Native Windows executable icon/version metadata editing is retained |

The exact **claude root folder → C:\Projects\Claude** retrieval passed against real SQLite on Linux and in the packaged Windows app. The automated Windows test does not open that illustrative nonexistent path in Explorer.

New tests use the exact frozen v1 SQL schema to verify one-time migration, preserved preferences/FTS, an independently readable pre-migration backup, and refusal of a future schema without changing it. Other checks cover canonical collision rejection, preservation of user titles through enrichment, search operators, active/archive/trash separation for lexical and vector retrieval, saved-search persistence, relation evidence, V1/V2 round trips, transactional rollback, and stale provider results after edit/trash/restoration.

UI tests cover capture, search, favorites, explicit trash confirmation, Undo, restore, archive, editing, Close/Cancel without saving, saved filters, keyboard commands, connected items, settings and layouts. Browser sample data is explicitly labeled and separate from desktop SQLite. Preview PNGs were visually inspected and their public repository bytes checked against the local files.

## Build diagnosis and release process

The early Windows builds failed after executable generation because electron-builder implicitly attempted publication in CI without a GitHub token. Packaging now uses `--publish never`; publication uses a separate GitHub Actions job with `contents: write` only after successful packaged-runtime validation. A direct cloud release upload returned HTTP 401, so the original frozen release was published by an authorized workflow using GitHub Actions' token. No user credentials were printed or requested.

The successful main-branch Windows build is [run 38057297872](https://github.com/data-node/01a12515-452f-759f-96b9-413e3d043394/actions/runs/38057297872). The frozen release publication is [run 38057349767](https://github.com/data-node/01a12515-452f-759f-96b9-413e3d043394/actions/runs/38057349767). The tagged [release build 38057565403](https://github.com/data-node/01a12515-452f-759f-96b9-413e3d043394/actions/runs/38057565403) passed both Windows validation and release publication.

On constrained cloud Linux, only the isolated native smoke process uses `NOTCH_SMOKE_NO_SANDBOX=1`. Normal development and packaged Windows builds keep sandbox defaults. Windows smoke does not set that bypass.

Reusable installation/start instructions and necessary research/GitHub domains are saved to the cloud environment configuration draft. Saving a draft does not publish a snapshot or establish fresh-task restoration; review/save and publish in environment settings remain separate operations.

## Public download verification

Both complete files were downloaded through their public GitHub release URLs after publication. File sizes and computed SHA-256 values match both the downloaded checksum files and GitHub's server digests. Both have valid PE executable headers and no Authenticode certificate.

| Asset | Bytes | SHA-256 |
| --- | --- | --- |
| [Portable 0.2.0](https://github.com/data-node/01a12515-452f-759f-96b9-413e3d043394/releases/download/v0.2.0/Notch.0.2.0.exe) | 114086845 | `a04611d6cf77713705daa05c069442c0bf81db2c0834d5adba4e4f4d68e05500` |
| [Installer 0.2.0](https://github.com/data-node/01a12515-452f-759f-96b9-413e3d043394/releases/download/v0.2.0/Notch.Setup.0.2.0.exe) | 114296868 | `cb5e2837f1da745e0286573d6e3aeb284fcb13a1044bfba54699510b0582ecdd` |

GitHub normalizes spaces to dots in the release asset names. Check the hash value in the checksum file; its original builder filename contains spaces. This normalization changes the download name, not the executable bytes.

The first release is [preserved separately](https://github.com/data-node/01a12515-452f-759f-96b9-413e3d043394/releases/tag/v0.1.0). No original executable, checksum or source tag was replaced.
