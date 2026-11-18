// Builds upload-ready text for YouTube (Shorts or long-form) and Instagram Reels from a project.
// Shared by the dashboard (live preview) and the export job (writes the files).
import type { Project } from "../../remotion/src/types";

// Long-form (16:9) videos are for YouTube only; Instagram gets the 9:16 Shorts/Reels.
export const allowsInstagram = (project: { format?: string }) => !(project.format ?? "short-9x16").startsWith("long");

export const LIMITS = { youtubeTitle: 100, youtubeDescription: 5000, instagramCaption: 2200, hashtags: 15, tags: 500 };

// artist "Own …" = music you made (e.g. tools/ambient_score.py) — nothing to credit
export type MusicCredit = { title: string; attribution: string | null; artist?: string } | null;

export type PublishText = {
  youtubeTitle: string;
  youtubeDescription: string;
  instagramCaption: string;
  sources: { label: string; url: string }[];
  credits: string[];
  tags: string; // comma-separated, for YouTube Studio's Tags field
  pinnedComment: string;
  warnings: string[];
};

const plain = (s: string) => s.replace(/\*/g, "").replace(/\s+/g, " ").trim();

// Markdown links in research.md become the "Sources" list. A long research file can hold far more
// links than a 5,000-character description fits: then a "## Key sources" section picks the ones
// that go in the description (the full research stays in research.md).
export const parseSources = (research: string | null) => {
  const seen = new Set<string>();
  const out: { label: string; url: string }[] = [];
  const key = (research ?? "").match(/^## Key sources[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  for (const m of (key ? key[1] : research ?? "").matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
    if (seen.has(m[2])) continue;
    seen.add(m[2]);
    out.push({ label: plain(m[1]), url: m[2] });
  }
  return out;
};

// Data behind the satellite maps (mirrors `credits` in library/maps/<id>/map.json)
const MAP_CREDITS: Record<string, string[]> = {
  india: [
    "Satellite imagery: NASA Blue Marble Next Generation, via NASA GIBS — Public domain",
    "India state boundaries: DataMeet (github.com/datameet/maps) — CC BY 4.0",
    "Country borders: Natural Earth — Public domain",
  ],
};

const normalizeTag = (t: string) => `#${t.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`;

