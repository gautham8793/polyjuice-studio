"""Check a project.json against the template rules before generating voice.

Usage:
  python3 tools/validate_project.py <slug>   (a slug or a project folder)

Exits 1 on errors; warnings are printed but don't fail. Includes the post-text rules from PUBLISHING.md.
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from studio_paths import CONTENT_ROOT, project_dir as find_project  # noqa: E402

WORDS_PER_SECOND = 2.35  # Kokoro am_michael at speed 1.05, measured on the whales sample
SHORT_SECONDS = (35, 60)
MAX_ON_SCREEN_WORDS = 10
# scene kinds each template may use between its hook and outro
TEMPLATES = {"listicle": {"item"}, "analogy": {"character", "beat"}, "explainer": {"item", "scoreboard", "measure", "beat", "stats", "chart", "quiz", "comment", "diagram", "map"}, "cinematic": {"shot"}, "newsroom": {"beat", "stats", "chart", "comment", "map"}}
WIDGETS = {"funnel": "rows", "counter": "items", "ticker": None, "compare": "items", "terminal": "lines", "checklist": "columns"}
STYLES = {"photo-mix", "illustrated"}
VISUAL_TYPES = {"photo", "clip", "illustration", "graphic"}


def check_cue(scene: dict, cue: str, warnings: list[str]) -> None:
    """Cue words pop things in when the narration says them — warn when the word never comes."""
    norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
    if not any(norm(w).startswith(norm(cue)) for w in scene.get("narration", "").split()):
        warnings.append(f"{scene.get('id')}: cue '{cue}' isn't in the narration (it will fall back to a fixed time)")


def narration_hash(text: str) -> str:
    """FNV-1a (32-bit) of the text — mirrors textHash() in dashboard/src/review.ts."""
    h = 0x811C9DC5
    for b in text.encode():
        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


def check_review(project: dict, project_dir: Path, warnings: list[str]) -> None:
    """Script review lives in review.json (one review per member per scene); flag what the narration has outgrown."""
    file = project_dir / "review.json"
    if not file.exists():
        return
    review = json.loads(file.read_text(encoding="utf-8"))
    scenes = {s.get("id"): s for s in project.get("scenes", [])}
    for sid, by_member in (review.get("scenes") or {}).items():
        scene = scenes.get(sid)
        if scene is None:
            warnings.append(f"review: scene '{sid}' no longer exists")
            continue
        for member, r in by_member.items():
            if r.get("status") == "changes" and r.get("hash") == narration_hash(scene.get("narration", "").strip()):
                warnings.append(f"{sid}: {member} requested a change — {r.get('comment', '')}")
    approval = review.get("approval")
    if approval:
        current = narration_hash("\n\n".join(f"{s.get('id')}\n{s.get('narration', '').strip()}" for s in project.get("scenes", [])))
        if approval.get("scriptHash") != current:
            warnings.append("narration changed after the script was approved — the owner re-approves it in the dashboard (Script tab)")


HEALTH_WORDS = ("cancer", "disease", "therapy", "drug", "medical", "treatment", "patient", "leukemia", "vaccine")
BANNED_HASHTAGS = {"#cart", "#shorts"}


def yt_len(text: str) -> int:
    """Length the way YouTube counts it (UTF-16 units: most emojis are 2, flags 4)."""
    return len(text.encode("utf-16-le")) // 2


def check_publish(project: dict, research: str, errors: list[str], warnings: list[str]) -> None:
    """House rules for post text (PUBLISHING.md). Errors block the dashboard's Export."""
    pub = project.get("publish")
    if not pub:
        errors.append("publish: missing — write the post text by PUBLISHING.md")
        return
    title = (pub.get("title") or "").strip()
    if not title:
        errors.append("publish.title: empty")
    elif yt_len(title) > 100:
        errors.append(f"publish.title: {yt_len(title)} characters (YouTube max 100)")
    elif yt_len(title) < 60:
        warnings.append(f"publish.title: {yt_len(title)} characters — use more of the 100 (hook first, then the search phrase)")
    if re.search(r"(^|\s)#\w", title):
        errors.append("publish.title: has hashtags — put them in `hashtags` (description) instead")

    tags_ = [h.lower() for h in pub.get("hashtags", [])]
    for h in sorted(BANNED_HASHTAGS & set(tags_)):
        errors.append(f"publish.hashtags: {h} is banned (PUBLISHING.md §4)")
    if len(tags_) > 15:
        errors.append(f"publish.hashtags: {len(tags_)} — YouTube ignores all of them above 15")
    elif not 5 <= len(tags_) <= 8:
        warnings.append(f"publish.hashtags: {len(tags_)} — use 5–8 (specific → category → broad)")

    desc = (pub.get("description") or "").strip()
    if yt_len(desc) < 800:
        errors.append(f"publish.description: only {yt_len(desc)} characters — write the full description (hook, summary, 🔑 facts, 📖 glossary, ❓ FAQ…), see PUBLISHING.md §3")
    elif not 1500 <= yt_len(desc) <= 3200:
        warnings.append(f"publish.description: {yt_len(desc)} hand-written characters — aim for 1,500–3,000 (sources, credits and hashtags are added on export, total ≤ 5,000)")
    narration = " ".join(s.get("narration", "") for s in project.get("scenes", [])).lower()
    if any(w in narration for w in HEALTH_WORDS) and "not medical advice" not in desc.lower():
        warnings.append("publish.description: health topic — add the ⚠️ \"For education, not medical advice…\" line")

    tag_text = ", ".join(t.strip() for t in pub.get("tags", []) if t.strip())
    if not tag_text:
        errors.append("publish.tags: missing — add YouTube Studio tags (search phrases, ≤ 500 characters)")
    elif len(tag_text) > 500:
        errors.append(f"publish.tags: {len(tag_text)} characters (YouTube max 500)")
    elif len(tag_text) < 250:
        warnings.append(f"publish.tags: {len(tag_text)} characters — use more of the 500")
    if not (pub.get("pinnedComment") or "").strip():
        errors.append("publish.pinnedComment: missing — one question to pin under the video")

    # sources must be the page that backs the claim, not a site's home page
    for url in re.findall(r"\]\((https?://[^)\s]+)\)", research):
        path = re.sub(r"^https?://[^/]+", "", url).strip("/")
        if not path:
            warnings.append(f"research.md: {url} is a home page — link the page that actually backs the claim")


