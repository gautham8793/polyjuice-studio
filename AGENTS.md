# Instructions for AI agents working in this repo

This folder is a video pipeline for the YouTube channel "The Polyjuice Project". Read
`PLAN.md` for how it fits together, and the highest-numbered `Tracker/PROJECT_TRACKER_v*.md`
for what has been agreed, what exists and what's next. Record new agreed decisions there (§8)
and open questions in `Tracker/open-questions.md`.

**Before you create or edit a video project (`projects/<slug>/`):**
1. Follow `.claude/skills/new-video/SKILL.md` for research, script, scenes and visuals, and `.claude/skills/video-hook-writer/SKILL.md` for writing or auditing Scene 1 hooks (the 3-step Curiosity Loop: Context Lean → Scroll-Stop Interjection → Contrarian Snapback). Both apply to every agent, not only Claude.
2. **Script first, then stop.** For a new video, write only `research.md` and the script in
   `project.json` (narration, on-screen text, image prompts with `asset: null`), validate it, and
   stop. Don't make images, voice, music or renders until the owner has approved the script in
   the dashboard's Script tab (recorded in `projects/<slug>/review.json`). If the narration changes
   after approval, the changed scenes need approval again before you re-voice or render them.
3. Write the post text (`publish` in `project.json`) by the rules in **`PUBLISHING.md`**:
   titles up to 100 characters with the hook first, 1,500–3,000-character descriptions of real,
   sourced content, 5–8 hashtags (never `#cart` or `#Shorts`), plus `tags` and `pinnedComment`.
4. Every claim in the narration and the post text needs a source in `research.md`, linking to
   the page that actually says it.
5. Run `python3 tools/validate_project.py projects/<slug>` and fix every `ERROR`. The
   dashboard's Export refuses to run until it passes.
6. Never run Export or upload anything without the channel owner's review.

**Long-form (16:9, ~8 min):** follow `docs/playbooks/long-form-cinematic.md`, how "CAR-T: The
Living Drug" was made. If a project folder has a `HANDOFF.md`, read it before changing anything.

**Handoffs:** before changing an area, read the newest note in `docs/handoffs/` for it (e.g.
`docs/handoffs/2026-11-09_dashboard-ui-ux.md` for the dashboard UI).
