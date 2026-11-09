# AI-Powered Explainer Video Workflow — Plan

_Last updated: 2026-11-04_

## Goal

A local workflow + small web dashboard for producing **explainer / infotainment videos**
(e.g. "Types of Whales", "Body Security Guards" — the immune system as a security team).

- **User:** solo creator (for now)
- **Volume:** a few polished videos per month
- **Outputs:** Instagram Reels / YouTube Shorts first (9:16, 1080×1920, 45–60s);
  YouTube long-form (8–10 min, 16:9) later
- **Language:** English now; regional languages (Tamil, Hindi, …) soon

## Key decisions

| Topic | Decision |
|---|---|
| Assets | **Not fully AI-generated.** Mix of own uploads, browsed/licensed stock, and AI images. Every asset records source + license. |
| AI access | Only chat subscriptions (Gemini Pro, Claude Pro, ChatGPT Pro) — **no API keys**. Claude Code is the "brain" (research, script, scenes, prompts) writing files; AI image generation is manual copy-paste prompts for now. Higgsfield / ImagineArt may be added later. |
| Voice | AI text-to-speech now (Kokoro, local + free); recording own voice later — voice track is swappable per project. |
| Visual style | **Per project:** `photo-mix` (real photos + motion graphics, e.g. whales) or `illustrated` (consistent illustrated look with style preset + character sheets, e.g. body guards). |
| Brand | Simple brand kit, **bold & punchy** vibe (high contrast, Kurzgesagt / Zack D. Films energy). Channel name: **placeholder** for now. |
| Music | YouTube Audio Library — downloaded manually into a tagged local library; auto-ducked under voice; attribution auto-added to descriptions when required. |
| Interface | Small local web dashboard (localhost). |

## How it fits together

- **Claude Code** (in this folder): researches, writes the script and scene breakdown into
  `project.json`, drafts per-scene image prompts.
- **Dashboard**: review/edit script & scenes, fill asset slots, generate voice + captions,
  pick music, live preview, render.
- **AI image tools** (Gemini / ChatGPT, manual): paste the copyable prompt, upload result back.

## Pipeline (one short)

1. **Topic** — "Types of Whales"
2. **Research** — facts + source links (accuracy matters) → `research.md`
3. **Script** — hook in first 2s → items → payoff/CTA (~45–60s, ~140 words)
4. **Scenes** — narration line + on-screen text + visual type + asset slot + AI prompt
5. **Assets** — per scene: upload own / Pexels·Pixabay search / copy AI prompt
6. **Voiceover** — Kokoro TTS (or uploaded recording)
7. **Captions** — whisper.cpp word-level timestamps → word-by-word highlight captions
8. **Assembly** — Remotion templates (Ken Burns zoom/pan, animated titles, counters)
9. **Preview** — live in browser (Remotion Player), tweak, re-preview
10. **Render** — MP4 + title, description, hashtags, credits

## Stack

| Part | Choice |
|---|---|
| Video engine | **Remotion** (React-based templates, live preview) |
| Dashboard | React (Vite) + small Node server |
| Storage | File-based: one folder per video, no database |
| Voice | **Kokoro TTS** (local); ElevenLabs free tier as alternative |
| Captions | **whisper.cpp** (local) |
| Stock assets | Pexels / Pixabay APIs (free keys), Wikimedia Commons (attribution), NASA / public domain |
| Music | YouTube Audio Library (manual download + tags) |
| Media tooling | FFmpeg |

## Templates

- **Listicle** — numbered items ("#3 Blue Whale"), image + name + 1–2 facts. _Build first._
- **Analogy explainer** — illustrated characters with roles; uses style presets + character sheets.
- **Long-form** (later) — same scene system, more scenes + chapters, 16:9.

## Visual styles

- **`photo-mix`**: real photos/clips, Ken Burns motion, motion-graphic labels, maps, counters.
- **`illustrated`**: a saved **style preset** is prepended to every AI image prompt; recurring
  characters get a **character sheet** generated once and reused as a reference image for
  consistency. Stored in `library/characters/` and reusable across videos.

## Channel identity (Nov 5, 2026)

