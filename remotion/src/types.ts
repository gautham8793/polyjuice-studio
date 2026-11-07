// US state codes → how to color them on the tile map
// "R>D" / "D>R" = flipped: drawn in the old party's color, then flips to the new one
export type StateMap = Record<string, "D" | "R" | "pending" | "highlight" | "R>D" | "D>R">;

export type Visual = {
  type: "photo" | "clip" | "illustration" | "graphic";
  // relative to the project folder, or to the Video/ root when it starts with "library/"
  asset: string | null;
  map?: StateMap; // graphic: draw the US tile map with these states colored
  mapZoom?: boolean; // start on the full map, then zoom into the colored/flipped states
  // "contain": whole (landscape) photo over a blurred copy of itself
  // "pan": full-screen, camera glides across the photo from `pan.from` to `pan.to`
  fit?: "cover" | "contain" | "pan";
  // points are fractions of the photo (0–1); zoom 1 = photo height fills the screen
  pan?: { from: { x: number; y: number }; to: { x: number; y: number }; zoom?: number };
  size?: { width: number; height: number }; // photo pixel size, needed for "pan"
  // photo-mix: the full prompt. illustrated: just the scene action — the dashboard prepends the
  // style preset and the scene character's description so every image stays on-model.
  aiPrompt: string | null;
  searchTerms?: string[]; // stock-photo search queries (Pexels / Wikimedia)
  source: string | null;
  license: string | null;
  credit: string | null;
};

// ── Cinematic template (16:9): a scene is one camera shot over stacked image layers ──────────
// Points are fractions of the 1920×1080 frame ([0.5, 0.5] = center).
export type Pt = [number, number];

// When something happens: at a narration word (`cue`), else `start` seconds into the scene.
export type ShotTiming = { cue?: string; start?: number; duration?: number };

export type ShotLayer = {
  id?: string; // labels can `follow` a layer by id
  src: string; // image (relative to the project, or "library/...")
  stages?: string[]; // cross-fade from `src` through these images during `move` (e.g. apoptosis)
  fill?: boolean; // full-frame background plate
  at?: Pt; // center at the start (cut-outs)
  width?: number; // share of the frame width (cut-outs)
  to?: { at?: Pt; scale?: number; rotate?: number; opacity?: number; blur?: number }; // end state of `move`
  move?: ShotTiming & { ease?: "inOut" | "out" | "in" | "linear" };
  depth?: number; // 0 = far (barely moves with the camera) … 1 = near (default 0.5; plates 0)
  blur?: number; // px, depth of field
  opacity?: number;
  float?: number; // px of gentle bobbing in the bloodstream
  spin?: number; // degrees of slow rotation over the scene
  enter?: ShotTiming & { from?: "fade" | "left" | "right" | "below" }; // how the layer arrives
  glow?: { color: string; size?: number; pulse?: boolean; cue?: string; start?: number; strength?: number };
  blend?: "screen" | "normal";
};

export type ShotFx =
  // sprites (red blood cells) carried across the frame by the flow; `back` = behind the layers
  | { type: "drift"; src: string; count: number; seed?: number; size?: [number, number]; speed?: number; dir?: 1 | -1; back?: boolean; blur?: number; opacity?: number; depth?: number }
  // floating specks of light
  | { type: "particles"; count: number; color?: string; seed?: number; size?: number }
  // granules / granzymes travelling from one point to another
  | ({ type: "stream"; from: Pt; to: Pt; count: number; colors?: string[]; spread?: number; size?: number; seed?: number; depth?: number } & ShotTiming)
  // holes opening in a membrane (perforin)
  | ({ type: "pores"; points: Pt[]; size?: number; depth?: number } & ShotTiming)
  // a bloom of light (binding, activation); `hold` keeps it pulsing afterwards
  | ({ type: "flash"; at: Pt; color: string; size?: number; hold?: boolean; ring?: boolean; depth?: number } & ShotTiming);

export type ShotLabel = {
  text: string; // "CAR receptor"
  sub?: string; // "(anti-CD19)"
  at?: Pt; // point the leader line touches (no `at` / `follow`: just the box)
  follow?: string; // …or a layer id: the point moves with that layer
  offset?: Pt; // with `follow`: offset from the layer center, in frame fractions
  depth?: number; // with `at`: depth of what it points at (0 = on the background plate)
  box: Pt; // where the label box sits on screen (its center)
  tone?: "blue" | "red" | "gold" | "violet" | "white";
  cue?: string;
  start?: number;
  until?: number | string; // hide again: seconds, or a narration word
};

