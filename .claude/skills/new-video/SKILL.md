---
name: new-video
description: Turn a topic into a ready-to-render explainer video project — fact-checked research with sources, a punchy script, scenes, on-screen text and per-scene image prompts — then generate voice + captions and a preview render. Use when the user says "/new-video <topic>", "make a video about X", "new short on X", or "script a video on X".
argument-hint: <topic> [--template listicle|analogy] [--style photo-mix|illustrated] [--items N]
---

# /new-video — topic → project.json

You are the writer and researcher for a faceless infotainment channel (Shorts / Reels first).
Brand vibe: **bold & punchy**, curious, fast. Accuracy matters more than hype.

Input: `$ARGUMENTS` — a topic, optionally `--style` and `--items N` (default 5).
Repo root is the folder containing `PLAN.md`. Read `PLAN.md` once if you have not this session.

## 0. Decide the basics

- **Template:**
  - `listicle` — "N things" countdowns (Types of Whales, Deadliest Volcanoes).
  - `analogy` — explain a system by casting its parts as characters in a familiar world
    (immune system = security firm, a computer = a restaurant kitchen). See **Analogy** below.
  - `explainer` + **blueprint** — how a system / institution works (Parliament, Congress,
    elections, courts, how a bill becomes law): drafting-paper look, an org chart that builds up
    scene by scene, pictograms, handwritten notes, seat charts. See **Blueprint explainer** below.
    Use it when the topic is structure or "who does what", or when the user asks for that look.
- `newsroom` — **AI News series** (latest AI stories): green terminal look, news top bar, a
  full-screen image behind every scene, one data widget per beat, glitch cuts. See **Newsroom** below.
- **Style:** `photo-mix` for real-world subjects (animals, places, history, space);
  `illustrated` for abstract / inside-the-body / analogy topics. Use `--style` if given.
- **Slug:** `YYYY-MM-<kebab-topic>` using today's date, e.g. `2026-11-deadliest-volcanoes`.
  If `projects/<slug>/` exists, ask before overwriting.

## 1. Research → `projects/<slug>/research.md`

- Use web search. Pick `N` items that are genuinely surprising, not the obvious top results.
- For every claim that will be **said or shown**, record a source. Prefer: government science
  agencies (NOAA, NASA, USGS, NIH), universities, museums, encyclopedias (Britannica),
  peer-reviewed papers. Avoid content farms and listicle sites as sources.
- Use **conservative** numbers ("up to", "over", "about"). If sources disagree, use the
  lower / safer figure and note the disagreement.
- Mark anything you couldn't confirm as **UNVERIFIED** and don't use it in the script.

Format (keep it scannable):

```markdown
# Research — <title>

| # | Item | Claim used in video | Notes | Source |
|---|---|---|---|---|
| 5 | Narwhal | Tusk is a tooth, up to ~3 m | Left canine, 1.5–3 m | [NOAA Fisheries](https://...) |

## Considered but cut
- <item> — why
```

## Analogy template (when `template: "analogy"`)

- Pick ONE familiar world and keep every role inside it (security firm: the wall, rapid
  responders, special agents…). Each role must map cleanly onto one real thing.
- Scenes: `hook` → 4–5 `character` scenes → optional 1 `beat` (twist / payoff) → `outro`.
  - `character`: `name` = the role ("The Big Eaters"), `realName` = the real thing
    ("Macrophages"), `character` = its id. Narration: role intro + what the real thing does +
    one striking fact. On-screen text: the striking fact, ≤ 8 words.
  - `beat`: one big statement in `onScreenText` (ALL CAPS, ≤ 6 words), e.g. the twist.
- Research table columns: `Guard/Role | Real thing | Claim | Notes | Source`, plus a
  "Wording choices" section listing simplifications the analogy forces.
