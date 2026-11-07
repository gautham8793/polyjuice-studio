# Open questions and proposed decisions

> Last updated: 7 Nov 2026 (evening) · Move an item to the Tracker (§8) once it's **Agreed**.

| # | Question | Proposal | Status |
|---|---|---|---|
| Q1 | Will the two friends make videos for their own channels, or work with Gautham on The Polyjuice Project? | One shared channel; three members; async sync now, live hub and fully cloud later (DEC-14) | **Agreed — 7 Nov 2026** |
| Q2 | Do the friends have Claude Code (or another coding agent) to write scripts? | Yes, all three have Claude Code. Also wanted: a "Paste script" option in the dashboard, and possibly a Polyjuice Studio MCP so a script written in ChatGPT, Claude or Gemini can be sent to the studio with one command (see Q9) | **Agreed — 7 Nov 2026** (paste option wanted) |
| Q3 | Whose API keys do the members use (Pexels, R2, YouTube, Instagram)? | Each machine has its own `secrets/`; R2 key scoped to the one bucket; YouTube/Instagram tokens only on publisher machines. Google TTS is Q7 | Proposed — 7 Nov 2026 |
| Q4 | Does each person get their own brand? | No: one shared channel brand in the content repo (`workspace/brand/brand.json`) | **Agreed — 7 Nov 2026** |
| Q5 | Who may Render & Publish? | Gautham only for now (publisher role); others get permission later through `members.json` | **Agreed — 7 Nov 2026** |
| Q6 | Whose approval makes a script "approved"? | The video's owner alone approves the script. Gautham approves the finished video before publishing (the publish step) | **Agreed — 7 Nov 2026** |
| Q7 | Google voices: one shared channel key, or each member's own key? | One shared channel key (consistent voice, one bill), limited to Text-to-Speech; Kokoro stays the free default | **Agreed — 7 Nov 2026** |
| Q8 | Where do media files sync: Cloudflare R2 or Google Drive? | Cloudflare R2 for the studio's media sync, behind a storage interface (Google Drive via API stays possible later); optionally a shared Drive folder as an archive of finished videos. Comparison in the design doc §15 | **Agreed — 7 Nov 2026** |
| Q9 | How do scripts written in ChatGPT, Claude or Gemini reach the studio? | (a) "Paste script" in the dashboard, with a simple Markdown format, for any app. (b) A local Polyjuice Studio MCP server inside the dashboard, connected like my_first_tube: `send_script`, `get_rules`, `list_projects`, `get_script`, `get_review_comments`, `validate`; no export/publish tools. See design doc §14. Build (a) first, then (b) | **Agreed — 7 Nov 2026** |