- **Name:** The Polyjuice Project · **handle:** @thepolyjuiceproject (in `brand/brand.json`).
- **Logo:** potion mascot #10 (violet + emerald) — `brand/logo/polyjuice-logo-1024.png`,
  `polyjuice-avatar-800.png` (YouTube profile picture), `polyjuice-logo-round-transparent.png`.
  All 12 explorations: `.skill-archive/logo-creator/2026-11-05-polyjuice-logo/`.
- **Banner:** `brand/banner/polyjuice-banner-2048x1152.png`, rendered from the Remotion
  composition `ChannelBanner` (`remotion/src/brand/ChannelBanner.tsx`) — logo + name inside
  YouTube's 1235×338 all-devices safe area. Re-render after edits:
  `npx remotion still src/index.ts ChannelBanner ../brand/banner/polyjuice-banner-2048x1152.png`

## Brand kit (`brand/brand.json`)

Direction: **bold & punchy** — high contrast, saturated accents, heavy display type.

- Channel name: `[CHANNEL NAME]` placeholder + placeholder logo
- Palette: 3–4 colors (dark base, one loud accent, one secondary, white)
- Fonts: 2 Google Fonts (heavy display headline + highly legible caption font)
- Caption style: word-by-word highlight, position, size, stroke/shadow
- 1s intro sting, outro with CTA, small watermark

2–3 palette/font options will be drafted in Phase 1 to choose from.

## Folder structure

```
Video/
├── PLAN.md
├── dashboard/          React app + small Node server (localhost)
├── remotion/
│   ├── templates/      listicle/, analogy/ (later: longform/)
│   └── components/     captions, title cards, Ken Burns, counters, lower-thirds
├── brand/              brand.json, logo, fonts, intro/outro
├── library/
│   ├── music/          tracks + tags.json (mood, tempo, attribution)
│   ├── assets/         reusable images/clips + source & license metadata
│   └── characters/     illustrated character sheets + style presets
├── projects/
│   └── 2026-11-types-of-whales/
│       ├── project.json    topic, style, script, scenes, voice, music
│       ├── research.md     facts + source links
│       ├── assets/  audio/  captions/  renders/
└── .claude/skills/     /new-video → research + script → project.json
```

### `project.json` (sketch)

```json
{
  "title": "Types of Whales",
  "template": "listicle",
  "style": "photo-mix",
  "format": "short-9x16",
  "language": "en",
  "voice": { "source": "tts", "engine": "kokoro", "voiceId": "..." },
  "music": { "track": "library/music/....mp3", "duckDb": -18 },
  "scenes": [
    {
      "id": "s1",
      "narration": "...",
      "onScreenText": "...",
      "visual": { "type": "photo", "asset": "assets/s1.jpg", "aiPrompt": "...",
                  "source": "pexels", "license": "Pexels License", "credit": "..." },
      "durationHint": 4.0
    }
  ]
}
```

## Build phases

| Phase | What | Outcome |
|---|---|---|
| **0. Setup** ✅ | Node, FFmpeg, whisper.cpp, Kokoro TTS, Remotion | Working toolchain (done 2026-11-04) |
| **1. Brand + Listicle template** ✅ | Brand kit options, whales sample | A real rendered short (done 2026-11-04; brand: B · Electric) |
| **2. `/new-video` skill** ✅ | Claude Code researches + writes `project.json` | Topic → script in minutes (done 2026-11-04) |
| **3. Dashboard** ✅ | Project list, scene editor, asset slots (upload / Wikimedia / Pexels / copyable prompt), live preview, voice + render buttons | The editing table (done 2026-11-04) |
| **4. Audio** ✅ | Voice picker, own-voice recordings, captions, music library + auto-ducking | Finished sound (done 2026-11-04) |
| **5. Render + export** ✅ | MP4 + cover + title, description, hashtags, sources, credits | Ready to upload (done 2026-11-04) |
| **6. Analogy template** ✅ | Illustrated style, character library + reference sheets, ID-badge scenes | "Body Security Guards" (done 2026-11-04) |

**Later:** long-form template, regional languages (Gemini TTS / AI4Bharat Indic voices),
Higgsfield / ImagineArt integration, thumbnail generation, own-voice recording flow.