- **Style is `illustrated`**, with `"stylePreset": "electric-flat"` (see `library/characters/styles.json`).
- **Characters** live in `library/characters/<id>/character.json`:
  `{ "id", "name", "description", "sheet": null }`. `description` is the fixed visual look
  reused in every prompt — concrete shapes, colors, clothing, one prop, e.g.
  `"a huge pale-cyan amoeba-shaped blob with a wide toothy grin and long stretchy arms, wearing a small navy security cap"`.
  Reuse existing characters when they fit; create new ones otherwise. Include a villain if
  the story has one (e.g. `germ-invader`). List all ids in the project's `"characters"`.
- For illustrated scenes, `visual.aiPrompt` is **only the scene action** ("gulping down a
  surprised green germ, cheeks bulging"). The dashboard prepends the style preset and the
  character description when copying. Set each scene's `"character"` to who's drawn.

## Blueprint explainer (when the topic is a system's structure)

Style reference: GeoGlobeTales "House vs Senate". Example to copy from:
`projects/2026-11-lok-sabha-vs-rajya-sabha/project.json`.

Project settings: `"template": "explainer"`, `"style": "photo-mix"`, `"theme": "blueprint"`,
`"captions": { "style": "lower-third", "fontSize": 40, "wordsPerGroup": 6, "bottomOffset": 210 }`.
Indian topics: `"voice": { "source": "tts", "engine": "google", "voiceId": "en-IN-Chirp3-HD-Iapetus", "speed": 1.0 }`
and add `ttsText` with phonetic hints for Hindi words, e.g. `[Lok Sabha](/lˈOk sˈʌbɑ/)`,
`[Rajya Sabha](/ɹˈɑʤjə sˈʌbɑ/)`.

**Shape:** `hook` (drawn) → `map` (where it happens) → 3–5 `diagram` scenes, with a `map`
scene for the big-vs-small comparison → `beat` (seat chart) → `comment` → `outro`.
Not a countdown: no ranks, no "Number five". Each scene explains one step of the structure,
and one concrete comparison (big state vs tiny state, 80 vs 1) carries the explanation.

**The org chart** is written once, at project level, and every `diagram` scene builds on it:

```json
"diagram": { "nodes": [
  { "id": "president", "label": "President", "icon": "palace" },
  { "id": "parliament", "label": "Parliament", "icon": "parliament", "parent": "president" },
  { "id": "ls", "label": "Lok Sabha", "parent": "parliament", "people": 543, "value": "543" }
]}
```

- `icon`: `parliament` | `palace` | `people` | `state` (white line drawings). `label` ≤ 2 words.
- `value`: the big yellow number (counts up). `people`: pictogram, one icon ≈ 10 members.
- Keep it to 3–6 nodes; deeper than 3 levels gets too small on a phone.

**Each `diagram` scene** says what changes (`onScreenText: ""` — the chart is the visual,
`visual: { "type": "graphic", "asset": null, ... }`):

```json
"diagram": {
  "reveal": ["ls", "rs"],                 // nodes that appear now (and stay)
  "cues": { "ls": "lok", "rs": "rajya" }, // pop each in when the narration says this word
  "focus": ["ls"],                        // camera frames these (default: everything shown)
  "highlight": ["ls"],                    // pulsing ring, this scene only
  "notes": [{ "at": "ls", "text": "every 5 years", "side": "left", "cue": "five" }],
  "compare": { "at": "ls", "items": [
    { "label": "Uttar Pradesh", "value": 80, "cue": "uttar" },
    { "label": "Sikkim", "value": 1, "cue": "sikkim" } ] }
}
```

- Reveal top-down when you can; the root may be revealed late (e.g. the President when the
  narration reaches signing laws). The camera glides between consecutive diagram scenes.
- `notes`: ≤ 5 words, handwritten, this scene only. `side`: put it where there's room —
  the left node gets `left`, the right node `right`, `below` under compares.
- `compare`: 2 items, values ≤ 100 (drawn as people icons); stays for later scenes.
- **Cue words must appear in that scene's `narration`** (first letters are enough: "uttar",
  "fourteen"). Numbers are spelled out in narration, so cue "eighty", not "80".

**Map scenes** (`kind: "map"`, satellite map, India only for now — `library/maps/india/`):

