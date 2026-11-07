# Team studio: async sync design

> Status: Agreed — 7 Nov 2026
> Direction (DEC-14, settled 7 Nov 2026): async sync now; live cloud hub and fully cloud later.
> Tracker: DEC-14 (direction), DEC-15 (this design) · Settled: Q2, Q5, Q6, Q7, Q8 (Cloudflare R2), Q9 (Paste script, then MCP) in `Tracker/open-questions.md`

## 1. Goal

Three members (Gautham on a Mac, two friends on Windows) run one shared channel, The Polyjuice Project. Each person works **locally and offline** in their own copy of the studio. A **Sync** button exchanges work with the others, so everyone sees each other's scripts, reviews and progress. Whoever finishes a video presses **Render & Publish**: it renders on their computer and uploads to YouTube and Instagram.

Sync is **asynchronous**: changes arrive when someone syncs, not live. The design keeps the formats and boundaries that a later **live cloud hub** (stage 2) and a **fully cloud studio** (stage 3) need, so those stages replace the transport without changing the files or the UI.

## 2. Principles (also hold for stages 2 and 3)

1. **One owner per file, one concern per file.** Each concern lives in its own file: the script, the review, the team status, folders and activity. Two people rarely touch the same file at the same time, and conflicts can be merged by key.
2. **Content is separate from code.** The app (code) updates from GitHub. The channel's work (content) syncs separately. Neither depends on where the other lives on disk.
3. **Media is immutable and content-addressed.** Images and audio are stored by their SHA-256 hash and never change once uploaded, so media never conflicts.
4. **Everything is keyed by stable IDs.** Member IDs, project slugs, scene IDs and ISO-8601 UTC timestamps. No OS usernames, no absolute paths, no machine-specific data in shared files.
5. **Sync sits behind one interface.** The dashboard calls only `/api/sync/*` and `/api/team/*`. Stage 1 implements these with Git + object storage; stage 2 with a realtime database; stage 3 on a server.
6. **Facts about local machines stay local.** Renders, caches, secrets and installed tools never sync.
7. **The owner-review rules still apply.** REQ-06 becomes: only a member with the *publisher* role, on the video's final review, renders and publishes.

## 3. What syncs and what stays local

| Class | Examples | Where it goes |
| --- | --- | --- |
| Content (text) | `project.json`, `research.md`, `review.json`, `team.json`, `media.json`, folders, `members.json`, `brand/brand.json`, `library/**/*.json` tags and metadata, `_series/**` | **Content repo** (private Git, GitHub) |
| Media (binary) | `assets/*`, `audio/*.wav`, `captions/*`, `recordings/*`, `library/assets`, `library/music`, `library/characters` sheets, `library/maps`, `library/sfx` | **Blob store** (Cloudflare R2 bucket), by hash; files are listed in a manifest |
| Derived but shared | `timeline.json` (voice timings) | Content repo. Shared so nobody has to re-generate voice (Google voices cost money and Kokoro can differ slightly by machine) |
| Local only | `out/`, `library/voice-samples/` cache, `node_modules`, `tools/.venv`, `tools/models`, `secrets/`, `.studio/` | Never synced |

Sizes today: about 300 MB of content and media in total; a Short is about 2 MB, the long CAR-T video about 50 MB. This is well inside R2's free tier (10 GB).

## 4. Folder layout

```
Video/                     ← code repo (GitHub: polyjuice-studio), what `git pull` updates
├── dashboard/  remotion/  tools/  Tracker/  docs/  AGENTS.md …
├── .studio/               ← local only: me.json (which member I am), sync state, blob cache index
├── secrets/               ← local only
├── out/                   ← local only: renders
└── workspace/             ← content repo (GitHub: polyjuice-channel), its own Git history
    ├── members.json
    ├── workspace.json     ← folders + per-project placement (today projects/_workspace.json)
    ├── activity/<member>.jsonl
    ├── brand/  library/
    └── projects/<slug>/
        ├── project.json   ← the script and scenes (edited by the holder of the lock)
        ├── research.md
        ├── review.json    ← approvals and comments (moved out of project.json)
        ├── team.json      ← owner, assignees, lock, stage, publish record
        ├── media.json     ← manifest: path → sha256, size, type
        └── timeline.json
```

- The dashboard and Python tools get the content root from `STUDIO_WORKSPACE` (default `./workspace`). Remotion uses it as its `publicDir` instead of the symlinks in `remotion/public/`, which also removes a Windows blocker (symlinks need admin rights or Developer Mode).
- **Migration:** move `projects/`, `library/` and `brand/` into `workspace/`. Paths inside `project.json` (`assets/…`, `library/…`) stay valid because they are relative to the content root.

