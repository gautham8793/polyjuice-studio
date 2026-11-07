# Instructions for AI agents working in this repo

This folder is a video pipeline for the YouTube channel "The Polyjuice Project". Read
`PLAN.md` for how it fits together, and the highest-numbered `Tracker/PROJECT_TRACKER_v*.md`
for what has been agreed, what exists and what's next. Record new agreed decisions there (§8)
and open questions in `Tracker/open-questions.md`.

**Before you create or edit a video project (`projects/<slug>/`):**
1. Follow `.claude/skills/new-video/SKILL.md` for research, script, scenes and visuals. It
   applies to every agent, not only Claude.
2. Write the post text (`publish` in `project.json`) by the rules in **`PUBLISHING.md`**:
   titles up to 100 characters with the hook first, 1,500–3,000-character descriptions of real,
   sourced content, 5–8 hashtags (never `#cart` or `#Shorts`), plus `tags` and `pinnedComment`.
3. Every claim in the narration and the post text needs a source in `research.md`, linking to
   the page that actually says it.
4. Run `python3 tools/validate_project.py projects/<slug>` and fix every `ERROR`. The
   dashboard's Export refuses to run until it passes.
5. Never run Export or upload anything without the channel owner's review.