## Toolchain commands (Phase 0)

```bash
# Voice (Kokoro, Python 3.12 venv in tools/.venv)
tools/.venv/bin/python tools/tts.py "Text to speak" out/voice.wav --voice am_michael

# Word-level captions (whisper.cpp, model in tools/models/)
tools/.venv/bin/python tools/captions.py out/voice.wav out/captions   # -> out/captions.json (whisper-cli + ffmpeg)

# Remotion studio / render (from remotion/)
npm run studio
npx remotion render src/index.ts <CompositionId> ../out/video.mp4
```

## Dashboard (Phase 3)

```bash
npm run dashboard        # from the Video/ folder → http://localhost:3200
```

- **Left:** projects (newest first). **Middle:** one card per scene — edit name, narration,
  on-screen text; add an image by **Search** (Wikimedia Commons, or Pexels with a key),
  **Upload** / drag-and-drop, or **Copy AI prompt** for Gemini / ChatGPT. **Right:** live preview.
- Edits autosave to `project.json`. Scenes whose narration changed show **Needs voice** and
  play silent at an estimated length until you click **Generate voice**.
- **Check** runs the validator. **Export** runs the validator first, then writes the package to
  `out/<slug>/`: `<slug>.mp4`, `cover.png` (hook frame, no captions), `youtube.txt`,
  `instagram.txt`, `metadata.json`.
- **Publish tab:** edit the post title (≤ 100), opening lines and hashtags (`publish` in
  `project.json`). The countdown, **Sources** (every markdown link in `research.md`) and
  **Credits** (image credit/license/source + music attribution) are appended automatically,
  with live YouTube / Instagram previews, character counters and copy buttons. "Before you post"
  lists missing images, unlicensed uploads and missing sources. For your own photos / AI images,
  set the license to `Own` so they're left out of the credits.
- Saves are version-checked: if `project.json` changed on disk (e.g. Claude Code edited it), the
  dashboard reloads instead of overwriting. It also re-checks when the window regains focus.
- Image license, credit and source page are saved with each image (see "image details").
- **Sound panel** (top of the scene list):
  - *Voice* — pick any English Kokoro voice (US/UK, male/female), set speed, **Hear it** plays a
    cached sample (`library/voice-samples/`). Changing voice/speed marks scenes "Needs voice".
  - *Music* — pick a track from `library/music/`, set volume, the level **under the voice**
    (auto-ducking from the word timings, with 0.5s fade-in / 1.5s fade-out), and a start offset.
    **+ Add track** uploads into the library; **Tags** sets title, mood and the attribution text
    for Creative Commons tracks (stored in `library/music/tags.json`).
- **Own voice:** each scene has **Upload my recording**. The take is trimmed, loudness-normalized
  (−16 LUFS) and captioned by Whisper from what you actually said; **Use AI voice** switches back.
- **Analogy / illustrated projects:** a **Characters** panel lists the cast. Make each
  character's reference sheet once (**Copy sheet prompt** → Gemini / ChatGPT → upload), then per
  scene **Copy AI prompt** = style preset + character look + scene action, and attach the sheet
  so drawings stay on-model. Characters are reusable across videos.
- **Channel & captions panel** (Scenes tab, under Theme): channel name + handle (saved to
  `brand/brand.json`, used in every video); per-video caption size (S/M/L/XL or 56–130px),
  height and words-at-a-time (`project.captions`); channel-name style — footer · pill ·
  corner bug · intro card (first 3 s) · hidden — and source-line style — footer · chip · hidden,
  with custom source text for non-series videos (`project.branding`). "Make these the channel
  default" writes `brand.captions` / `brand.branding`; "Reset" clears the per-video overrides.
- Optional Pexels search: add `PEXELS_API_KEY=...` to `dashboard/.env.local` (free key at
  pexels.com/api) and restart.
- Code: `dashboard/src` (React UI), `dashboard/server/api.ts` (local file API inside Vite).
  npm workspaces at the root share one copy of React / Remotion with `remotion/`.

## Templates & characters (Phase 6)

- One engine, `remotion/src/templates/SceneVideo.tsx`, renders every template; templates are
  just the scene kinds they use. Compositions: `Listicle` (hook / item / outro) and `Analogy`
  (hook / character / beat / outro).
