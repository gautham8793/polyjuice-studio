# Polyjuice Video Studio — Product and Production Tracker

> The main reference for what this studio is, what has been agreed, what exists, and what happens next.
> Tracker document version: **1.0** — the studio has no numbered app releases yet.
> Last updated: **7 November 2026**

## 1. At a glance

| Item | Current position |
| --- | --- |
| Product | Polyjuice Video Studio — a local AI-assisted pipeline and web dashboard for explainer / infotainment videos |
| Channel | The Polyjuice Project · @thepolyjuiceproject (YouTube + Instagram) |
| Owner | Gautham (solo creator) |
| Outputs | YouTube Shorts / Instagram Reels (9:16, 1080×1920, ~45–60 s) and YouTube long-form (16:9, 1920×1080) |
| Language | English now; regional Indian languages (Tamil, Hindi) later |
| Where it runs | The owner's Mac, folder `Documents/G2.0/Video`; dashboard at http://localhost:3200 (`npm run dashboard`) |
| Overall stage | In daily use as a **team studio** since 9 Nov 2026: two members (Gautham on macOS, Prakash Sivam on Windows on ARM) share one channel through async sync (private GitHub content repo + Cloudflare R2 media). Publishing (YouTube Private + Instagram) from the dashboard by the publisher |
| Current priority | Dashboard UI/UX improvements (owner, via Codex; handoff `docs/handoffs/2026-11-09_dashboard-ui-ux.md`). Later: second friend (parked), Paste script + Polyjuice Studio MCP (Q9), home page + privacy page to publish the Google OAuth app |
| Code history | Git, private GitHub [gautham8793/polyjuice-studio](https://github.com/gautham8793/polyjuice-studio) (`main`), first commit `6361082` — 7 Nov 2026. Content is not in it (content repo comes with sync, DEC-15 step 3) |

**Read these status labels literally:**

- **Completed:** the action was performed and its result checked.
- **Agreed:** the owner has accepted it; it may not be implemented yet.
- **Proposed:** a suggested approach awaiting agreement.
- **Pending decision:** a choice or information is still needed.
- **Built / unverified:** code exists, but working behaviour has not been confirmed.

## 2. Product purpose and users

The studio turns a topic into a finished, sourced, publish-ready video with as little manual editing as possible, while keeping the owner in control of every script, image and post. It replaces timeline editors with a file-based pipeline that AI agents can write to and a dashboard where the owner reviews, adjusts and approves.

**Main workflow:** Topic → research with sources → script → owner approves the script → assets → voice + captions → preview → owner approves → Export → owner posts.

| User | Count | Access |
| --- | ---: | --- |
| Owner | 1 | Everything; the only person who exports, uploads or posts |
| AI agents (Claude Code, Gemini, Codex) | — | Write research, scripts, scenes and post text by following `AGENTS.md`; never export or post |
| Members | Prakash Sivam (`prakash`, editor + reviewer, since 9 Nov 2026); one more planned | Windows PCs; co-members of the same channel through async sync (DEC-14, DEC-15) |

Key documents: `PLAN.md` (architecture and history), `AGENTS.md` (rules for every agent; `CLAUDE.md` and `GEMINI.md` point to it), `PUBLISHING.md` (post-text rules), `.claude/skills/new-video/SKILL.md` (topic → `project.json` recipe), `.claude/skills/video-hook-writer/SKILL.md` (3-step Curiosity Loop hook recipe).

## 3. Agreed requirements

These are requirements, not claims that every detail is enforced in code.

| ID | Requirement | Implementation status |
| --- | --- | --- |
| REQ-01 | Every claim in the narration and the post text is backed in `research.md` by a link to the page that actually says it. Home pages don't count; numbers, ranks and dates match the source exactly; vendor-reported results are labelled. | Rule in `AGENTS.md` and `PUBLISHING.md §1`; the dashboard lists sources; links are not machine-checked |
| REQ-02 | Assets are mixed (own uploads, licensed stock, AI images), and every asset records source, license and credit. No random Google Images. | Asset slots store source/license/credit; Publish tab warns about unlicensed uploads; credits are added to post text |
| REQ-03 | Real people appear only in real, licensed photos with their identity checked. Never AI likenesses of real people. | Rule; portrait library `library/assets/people/people.json`; validator checks portraits have a license |
| REQ-04 | News videos: facts AP-called or confirmed by 2+ outlets, neutral wording, and 🔁 facts re-checked right before export. | Rule (`PLAN.md` News series); manual |
| REQ-05 | Post text follows `PUBLISHING.md`: titles ≤ 100 characters with the hook first, 1,500–3,000-character descriptions of real content, 5–8 hashtags (never #cart or #Shorts), plus tags and a pinned comment. | Enforced by `tools/validate_project.py`; Export refuses to run on errors |
| REQ-06 | AI agents never run Export, re-export, upload or post. They ask the owner every time; only the owner clicks Post. When checking the publish UI, agents never click inside the confirm box. | Rule in `AGENTS.md` step 6 and agent memory |
| REQ-07 | Script first: new videos stop at research + script (Draft) until the owner approves the script in the dashboard; assets, voice and full post text come after. | Script tab with per-scene and whole-script approval (6 Nov 2026) |
| REQ-08 | Prefer free, local tools. Paid services are added only when the owner agrees to each one. | Kokoro, whisper.cpp, Remotion and FFmpeg are local; Google Cloud TTS, the Instagram Graph API and a GCS bucket were added by the owner |
| REQ-09 | Credentials stay in `secrets/` on the machine, are read only by the local server, and never appear in docs, this tracker, memory or the browser. | `dashboard/server/secrets.ts`; owner-only files |

## 4. Setup register

| Area | Status | Details / evidence |
| --- | --- | --- |
| Local toolchain | Completed — 4 Nov 2026 | Node + npm workspaces (`remotion/`, `dashboard/`), Python 3.12 venv `tools/.venv`, FFmpeg/ffprobe, whisper.cpp with `tools/models/ggml-base.en.bin`, Kokoro TTS |
| Git / backup (code) | Completed — 7 Nov 2026 | Private repo `gautham8793/polyjuice-studio`, `main` tracks `origin/main`; repository-local identity `gautham8793` (GitHub privacy email); `.gitignore` keeps content, `out/`, `secrets/`, models and venv out; staged files scanned for credentials before the first push |
| Content root | Completed — 7 Nov 2026 | `STUDIO_WORKSPACE` → `./workspace` → repo root, in `tools/studio_paths.py`, `dashboard/server/paths.ts`, `remotion/remotion.config.ts`. Content still at the repo root; the move into `workspace/` is deferred |
| Google Cloud TTS | Configured | Indian-English Chirp3-HD voices; service-account key in `secrets/google-tts.json` |
| Pexels search | Optional | `PEXELS_API_KEY` in `dashboard/.env.local` |
| Instagram publishing | Configured | Graph API via Facebook Login; Page token in `secrets/instagram.json`; videos handed over through a private GCS bucket with expiring signed URLs (`secrets/gcs-reels.json`, set up by `tools/setup_reels_bucket.sh`) |
| YouTube | Manual | The owner uploads from `out/<slug>/` (mp4, cover, youtube.txt, tags.txt, pinned-comment.txt) |
| AI images | Manual / Figma | Gemini or ChatGPT by copied prompt, or Figma file "Video Studio — Character Sheets" (`uUQCDmP84YwhxS2JnUCkJO`) with `generate_image`; `tools/cutout.py` for transparent cut-outs. Figma Weave video needs a paid plan |
| Content repo (sync) | Completed — 9 Nov 2026 | Private GitHub `gautham8793/polyjuice-channel` (`main`), the `workspace/` folder: 291 text files; first commit `fb69a13` |
| Media store (sync) | Completed — 9 Nov 2026 | Cloudflare R2 bucket `polujuice-media` (spelled with a "u"), key in `secrets/r2.json`; 606 unique media files / 434 MB uploaded and checked against the local fingerprints; dashboard "Test connection" passes |
| Shared memory | Completed — 7 Nov 2026 | Project "Polyjuice Video Studio" in my_first_tube; syncs from this tracker and `Tracker/open-questions.md` |
| This tracker | Version 1.0 | Created 7 Nov 2026 |

## 5. Milestone history

The studio has no numbered releases; these are the verified build milestones.

| Date | Milestone | What it delivered |
| --- | --- | --- |
| 4 Nov 2026 | Phase 0 — Setup | Working toolchain |
| 4 Nov 2026 | Phase 1 — Brand + Listicle template | First rendered Short (Types of Whales) |
| 4 Nov 2026 | Phase 2 — `/new-video` skill | Topic → researched `project.json` |
| 4 Nov 2026 | Phase 3 — Dashboard | Project list, scene editor, asset search/upload, live preview, voice + render |
| 4 Nov 2026 | Phase 4 — Audio | Voice picker, own-voice recordings, captions, music library with ducking |
| 4 Nov 2026 | Phase 5 — Render + export | MP4, cover, post texts, sources, credits |
| 4 Nov 2026 | Phase 6 — Analogy template | Illustrated style, character library (Body Security Guards) |
| 5 Nov 2026 | Explainer template + series | Maps, scoreboards, ballot measures, portraits; Election 2026 series |
| 5 Nov 2026 | Channel identity | Name, logo, banner, theme presets |
| 5–6 Nov 2026 | Cinematic template | 16:9 and 9:16 camera-shot scenes; CAR-T long video + 3 Shorts |
| 6 Nov 2026 | Publishing upgrades | `PUBLISHING.md` rules in the validator; tags + pinned comment; Instagram posting |
| 6 Nov 2026 | Folders, status and script review | Sidebar folders and smart views; Script tab with approvals |
| 7–9 Nov 2026 | Team studio (DEC-14, DEC-15) | Code on private GitHub; content in `workspace/` as its own repo; team files (members, owners, per-member reviews, activity); async Sync with R2 media, check-outs and conflict copies; Publish card with YouTube upload; setup for Windows and macOS |
| 9 Nov 2026 | **First teammate live** | Prakash Sivam installed the studio on his Windows ARM laptop with `setup.ps1` and synced the whole channel (scripts from GitHub, 696 media files from R2). Owner's personal milestone: the studio is now a shared tool |

## 6. Feature inventory

| Feature | What is present | What still needs checking or work |
| --- | --- | --- |
| `/new-video` skill | Research → script → scenes → visual prompts → `project.json`, plus 3-step Curiosity Loop hook formula (`.claude/skills/video-hook-writer/SKILL.md`) | Script-first stop is a memory rule; not yet written into the skill |
| Templates | listicle, analogy, explainer, cinematic (`remotion/src/templates/SceneVideo.tsx` renders all) | Long-form chapters exist only in cinematic |
| Styles + brand | photo-mix / illustrated; six theme presets; caption and channel-name styles | — |
| Dashboard: Scenes | Scene cards, image search (Wikimedia / Pexels), upload, AI prompt copy, own-voice recording, Theme, Channel & captions, Sound, Characters panels, live preview | — |
| Dashboard: Script | Reading view, timings, ▶ play voice, per-scene Approve / Request change, Approve script with hash | No real project has been approved through it yet |
| Dashboard: Publish | Title/description/hashtags/tags/pinned comment with counters, previews, auto Sources + Credits, Instagram posting | YouTube upload stays manual |
| Dashboard: sidebar | Folders, smart views (All / Unfiled / Needs review / Uploaded), derived status badges | — |
| Voice | Kokoro (local), Google Indian-English voices, own recordings | Regional languages not started |
| Captions | whisper.cpp word timings, re-aligned to the script | `tools/captions.sh` is bash-only (Windows blocker) |
| Series | `projects/_series/<series>/build_projects.py` generates the parts | — |
| Validator | `tools/validate_project.py`: template rules, licenses, cues, publish text, review warnings | — |
| Export | `out/<slug>/`: mp4, cover.png, youtube.txt, instagram.txt, tags.txt, pinned-comment.txt, metadata.json | — |

## 7. Proposed roadmap — not approved for implementation yet

- Team studio, stage 1 — async sync (DEC-15, `docs/decisions/2026-11-07_team-async-sync-design.md`).
- Team studio, stage 2 — live cloud hub; stage 3 — fully cloud studio (later, DEC-14).
- Put the code under Git with a private remote (GAP-01).
- Regional languages: Tamil, Hindi (Gemini TTS / AI4Bharat voices).
- Thumbnail generation.
- Higgsfield / ImagineArt integration; AI video when Figma Weave is on a paid plan.
- Write the script-first stop into the `/new-video` skill.

## 8. Decision register

| ID | Decision | Current proposal / context | Status |
| --- | --- | --- | --- |
| DEC-01 | Core architecture | Local and file-based, no database. Remotion renders; a React + Vite dashboard with a Node file API is the editing table; Claude Code (or any agent following `AGENTS.md`) is the brain and writes files. `projects/<slug>/project.json` is the source of truth per video; shared `library/`, `brand/brand.json`, `secrets/` | Agreed — 4 Nov 2026 |
| DEC-02 | AI access | Chat subscriptions (Claude, Gemini, ChatGPT) and Claude Code; no paid AI APIs by default. AI image generation is by copied prompt or Figma | Agreed — 4 Nov 2026 |
| DEC-03 | Voice | Kokoro TTS by default; Google Cloud Chirp3-HD Indian-English voices as an option; the owner's own recording per scene replaces TTS (trimmed, normalised to −16 LUFS, captioned from what was said) | Agreed — 4 Nov 2026; Google voices added Nov 2026 |
| DEC-04 | Visual style per project | `photo-mix` (real photos + motion graphics) or `illustrated` (style preset + reusable character sheets in `library/characters/`) | Agreed — 4 Nov 2026 |
| DEC-05 | Channel identity | The Polyjuice Project, @thepolyjuiceproject; potion mascot logo (violet + emerald); bold and punchy; active theme `editorial`; intro card at 20 s with a Subscribe tap | Agreed — 5 Nov 2026 |
| DEC-06 | Series from one master script | `projects/_series/<series>/` holds research, master script and `build_projects.py`, which generates the parts and keeps dashboard additions (images, music, voice, recordings, script review) on rebuild | Agreed — 5 Nov 2026 |
| DEC-07 | Cinematic template | Camera "shots" over layered images with labels, effects and cards; `Cinematic` (16:9) and `CinematicVertical` (9:16); used for long-form | Agreed — 6 Nov 2026 |
| DEC-08 | Motion source | Remotion-only motion until a paid Figma Weave plan; Figma image models are used for stills | Agreed — 5 Nov 2026 |
| DEC-09 | Instagram posting from the dashboard | Graph API with a non-expiring Page token; video staged in a private GCS bucket behind expiring signed URLs; the owner presses Post | Agreed — 6 Nov 2026 |
| DEC-10 | Dashboard folders and project status | Folders in `workspace.json` and uploads in `projects/<slug>/team.json` (moved from `projects/_workspace.json` on 7 Nov 2026, DEC-15 step 2), not in `project.json`; smart views All / Unfiled / Needs review / Uploaded; status Draft → Script approved → Voiced → Exported → Uploaded, all derived except Uploaded | Agreed — 6 Nov 2026 |
| DEC-11 | Script review and approval | Script tab between Scenes and Publish; each member's own per-scene Approve / Request change with comment; only the video's owner approves the script, recording who, when and a narration hash; stored in `projects/<slug>/review.json` (moved out of `project.json` on 7 Nov 2026); approvals reset when narration changes | Agreed — 6 Nov 2026 |
| DEC-12 | Make this tracker the maintained project reference | Keep numbered files in `Tracker/`, apply the snapshot policy in §11, and sync it into my_first_tube | Agreed — 7 Nov 2026 |
| DEC-13 | Agent rules live in the repo | `AGENTS.md` is the entry point for every agent; `PUBLISHING.md` and the `/new-video` skill hold the detail; this tracker records what was agreed | Agreed — 6 Nov 2026 |
| DEC-14 | Team studio for the shared channel | Three members (Gautham + two friends on Windows) work on The Polyjuice Project together. Stage 1 now: everyone works locally and offline, a Sync button exchanges work asynchronously, and a publisher renders locally and uploads. Stage 2 later: live cloud hub (realtime scripts, comments, presence). Stage 3 later: fully cloud studio. Stage 1 must keep the formats and boundaries stages 2 and 3 need | Agreed — 7 Nov 2026 (direction; supersedes the "own copy, own channel" proposal) |
| DEC-15 | Async sync design (stage 1) | Code repo and content repo split (`STUDIO_WORKSPACE`); content text in a private Git repo, media as SHA-256 blobs in Cloudflare R2; one concern per file (`project.json`, `review.json`, `team.json`, `media.json`, `workspace.json`, `activity/<member>.jsonl`); member IDs in `members.json`; check-out locks via atomic push; key-based merges; Render & Publish for publishers with YouTube + Instagram upload; same `/api/sync` boundary later backed by a realtime database. Script intake: Paste script first, then a local Polyjuice Studio MCP (no export/publish tools). Media on Cloudflare R2. Full design: `docs/decisions/2026-11-07_team-async-sync-design.md` | Agreed — 7 Nov 2026 |
| DEC-16 | Script first, for every agent | A new video starts as research + script only (narration, on-screen text, image prompts with `asset: null`). No images, voice, music or renders until the owner approves the script in the dashboard Script tab (`review.json`); scenes whose narration changes after approval are approved again before re-voicing. Added to `AGENTS.md` step 2 after a Gemini-made video skipped the approval | Agreed — 8 Nov 2026 |

| DEC-17 | Temple product visual fidelity | Use the owner's downloaded Temple website assets for product shots. The five `web-*.png` files in `library/assets/Temple_Cerebral_Blood_Flow_Images/Downloaded assests/` are the actual product colour variants; match their rounded bean shape and the placement-reference portrait's upright temple position in generated illustrations. Figma file `uUQCDmP84YwhxS2JnUCkJO`: corrected illustrations in section `121:2`; original-product shots in `135:2`. Corrections saved under `out/temple-figma-2026-11-08/`. Applied to the dashboard video on 8 Nov 2026 via `apply_figma_visuals.py`; preview verified with original product variants, corrected illustrations and evidence graphics. | Agreed — 8 Nov 2026 |

## 9. Known gaps and risks

| ID | Finding | Planned handling |
| --- | --- | --- |
| GAP-01 | ~~The folder is not under Git~~ Code is on private GitHub since 7 Nov 2026; **content still has no backup** until the content repo and R2 sync exist (DEC-15 step 3) | Content repo + R2 in step 3 |
| GAP-02 | Mac-only code paths — fixed in code on 7 Nov 2026 (venv path, `captions.py`, Explorer, Node-run Remotion CLI, `PORT`, UTF-8 Python, no symlinks, LF endings); **not yet run on a Windows PC**; FFmpeg / whisper.cpp / Kokoro installs on Windows come with `setup.ps1` | Test on a friend's PC in step 5 |
| GAP-03 | Rules are written in several places (`AGENTS.md`, `PUBLISHING.md`, skill, agent memory, my_first_tube) | This tracker records decisions; docs hold the detail; update both when a rule changes |
| GAP-04 | No automated tests; checks are the validator, typechecks and browser review | Add tests if more people start using it |
| GAP-05 | `out/` is ~1.1 GB and growing; no clean-up policy | Decide what to keep after upload |
| GAP-06 | Copyright: music and image licenses depend on correct manual tagging | Publish tab warnings; owner review before export |

## 10. Export and publish checklist

For each video, an empty box means **not verified**, not necessarily wrong.

- [ ] Script approved in the dashboard Script tab.
- [ ] Every claim sourced in `research.md` (REQ-01); news facts re-checked (REQ-04).
- [ ] All images filled, licensed and credited (REQ-02, REQ-03).
- [ ] No scene shows "Needs voice"; captions read correctly.
- [ ] `tools/validate_project.py` passes; post text within `PUBLISHING.md` limits.
- [ ] Owner watched the preview and asked for Export (REQ-06).
- [ ] Owner uploaded / posted, then marked the video Uploaded in the dashboard.

## 11. How to maintain this file

1. **Before work:** record the requested change, its agreed scope and any unresolved decision.
2. **During work:** distinguish code written from behaviour tested.
3. **After verification:** record the result and evidence (file, command output, screenshot).
4. **When decisions change:** add a short note on what changed and why instead of silently rewriting history; mark the old DEC row Superseded.
5. **At the end of each task:** reconcile this tracker with the actual state of the repo.

Section numbers 1–13 are fixed. Dated records go in new sections from **§14** onwards, titled `NN. <what> — <status>, <d Month yyyy>`. my_first_tube turns a dated section into an Agreed decision when its title says agreed / approved / locked / decision, and into a Pending decision when it also says open or pending. It reads REQ rows (§3), DEC rows (§8, status in the last column) and `Tracker/open-questions.md` (Q rows).

Do not put passwords, tokens, API keys or private account details here.

### When to create a new tracker version

The highest numbered file is the current reference. Update it during ongoing work; create a new file only at a checkpoint:

| Event | Action |
| --- | --- |
| A milestone is verified complete and accepted by the owner | Next minor version |
| The owner approves a material change to scope, architecture or workflow | Next minor version; explain the decision |
| The owner requests a snapshot | Next minor version |
| The owner approves a fundamental direction change (e.g. a multi-user product) | Next major version |
| Routine updates, test results, small clarifications | Update the current file and its change log |

**Numbering:** `1.0 → 1.1 → 1.2`; after a major change `2.0`. Compare numerically: `1.10` follows `1.9`. Copy the current file to the next name, never overwrite an existing version, and keep earlier files unchanged.

## 12. Content register

Status as of 7 November 2026 (from the dashboard: Uploaded is the owner's mark; Exported means `out/<slug>/<slug>.mp4` exists).

| Project | Title | Template / format | Status |
| --- | --- | --- | --- |
| 2026-11-types-of-whales | 5 Whales That Break the Rules | listicle / 9:16 | Uploaded |
| 2026-11-body-security-guards | Your Body's Security Team | analogy / 9:16 | Uploaded |
| 2026-11-animals-that-survive-the-impossible | 5 Animals That Survive the Impossible | listicle / 9:16 | Uploaded |
| 2026-11-lok-sabha-vs-rajya-sabha | Lok Sabha vs Rajya Sabha, Explained | explainer / 9:16 | Uploaded |
| 2026-11-ai-ram-squeeze | Why You Pay for AI Even If You Never Use It | explainer / 9:16 | Uploaded |
| 2026-11-gemini-argon | Gemini 4 Argon: The 1M-Token Code Engine | explainer / 9:16 | Uploaded |
| 2026-11-election-1 … 10 | Election 2026 Explained (10 parts) | explainer / listicle / analogy, 9:16 | Uploaded |
| 2026-11-car-t-cells | CAR-T Cells – The Living Cancer Killers | cinematic / 16:9 | Uploaded (archived folder) |
| 2026-11-car-t-long | CAR-T: The Living Drug | cinematic / 16:9 | Uploaded |
| 2026-11-car-t-short-1/2/3 | How a Cell Kills Cancer · How to Make a Living Drug · India's Own CAR-T | cinematic / 9:16 | Uploaded |
| 2026-11-ai-news-948-linux-hacks | AI Found 948 Ways to Take Over Linux | explainer / 9:16 | Script stage (AI News) |
| 2026-11-ai-news-ai-crash-india | America Voted Against AI. India Gained. | explainer / 9:16 | Script stage (AI News) |
| 2026-11-ai-news-ai-slacked-on-safety | OpenAI's AI Quietly Slacked on Safety Work | explainer / 9:16 | Script stage (AI News) |
| 2026-11-temple-brain-blood-flow | Temple: Can a Sensor on Your Skin Track Brain Blood Flow? | cinematic / 16:9 | Full script draft ready, 8 Nov; 43 scenes / 1,138 words; owner approval pending |

## 13. Tracker change log

| Date | Update |
| --- | --- |
| 7 Nov 2026 | v1.0 created from `PLAN.md`, `AGENTS.md`, `PUBLISHING.md`, the dashboard state and agent memory. Registered in my_first_tube sync. |
| 7 Nov 2026 | DEC-14 agreed: shared channel, async sync now, live hub and fully cloud later. DEC-15 design proposed. Q1 and Q4 answered; Q5–Q8 added. |
| 7 Nov 2026 | Q2, Q5, Q6, Q7 agreed (Claude Code for all + paste option; Gautham publishes; owner approves the script, Gautham approves the video; one shared Google TTS key). Q8 compared; Q9 (script intake via paste + MCP) proposed. |
| 7 Nov 2026 | Q8 agreed: Cloudflare R2 for media sync. |
| 7 Nov 2026 | Q9 agreed (Paste script first, then the Polyjuice Studio MCP). DEC-15 async sync design agreed; next tracker version (v1.1) due when build step 1 is verified. |
| 7 Nov 2026 | Build step 1: code under Git and pushed to private GitHub (`6361082`); content-root setting; Windows fixes. Verified on the Mac: validator and render props by slug, one-scene voice + captions through `captions.py`, a Remotion still rendered from the content root, dashboard API, images, audio and preview. Moving content into `workspace/` deferred by the owner. |
| 7 Nov 2026 | Build step 2 (team files): `members.json`, `.studio/me.json`, `workspace.json`, per-project `team.json` (owner, uploads, Instagram posts) and `review.json` (one review per member; owner approves), `activity/<member>.jsonl`. Data migrated by `tools/migrate_team.py` (21 uploads, 9 Instagram posts, 3 approvals kept; backups in `.studio/migration-backup/`). Dashboard: who-are-you, Team & activity panel, owner picker, per-member reviews. Verified in the browser with a test member and a test project, both removed. |
| 7 Nov 2026 | Hook workflow added: created `.claude/skills/video-hook-writer/SKILL.md` and updated `.claude/skills/new-video/SKILL.md` and `AGENTS.md` with the 3-step Curiosity Loop (`Context Lean → Scroll-Stop Interjection → Contrarian Snapback`), staccato rhythm, 3–5 word visual title rules, and 3 hook variations per script. |
| 8 Nov 2026 | Temple continuation: full sourced script draft (43 scenes, 1,138 words), reproducible builder, corrected TTS wording and publishing copy; validator clean; browser Script review verified. Awaiting owner approval; no media generation or export. Details in §15 and the project handoff. |
| 8 Nov 2026 | DEC-16 script-first rule added to `AGENTS.md` (step 2; later steps renumbered). Added `docs/playbooks/long-form-cinematic.md` (how the 8-minute CAR-T video was made) and the per-project `HANDOFF.md` convention, both linked from `AGENTS.md`. |
| 8 Nov 2026 | Removed all per-scene sound effects (`shot.sfx`: whoosh, shimmer/chime, click/tick, heartbeat/monitor-beep, hit, rumble, riser, pop, ventilator) from `2026-11-checkpoint-inhibitors` and `2026-11-temple-brain-blood-flow` (`project.json` and `stage_shots.py`) at the owner's request; both projects validated clean. |
| 9 Nov 2026 | Content moved into `workspace/` (links at the old paths on the Mac); content root no longer cached (`792f2a5`). Build step 3, team sync (`842fd5e`): content Git repo + SHA-256 media manifests + blob store (R2 or folder), Sync button, key-based merges and conflict copies, check-out locks with read-only view. Verified with two simulated members on this Mac (local remote + folder store): join and full media download, locks, edits both ways, five concurrent-conflict cases converging identically, deletion. R2 untested until the owner's Cloudflare bucket exists; the content repo on GitHub is not created yet. |
| 9 Nov 2026 | Team sync went live: R2 bucket `polujuice-media` working (after fixing the bucket name in `secrets/r2.json`); private content repo `gautham8793/polyjuice-channel` created; first sync in ~17 min: 696 media files (606 unique, 434 MB) to R2, text to GitHub (`fb69a13`); all hashes verified present in R2. |
| 9 Nov 2026 | Sync progress + resumable, parallel transfers (`d7b8798`). Build step 4, Render & Publish (`a3a458d`): Publish card with checklist (publisher, owner-approved script, export up to date, not behind the team), one confirmed Publish to YouTube (Private, resumable upload) and/or Instagram, recorded in `team.json`, then synced; YouTube connection in Connections. Not yet run against YouTube: waiting for the owner's Google OAuth client (`secrets/youtube-client.json`, placeholder created). Owner choices: one button, full checklist, Private uploads. |
| 9 Nov 2026 | YouTube connected (Google project `polyjuice-project`: Data API v3 on, Desktop OAuth client "Polyjuice Studio", consent screen in Testing with test user gautham8793@gmail.com; Publish app blocked until a home page + privacy policy exist, so sign-in lasts ~7 days). Build step 5 (`9986cef`…`23a57d4`): `setup.ps1` (Windows, winget), `setup.sh` (macOS, installs only missing tools), `Start Studio.cmd`, pinned `tools/requirements.txt`, `docs/JOINING.md`. Verified on this Mac with a fresh clone from GitHub: setup completed, all Python packages load, content cloned, first sync downloaded all 696 media files from R2 identical to the owner's. `setup.ps1` not yet run on a Windows PC. Note: the first test run installed Homebrew `python@3.12` (and upgraded `sqlite`) on the owner's Mac before the script was changed to skip working tools. |
| 9 Nov 2026 | First teammate: **Prakash Sivam** (member id `prakash`, editor + reviewer) added in `members.json` (content commit `db5ea79`); GitHub `jonrhaeghar` invited with write access to `polyjuice-channel` and `polyjuice-studio` (pending acceptance). Team mode is now on: editing a video needs Edit (check out). Still to do: Prakash's own R2 token, keys sent privately, first Windows run of `setup.ps1`. Second friend: parked. |
| 9 Nov 2026 | `setup.ps1` completed on Prakash's PC (Windows on ARM, first real Windows run) after fixes found there: Smart App Control had to be turned off (it blocked Git's libcurl); sign-in via `gh auth login` + `gh auth setup-git` (Git's password prompt can't work); x64 Python on ARM PCs (torch / spaCy parts / gRPC have no Windows ARM wheels), found by its build (`sysconfig`) in the standard install folders; PowerShell 5.1 silenced-stderr quirk; whisper.cpp Windows builds come from build releases, native ARM build on ARM (`644d11b`…`7a38751`). Next: his key files, first Sync. |
| 9 Nov 2026 | **Milestone: first teammate live.** Prakash's first Sync completed on his Windows ARM PC and everything works (owner confirmed). His key copy `secrets/for-prakash/` deleted from the owner's Mac. |

## 14. Tracker created — 7 November 2026

The project reference started at v1.0, modelled on the BoutiqueOS tracker. Earlier history is summarised in §5 and kept in full in `PLAN.md`.

## 15. Temple long-form continuation — in progress, 8 November 2026

Requested: read `AGENTS.md` and the Temple `HANDOFF.md`, then continue the video. Scope: finish the full sourced long-form script and a reproducible scene plan, fix the narration/TTS wording mismatch, and validate the draft. The project has no `review.json`; script approval is still required under DEC-16 before new images, voice, music or renders. Existing audio and images will be retained. No approval will be written by an agent.

### Verified result

Full draft now in `projects/2026-11-temple-brain-blood-flow/script.md` and `project.json`; 43 scenes, 1,138 narration words, six chapters, 42.1 seconds planned holds. `research.md` maps R1–R13 to scenes and post claims, distinguishes primary evidence from inference, and records TD-NIRS full-text access limits. The script treats the studies fairly and does not equate correlation with accuracy, autoregulation with perfectly constant flow, or superficial anatomy with proof indirect sensing is impossible. Original Part 1 project/research saved in `drafts/`; original media and timeline retained unchanged. New/rewritten shots are provisional existing-image placeholders, not complete visuals.

Checks: `python3 tools/validate_project.py projects/2026-11-temple-brain-blood-flow` → `43 scenes, 1138 words, ~484s — OK` with no warnings/errors; builder rerun is byte-identical; scene IDs unique; no TTS word substitutions or narration digits. Browser Script tab shows 1,138 words / 43 scenes / 0 approved (`drafts/script-review-2026-11-08.png`). Owner must approve before new media; no `review.json` created, voice generated, render, Export or upload. Runtime/chapters are not measured yet. No new production or architecture decision was approved during this work.

## 16. Temple voice and visuals — in progress, 8 November 2026

Owner reports approval in the dashboard and requests voice and visuals. Verified `review.json`: approved by `gautham`, script hash `20465672`, all 43 scene hashes current. Approved narration will be preserved. Scope: generate Puck narration/captions, replace provisional shots with motion and scientifically qualified visuals, verify timing and previews. Prior media and project backed up under the project `drafts/pre-production-2026-11-08/`. No Export or publishing.

## 16. Temple visual rollback — completed, 8 November 2026

At the owner’s request, restored `visual` and `shot` for all 43 scenes from the pre-production snapshot. Generated SVG diagrams, their builder and visual review stills archived under the project’s `drafts/visuals-undone-2026-11-08/`. Approved narration and audio retained. Validator passes with no warnings/errors. Current visuals are draft placeholders; do not reinstate the rejected diagrams.

## 17. Sound effects removed from Checkpoint Inhibitors and Temple — completed, 8 November 2026

At the owner's request, removed all per-shot sound effects (`shot.sfx`: `whoosh`, `shimmer`, `click`, `tick`, `heartbeat`, `monitor-beep`, `hit`, `rumble`, `riser`, `pop`, `ventilator`) from `projects/2026-11-checkpoint-inhibitors/project.json` (10 scenes) and `projects/2026-11-temple-brain-blood-flow/project.json` + `stage_shots.py` (42 staged scenes), and refreshed `remotion/.studio-props.json`. Validated both projects with `tools/validate_project.py` (0 errors).