## 5. Shared files

```jsonc
// workspace/members.json — who is on the channel
{ "members": [
  { "id": "gautham", "name": "Gautham", "roles": ["admin", "publisher", "editor", "reviewer"] },
  { "id": "m2", "name": "…", "roles": ["editor", "reviewer"] },
  { "id": "m3", "name": "…", "roles": ["editor", "reviewer"] } ] }

// .studio/me.json — local only: which member this machine belongs to
{ "member": "gautham" }

// projects/<slug>/team.json
{ "owner": "gautham",                       // creates the video; default editor
  "assignees": { "visuals": "m2", "review": "m3" },
  "stage": "scripting",                     // idea | scripting | review | production | ready | published
  "lock": { "by": "m2", "at": "2026-11-08T10:12:00Z", "scope": "script" },   // or null
  "published": { "youtube": { "id": "…", "at": "…", "by": "gautham", "visibility": "private" },
                 "instagram": { "id": "…", "at": "…", "by": "gautham" } } }

// projects/<slug>/review.json — keyed so two reviewers merge cleanly
{ "scenes": { "s3": { "by": { "m3": { "status": "changes", "comment": "…", "hash": "…", "at": "…" } } } },
  "approvals": [ { "by": "gautham", "at": "…", "scriptHash": "…" } ] }

// activity/<member>.jsonl — append-only, one file per member, so it never conflicts
{ "at": "…", "by": "m3", "project": "2026-11-ai-news-…", "type": "review.changes", "scene": "s3" }
```

- `review.json` replaces the `review` block added to `project.json` on 6 Nov. Reviews become **per member** (anyone can comment or request changes), but **the video's owner alone approves the script** (Q6): the script counts as approved when the owner has approved the current `scriptHash`. Gautham's approval of the finished video happens at Render & Publish (§7). The same FNV-1a hashes are used, so stale approvals still reset on their own.
- `workspace.json` replaces `projects/_workspace.json`. Each project's folder is a key, so two members moving different videos merge cleanly.
- Status badges keep their meaning. "Exported" stays a local fact (my `out/`); the shared truth is `team.json.stage` plus `published`.

## 6. How Sync works (stage 1)

**Pull** (when the dashboard opens and when Sync is pressed):
1. `git pull --rebase` on the content repo.
2. Read every `media.json` and download any blobs missing locally from R2 (`blobs/<sha256>`) into place.
3. Reload the open project if it changed (the existing version-checked reload).

**Push** (Sync, and a reminder when closing with unsynced work):
1. Hash new or changed media, upload missing blobs to R2 (skipped if the hash already exists), and update `media.json`.
2. Commit content with a readable message and author = member ("m3: requested 2 changes on AI News — Linux hacks").
3. Push. If the remote moved: pull, merge (step 4), push again.
4. **Merge rules**, applied by the studio's own code, never shown as Git conflicts:
   - `review.json`, `team.json`, `workspace.json`, `members.json`: three-way merge by key; for the same key, the later `at` wins.
   - `activity/*.jsonl`: only ever appended to by its owner, so it doesn't conflict.
   - `project.json` / `research.md`: should not conflict because of the locks. If they do, keep the incoming version and save mine as `project.conflict-<member>.json`, then show a "Resolve" banner.

**Locks (check-out):**
- Editing a script or research needs the lock in `team.json`. Taking it means committing the lock and pushing successfully. The push is atomic, so if two people try, only one wins. **Taking a lock needs internet; editing afterwards works offline.**
- Unlocked members can still comment and approve, because those go to `review.json`.
- Locks are released on Sync after editing, or with "Release". Stale locks (older than 48 h) can be taken over by an admin, with the takeover logged.

**Dashboard additions:** a Sync button showing "N changes to send · last synced 10 min ago", a lock badge on each video ("✏️ m2 editing"), an "Edit (check out)" button, an Activity panel (who did what, newest first), the member's name instead of the OS username in approvals, and an owner/assignee chip on each sidebar row.

## 7. Render & Publish

Shown only to members with the publisher role — **Gautham only for now** (Q5); others are added later in `members.json` — and only when `stage` is `ready` (the owner approved the script and all checks pass):
1. Pull first; refuse if this computer is behind or has unsynced changes.
2. Validate → render locally (Remotion, as now) → cover and texts (as now).
3. Show the final preview with the post text. **Gautham watches and approves the finished video** (Q6); this approval is recorded in `team.json`. REQ-06 still applies: an AI agent never presses this.
4. Upload to YouTube with the Data API, then Instagram with the Graph API (already built). Record IDs in `team.json.published`, set `stage: published`, log activity, push.

