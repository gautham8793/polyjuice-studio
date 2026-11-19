# Second channel: gamer87 (GTA 6 videos)

> Status: **Proposed — 19 Nov 2026** (awaiting owner approval; nothing is built yet)
> Tracker: DEC-19 (proposed) · Open questions Q11–Q15 in `Tracker/open-questions.md`
> Working name **gamer87**, internal channel id **`gaming`**. The name can change later: it lives in one
> file, and nothing else depends on it.

## 1. Goal

A second YouTube + Instagram channel about GTA 6 (and later other open-world games), made with the same
studio as The Polyjuice Project, by the owner alone. Shorts (9:16) and long-form (16:9).

What carries over unchanged: research with sources → script → owner approval → voice + captions →
preview → validate → Export → Publish. The owner rules still apply: script first (DEC-16), agents never
Export or Publish (REQ-06), secrets stay in `secrets/` (REQ-09).

What's new:

1. **Multi-channel studio:** one studio, a channel switcher, separate content per channel.
2. **Gameplay footage** as the main visual: PS5 captures, clips in scenes, a searchable footage library.
3. **Gaming templates** for news, lists, maps, guides and comparisons.
4. **Gaming source rules:** confirmed / reported / rumour.
5. **ElevenLabs voice for the gaming channel only,** with a credit budget.

## 2. Principles

1. **Polyjuice keeps working unchanged.** Its files, sync, brand and voices are untouched. The
   gaming channel is added next to it, not merged into it.
2. **One channel = one content workspace.** Brand, library, projects, rules and publish connections are
   per channel. Nothing is shared by accident (wrong logo, wrong YouTube account, wrong voice).
3. **The channel decides what is allowed.** Allowed voice engines, templates and post-text rules are in
   the channel's config and **enforced by the server**, not just hidden in the UI.