- **Character scene:** a "SECURITY ID" badge with the role (`name`), `realName`, an
  "ON DUTY" stamp, and the fact strip. **Beat scene:** one big statement (twists, payoffs).
- `library/characters/styles.json` — style presets (`electric-flat` matches the brand).
- `library/characters/<id>/character.json` — `{ id, name, description, sheet }`. The
  `description` is the fixed look reused in every prompt; `sheet` is the uploaded reference image.
- For illustrated scenes `visual.aiPrompt` holds only the scene action.

## News series (Election 2026 Explained, Nov 2026)

- One **locked master script** feeds several Shorts:
  `projects/_series/<series>/` holds `research.md` (fact sheet: ✅ / 🔁 / ❌ per fact, AP-called
  or 2+ outlets only), `master-script.md`, and `build_projects.py`, which generates the
  per-part projects (`projects/2026-11-election-1…5`). Edit scripts in `build_projects.py` and
  re-run it — it keeps images, music and voice choices added in the dashboard.
- **Explainer template** (composition `Explainer`) adds: **US tile map** visuals
  (`visual.map: {"TX": "D", "AK": "pending", …}`), **scoreboard** scenes (seat bar + majority
  line), **measure** scenes (ballot cards with PASSED / REJECTED / STILL COUNTING stamps), and
  item scenes with a `tag` badge instead of a rank.
- `project.series` adds the "PART n/5" badge, a "SOURCE · AS OF" tag, and a "Results as of…"
  line in the post text.
- Shared assets live in `library/assets/<series>/` (with `assets.json` for license/credit);
  scenes reference them as `library/...`.
- **Portraits:** `library/assets/people/people.json` holds real, licensed photos (Wikimedia:
  public domain / CC, identity checked against the file description) with a face crop
  (`focus`). Item scenes take `portraits`: two = an equal-size head-to-head with "✓ WON" on the
  winner; more = a row of winners. Each pops in when its `cue` word is spoken. Photo credits
  are added to the post text automatically. Never AI likenesses of real people.
- **Names:** captions are re-aligned to the script's spelling; a scene's `ttsText` can carry a
  phonetic override for the voice, e.g. `[Hinojosa](/inoˈhoʊsə/)`.
- News rules: no AI images of real people; neutral wording; re-check 🔁 facts right before export.

## Command-line workflow

```bash
# 1. In Claude Code: /new-video <topic>   (skill: .claude/skills/new-video/SKILL.md)
#    -> projects/<slug>/research.md + project.json, validated, voiced, preview rendered
#    Or edit projects/<slug>/project.json by hand (script, on-screen text, assets)

# 2. Check the project against the template rules
python3 tools/validate_project.py projects/<slug>

# 3. Per-scene voice + word captions -> projects/<slug>/timeline.json
#    (only changed scenes are regenerated)
tools/.venv/bin/python tools/prepare.py projects/<slug>

# 4. Render (from remotion/)
npx remotion render src/index.ts Listicle ../out/<slug>.mp4 \
  --props="$(python3 ../tools/render_props.py ../projects/<slug>)"   # (dashboard Export also makes cover + texts)
npm run studio    # live preview (shows the whales sample by default)
```

- **Images:** put a file in `projects/<slug>/assets/` and set the scene's `visual.asset`
  (e.g. `"assets/narwhal.jpg"`). Empty slots render as a labelled placeholder.
- **Emphasis:** wrap words in `*asterisks*` in `onScreenText` to color them
  (e.g. `"*5* WHALES THAT *BREAK* THE RULES"`).
- **Brand:** `brand/brand.json` holds three presets (`signal`, `electric`, `heat`); `active` picks the default.
- **Timing:** each scene lasts as long as its narration + 0.35s, so the video length follows the script.

## Publish text rules (Nov 6, 2026)

- Full rules: **`PUBLISHING.md`**, for every agent (`AGENTS.md`, `GEMINI.md` and `CLAUDE.md` point to it); `tools/validate_project.py` enforces them. In short:
  - titles use up to 100 characters (hook first, search phrase after, emojis kept)
  - descriptions are about 1,500–3,000 hand-written characters of real content (summary, key
    facts, glossary, FAQ, series line, disclaimer); no keyword stuffing
  - 5–8 hashtags, no `#Shorts`
