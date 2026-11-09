# Playbook — an 8-minute long-form video (cinematic, 16:9)

How "CAR-T: The Living Drug" (`projects/2026-11-car-t-long`, uploaded Nov 2026) was made, written
so any agent (Claude Code, Codex, Gemini) can repeat it. Rules in `AGENTS.md` and `PUBLISHING.md`
still apply on top of this.

## The result, for scale

| | CAR-T long |
|---|---|
| Length | 7:41 voiced (460.9 s), 75 scenes, 1,244 words |
| Template / format | `"template": "cinematic"`, `"format": "long-16x9"` → Remotion composition `Cinematic` (1920×1080) |
| Style | `"style": "illustrated"`; dark bloodstream world, glowing cells |
| Voice | Google `en-IN-Chirp3-HD-Puck`, speed 1.0 |
| Captions | `{ "style": "lower-third", "fontSize": 40, "wordsPerGroup": 7, "bottomOffset": 56 }` |
| Branding | `{ "watermark": "corner", "source": "none" }` |
| Music | own ambient score, `music: { track, volume: 0.6, duckTo: 0.22 }` (ducks under the voice) |
| Spin-offs | 3 Shorts (9:16) cut from it, `CinematicVertical` composition |

## Order of work

1. **Research first** → `research.md`. Every claim is linked to the page that says it (REQ-01).
   A real person's story (Emily Whitehead) framed the film, told with narration, cell visuals and
   date cards only, never a likeness.
2. **Script as a plan table** → `script.md`, one table per chapter:
   `# | Visual | Narration | On screen | ⏸ pause`. Mark each visual ✅ reuse an image,
   🆕 new image, ⚙️ code graphic. Aim for about 1,000–1,250 words for 8 minutes. Structure:
   - **Cold open (≈0:45):** a dated, human moment, then an open loop ("It worked. And then, it
     nearly killed her.") that is paid off chapters later.
   - **Title card**, then **6–7 chapters** of 1–1.5 min each, then a short epilogue.
   - Write for the ear: short sentences, numbers spelled out in narration.
3. **Owner approves the script** in the dashboard (Script tab) before images, voice or renders.
4. **Build `project.json` from code**, not by hand: `projects/2026-11-car-t-long/build_project.py`
   turns the scene plan into 75 `shot` scenes with helpers (`reuse()` re-frames a shot from the
   1.5-min cut, `flow()` adds drifting blood cells and particles, `cell()` places a glowing cell).
   Re-running rewrites `project.json`; the voice step only regenerates scenes whose narration changed.
5. **Images:** a small reusable kit instead of one image per scene: one empty background plate
   (`bg-bloodstream-empty.png`) plus cut-out "actors" (`cart.png`, `cancer.png`, `tcell.png`,
   `rbc.png`, `antibody.png`…) and a few hero frames. Generated in the Figma file
   `uUQCDmP84YwhxS2JnUCkJO` with `generate_image` ("isolated on a pure solid black background"),
   cut out with `tools/cutout.py`. Shared images live in `library/assets/car-t/` so the Shorts reuse them.
6. **Shots carry the motion** (see `Shot` in `remotion/src/types.ts`): `camera` from→to push/pan,
   `layers` with `depth` (parallax), `float`, `spin`, `blur`, `glow`; `fx` (drift, particles,
   flash); `labels` that point at things on cue words; `tint`/`grade` for mood (red pulse = danger);
   and information overlays: `steps`, `tracker` (chapter progress), `timeline`, `stats`, `bars`,
   `card`, `quote`, `title` (chapter cards, `hideCaptions: true` when the card already says it).
   CAR-T used labels in 33 shots and sound effects in 47.
7. **Pauses:** `hold` (seconds of silence after a line) on 25 scenes, for reveals and chapter breaks.
8. **Voice:** `tools/.venv/bin/python tools/prepare.py projects/<slug>` (Google TTS + Whisper
   captions → `timeline.json`). Use `ttsText` only for pronunciation; it must say the **same
   words** as `narration` (captions show `narration`).
9. **Sound:** effects are synthesized once into `library/sfx/` (`tools/make_sfx.py`: whoosh, hit,
   heartbeat, monitor-beep, riser…) and played per shot via `shot.sfx`. Music is an own ambient
   score: write `score.json` with one section per chapter (chord, pulse, shimmer, noise, level at
   the chapter's start time from `timeline.json`), then
   `tools/.venv/bin/python -I tools/ambient_score.py projects/<slug>/score.json library/music/<slug>-ambient.mp3`.
10. **Preview renders** (from `remotion/`):
    `npx remotion render src/index.ts Cinematic ../out/<slug>/<slug>-preview.mp4 --props="$(python3 ../tools/render_props.py ../projects/<slug>)"`.
    Check stills per scene (`npx remotion still … --frame=N --scale=0.4`) before a full render.
11. **Post text** by `PUBLISHING.md`, plus **chapters** at the end of the description, taken from
    the real scene start times after voicing ("0:00 Cold open / 0:26 1 · The enemy / …"), a
    "📺 Shorts from this video" line, and the ⚠️ medical disclaimer for health topics.
12. **Shorts from the long video:** `projects/_series/car-t-shorts/build_projects.py` writes three
    9:16 projects (50–60 s each) that reuse the long video's images and research.
13. **Export and upload are the owner's job** (REQ-06). Agents never press Export or Post.

## Lessons

- Build a 1.5-minute cut first (`2026-11-car-t-cells`) to settle the look; the long video reused
  and re-framed its shots.
- Few images, lots of camera: one background + cut-outs + parallax carried 75 scenes.
- Plan pauses and chapter cards in the script table, not after voicing.
- Keep the voice and captions identical; a `ttsText` that changes a word puts wrong captions on screen.