4. **Own footage first.** Every clip records where it came from and what we may do with it.
5. **Add real value.** Every video needs our own footage, a real script and real insight. No
   template factory (YouTube's "inauthentic content" monetization policy).

## 3. Multi-channel studio

### 3.1 Layout

Each channel is its own content workspace, the same shape as today's `workspace/`:

```
Video/                          ← code repo (polyjuice-studio), unchanged
├── .studio/channels.json       ← local: which channels this machine has, and the active one
├── secrets/                    ← local; per-channel files for publishing (see 3.3)
├── workspace/                  ← Polyjuice content repo (as today)
└── workspaces/gaming/          ← gamer87 content (own private Git repo later, e.g. gamer87-channel)
    ├── channel.json            ← NEW: id, name, handle, rules, allowed voices/templates, budget
    ├── brand/brand.json        ← gamer87 logo, colours, fonts, captions
    ├── library/footage/        ← PS5 captures + footage.json (see 4)
    ├── library/music/          ← own / licensed score only
    └── projects/<slug>/        ← same project files as Polyjuice
```

`workspace/` (Polyjuice) gets a `channel.json` too, with today's behaviour written down
(`voice.engines: ["kokoro", "google"]`).

### 3.2 How the code finds the active channel

- Today `contentRoot()` (`dashboard/server/paths.ts`, mirrored in `tools/studio_paths.py` and
  `remotion/remotion.config.ts`) reads `STUDIO_WORKSPACE`, then `workspace/`. It becomes:
  `STUDIO_WORKSPACE` → the active channel in `.studio/channels.json` → `workspace/`. It is still not
  cached, so switching channels needs no restart.
- Renders and Python tools get the channel's workspace explicitly (`STUDIO_WORKSPACE` set per call),
  so a render can never pick up the other channel's brand.
- **Dashboard:** a channel switcher at the top of the sidebar (logo + name). The project list,
  brand, library, connections and sync all follow it.

### 3.3 Secrets and publishing per channel

- YouTube: same Google OAuth app, a **separate token per channel**
  (`secrets/channels/gaming/youtube-token.json`). gamer87 is a Brand Account channel under the
  owner's Google login, so the existing Desktop OAuth client works. The connect flow lets you pick
  the gamer87 channel.
- Instagram: a separate token per channel.
- ElevenLabs: `secrets/elevenlabs.json`. It is only ever used for channels that allow it (5).
- The Publish card shows the **target channel's name and avatar** in the confirm box, so you can see
  which channel you are posting to.

### 3.4 Sync

Solo for now: the gaming workspace can be a plain local folder at first. When wanted, it gets its own
private content repo and its own R2 prefix (or bucket). It uses the same sync code; only the per-channel
settings are new. Raw footage does not sync (4.3).

## 4. Gameplay footage

### 4.1 Capture (owner's PS5)

Settings → Captures and Broadcasts: 1080p, HDR off, microphone audio off. Use **Create** to save
moments, or record exploration sessions manually (up to 1 h). Copy to an exFAT USB drive, then to the
Mac. Turn the in-game radio off or note the station. Use photo mode for thumbnails. Capture card + OBS
later if needed (HDCP off on the PS5). Full checklist in 9.

### 4.2 Ingest: `tools/ingest_footage.py`

Drop captures into `library/footage/inbox/` (or use **Import footage** in the dashboard). For each file:

1. `ffprobe`: duration, resolution, fps, date. SHA-256 id (same as sync media).
2. A **720p proxy** for fast preview, plus a contact sheet of thumbnails.
3. **Scene detection** (ffmpeg `select='gt(scene,…)'`): marks cuts and moments as candidate clips.
4. Optional: whisper on the game audio → dialogue transcript, so footage is searchable by what's said.
5. Writes an entry in `library/footage/footage.json`:

```jsonc
{ "id": "a1b2…", "file": "raw/2026-11-20_vice-beach-chase.mp4", "proxy": "proxy/a1b2….mp4",
  "duration": 312.4, "size": [1920, 1080], "fps": 60, "captured": "2026-11-20",
  "source": "own-ps5",                 // own-ps5 | rockstar-official | community
  "license": "own gameplay",           // for rockstar-official: the page it came from
  "music": "radio off",                // or the station, to flag claim risk
  "tags": ["beach", "chase", "police"], "notes": "…", "moments": [{ "at": 41.2, "label": "jump off pier" }] }
```

### 4.3 Storage

Raw PS5 1080p60 is about 5–8 GB per hour. **Raw stays on the Mac** (or an external drive, Q12). Only
proxies, used trims and `footage.json` go into the content workspace. Export renders from raw when it
is on the machine and falls back to the proxy with a warning.

### 4.4 Clips in scenes

`Visual.type: "clip"` exists today but is barely used (only `ArgonArt` plays one). It becomes a full
feature:

```jsonc
"visual": { "type": "clip", "asset": "library/footage/raw/2026-11-20_vice-beach-chase.mp4",
  "clip": { "in": 41.0, "out": 47.5, "speed": 1, "crop": { "x": 0.62 }, "mute": true, "zoom": 1.1 },
  "source": "own-ps5", "license": "own gameplay", "credit": null }
```

- Rendered with Remotion `OffthreadVideo` (trim, speed, 9:16 crop window over 16:9 footage).
- If the clip is shorter than the scene's narration, it slows slightly, holds or loops, and the
  validator warns.
- **Dashboard:** the scene card gets a **Footage** picker (search tags, notes, transcript, with
  thumbnails) and a small trim bar with an in/out and crop preview.
- **Agents:** while scripting, a scene can name a footage need (`"needs": "night drive on causeway,
  police lights"`). The dashboard lists unfilled needs as a shot list for your next play session.

## 5. Voice: ElevenLabs for gaming only

| Engine | Polyjuice | gamer87 |
| --- | --- | --- |
| Kokoro (free, local) | ✅ | ✅ drafts and previews |
| Google Chirp3 HD | ✅ | ✅ (fallback) |
| ElevenLabs TTS | ❌ blocked | ✅ final voice |
| ElevenLabs Voice Changer (your recording → channel voice) | ❌ blocked | ✅ guides, reactions |

**Guards on ElevenLabs credits:**

1. **Allowed per channel:** `channel.json → voice.engines`. The server refuses ElevenLabs for any
   channel that doesn't list it, whoever asks (dashboard, agent, script).
2. **Draft, then final:** script iterations and previews use Kokoro, at a similar pace. ElevenLabs runs
   only on **Final voice**, after the script is approved (DEC-16). `Voice` gets `draftEngine`.
3. **Never pay twice:** audio is cached by a hash of (text, voice, model, settings), like today's
   voice key. Unchanged scenes and re-renders cost nothing.
4. **Monthly budget:** `channel.json → voice.budget` (e.g. 80% of the plan's credits per billing
   month). Before generating, the dashboard shows "≈ 6,800 credits · 24,000 left this month". The
   server blocks a request that would pass the cap. Remaining credits are read from the ElevenLabs
   account, and every call is logged to `.studio/elevenlabs-usage.jsonl`.
5. **The Voice Changer** counts against the same budget.

Rough usage, about 1 credit per character (check current plans): Short ≈ 900, 8-min video ≈ 7,000.
**Starter** (~30k credits/month) ≈ 3 long-form + 6–8 Shorts. Start there; upgrade only if the meter
says so.

`Voice` type: `engine: "kokoro" | "google" | "elevenlabs"`, plus `model`, `stability`, `style` for
ElevenLabs. `tools/tts.py` gets `speak_elevenlabs()` (REST API; key read by the tool from `secrets/`,
never the browser).

## 6. Templates

Same engine (`SceneVideo.tsx`), new scene kinds over clips, gamer87 theme (neon sunset / Miami palette,
**not** Rockstar's logo, font or "GTA" lettering).

| Phase | Template | Scene kinds | Built from |
| --- | --- | --- | --- |
| 1 | `gaming-news` | headline over clip, "confirmed / rumour" stamp, source chip, date | newsroom |
| 1 | `gaming-list` | numbered item over clip ("#3 Hidden shark"), location pin | listicle |
| 2 | `gaming-map` | own map screenshot + pins, routes, zoom to region | explainer map |
| 2 | `gaming-guide` | step N/M over clip, progress bar, "reward" card | new |
| 2 | `gaming-versus` | split screen (GTA 5 vs 6, before / after) | new |
| 3 | long-form `cinematic` over clips | chapters, lore, character stories | cinematic |

Both 9:16 and 16:9: Shorts crop a window from 16:9 footage (`clip.crop.x`); long-form uses full frame.

## 7. Sources and post text

### 7.1 Source tiers (in `research.md`, every claim)

- ✅ **Confirmed:** Rockstar Newswire, official trailers, or **seen in our own footage** (the footage
  id is the source).
- 🔁 **Reported:** major outlets (IGN, Kotaku, Bloomberg, Eurogamer…), linked to the article.
- ❌ **Rumour / leak:** not stated as fact. Either left out or labelled "rumour" on screen and in the
  post. Leaked material is never shown.

### 7.2 Footage and music rules

- Own footage preferred. Rockstar trailer or screenshot clips: short, under our own commentary, with
  the source page in `footage.json`.
- No other creators' footage. No leaked footage. No AI images of GTA characters or scenes.
- In-game licensed music muted or avoided. Our score only.
- **Rockstar's current video policy is checked and quoted** in `PUBLISHING-gaming.md` before the
  first upload (Q11).

### 7.3 `PUBLISHING-gaming.md`

Same structure as `PUBLISHING.md` (title ≤ 100 characters with the hook first, description of real
content, hashtags, tags, pinned comment), with gaming changes:

- Gaming search phrases ("GTA 6 map", "GTA 6 secrets", "GTA 6 money guide").
- Rumours labelled as rumours.
- No fake release dates, no "leaked" clickbait.
- No medical disclaimer.
- Its own banned hashtags list.

`tools/validate_project.py` reads the rules file from `channel.json` and adds gaming checks: every clip
has `source` and `license`; tier-❌ claims aren't in the post text; music flagged by `footage.json`
raises a warning.

### 7.4 Agent instructions

- `AGENTS.md` gets a short "which channel?" section pointing to the channel's rules.
- New skill `.claude/skills/new-gaming-video/SKILL.md`: topic → research with tiers → script with
  footage needs → stop for approval. The hook writer skill applies as-is.

## 8. Build order

| Step | What | Done when |
| --- | --- | --- |
| 1 | Multi-channel: `channel.json`, `.studio/channels.json`, `contentRoot` per channel, sidebar switcher, per-channel secrets | Polyjuice works exactly as before; switching to an empty gamer87 workspace shows its own (empty) project list and brand |
| 2 | Footage: ingest tool, `footage.json`, clip scenes (trim / crop / speed), Footage picker | A real PS5 capture imported, a clip trimmed into a scene and previewed in 9:16 |
| 3 | ElevenLabs: engine in `tts.py`, server-side allow-list, draft/final, cache, budget meter | Final voice on a test project uses credits once; a Polyjuice request for ElevenLabs is refused |
| 4 | gamer87 brand + `gaming-news` / `gaming-list` templates, `PUBLISHING-gaming.md`, validator rules, `new-gaming-video` skill | First Short scripted, approved, voiced, previewed; validator clean |
| 5 | YouTube / Instagram connection for gamer87; first publish by the owner | First Short live (owner presses Publish) |
| 6 | Map, guide and versus templates, long-form cinematic over clips | First long-form video |

Each step: type checks clean (`dashboard`, `remotion`), Polyjuice preview still renders, and a commit
plus Tracker entry.

## 9. Setup checklist (owner)

**PS5**
1. Settings → Captures and Broadcasts → Captures: video 1080p, **HDR off**, include mic audio **off**,
   recent gameplay 15 min.
2. In game: radio off (or note the station), HUD off for cinematic shots, photo mode for thumbnails.
3. A USB drive formatted **exFAT**. Media Gallery → select → Copy to USB.

**YouTube**
1. youtube.com → profile → Settings → **Create a new channel** (this makes a Brand Account under your
   Google login). Name: gamer87 for now.
2. Claim the handle. Add a profile picture and banner (we make them in the studio, step 4).
3. Verify the channel (phone) so you can upload long videos and custom thumbnails.

**Instagram** (optional at first): a new account with the same handle; switch it to a professional
(creator) account for the API.

**ElevenLabs**
1. Sign up, choose **Starter**. Pick or design one channel voice (Voice Library or Voice Design).
2. Create an API key with only the permissions we need. Save it as `secrets/elevenlabs.json` on the Mac
   (never in chat, docs or Git).

**Mac:** enough disk for raw footage (about 5–8 GB per hour), or an external SSD (Q12).

## 10. Not in scope now

Live streaming, TikTok publishing, other members on gamer87, AI video generation, other games (the
design allows them; no templates yet).