// Big text over the shot: a chapter card ("CHAPTER 1" / "The enemy"), a date stamp, or a callout ("1 in 1,000").
export type ShotCard = { kind: "chapter" | "date" | "callout"; text: string; kicker?: string; sub?: string; until?: number | string } & ShotTiming;

// A stat tile; `count` makes the number count up (value is then `prefix + count + suffix`).
export type ShotStat = { value?: string; count?: number; prefix?: string; suffix?: string; label: string; tone?: "blue" | "red" | "gold" | "violet" | "white" } & ShotTiming;

// A sound effect from library/sfx/<sound>.wav; `loop` repeats it for `duration` seconds (default: the rest of the shot).
export type ShotSound = { sound: string; volume?: number; loop?: boolean } & ShotTiming;

export type Shot = {
  camera?: { from?: { zoom?: number; x?: number; y?: number }; to?: { zoom?: number; x?: number; y?: number }; ease?: "inOut" | "out" | "linear" };
  layers: ShotLayer[];
  fx?: ShotFx[];
  labels?: ShotLabel[];
  // end card; `question` pops in under it (comment bait)
  title?: { text: string; subtitle?: string; side?: "left" | "right" | "center"; size?: number; cue?: string; start?: number; question?: { text: string } & ShotTiming };
  brand?: { line?: string } & ShotTiming; // calm end card: channel logo, name and handle, plus an optional line ("Full story on our channel")
  steps?: { title?: string; items: ({ text: string } & ShotTiming)[]; side?: "left" | "right" }; // numbered process list
  tint?: string | { color: string; strength?: number; pulse?: boolean }; // color wash over the shot; pulse = warning
  grade?: string; // CSS filter over the picture (not the overlays), e.g. "saturate(0.6) hue-rotate(-25deg)"
  hideCaptions?: boolean; // title cards that already show the line
  card?: ShotCard;
  stats?: ShotStat[];
  bars?: { title?: string; items: { label: string; value: number; highlight?: boolean }[] } & ShotTiming; // values 0–1
  tracker?: { items: string[]; active: number }; // corner step tracker; active = index lit (−1 = none)
  timeline?: { points: { year: string; label: string }[]; active: number } & ShotTiming;
  quote?: { text: string; who: string; where?: string } & ShotTiming;
  sfx?: ShotSound[];
};

export type ArgonKind = "crash-hook" | "refactor-split" | "token-editor" | "autonomous-ide" | "deepswe-loop";

export type Scene = {
  id: string;
  kind: "hook" | "item" | "character" | "beat" | "scoreboard" | "measure" | "stats" | "chart" | "quiz" | "comment" | "diagram" | "map" | "shot" | "outro";
  argon?: ArgonKind; // programmatic UI scenes for the 60s Gemini Argon hybrid short
  shot?: Shot; // cinematic template: every scene (hook / shot / outro) is a shot
  rank?: number; // listicle items
  tag?: string; // explainer items without a rank: badge text ("FLIP", "FIRST")
  factStyle?: "strip" | "card"; // item fact: colored strip under the name (default) or calm card beside the badge
  name?: string; // listicle: item name · analogy: role ("The Big Eaters")
  realName?: string; // analogy: what it really is ("Macrophages")
  character?: string; // id in library/characters/ drawn in this scene
  narration: string;
  ttsText?: string; // optional phonetic respelling for the voice; captions still show `narration`
  onScreenText: string;
  scoreboard?: Scoreboard;
  stats?: Stat[]; // "stats" scenes: 1–3 big-number tiles
  chart?: Chart; // "chart" scenes: animated bar chart
  portraits?: Portrait[];
  measures?: Measure[];
  quiz?: Quiz; // "quiz" scenes: a question asked in one scene, answered in the next
  comment?: CommentPrompt; // "comment" scenes: ask viewers to answer in the comments
  diagram?: DiagramStep;
  geo?: GeoMap; // "map" scenes: satellite map with highlighted states, pins and a camera move
  hemicycle?: Hemicycle; // beat: seating chart under the statement (blueprint look)
  scribbles?: string[];
  quotes?: Quote[]; // beat: quote cards (a podcast clip, a social post) stacked under the statement
  priceTag?: { label: string; cue?: string }; // beat: a drawn phone with RAM inside and a price tag that grows ("+14%")
  outroStyle?: "channel"; // outro: calm end card with the channel logo, name and handle (onScreenText = the line under it)
  titlePosition?: "center" | "lower"; // hook / beat: "lower" keeps a face in the photo clear of the title // hook on the blueprint theme: handwritten questions around the drawing // "diagram" scenes: what this scene adds to / looks at on the project's diagram
  hold?: number; // seconds of silence after the narration (the quiz countdown)
  // stats / chart / quiz / comment: a visual with an asset becomes a faded photo background;
  // `strip` adds one or two labelled photos below the content
  strip?: StripPhoto[];
  widget?: NewsWidget; // newsroom template: the data card under the headline
  source?: string; // newsroom template: "OpenAI · Help Net Security", shown under the photo
  visual: Visual;
  recording?: string | null; // own-voice take, relative to the project folder; replaces TTS
};