**YouTube API limits:**
- Uploads from an API project that hasn't passed Google's audit are locked to **private**. Until the audit passes, the button uploads as private and the publisher makes it public in YouTube Studio.
- The default quota allows roughly 6 uploads a day.
- Members get channel access through YouTube's channel permissions (Manager/Editor), never a shared password.

## 8. Secrets and keys

- Per machine, in `secrets/`: R2 access key (scoped to the one bucket), YouTube OAuth token and Instagram token (publishers only), Google TTS key, Pexels key.
- **Channel voice (Q7, agreed):** one shared Google Cloud key, limited to Text-to-Speech, on every member's machine, so the channel voice is identical and billed once. Kokoro stays the free default.

## 9. Code distribution and Windows

- **Code repo:** private GitHub repo `polyjuice-studio`. An "Update studio" button runs `git pull` plus `npm install` / `pip install` when lockfiles changed.
- **`setup.ps1`** (Windows) and `setup.sh` (Mac): install Git, Node LTS, Python 3.12, FFmpeg (winget / Homebrew); create the venv; download the whisper model; clone the content repo; ask "Which member are you?" and write `.studio/me.json`; ask for keys.
- **Windows fixes:**
  - venv path: `Scripts\python.exe` instead of `bin/python`
  - `captions.sh` → Python
  - `open` → `explorer`
  - Remotion `publicDir` instead of the symlinks
  - LF line endings via `.gitattributes`
  - pin the Kokoro and Remotion versions

## 10. How stages 2 and 3 slot in later

| Concern | Stage 1: async (now) | Stage 2: live cloud hub | Stage 3: fully cloud |
| --- | --- | --- | --- |
| Text content | Content Git repo | Realtime database (Supabase/Firebase) rows per file; Git kept as nightly backup | Same database |
| Media | R2 blobs by hash | Same R2 bucket | Same R2 bucket |
| Locks | Lock in `team.json` + atomic push | Live presence + database row locks | Same |
| Identity | `members.json` + `.studio/me.json` | Real logins mapped to the same member IDs | Same |
| Activity | `activity/*.jsonl` | Same events in a table, live feed | Same |
| Rendering | Publisher's computer | Publisher's computer | Cloud render (Remotion Lambda / a server) |
| Dashboard | Local server | Local server, live data | Hosted |

Because the files, IDs, merge rules and `/api/sync` boundary don't change, stage 2 swaps the transport, and stage 3 moves the same server to the cloud.

## 11. Costs (stage 1)

| Item | Cost |
| --- | --- |
| GitHub private repos (code + content) | Free |
| Cloudflare R2 (≤ 10 GB stored; no download fees) | Free at this size |
| Remotion | Free for teams of up to 3 people (check the license terms; a 4th member needs a company license) |
| YouTube Data API, Instagram Graph API | Free (quota-limited) |
| Google TTS | Pay per character beyond the free tier (Q7) |
| **Total** | **About ₹0 a month** |

## 12. Build order

1. **Foundations:** put the code under Git (GitHub private). Add `STUDIO_WORKSPACE` and move content to `workspace/`. Point Remotion's `publicDir` at it. Port to Windows.
2. **Team model:** `members.json`, `.studio/me.json`; move review into `review.json` (per member); add `team.json`; turn `projects/_workspace.json` into `workspace.json`; activity log; owner/assignee/stage in the UI.
3. **Sync:** content repo, R2 blobs, the Sync button, merge rules, locks, Activity panel.
4. **Publish:** YouTube upload, Render & Publish flow, roles.
5. **Install:** `setup.ps1` / `setup.sh`, Update button; first run on one friend's PC.

Each step is usable on its own. Gautham can work through steps 1–2 alone before the friends join.

## 13. Risks

- **Git on non-developer machines:** the studio runs Git itself and members never type Git commands. Unknown failures (auth, a corrupted checkout) show a "Repair" action that re-clones the content repo.
- **Forgotten Sync:** the dashboard pulls on open, reminds on close, and shows how far behind it is.
- **Big media:** blobs by hash avoid Git LFS limits, and `out/` never syncs.
- **Untested on Windows from the Mac:** step 5 needs a test run on a real Windows PC.