```json
"geo": {
  "map": "india",
  "focus": ["uttar-pradesh", "sikkim"],          // state ids, or [lonMin, latMin, lonMax, latMax]
  "highlight": [{ "state": "uttar-pradesh", "label": "Uttar Pradesh", "value": "80", "cue": "uttar" },
                { "state": "sikkim", "value": "1", "cue": "sikkim", "tone": "accent" }],
  "pins": [{ "lon": 77.21, "lat": 28.61, "label": "New Delhi", "cue": "delhi" }],
  "photo": { "cue": "parliament" }               // fade into visual.asset (e.g. the building)
}
```

- The camera starts on all of India (or where the previous map scene ended) and zooms to `focus`.
- State ids are kebab-case names from `library/maps/india/states.geojson` (`uttar-pradesh`,
  `jammu-kashmir`, `ladakh`, `delhi`, `andaman-nicobar`, …). The validator rejects unknown ids.
- Imagery is sharp down to state level. For a city or a building, zoom to the city with a pin,
  then fade into a real photo with `photo` (set `visual.asset` + license as usual).
- Boundaries follow India's official map (DataMeet + Natural Earth India view) — never swap in
  other boundary data for Indian videos.
- Credits for the publish text: NASA Blue Marble (public domain), DataMeet (CC BY 4.0),
  Natural Earth (public domain) — listed in `library/maps/india/map.json`.

**Hook (drawn):** `visual.type: "graphic"`, no asset, plus `"scribbles": ["Lok Sabha?", "Rajya Sabha?", "?", "?"]`
— handwritten questions around a line drawing of the building. Title still ALL CAPS ≤ 7 words.

**Beat (seat chart):** `visual.type: "graphic"`, no asset, plus
`"hemicycle": { "total": 543, "highlight": 272, "label": "Lok Sabha majority", "cue": "two" }` —
seats light up as the narration says the number. `onScreenText` e.g. `*272* SEATS TO RULE`.
Avoid live party seat counts unless the user asks — they date fast and sources disagree.

**More visuals — never leave a scene as text alone.** Every scene should show something:
- Diagram `icon`s also include `factory`, `server`, `phone`. `"flow": { "from": "fabs", "to": { "ai": 4, "phone": 1 } }`
  streams chips down the lines (weights = how many). `"tally": { "at": "ai", "icon": "wafer", "total": 10, "lit": 4, "label": "4 in 10 wafers", "cue": "forty" }`
  lights up icons for a share. A diagram scene with `strip` gets two labelled photos under the chart.
- Beat with a real quote: `"quotes": [{ "kind": "podcast" | "post", "who", "where", "photo", "text", "cue" }]`
  — podcast card with a moving waveform, or a social-post card. Only verbatim, sourced quotes.
- Beat about prices: `"priceTag": { "label": "+14%", "cue": "paying" }` — drawn phone with RAM inside and a growing ₹ tag.
- Map: pins with `"tag": "₹↑"` become swinging price tags; `"counters": [{ "value": 47, "prefix": "-", "suffix": "%", "label": "...", "cue": "forty" }]`
  count up under the map.
- Comment: `"faces": [{ "photo": "library/assets/people/x.jpg", "label": "AI companies" }, { "label": "You" }]` above the choices.
- Hook over a face photo: `"titlePosition": "lower"` keeps the title off the face.
- Photos: fetch from Wikimedia Commons (record license + credit in `library/assets/<topic>/assets.json`),
  reuse `library/assets/` first. Real people only from licensed photos, never AI images.

**Comment:** `kind: "comment"` with `comment: { "prompt": "...*word*?", "choices": ["✅ YES", "❌ NO"] }`.

## Newsroom (AI News series)

Example: `projects/2026-11-ai-news-948-linux-hacks/project.json`. Composition `Newsroom`.

**Script first:** write research + narration + on-screen text and stop. The user approves the
script in the dashboard Script tab; only then add widgets, photos, voice and a render. File the
project in the dashboard folder "AI News" (`workspace.json` at the content root, folder `ai-news-k7q2`).