// An official-style round portrait badge (real photo, credited), shown over a scene.
export type Portrait = {
  name: string;
  party: "D" | "R" | "I";
  // no licensed photo → an initials badge in the party color
  photo?: string; // relative to the Video/ root, e.g. "library/assets/people/gina-hinojosa.jpg"
  width?: number; // photo pixel size, for cropping
  height?: number;
  focus?: { x: number; y: number; size: number }; // face center (% of width/height), crop side (× shorter edge)
  winner?: boolean;
  cue?: string; // pop in when the narration says this word (e.g. the surname or state)
  credit?: string | null;
  license?: string | null;
  source?: string | null;
};

// A multiple-choice question. Write it as two scenes with the same options: phase "ask"
// (options pop in, then a 3-2-1 countdown during `hold`) and phase "reveal" (the answer lights up).
export type Quiz = {
  question: string;
  options: { label: string; portrait?: Portrait; reveal?: string }[]; // reveal: shown once answered, e.g. "−63 · 2010"
  answer: number; // index into options
  phase: "ask" | "reveal";
};

// A blueprint org chart drawn once per project (`project.diagram`) and built up across
// consecutive "diagram" scenes: each scene reveals nodes, points the camera at some of them and
// adds handwritten notes, so the chart feels like one continuous shot.
export type DiagramNode = {
  id: string;
  label: string; // orange label box, e.g. "LOK SABHA"
  parent?: string; // id of the node above it
  icon?: "parliament" | "palace" | "people" | "state" | "factory" | "server" | "phone"; // white line drawing above the label
  image?: string; // cut-out PNG instead of an icon (relative to the project, or "library/...")
  value?: string; // big yellow number under the label, e.g. "543" (counts up when numeric)
  people?: number; // pictogram rows of people icons (drawn up to 60, `value` gives the real count)
};

export type DiagramNote = {
  at: string; // node id
  text: string; // "every 5 years"
  side?: "left" | "right" | "below";
  cue?: string; // appear when the narration says this word
};

export type DiagramCompare = {
  at: string; // node id it hangs under
  items: { label: string; value: number; cue?: string }[]; // e.g. Uttar Pradesh 80 · Sikkim 1
};

// Row(s) of wafer / chip icons under a node; `lit` of `total` light up, e.g. 4 of 10 = 40%.
export type DiagramTally = { at: string; icon: "wafer" | "chip"; total: number; lit: number; label?: string; cue?: string };

export type DiagramStep = {
  reveal?: string[]; // node ids that appear in this scene (stay for later scenes)
  cues?: Record<string, string>; // node id → word in the narration that pops it in
  focus?: string[]; // camera frames these nodes (default: everything revealed so far)
  highlight?: string[]; // glowing ring this scene only
  notes?: DiagramNote[]; // this scene only
  compare?: DiagramCompare; // pictogram comparison; stays until another compare at the same node
  flow?: { from: string; to: Record<string, number> }; // chips stream down the lines, weight = how many (e.g. { ai: 4, phone: 1 })
  tally?: DiagramTally;
};