def main() -> None:
    project_dir = find_project(sys.argv[1])
    project = json.loads((project_dir / "project.json").read_text())
    errors: list[str] = []
    warnings: list[str] = []

    for key in ("title", "template", "style", "format", "language", "voice", "scenes"):
        if key not in project:
            errors.append(f"missing top-level field '{key}'")
    if project.get("template") not in TEMPLATES:
        errors.append(f"template must be one of {sorted(TEMPLATES)}")
    if project.get("style") not in STYLES:
        errors.append(f"style must be one of {sorted(STYLES)}")
    if project.get("theme"):
        brand_file = CONTENT_ROOT / "brand/brand.json"
        presets = json.loads(brand_file.read_text()).get("presets", {}) if brand_file.exists() else {}
        if project["theme"] not in presets:
            errors.append(f"theme '{project['theme']}' not found in brand/brand.json presets ({sorted(presets)})")

    scenes = project.get("scenes", [])
    ids = [s.get("id") for s in scenes]
    if len(ids) != len(set(ids)):
        errors.append("scene ids must be unique")
    kinds = [s.get("kind") for s in scenes]
    if not kinds or kinds[0] != "hook":
        errors.append("first scene must be kind 'hook'")
    if not kinds or kinds[-1] != "outro":
        errors.append("last scene must be kind 'outro'")

    allowed = TEMPLATES.get(project.get("template"), set()) | {"hook", "outro"}
    for s in scenes:
        if s.get("kind") not in allowed:
            errors.append(f"{s.get('id')}: kind '{s.get('kind')}' isn't used by the {project.get('template')} template")

    if project.get("template") == "listicle":
        items = [s for s in scenes if s.get("kind") == "item"]
        ranks = [s.get("rank") for s in items]
        if ranks != list(range(len(items), 0, -1)):
            errors.append(f"item ranks should count down {len(items)}..1, got {ranks}")

    root_dir = CONTENT_ROOT
    for s in scenes:
        for p in s.get("portraits") or []:
            if not p.get("photo"):
                continue  # initials badge — no photo, nothing to license
            if not (root_dir / p["photo"]).exists():
                errors.append(f"{s.get('id')}: portrait photo not found for {p.get('name')}")
            if not p.get("license"):
                errors.append(f"{s.get('id')}: portrait of {p.get('name')} has no license")
        if s.get("kind") == "scoreboard":
            b = s.get("scoreboard") or {}
            if not b.get("segments") or sum(x["value"] for x in b["segments"]) > b.get("total", 0):
                errors.append(f"{s.get('id')}: scoreboard needs segments that fit within 'total'")
        for ph in s.get("strip") or []:
            if ph.get("asset") and not (root_dir / ph["asset"]).exists():
                errors.append(f"{s.get('id')}: strip photo not found: {ph['asset']}")
            if ph.get("asset") and not ph.get("license"):
                errors.append(f"{s.get('id')}: strip photo {ph.get('label') or ph['asset']} has no license")
        if s.get("kind") == "quiz":
            q = s.get("quiz") or {}
            if not q.get("options") or not 0 <= q.get("answer", -1) < len(q["options"]):
                errors.append(f"{s.get('id')}: quiz needs 'options' and an 'answer' index within them")
            for o in q.get("options") or []:
                pp = o.get("portrait")
                if pp and pp.get("photo") and not pp.get("license"):
                    errors.append(f"{s.get('id')}: quiz portrait of {pp.get('name')} has no license")
        if s.get("kind") == "comment" and not (s.get("comment") or {}).get("choices"):
            errors.append(f"{s.get('id')}: comment scenes need 'comment.choices'")
        if s.get("kind") == "diagram":
            node_ids = {n["id"] for n in (project.get("diagram") or {}).get("nodes", [])}
            if not node_ids:
                errors.append(f"{s.get('id')}: diagram scenes need a project-level 'diagram' with nodes")
            d = s.get("diagram") or {}
            refs = list(d.get("reveal", [])) + list(d.get("focus", [])) + list(d.get("highlight", []))
            refs += [n["at"] for n in d.get("notes", [])] + ([d["compare"]["at"]] if d.get("compare") else [])
            for ref in refs:
                if node_ids and ref not in node_ids:
                    errors.append(f"{s.get('id')}: diagram refers to unknown node '{ref}'")
            cues = list((d.get("cues") or {}).values()) + [n.get("cue") for n in d.get("notes", [])]
            cues += [it.get("cue") for it in (d.get("compare") or {}).get("items", [])]
            for cue in filter(None, cues):
                check_cue(s, cue, warnings)
            for n in d.get("notes", []):
                if len(n.get("text", "").split()) > 5:
                    warnings.append(f"{s.get('id')}: note '{n['text']}' is long (> 5 words) for handwriting")
            for it in (d.get("compare") or {}).get("items", []):
                if it.get("value", 0) > 100:
                    warnings.append(f"{s.get('id')}: compare value {it['value']} is drawn as at most 100 icons")
        if s.get("kind") == "map":
            geo = s.get("geo") or {}
            map_dir = root_dir / "library" / "maps" / str(geo.get("map"))
            if not (map_dir / "map.json").exists():
                errors.append(f"{s.get('id')}: map '{geo.get('map')}' not found in library/maps")
            else:
                meta = json.loads((map_dir / "map.json").read_text())
                states = json.loads((map_dir / meta["layers"]["states"]).read_text())
                state_ids = {f["properties"]["id"] for f in states["features"]}
                focus = geo.get("focus") or []
                named = [f for f in focus if isinstance(f, str)] + [h.get("state") for h in geo.get("highlight", [])]
                for sid in named:
                    if sid not in state_ids:
                        errors.append(f"{s.get('id')}: unknown state '{sid}' (see {map_dir.relative_to(root_dir)}/{meta['layers']['states']})")
            cues = [h.get("cue") for h in geo.get("highlight", [])] + [p.get("cue") for p in geo.get("pins", [])]
            cues += [(geo.get("photo") or {}).get("cue")]
            for cue in filter(None, cues):
                check_cue(s, cue, warnings)
            if geo.get("photo") and not s.get("visual", {}).get("asset"):
                warnings.append(f"{s.get('id')}: map 'photo' fades into visual.asset, but there is none")
        if s.get("hemicycle"):
            h = s["hemicycle"]
            if not 0 < h.get("highlight", 0) <= h.get("total", 0):
                errors.append(f"{s.get('id')}: hemicycle needs 0 < highlight <= total")
            if h.get("cue"):
                check_cue(s, h["cue"], warnings)
        if project.get("template") == "cinematic":
            shot = s.get("shot")
            if not shot or not shot.get("layers"):
                errors.append(f"{s.get('id')}: cinematic scenes need a 'shot' with layers")
            shot = shot or {}
            srcs = [l.get("src") for l in shot.get("layers", [])] + [st for l in shot.get("layers", []) for st in l.get("stages", [])]
            srcs += [f.get("src") for f in shot.get("fx", []) if f.get("type") == "drift"]
            for src in filter(None, srcs):
                base = root_dir if src.startswith("library/") else project_dir
                if not (base / src).exists():
                    errors.append(f"{s.get('id')}: shot image not found: {src}")
            layer_ids = {l.get("id") for l in shot.get("layers", []) if l.get("id")}
            for lab in shot.get("labels", []):
                if lab.get("follow") and lab["follow"] not in layer_ids:
                    errors.append(f"{s.get('id')}: label '{lab.get('text')}' follows unknown layer '{lab['follow']}'")
                if len(lab.get("text", "").split()) > 3:
                    warnings.append(f"{s.get('id')}: label '{lab['text']}' is long (> 3 words)")
            cues = [x.get("cue") for x in shot.get("labels", []) + shot.get("fx", []) + shot.get("layers", [])]
            cues += [(l.get(k) or {}).get("cue") for l in shot.get("layers", []) for k in ("move", "enter", "glow")]
            for cue in filter(None, cues):
                check_cue(s, cue, warnings)
        if project.get("template") == "newsroom":
            if s.get("kind") == "beat" and not s.get("widget"):
                warnings.append(f"{s.get('id')}: newsroom beats look empty without a 'widget'")
            if s.get("kind") in ("hook", "beat") and not s.get("source"):
                warnings.append(f"{s.get('id')}: add 'source' (the outlet shown under the photo)")
            w = s.get("widget")
            if w:
                key = WIDGETS.get(w.get("type"), "?")
                if key == "?":
                    errors.append(f"{s.get('id')}: widget.type must be one of {sorted(WIDGETS)}")
                elif key and not w.get(key):
                    errors.append(f"{s.get('id')}: {w['type']} widget needs '{key}'")
                parts = [w] + [x for k in ("rows", "items", "lines", "columns") for x in w.get(k) or []]
                for cue in filter(None, (x.get("cue") for x in parts)):
                    check_cue(s, cue, warnings)
                if w.get("type") == "checklist" and any(c.get("total", 0) > 25 for c in w.get("columns", [])):
                    warnings.append(f"{s.get('id')}: checklist columns fit up to 25 boxes")
        if s.get("kind") == "measure" and not s.get("measures"):
            errors.append(f"{s.get('id')}: measure scenes need a 'measures' list")
        if s.get("kind") == "item" and project.get("template") == "explainer" and not s.get("tag"):
            warnings.append(f"{s.get('id')}: explainer items look best with a 'tag' (e.g. FLIP)")

    if project.get("template") == "analogy":
        root = CONTENT_ROOT
        chars_dir = root / "library/characters"
        cast = project.get("characters", [])
        if project.get("style") != "illustrated":
            warnings.append("analogy videos are designed for style 'illustrated'")
        styles = json.loads((chars_dir / "styles.json").read_text()) if (chars_dir / "styles.json").exists() else {}
        if project.get("style") == "illustrated" and project.get("stylePreset") not in styles:
            errors.append(f"stylePreset must be one of {sorted(styles)}")
        for cid in cast:
            cfile = chars_dir / cid / "character.json"
            if not cfile.exists():
                errors.append(f"character '{cid}' not found in library/characters/")
            elif not json.loads(cfile.read_text()).get("sheet"):
                warnings.append(f"character '{cid}' has no reference sheet yet")
        for s in scenes:
            if s.get("kind") == "character" and not (s.get("name") and s.get("realName")):
                errors.append(f"{s.get('id')}: character scenes need 'name' (role) and 'realName'")
            if s.get("character") and s["character"] not in cast:
                errors.append(f"{s.get('id')}: character '{s['character']}' isn't in the project's characters list")

    total_words = 0
    for s in scenes:
        sid = s.get("id", "?")
        narration = s.get("narration", "")
        total_words += len(narration.split())
        on_screen = s.get("onScreenText", "")
        if not narration and s.get("kind") != "outro":  # a silent outro card is fine (prepare.py holds it on screen)
            errors.append(f"{sid}: empty narration")
        if on_screen.count("*") % 2:
            errors.append(f"{sid}: unbalanced *emphasis* markers in onScreenText")
        if len(re.findall(r"\w+", on_screen.replace("'", ""))) > MAX_ON_SCREEN_WORDS:
            warnings.append(f"{sid}: onScreenText is long (> {MAX_ON_SCREEN_WORDS} words)")
        if re.search(r"\d", narration) and not s.get("ttsText"):
            warnings.append(f"{sid}: narration has digits — spell numbers out for the voice")
        if s.get("kind") == "item" and not s.get("name"):
            errors.append(f"{sid}: item scene needs a 'name'")
        visual = s.get("visual") or {}
        if visual.get("type") not in VISUAL_TYPES:
            errors.append(f"{sid}: visual.type must be one of {sorted(VISUAL_TYPES)}")
        if visual.get("type") in ("photo", "illustration") and not (visual.get("asset") or visual.get("aiPrompt")):
            warnings.append(f"{sid}: no asset and no aiPrompt")
        if project.get("style") == "photo-mix" and visual.get("type") == "photo" and not visual.get("searchTerms") and not visual.get("asset"):
            warnings.append(f"{sid}: add visual.searchTerms for stock-photo search")
        asset_root = CONTENT_ROOT if str(visual.get("asset", "")).startswith("library/") else project_dir
        if visual.get("asset") and not (asset_root / visual["asset"]).exists():
            errors.append(f"{sid}: asset file not found: {visual['asset']}")
        if visual.get("asset") and not visual.get("license"):
            warnings.append(f"{sid}: asset has no license recorded")

    est = total_words / WORDS_PER_SECOND
    lo, hi = SHORT_SECONDS
    if project.get("format") == "short-9x16" and not lo <= est <= hi:
        warnings.append(f"estimated length {est:.0f}s is outside {lo}–{hi}s ({total_words} words)")

    if not (project_dir / "research.md").exists():
        warnings.append("research.md is missing")
    check_publish(project, (project_dir / "research.md").read_text() if (project_dir / "research.md").exists() else "", errors, warnings)

    for s in scenes:
        if s.get("recording") and not (project_dir / s["recording"]).exists():
            errors.append(f"{s.get('id')}: recording file not found: {s['recording']}")

    music = project.get("music")
    if music:
        root = CONTENT_ROOT
        if not (root / music.get("track", "")).exists():
            errors.append(f"music track not found: {music.get('track')}")
        if not 0 <= music.get("duckTo", 0) <= music.get("volume", 0) <= 1:
            errors.append("music needs 0 ≤ duckTo ≤ volume ≤ 1")
        tags_path = root / "library/music/tags.json"
        tags = json.loads(tags_path.read_text())["tracks"] if tags_path.exists() else []
        tag = next((t for t in tags if f"library/music/{t['file']}" == music.get("track")), None)
        if tag is None:
            warnings.append("music track has no tags — set its attribution in the dashboard (Sound → Tags)")
        elif tag.get("attribution"):
            warnings.append(f"music needs credit in the description: {tag['attribution']}")

    check_review(project, project_dir, warnings)

    for w in warnings:
        print(f"warning: {w}")
    for e in errors:
        print(f"ERROR: {e}")
    print(f"{len(scenes)} scenes, {total_words} words, ~{est:.0f}s — {'FAILED' if errors else 'OK'}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