## 14. Getting scripts in from ChatGPT, Claude and Gemini (Q9 — agreed: build (a), then (b))

All three members have Claude Code, which keeps writing projects directly (`/new-video`). Two more ways in:

**(a) Paste script, in the dashboard: any AI app, no setup.**
- **New video → Paste script** accepts a simple Markdown format that any chat app can be asked to produce: a title, then a block per scene (`## Scene: name`, the narration paragraph, an `On screen:` line and a `Visual:` line), then sources.
- The studio parses it into `project.json` (template, format, scene IDs, empty asset slots) and `research.md` (the sources), runs the validator's script checks and opens the Script tab as Draft, owned by the member who pasted it.
- It also accepts raw `project.json`. A "Copy format prompt" button gives the exact instructions to paste into ChatGPT or Gemini.
- Effort: small. Feasibility: high.

**(b) A Polyjuice Studio MCP server: one command from the chat app.**
- **How it connects:** the dashboard's local server adds an MCP endpoint (`http://127.0.0.1:3200/mcp`). Apps connect exactly like my_first_tube does today (`bridge.sh` → `mcp-remote`): Claude Desktop, Claude Code, the ChatGPT desktop app, and Gemini (CLI, or the client already used with my_first_tube).
- **Tools:**
  - `get_rules`: script rules and format from the `/new-video` skill and `PUBLISHING.md`, so ChatGPT and Gemini follow the same rules as Claude
  - `list_projects`, `get_script`, `get_review_comments`: read the current scripts, and fix requested changes from inside the chat
  - `send_script`: creates a new Draft, or a new version when the member holds the lock
  - `validate`: returns the validator's script-level errors so the AI can fix them before sending
- **No export, render or publish tools** (REQ-06).
- **Prompts:** `/send-to-studio`, `/fix-review-comments`.
- **Where scripts land:** in each member's local studio; Sync shares them with the others, and an `activity` entry records "sent from ChatGPT".
- **Limits:**
  - Web versions (chatgpt.com, claude.ai, gemini.google.com) can't reach a local server. That needs a public HTTPS endpoint with login, which is stage 2 (live hub) work.
  - Desktop/CLI apps only for now.
  - Each app's MCP support differs by plan and version, so check it on each member's machine at setup.
- **Effort:** medium. The script parser and validator are shared with (a), so build (a) first.
- **Cost:** ₹0 (runs locally).

## 15. Media storage: Cloudflare R2 vs Google Drive (Q8 — R2 chosen, 7 Nov 2026)

Media is content-addressed (§2.3) and reached only through a small storage interface (`has / put / get blob`), so the choice can change later without touching anything else.

| | Cloudflare R2 | Google Drive (via the Drive API) | Google Drive (desktop sync app) |
| --- | --- | --- | --- |
| How the studio uses it | S3 API: exact, scriptable, "upload if missing" | Drive API with each member's Google login (OAuth) | No code: the media folder lives inside a synced Drive folder |
| Free allowance | 10 GB storage, free downloads, generous free operations | 15 GB per Google account, shared with Gmail/Photos; files count against the owner's quota | Same as Drive |
| Paid beyond that | About US$0.015 / GB / month | Google One, e.g. 100 GB plan (about ₹130/month) | Same |
| Reliability for sync | High: the studio knows when each upload has finished before it pushes | Good, but API rate limits and token refresh to handle | **Weak:** Drive syncs on its own schedule, so Git can reference a file Drive hasn't delivered yet; online-only placeholders; conflicts make "(1)" copies |
| Setup for members | One scoped access key in `secrets/` | Each member signs in with Google once | Install Drive for desktop and "make available offline" |
| Browsing files by hand | Not friendly (a dashboard or tool is needed) | Friendly: open drive.google.com | Friendly |
| Fits stages 2–3 | Best: cloud rendering and a hosted studio read S3-style storage directly | Possible, more work | Poor |
| Account notes | Cloudflare may ask for a payment card even on the free tier | Uses the Google accounts you already have | Same |
| Build effort | Lowest | Medium (OAuth on 3 machines, Drive folder IDs) | None to build, but sync failures are hard to diagnose |

**Recommendation:**
- Use **R2 for the studio's own sync**: most reliable, free at this size, and the right base for stages 2 and 3.
- If you'd rather avoid a Cloudflare account, use **Google Drive through its API**, behind the same interface. Avoid the Drive desktop-sync shortcut for working media.
- Either way, a shared **Google Drive folder for finished videos and covers** (copied after publishing) is a nice, human-friendly archive.