// Satellite map (library/maps/<map>/) with state outlines. The camera moves from the previous
// map scene's framing (or the whole country) to `focus`; consecutive map scenes form one move.
export type GeoMap = {
  map: string; // folder in library/maps, e.g. "india"
  focus?: string[] | [number, number, number, number]; // state ids, or [lonMin, latMin, lonMax, latMax]
  highlight?: { state: string; label?: string; value?: string; cue?: string; tone?: "accent" | "secondary" }[];
  pins?: { lon: number; lat: number; label: string; cue?: string; tag?: string }[]; // tag: draw a price tag ("₹ ↑") instead of a dot
  counters?: { value: number; prefix?: string; suffix?: string; label: string; cue?: string }[]; // big numbers that count up under the map
  photo?: { cue?: string }; // cross-fade into the scene's visual.asset when this word is said
};

// A real quote shown as a card. "podcast" = dark card with a moving waveform, "post" = light
// social-post card. `cue`: the card appears when the narration says this word.
export type Quote = { text: string; who: string; where: string; kind: "podcast" | "post"; photo?: string; cue?: string };

export type Hemicycle = { total: number; highlight: number; label?: string; cue?: string }; // 543 seats, 272 lit; cue: word that starts the fill

export type CommentPrompt = { prompt: string; choices: string[]; faces?: { photo?: string; label: string }[] }; // faces: who each choice stands for, drawn above it (no photo = a person icon) // "SHOULD INDIA HAVE MIDTERMS?", ["YES", "NO"]

export type StripPhoto = Visual & { label?: string; focus?: { x: number; y: number } }; // focus: % of the photo kept in view

export type Stat = { value: string; label: string; tone?: "accent" | "D" | "R" | "text"; icon?: "megaphone" | "home" | "scales" };

export type Chart = {
  bars: { label: string; value: number; party?: "D" | "R"; highlight?: boolean }[];
  unit?: string; // appended to values, e.g. "%"
  showValues?: "all" | "highlights";
  note?: string; // small print under the chart (source)
};

export type Scoreboard = {
  total: number; // seats in the chamber
  majority: number; // seats needed to control it
  segments: { label: string; value: number; party: "D" | "R" | "pending" }[];
  note?: string; // small print, e.g. "AP count · as of Nov 4"
};

export type Measure = {
  state: string; // "MO"
  name: string; // "Amendment 3"
  about: string; // "Would have reinstated a near-total abortion ban"
  result: "passed" | "rejected" | "counting";
  resultLabel?: string; // overrides the stamp text, e.g. "STRUCK DOWN", "REMOVED"
  detail?: string; // "55% no"
};

// Newsroom template (AI news shorts): a top bar on every scene, and one data widget per beat.
// Widgets animate in when the narration says their `cue` word.
export type NewsInfo = { tag?: string; date: string }; // tag default "AI NEWS"; date "NOV 5, 2026"
export type NewsTone = "accent" | "danger" | "up" | "neutral";
export type NewsWidget =
  | { type: "funnel"; rows: { label: string; value: number; cue?: string; tone?: NewsTone }[] }
  | { type: "counter"; items: { value: number; prefix?: string; suffix?: string; decimals?: number; label: string; cue?: string; tone?: NewsTone }[] }
  | { type: "ticker"; trend: "down" | "up"; label?: string; cue?: string; items?: { label: string; change: number; cue?: string }[] }
  | { type: "compare"; unit?: string; items: { label: string; value: number; max?: number; cue?: string; tone?: NewsTone }[] }
  | { type: "terminal"; title?: string; lines: { text: string; cue?: string; tone?: NewsTone }[] }
  | { type: "checklist"; columns: { label: string; done: number; total: number; cue?: string; tone?: NewsTone }[] };

export type Series = {
  name: string; // "Election 2026 Explained"
  part: number;
  total: number;
  source?: string; // "AP"
  asOf?: string; // "Nov 4, 2026"
};

export type Voice = { source: "tts"; engine: "kokoro" | "google"; voiceId: string; speed: number }; // google: "en-IN-Chirp3-HD-…"

export type Music = {
  track: string; // relative to the Video/ root, e.g. "library/music/calm-ocean.mp3"
  volume: number; // 0–1 when no one is speaking
  duckTo: number; // 0–1 under the voice
  startAt?: number; // seconds into the track
};

