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
| Overall stage | In daily use. 21 videos published, 3 AI News Shorts in progress (script stage). Dashboard folders and script review were added on 6 Nov 2026 |
| Current priority | Team studio (DEC-14, DEC-15). Build step 1 done except moving content into `workspace/` (deferred by the owner) and a Windows test run; next is step 2 — team files |
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
| Members (planned) | 2 more | Windows PCs; co-members of the same channel through async sync (DEC-14, DEC-15) |

Key documents: `PLAN.md` (architecture and history), `AGENTS.md` (rules for every agent; `CLAUDE.md` and `GEMINI.md` point to it), `PUBLISHING.md` (post-text rules), `.claude/skills/new-video/SKILL.md` (topic → `project.json` recipe).

## 3. Agreed requirements

These are requirements, not claims that every detail is enforced in code.

| ID | Requirement | Implementation status |
| --- | --- | --- |
| REQ-01 | Every claim in the narration and the post text is backed in `research.md` by a link to the page that actually says it. Home pages don't count; numbers, ranks and dates match the source exactly; vendor-reported results are labelled. | Rule in `AGENTS.md` and `PUBLISHING.md §1`; the dashboard lists sources; links are not machine-checked |
| REQ-02 | Assets are mixed (own uploads, licensed stock, AI images), and every asset records source, license and credit. No random Google Images. | Asset slots store source/license/credit; Publish tab warns about unlicensed uploads; credits are added to post text |
| REQ-03 | Real people appear only in real, licensed photos with their identity checked. Never AI likenesses of real people. | Rule; portrait library `library/assets/people/people.json`; validator checks portraits have a license |
| REQ-04 | News videos: facts AP-called or confirmed by 2+ outlets, neutral wording, and 🔁 facts re-checked right before export. | Rule (`PLAN.md` News series); manual |
| REQ-05 | Post text follows `PUBLISHING.md`: titles ≤ 100 characters with the hook first, 1,500–3,000-character descriptions of real content, 5–8 hashtags (never #cart or #Shorts), plus tags and a pinned comment. | Enforced by `tools/validate_project.py`; Export refuses to run on errors |
| REQ-06 | AI agents never run Export, re-export, upload or post. They ask the owner every time; only the owner clicks Post. When checking the publish UI, agents never click inside the confirm box. | Rule in `AGENTS.md` step 5 and agent memory |
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

## 6. Feature inventory

| Feature | What is present | What still needs checking or work |
| --- | --- | --- |
| `/new-video` skill | Research → script → scenes → visual prompts → `project.json` | Script-first stop is a memory rule; not yet written into the skill |
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
| DEC-10 | Dashboard folders and project status | Folders and uploaded marks in `projects/_workspace.json`, not in `project.json`; smart views All / Unfiled / Needs review / Uploaded; status Draft → Script approved → Voiced → Exported → Uploaded, all derived except Uploaded | Agreed — 6 Nov 2026 |
| DEC-11 | Script review and approval | Script tab between Scenes and Publish; per-scene Approve / Request change with comment; Approve script records who, when and a narration hash (`review` in `project.json`); approvals reset when narration changes | Agreed — 6 Nov 2026 |
| DEC-12 | Make this tracker the maintained project reference | Keep numbered files in `Tracker/`, apply the snapshot policy in §11, and sync it into my_first_tube | Agreed — 7 Nov 2026 |
| DEC-13 | Agent rules live in the repo | `AGENTS.md` is the entry point for every agent; `PUBLISHING.md` and the `/new-video` skill hold the detail; this tracker records what was agreed | Agreed — 6 Nov 2026 |
| DEC-14 | Team studio for the shared channel | Three members (Gautham + two friends on Windows) work on The Polyjuice Project together. Stage 1 now: everyone works locally and offline, a Sync button exchanges work asynchronously, and a publisher renders locally and uploads. Stage 2 later: live cloud hub (realtime scripts, comments, presence). Stage 3 later: fully cloud studio. Stage 1 must keep the formats and boundaries stages 2 and 3 need | Agreed — 7 Nov 2026 (direction; supersedes the "own copy, own channel" proposal) |
| DEC-15 | Async sync design (stage 1) | Code repo and content repo split (`STUDIO_WORKSPACE`); content text in a private Git repo, media as SHA-256 blobs in Cloudflare R2; one concern per file (`project.json`, `review.json`, `team.json`, `media.json`, `workspace.json`, `activity/<member>.jsonl`); member IDs in `members.json`; check-out locks via atomic push; key-based merges; Render & Publish for publishers with YouTube + Instagram upload; same `/api/sync` boundary later backed by a realtime database. Script intake: Paste script first, then a local Polyjuice Studio MCP (no export/publish tools). Media on Cloudflare R2. Full design: `docs/decisions/2026-11-07_team-async-sync-design.md` | Agreed — 7 Nov 2026 |

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

## 13. Tracker change log

| Date | Update |
| --- | --- |
| 7 Nov 2026 | v1.0 created from `PLAN.md`, `AGENTS.md`, `PUBLISHING.md`, the dashboard state and agent memory. Registered in my_first_tube sync. |
| 7 Nov 2026 | DEC-14 agreed: shared channel, async sync now, live hub and fully cloud later. DEC-15 design proposed. Q1 and Q4 answered; Q5–Q8 added. |
| 7 Nov 2026 | Q2, Q5, Q6, Q7 agreed (Claude Code for all + paste option; Gautham publishes; owner approves the script, Gautham approves the video; one shared Google TTS key). Q8 compared; Q9 (script intake via paste + MCP) proposed. |
| 7 Nov 2026 | Q8 agreed: Cloudflare R2 for media sync. |
| 7 Nov 2026 | Q9 agreed (Paste script first, then the Polyjuice Studio MCP). DEC-15 async sync design agreed; next tracker version (v1.1) due when build step 1 is verified. |
| 7 Nov 2026 | Build step 1: code under Git and pushed to private GitHub (`6361082`); content-root setting; Windows fixes. Verified on the Mac: validator and render props by slug, one-scene voice + captions through `captions.py`, a Remotion still rendered from the content root, dashboard API, images, audio and preview. Moving content into `workspace/` deferred by the owner. |

## 14. Tracker created — 7 November 2026

The project reference started at v1.0, modelled on the BoutiqueOS tracker. Earlier history is summarised in §5 and kept in full in `PLAN.md`.