export const buildPublish = (project: Project, research: string | null, music: MusicCredit): PublishText => {
  const warnings: string[] = [];
  const publish = project.publish ?? { title: project.title, description: "", hashtags: [] };
  if (!project.publish) warnings.push("No publish block yet — using the video title. Fill in the Publish tab.");

  const title = publish.title.trim() || project.title;
  const hashtags = [...new Set(publish.hashtags.map(normalizeTag).filter((t) => t.length > 1))];
  const sources = parseSources(research);

  const items = project.scenes.flatMap((s) => {
    if (s.kind === "item") return [`${s.rank != null ? `#${s.rank}` : "•"} ${s.name} — ${plain(s.onScreenText)}`];
    if (s.kind === "measure")
      return (s.measures ?? []).map(
        (m) => `• ${m.state} ${m.name}: ${m.about} — ${m.result === "counting" ? "still counting" : m.result}${m.detail ? ` (${m.detail.toLowerCase()})` : ""}`,
      );
    if (s.kind === "character") return [`• ${s.name}${s.realName ? ` (${s.realName})` : ""} — ${plain(s.onScreenText)}`];
    return [];
  });

  const credits: string[] = [];
  const credited = new Set<string>();
  for (const s of project.scenes) {
    const v = s.visual;
    if (!v.asset) {
      const drawn = v.type === "graphic" || ["outro", "scoreboard", "measure", "stats", "chart", "quiz", "comment", "diagram", "map"].includes(s.kind); // template draws it
      if (!drawn) warnings.push(`${s.name ?? "Opening (hook)"}: no image yet`);
      continue;
    }
    const label0 = s.name ?? "Opening (hook)";
    // "Own" = your own photo / AI image — nothing to credit.
    if (/^own\b/i.test(v.license ?? "") && v.license !== "Own / unspecified") continue;
    if (!v.license || v.license === "Own / unspecified") {
      warnings.push(`${label0}: uploaded image has no license — open “image details” and enter its license and credit, or “Own” if you made it`);
      continue;
    }
    const label = s.kind === "hook" ? "Opening image" : (s.name ?? "Background image");
    if (credited.has(v.asset)) continue; // same photo in several scenes (e.g. quiz ask + reveal)
    credited.add(v.asset);
    const parts = [v.credit, v.license, v.source && v.source !== "upload" ? v.source : null].filter(Boolean);
    credits.push(`${label}: ${parts.join(" — ")}`);
  }
  // Photo strips (labelled photos under stats / charts)
  for (const s of project.scenes)
    for (const p of s.strip ?? []) {
      if (!p.asset || credited.has(p.asset)) continue;
      credited.add(p.asset);
      if (!p.license) warnings.push(`${s.name ?? s.id}: strip photo ${p.label ?? p.asset} has no license`);
      else credits.push(`${p.label ?? s.name ?? "Photo"}: ${[p.credit, p.license, p.source].filter(Boolean).join(" — ")}`);
    }
  // Portrait photos (one credit per person, even if they appear in several scenes)
  const pictured = new Map<string, string>();
  for (const s of project.scenes)
    for (const p of [...(s.portraits ?? []), ...(s.quiz?.options ?? []).flatMap((o) => (o.portrait ? [o.portrait] : []))])
      if (p.photo && !pictured.has(p.name)) pictured.set(p.name, [p.credit, p.license, p.source].filter(Boolean).join(" — ")); // initials badges have no photo to credit
  for (const [name, credit] of pictured) credits.push(`Photo of ${name}: ${credit}`);
  for (const id of new Set(project.scenes.flatMap((s) => (s.kind === "map" && s.geo ? [s.geo.map] : []))))
    credits.push(...(MAP_CREDITS[id] ?? [`Map data: library/maps/${id} — check map.json for credits`]));
  // Documentary template: photos and logos placed by scene.doc, plus its atlas maps
  for (const s of project.scenes) {
    const d = s.doc;
    if (!d) continue;
    for (const p of [...(d.photos ?? []), ...(d.photo ? [d.photo] : [])])
      if (p.credit && !credited.has(p.src)) {
        credited.add(p.src);
        credits.push(`Photo: ${p.credit}`);
      }
    const logos = [...(d.logos ?? []), ...(d.nodes ?? []).flatMap((n) => (n.logo ? [n.logo] : [])), ...(d.versus ? [d.versus.left.logo, d.versus.right.logo].filter((l): l is NonNullable<typeof l> => !!l) : [])];
    for (const l of logos)
      if (l.credit && l.src && !credited.has(l.src)) {
        credited.add(l.src);
        credits.push(`${l.name} logo: ${l.credit}`);
      }
  }
  if (project.scenes.some((s) => s.doc?.map || s.doc?.layout === "map" || s.doc?.layout === "date"))
    credits.push("Maps: Natural Earth (public domain); India outline: DataMeet (github.com/datameet/maps), CC BY 4.0");
  if (music?.attribution) credits.push(`Music: ${music.attribution}`);
  else if (music && !/^own\b/i.test(music.artist ?? "")) credits.push(`Music: "${music.title}" — YouTube Audio Library`);

  if (title.length > LIMITS.youtubeTitle) warnings.push(`Title is ${title.length} characters (YouTube max ${LIMITS.youtubeTitle})`);
  if (hashtags.length > LIMITS.hashtags) warnings.push(`${hashtags.length} hashtags — YouTube ignores all of them above ${LIMITS.hashtags}`);
  const tags = (publish.tags ?? []).map((t) => t.trim()).filter(Boolean).join(", ");
  if (tags.length > LIMITS.tags) warnings.push(`Tags are ${tags.length} characters (YouTube max ${LIMITS.tags})`);
  if (!sources.length) warnings.push("No sources found in research.md");

  const section = (heading: string, lines: string[]) => (lines.length ? `${heading}\n${lines.join("\n")}` : "");

  // News series: say which part this is and how fresh the numbers are.
  const series = project.series;
  const seriesLine = series
    ? `Part ${series.part} of ${series.total} · ${series.name}.` +
      (series.asOf ? ` Results as of ${series.asOf}${series.source ? ` (${series.source})` : ""}; counting continues in some races.` : "")
    : "";

  const youtubeDescription = [
    publish.description.trim(),
    items.join("\n"),
    section("Sources:", sources.map((s) => `• ${s.label}: ${s.url}`)),
    section("Credits:", credits.map((c) => `• ${c}`)),
    seriesLine,
    // all of them (5–8 is the house rule); no #Shorts — YouTube detects Shorts from the format
    hashtags.slice(0, LIMITS.hashtags).join(" "),
  ]
    .filter(Boolean)
    .join("\n\n");

  // Instagram: no links in captions, and a hard 2,200 limit. Sources become outlet names (no dates),
  // credits keep names + licences, and when it's still too long the caption sheds its least needed
  // parts in turn: the FAQ, then the glossary, then the end of the description.
  const outlet = (label: string) => label.replace(/,\s*((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{0,2},?\s*(\d{4})?|\d{4})$/, "").trim();
  const instagramTail = [
    sources.length ? `Sources: ${[...new Set(sources.map((s) => outlet(s.label)))].join(", ")}` : "",
    credits.length ? `Credits: ${credits.map((c) => c.replace(/ — https?:\/\/\S+/g, "")).join(" · ")}` : "",
    seriesLine,
    hashtags.join(" "),
  ];
  const igDescription = publish.description.trim().replace(/\blinked below\b/g, "sourced below");
  const dropBlock = (text: string, heading: RegExp) => text.replace(new RegExp(`(^|\\n\\n)${heading.source}[^\\n]*(\\n(?!\\n)[^\\n]*)*`, "u"), "");
  const assemble = (description: string) => [description, items.join("\n"), ...instagramTail].filter(Boolean).join("\n\n");
  let igText = igDescription;
  for (const heading of [/❓\s*FAQ/, /📖[^\n]*[Gg]lossary/]) {
    if (assemble(igText).length <= LIMITS.instagramCaption) break;
    igText = dropBlock(igText, heading);
  }
  const over = assemble(igText).length - LIMITS.instagramCaption;
  if (over > 0) igText = igText.slice(0, Math.max(0, igText.length - over - 1)).trimEnd() + "…";
  const instagramCaption = assemble(igText);

  if (youtubeDescription.length > LIMITS.youtubeDescription) warnings.push("YouTube description is over 5000 characters");
  if (allowsInstagram(project) && instagramCaption.length > LIMITS.instagramCaption) warnings.push("Instagram caption is over 2200 characters");

  return { youtubeTitle: title, youtubeDescription, instagramCaption, sources, credits, tags, pinnedComment: publish.pinnedComment?.trim() ?? "", warnings };
};