// Post text. Rules for writing it: .claude/skills/new-video/SKILL.md → "Publish text".
export type Publish = {
  title: string; // YouTube title, ≤ 100 chars — hook in the first ~40, search phrase after
  description: string; // written by hand (hook, summary, key facts, glossary, FAQ, disclaimer…); sources/credits/hashtags are appended on export
  hashtags: string[]; // "#CARTCellTherapy" — 5–8 relevant ones; YouTube ignores all of them above 15
  tags?: string[]; // YouTube Studio "Tags" field (≤ 500 chars in total) → tags.txt
  pinnedComment?: string; // a question to pin under the video → pinned-comment.txt
};

export type Project = {
  title: string;
  publish?: Publish;
  template: string;
  format?: string; // "short-9x16" (Shorts / Reels) or "long-16x9" (YouTube long-form)
  style: "photo-mix" | "illustrated";
  stylePreset?: string; // illustrated: key in library/characters/styles.json
  characters?: string[]; // illustrated: ids in library/characters/
  series?: Series;
  news?: NewsInfo; // newsroom template: the tag and story date in the top bar
  theme?: string; // per-video color preset from brand/brand.json (default: brand.active)
  captions?: Partial<CaptionStyle>; // per-video caption overrides (e.g. fontSize)
  branding?: Partial<Branding>; // per-video channel-name / source display overrides
  voice?: Voice;
  music?: Music | null;
  diagram?: { nodes: DiagramNode[] }; // explainer: the org chart "diagram" scenes build up
  review?: Review; // script review from the dashboard; not used by the renderer
  scenes: Scene[];
};

// Script review (dashboard "Script" tab). Hashes are FNV-1a of the narration, so an approval
// goes stale on its own when the narration changes after it was given.
export type SceneReview = {
  status: "approved" | "changes";
  comment?: string; // what to change (or a note on an approval)
  hash: string; // narration hash at the time of review
  at: string; // ISO time
};

export type Review = {
  scenes?: Record<string, SceneReview>;
  approvedAt?: string; // whole script approved…
  approvedBy?: string;
  scriptHash?: string; // …for this version of all narration
};

export type Word = { text: string; start: number; end: number };

export type TimelineScene = {
  id: string;
  hash?: string; // changes whenever the scene's voice is regenerated
  narration?: string; // narration the audio was generated from
  voiceKey?: string; // "<voiceId>@<speed>" or "rec:<file>" — what produced the audio
  audio: string | null; // relative to the Video/ root (served via remotion/public); null = no voice yet
  duration: number;
  hold?: number; // silent seconds added after the audio (copied from the scene)
  words: Word[];
};

export type Timeline = { scenes: TimelineScene[] };

export type BrandPreset = {
  label: string;
  colors: {
    background: string;
    surface: string;
    accent: string;
    secondary: string;
    text: string;
    textOnAccent: string;
    textOnSecondary: string;
  };
  fonts: { headline: string; body: string; hand?: string }; // hand: handwritten notes on diagrams
  pattern?: "blueprint"; // background drawn behind template scenes (default: radial glow)
};

// style "pop": big word-by-word captions (default) · "lower-third": one small calm phrase at a time
export type CaptionStyle = { wordsPerGroup: number; fontSize: number; bottomOffset: number; strokeWidth: number; style?: "pop" | "lower-third" };

// How the channel name and the source line appear on screen.
export type WatermarkStyle = "footer" | "pill" | "corner" | "intro" | "none";
export type SourceStyle = "footer" | "chip" | "none";
export type Branding = {
  watermark: WatermarkStyle;
  source: SourceStyle;
  sourceText?: string;
  // "intro" card: when it slides in — seconds into the video, or a scene id ("s3" = that scene's start).
  // Default 0 (the opening seconds). The channel default (brand.json) is mid-video, around 20 s.
  introAt?: number | string;
  introCta?: "subscribe" | "none"; // "subscribe": the card carries a Subscribe button that gets tapped
};

export type Brand = {
  channelName: string;
  handle: string;
  active: string;
  presets: Record<string, BrandPreset>;
  captions: CaptionStyle;
  branding?: Branding; // channel defaults; a project can override
};