Project settings: `"template": "newsroom"`, `"theme": "newsroom"`, `"style": "photo-mix"`,
`"news": { "tag": "AI NEWS", "date": "NOV 4, 2026" }` (the day the story broke),
`"captions": { "style": "lower-third", "fontSize": 54, "wordsPerGroup": 5, "bottomOffset": 210 }`,
voice `en-IN-Chirp3-HD-Puck` at 1.05.

**Shape:** `hook` → 4–5 `beat` → `comment` → `outro` (silent, `FOLLOW FOR MORE AI NEWS`).
Every hook and beat gets a full-screen 9:16 image (`visual.asset`): AI images from the Figma file
(dark, green-lit, no text) for places and ideas; licensed real photos (Wikimedia Commons) for real
people and logos — never AI images of real people. Keep `"source": "OpenAI · The Hacker News"` on
each scene for the post text (it isn't drawn). Beats add one `widget`:

| type | for | fields |
|---|---|---|
| `funnel` | narrowing numbers (2,308 → 1,724 → 948) | `rows: [{label, value, cue?, tone?}]` |
| `counter` | 1–2 big numbers that count up | `items: [{value, prefix?, suffix?, decimals?, label, cue?, tone?}]` |
| `ticker` | a market move | `trend: "down"/"up"`, `label?`, `cue?`, `items?: [{label: "NVDA", change: -9.3, cue?}]` |
| `compare` | two values as bars (33 of 41, 10% vs 16%) | `unit?`, `items: [{label, value, max?, cue?, tone?}]` |
| `terminal` | code / commands typing | `title?`, `lines: [{text, cue?, tone?}]` |
| `checklist` | ticked boxes per column (≤ 25 boxes) | `columns: [{label, done, total, cue?, tone?}]` |

`tone`: `accent` (yellow, default) · `danger` (red) · `up` (green) · `neutral`. Cue words pop each
part in; pick cues in the first two-thirds of the narration so the last part stays readable, or
add `"hold": 0.5` to the scene. A `map` scene (India) also works between beats.

## 2. Script rules (shorts, 9:16)

Target **110–140 words total** (~45–60 s at the channel's voice speed).

- **Hook (scene 1, ≤ 15 words):** open a curiosity gap in the first 2 seconds. No "Hi guys",
  no "In this video". Patterns: "X is weirder than you think…", "Number one will shock you",
  a surprising stat, a direct challenge.
- **Items:** count **down** (`#N` → `#1`), saving the best for `#1`. Each narration 15–25 words:
  `"Number <word>, the <name>." + one striking fact + optional twist.`
- **Outro (≤ 12 words):** a comment-bait question + "Follow for more."
- Write for the ear: short sentences, contractions, no parentheses.
- **Spell numbers out in `narration`** ("two thousand meters") — the voice reads digits badly.
  Use digits in `onScreenText` ("2,000 m+").
- No claims beyond what `research.md` supports.

## Team files for a new project

Every new `projects/<slug>/` also gets `team.json` with the member who asked for it as owner:
`{"owner": "<id from .studio/me.json>"}` (member ids are in `members.json` at the content root).
The owner approves the script in the dashboard. Never write `review.json` or an approval yourself:
reviews and approvals are made by people in the Script tab.

## 3. On-screen text rules

- Hook `onScreenText`: the title, ALL CAPS, ≤ 7 words, e.g. `*5* WHALES THAT *BREAK* THE RULES`.
- Item `onScreenText`: the single most striking fact as a fragment, ≤ 8 words,
  e.g. `Lives *200+ YEARS*`.
- Wrap 1–2 key words in `*asterisks*` to color them in the brand accent. Never emphasize
  everything.
- Item `name`: short display name (≤ 2 words fits best; 3 max).
- Outro `onScreenText`: `FOLLOW FOR MORE` (or a short variant).

## 4. Visuals per scene

Every scene has a `visual` object:

```json
{
  "type": "photo",          // photo | clip | illustration | graphic
  "asset": null,             // filled later: "assets/<file>"
  "aiPrompt": "...",         // ready to paste into Gemini / ChatGPT
  "searchTerms": ["..."],    // 1–3 stock-photo queries (photo-mix only)
  "source": null, "license": null, "credit": null
}
```

- **photo-mix:** `type: "photo"`. `aiPrompt` = photorealistic, the subject clearly
  identifiable and accurate, end with `vertical 9:16`. Add `searchTerms` for Pexels /
  Wikimedia (plain nouns: "narwhal tusk"). Real photos are preferred for real animals —
  AI images of real species can be anatomically wrong.
- **illustrated:** `type: "illustration"`, `aiPrompt` = scene action only (see Analogy above);
  style and character descriptions are added by the dashboard so they stay identical.
- Leave the top ~35% of the frame visually calm (title text sits there): add
  `subject in lower two-thirds of frame` to prompts.
- Outro: `type: "graphic"`, `aiPrompt: null`.

## 5. Write `projects/<slug>/project.json`

Also write a `publish` block, the post text for YouTube (Shorts or long-form) and Instagram,
following **Publish text** below.

### Publish text

Follow **`PUBLISHING.md`** at the repo root. It is the single source of the rules for all agents,
and `tools/validate_project.py` enforces them. In short:
- Titles use up to 100 characters: hook in the first ~40, then the search phrase, emojis kept.
- Descriptions are about 1,500–3,000 hand-written characters of sourced content (summary, 🔑 key facts,
  📖 glossary, ❓ FAQ, series line or chapters, 🔔 about line, ⚠️ disclaimer for health topics).
- 5–8 hashtags, never `#cart` or `#Shorts`; plus `tags` (≤ 500 characters) and `pinnedComment`.

```json
{
  "title": "<Title Case title>",
  "publish": {
    "title": "5 Whales That Break the Rules 🐋",
    "description": "A tooth that looks like a horn, a whale that lives 200+ years… Which one surprised you?",
    "hashtags": ["#whales", "#animalfacts", "#ocean", "#didyouknow"]
  },
  "template": "listicle",
  "style": "photo-mix",
  "format": "short-9x16",
  "language": "en",
  "voice": { "source": "tts", "engine": "kokoro", "voiceId": "am_michael", "speed": 1.05 },
  "music": null,
  "scenes": [
    { "id": "s1", "kind": "hook", "narration": "...", "onScreenText": "...", "visual": { ... } },
    { "id": "s2", "kind": "item", "rank": 5, "name": "...", "narration": "...", "onScreenText": "...", "visual": { ... } },
    ...
    { "id": "sN", "kind": "outro", "narration": "...", "onScreenText": "FOLLOW FOR MORE", "visual": { "type": "graphic", ... } }
  ]
}
```

Also create the empty folder `projects/<slug>/assets/`. Write JSON with real UTF-8 (not `\u` escapes).

## 6. Validate, voice, preview

Run from the repo root:

```bash
python3 tools/validate_project.py projects/<slug>
```

Fix every `ERROR`; fix warnings unless there's a reason not to. Then:

```bash
tools/.venv/bin/python tools/prepare.py projects/<slug>
```

Then render a preview (from `remotion/`), passing the project as props. The composition is
`Listicle`, `Analogy`, `Explainer` or `Newsroom` to match the template:

```bash
cd remotion && npx remotion render src/index.ts <Listicle|Analogy|Explainer|Newsroom> ../out/<slug>/<slug>.mp4 \
  --props="$(python3 ../tools/render_props.py ../projects/<slug>)"
```

(The dashboard's **Export** does this plus the cover and post texts.)

## 7. Report back

Keep it short:
- Title, length, item list (`#5 … #1`) — for blueprint explainers, the scene-by-scene beats.
- The hook line, so the user can judge it.
- Any UNVERIFIED / disputed facts you left out or softened.
- Next step for assets: which scenes need images, pointing at the `aiPrompt` / `searchTerms`
  in `project.json`. For illustrated projects: make each character's reference sheet first
  (dashboard → Characters panel → Copy sheet prompt), then the scene images.
- Send the preview MP4 to the user.
