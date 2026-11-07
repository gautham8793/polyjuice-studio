// Builds upload-ready text for YouTube (Shorts or long-form) and Instagram Reels from a project.
// Shared by the dashboard (live preview) and the export job (writes the files).
import type { Project } from "../../remotion/src/types";

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

// Markdown links in research.md become the "Sources" list.
export const parseSources = (research: string | null) => {
  const seen = new Set<string>();
  const out: { label: string; url: string }[] = [];
  for (const m of (research ?? "").matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) {
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

  const instagramCaption = [
    publish.description.trim(),
    items.join("\n"),
    sources.length ? `Sources: ${[...new Set(sources.map((s) => s.label))].join(", ")}` : "",
    // Instagram: no links in captions anyway, and the limit is tight — keep names + licenses only
    credits.length ? `Credits: ${credits.map((c) => c.replace(/ — https?:\/\/\S+/g, "")).join(" · ")}` : "",
    seriesLine,
    hashtags.join(" "),
  ]
    .filter(Boolean)
    .join("\n\n");

  if (youtubeDescription.length > LIMITS.youtubeDescription) warnings.push("YouTube description is over 5000 characters");
  if (instagramCaption.length > LIMITS.instagramCaption) warnings.push("Instagram caption is over 2200 characters");

  return { youtubeTitle: title, youtubeDescription, instagramCaption, sources, credits, tags, pinnedComment: publish.pinnedComment?.trim() ?? "", warnings };
};