- `publish.tags` → `tags.txt` (YouTube Studio tags, ≤ 500 characters); `publish.pinnedComment` →
  `pinned-comment.txt`. Both are written on export next to `youtube.txt`.
- **Intro card (all templates):** `branding.introAt` = when the channel card slides in (seconds, or a scene id such as `"s3"`); `branding.introCta: "subscribe"` adds a Subscribe button that gets tapped. Channel default in `brand/brand.json`: 20 s + subscribe. Pick a scene start where the card won't cover key graphics.
- **Channel outro (classic templates):** an `outro` scene with `outroStyle: "channel"` (silent is fine) shows the logo, name and handle, with `onScreenText` as the line under them. Cinematic shots use `shot.brand`.
- **Cinematic template** (`template: "cinematic"`): `format: "long-16x9"` renders with the
  `Cinematic` composition (1920×1080); `format: "short-9x16"` with `CinematicVertical`
  (1080×1920). Shared CAR-T images live in `library/assets/car-t/`.

## Code repo and content root (Nov 7, 2026)

- The code is a Git repo: private GitHub `gautham8793/polyjuice-studio` (`main`). Content (`projects/`,
  `library/`, `brand/`), renders (`out/`), keys (`secrets/`) and downloaded tools are not in it.
- **Content root:** `STUDIO_WORKSPACE`, else `./workspace` if it exists, else the repo root (today's
  layout). Set in `tools/studio_paths.py`, `dashboard/server/paths.ts` and `remotion/remotion.config.ts`
  (Remotion's `publicDir`, replacing the old `remotion/public` symlinks). Tools take a slug or a folder:
  `python3 tools/validate_project.py <slug>`.
- **Windows-ready:** venv python path per OS, captions in Python (`tools/captions.py`), Explorer for
  "open folder", Remotion CLI run by Node, `PORT` read in `vite.config.ts`, Python in UTF-8 mode,
  LF line endings (`.gitattributes`). Not yet tested on a Windows PC (build step 5).

## Team files (Nov 7, 2026 — DEC-15 step 2)

- `members.json` (content root): members and roles (admin, publisher, editor, reviewer).
  `.studio/me.json` (local): which member this computer is; the dashboard asks on first run.
- `workspace.json` (content root): sidebar folders. `projects/<slug>/team.json`: owner, assignees,
  lock (for sync), and where the video went out (`published.youtube` / `published.instagram`).
- `projects/<slug>/review.json`: one review per member per scene; only the owner approves the script.
- `activity/<member>.jsonl`: append-only log shown under **Team & activity** in the sidebar.
- Old data was converted by `tools/migrate_team.py` (backups in `.studio/migration-backup/`).

## Team sync (Nov 9, 2026 — DEC-15 steps 1–3)

- Content lives in `workspace/` (projects, library, brand, members, folders, activity). On the
  owner's Mac, `projects`, `library` and `brand` at the repo root are links into it, so older paths
  and agents keep working.
- `workspace/` becomes its own Git repo (the shared content repo); media files are listed by
  SHA-256 in `media.json` files and stored in a blob store: Cloudflare R2 (`secrets/r2.json`:
  accountId, bucket, accessKeyId, secretAccessKey) or a folder (`.studio/sync.json`).
- **Sync** (sidebar) records media, uploads, commits, merges others' work and downloads their media.
  **Team & activity → Sync** sets it up (first member) or joins (new computer, empty `workspace/`).
- With 2+ members, editing a video needs **Edit (check out)**; others see it read-only but can
  still review the script. Same-file collisions keep both versions (`*.conflict-<member>.*`).

## Notes & risks

- **Copyright:** avoid random Google Images — YouTube Content ID can block monetization.
  Prefer Pexels/Pixabay, Wikimedia (with attribution), public domain, own AI images.
- **Accuracy:** infotainment needs fact-checking; keep sources in `research.md`.
- **Music:** some YouTube Audio Library tracks require attribution — tracked in `tags.json`.
