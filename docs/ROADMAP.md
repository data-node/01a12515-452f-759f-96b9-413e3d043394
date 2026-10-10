# Notch improvement plan

Updated 2026-10-10. Current development version: **0.2.0**. The first release is frozen at **[v0.1.0](https://github.com/data-node/01a12515-452f-759f-96b9-413e3d043394/tree/v0.1.0)**; its source and executable are never replaced by this plan.

## Product direction

Make Notch a personal retrieval space: capture a useful location in seconds, explain why it matters, recover it later in your own words, and discover connections between things you already saved. Keep the notch small; put organization, intelligence, and diagnostics in the control panel. SQLite remains the source of truth. AI should improve recall without becoming a prerequisite for saving or searching.

The “third brain” direction is a searchable context layer for both the user and their future AI tools: evidence, project context, explicit relationships, and bounded context exports. It should earn trust with accurate paths and recoverable data before adding autonomous actions.

## Research and evidence

Read live YC directory pages, product websites, and official repositories on 2026-10-10. These are product patterns, not a claim that every feature below is an industry standard or that we copied their implementations.

| Reference | Primary source read | Observed pattern | Application to Notch |
| --- | --- | --- | --- |
| Onyx — YC Winter 2024 | [YC profile](https://www.ycombinator.com/companies/onyx), [Official README](https://github.com/onyx-dot-app/onyx#readme); website [onyx.app](https://onyx.app) | Live site and YC launch describe hybrid retrieval, permission-aware context across sources, model choice, and citations | Evidence-based retrieval, visible indexing health, separate source ingestion from capture, optional connectors |
| Raycast — YC Winter 2020 | [YC profile](https://www.ycombinator.com/companies/raycast), [Official extensions repository](https://github.com/raycast/extensions#readme); website [raycast.com](https://www.raycast.com) | Live site highlights keyboard-first launcher, quicklinks, aliases, note capture, hotkeys and extensions | Command palette, predictable shortcuts, quick actions, future extension boundary |
| Khoj | [Official README](https://github.com/khoj-ai/khoj#readme); website [khoj.dev](https://khoj.dev) | Live site describes a personal second brain, agents and scheduled research; official repo describes semantic search and local/online models | Connected items, later resurfacing and cited answers, equal provider choice, local operation |
| Quivr | [Official README](https://github.com/QuivrHQ/quivr#readme) | Current V2 evaluation-stage design emphasizes durable writes, idempotency, background enrichment, rebuildable indexes and retrieval evaluation | Immediate SQLite commits, safe retries, explicit lifecycle states, later regression benchmarks and index rebuilds |
| ThirdBrain candidate | [S-zhi/ThirdBrain English README](https://github.com/S-zhi/ThirdBrain/blob/main/README.en.md) | Versioned scoped context, evidence-backed knowledge cards, relation graph, machine-consumable retrieval, rebuildable indexes | Provenance, explicit project scopes, related-item reasons, future context capsules and read-only MCP |

**Research limits:** “3rd brain” identifies several unrelated projects. The ThirdBrain repository above is a relevant candidate, not a confirmed identification of the product the user had in mind and not a claim of YC affiliation. Direct website requests were initially blocked; when follow-up website requests succeeded, the Onyx/Raycast YC pages and product sites, plus Khoj's website, were successfully read. YC lists Onyx as Winter 2024 (acquired) and Raycast as Winter 2020 (active). Product-site performance/cost numbers are marketing claims, not Notch measurements. Mem's requested YC slug returned 404 and its public URL served a JavaScript-dependent app shell, so Mem features and YC membership are not asserted. A YC directory query for “third brain” did not identify a specific project in the returned page; that identification remains open.

### What the website pass changed

Raycast's quicklinks, aliases and hotkeys reinforced the keyboard-first command palette and saved-search shortcuts in 0.2.0. Onyx's parallel indexed retrieval and source citations reinforced visible match evidence, index health and the later cited-answer/evaluation work. Khoj's product separation and local coworker direction reinforced keeping capture simple while building context tools in the control panel. We retain SQLite and local defaults; enterprise stacks or marketing benchmarks are not imported as requirements.

## Priorities and release scope

- **P0 / 0.2.0:** trustworthy library operations, retrieval shortcuts, connections, migration safety, reproducible downloads.
- **P1 / 0.3.x:** capture speed, project spaces, data health, and measured retrieval quality.
- **P2 / 0.4.x:** grounded answers, content ingestion, resurfacing, and third-brain context exports.
- **P3 / later:** integrations, optional synchronization, collaboration, and controlled automation.

Effort: S = a focused change; M = several implementation and validation steps; L = a feature requiring a separate design and release. Release groups express order, not promised delivery dates. “Implemented” means source is present; release validation and downloadable artifact evidence are tracked in [validation](validation.md).

## The improvement backlog

| ID | Priority | Improvement and concrete acceptance criterion | Effort | Status |
| --- | --- | --- | --- | --- |
| 01 | P0 | Freeze v0.1.0 source and original executable under an immutable version tag; verify its checksum after the next release | S | Implemented |
| 02 | P0 | Update package, lockfile, and UI to 0.2.0 using one version source | S | Implemented |
| 03 | P0 | Edit title, description, tags, and locator; preserve item identity and favorite | M | Implemented |
| 04 | P0 | Manually correct folder/file classification for extensionless files and dotted folders | S | Implemented |
| 05 | P0 | Keep user-written titles through AI enrichment and backup/restore | S | Implemented |
| 06 | P0 | Archive items without losing them; keep active and archive searches separate | M | Implemented |
| 07 | P0 | Recoverable trash rather than immediate deletion; originals stay untouched | M | Implemented |
| 08 | P0 | Undo trash action and restore later from the control panel | S | Implemented |
| 09 | P0 | Persistent named searches containing query, collection, tags, type, and sort | M | Implemented |
| 10 | P0 | Search operators: `type:folder`, `tag:ai`, `tag:"team work"`, `is:favorite`, `status:error` | M | Implemented |
| 11 | P0 | Keyboard command palette with command filtering, arrow navigation and saved searches; Ctrl+Shift+P opens it | M | Implemented |
| 12 | P0 | Related items ranked by shared tags and compatible local vectors, with visible reasons | M | Implemented |
| 13 | P0 | Indexing health counts, issue search, and bounded retry of failed items | S | Implemented |
| 14 | P0 | Atomic v1→v2 migration with a readable pre-migration SQLite backup; reject newer schemas | M | Implemented |
| 15 | P0 | V2 JSON exports retain archive/trash, saved searches and title ownership; V1 imports still work transactionally | M | Implemented |
| 16 | P0 | Prevent stale AI responses after edits, duplicate capture, trash and restore | M | Implemented |
| 17 | P0 | Versioned Windows release assets with checksums and a stable download URL independent of expiring Actions artifacts | M | Released |
| 18 | P0 | Windows CI reports packaging failures clearly and validates actual packaged app capture/search before release | M | Released |
| 19 | P1 | Clipboard-aware capture: deliberate paste action with URL/path preview; never silently collect clipboard history | S | Planned |
| 20 | P1 | Drag a file/folder onto capture and fill the locator accurately, including UNC paths | M | Planned |
| 21 | P1 | In-notch type selector and validation for extensionless files; retain the compact layout | S | Planned |
| 22 | P1 | Browser bookmark import from HTML with duplicate review and atomic import | M | Planned |
| 23 | P1 | CSV import with column mapping and dry-run error summary | M | Planned |
| 24 | P1 | Browser extension: save current URL, selected text and source title through an explicit local bridge | L | Planned |
| 25 | P1 | Standalone thought/note capture without a locator; notes become first-class searchable items | M | Planned |
| 26 | P1 | Inbox review queue for captures needing titles/tags, with keyboard next/previous | M | Planned |
| 27 | P1 | Project spaces with scoped search and configurable local/cloud AI choices | L | Planned |
| 28 | P1 | Bulk select, archive, restore, favorite, tag and retry with clear operation results | M | Planned |
| 29 | P1 | Tag rename/merge, aliases and casing normalization without losing associations | M | Planned |
| 30 | P1 | Recent searches stored locally, clearable and optionally disabled | S | Planned |
| 31 | P1 | Search result snippets with matched words and accessible highlighting | M | Planned |
| 32 | P1 | Exact phrase, exclusion, date and domain operators with a documented parser | M | Planned |
| 33 | P1 | A labeled retrieval benchmark of at least 50 real path/link queries, measuring Recall@10 and MRR | M | Planned |
| 34 | P1 | Measure p50/p95 local search latency at 1k/10k/50k items before changing the index architecture | M | Planned |
| 35 | P1 | SQL-side candidate filtering and pagination; retain relevant results for sparse tags and large archives | M | Planned |
| 36 | P1 | Embedding model migration with coverage, job progress, resumable work and cancellation | L | Planned |
| 37 | P1 | Separate user tags from model suggestions; accept/reject suggestions and preserve explicit ownership | M | Planned |
| 38 | P1 | Link/path health checks initiated by the user; distinguish unavailable from deleted and avoid destructive repairs | M | Planned |
| 39 | P1 | Scheduled local backups with retention and restore preview; protect a running WAL database correctly | M | Planned |
| 40 | P1 | Item revision history and compare/restore descriptions with timestamps | M | Planned |
| 41 | P1 | Database integrity check and rebuildable FTS projection with recovery documentation | M | Planned |
| 42 | P1 | Export to Markdown and open formats including human-readable related-item references | M | Planned |
| 43 | P1 | Accessibility audit: screen reader labels, keyboard-only flows, reduced motion, contrast and 200% scaling | M | Planned |
| 44 | P1 | Persist window placement, list/grid choice and sort; recover onto visible displays after monitor changes | S | Planned |
| 45 | P1 | Windows signing, installer upgrade/uninstall checks, portable path checks and trusted download UX | L | Planned |
| 46 | P2 | “Ask my space”: retrieved answers cite saved items, preserve exact paths and abstain without evidence | L | Planned |
| 47 | P2 | Context capsules: select relevant items and export a bounded Markdown/JSON brief for Claude or local agents | M | Planned |
| 48 | P2 | Read-only local MCP server exposing scoped search, item lookup and context export | L | Planned |
| 49 | P2 | Explicit backlinks and typed relationships such as “root of”, “reference for” and “replaces” | M | Planned |
| 50 | P2 | A useful graph view with relation reasons and a list alternative; never infer unsupported factual relations | M | Planned |
| 51 | P2 | Weekly rediscovery queue based on age, tags and user choices; no background external messaging | M | Planned |
| 52 | P2 | Review reminders and snooze for useful items; notifications stay optional and local | M | Planned |
| 53 | P2 | Opt-in website content extraction with source URL, fetch time, size limits and prompt-injection boundaries | L | Planned |
| 54 | P2 | Opt-in PDF/Markdown/text indexing with source spans, per-source permission and bounded chunking | L | Planned |
| 55 | P2 | OCR for deliberate screenshot capture, retaining the image source and correcting extracted text | L | Planned |
| 56 | P2 | Reranking evaluation against the BM25/RRF baseline; add a small local model only if measured gains justify latency | M | Planned |
| 57 | P2 | Multilingual search evaluation and language-aware tokenization/embedding choices | L | Planned |
| 58 | P2 | Provider cost estimates, request budgets and explicit model availability checks | M | Planned |
| 59 | P2 | Privacy controls per item/project: local only, cloud allowed, exclusions and deletion of generated vectors | M | Planned |
| 60 | P2 | Local diagnostic bundle with deliberate export and automatic secret/path redaction | M | Planned |
| 61 | P3 | Obsidian and Markdown folder connector with incremental indexing and provenance | L | Planned |
| 62 | P3 | Read-only GitHub repository context connector with scoped credentials and incremental updates | L | Planned |
| 63 | P3 | Optional Notion/Drive connectors with source permissions and explicit sync boundaries | L | Planned |
| 64 | P3 | Optional end-to-end encrypted device sync with deletion/conflict semantics and an offline queue | L | Planned |
| 65 | P3 | Team spaces only after permission-aware retrieval and isolation tests are designed | L | Planned |
| 66 | P3 | Local extension API for commands and capture adapters with a narrow capability model | L | Planned |
| 67 | P3 | Mobile/browser capture inbox with authenticated pairing and duplicate handling | L | Planned |
| 68 | P3 | User-created review automations with dry-run, audit trail and recoverable local changes | L | Planned |
| 69 | P3 | Delta updates and signed release metadata; keep rollback assets and validate migration compatibility | L | Planned |
| 70 | P3 | Optional user feedback/exported search failures to improve ranking; no hidden telemetry | M | Planned |

## Release checks and measures

For 0.2.0: migrate an actual v1-schema fixture and read its backup; edit and retrieve changed descriptions; keep custom titles through provider races; isolate active/archive/trash across text and vector search; restore after trash; round-trip V1/V2 imports; persist saved searches; exercise keyboard commands, connected items and real Electron IPC. Run the existing capture, SQLite and provider tests too. Validate the public download and SHA-256 before claiming a release is available.

For later releases, measure time from hotkey to a usable input, local-save latency, retrieval Recall@10/MRR, p95 query latency, migration recoverability and provider failure behavior. These are proposed measures, not results already obtained. Improvements must remain useful with no credentials and no model server. Cited answers and graph relations must distinguish user facts, retrieved evidence and AI suggestions.

## Freeze and version policy

The v0.1.0 tag points to `442b664b96a25a4e29d93bc3100ea390bb757480`. Its original executable remains in `downloads/Notch-0.1.0-win-x64.exe`, including at the frozen tag. Never repoint that tag, overwrite its binary, or patch the frozen source. New work goes on main with a new SemVer version and release notes. A release tag is created only after the relevant validation passes.

V0.2.0 changes the local schema to version 2. Before upgrading an existing version-1 database, Notch creates `notch.sqlite.pre-v2-<timestamp>.bak` beside it. To roll back the data, quit every Notch process, preserve the current database/WAL/SHM as a separate recovery copy, then restore that pre-upgrade database into a separate data directory for v0.1.0. **Do not run the frozen old app on the upgraded database.** A frozen source tag preserves a release; it does not promise backwards database compatibility or signed Windows binaries.
