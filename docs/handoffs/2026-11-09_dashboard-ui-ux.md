# Handoff: dashboard UI / UX work

> Written 9 Nov 2026 by Claude Code for the next agent (Codex) and the owner, Gautham.
> Read `AGENTS.md` first, then this. Decisions: `Tracker/PROJECT_TRACKER_v1.0.md` §8 (DEC-10, DEC-11,
> DEC-14, DEC-15), `docs/decisions/2026-11-07_team-async-sync-design.md`. Shared memory: project
> "Polyjuice Video Studio" in my_first_tube (`find_decisions`, `read_state_brief`).

## 1. What the dashboard is

The local web app where the owner (and soon two teammates) review, edit, voice, preview, export and
publish videos for The Polyjuice Project. React 19 + Vite 8, no UI library, one stylesheet. A small
file API runs inside the Vite dev server; everything is files, there is no database.

- **Run:** `npm run dashboard` from the repo root → http://localhost:3200 (or Claude/Codex launch
  config "dashboard" in `.claude/launch.json`; it moves to 3201 if 3200 is busy).
- **Checks:** `cd dashboard && npx tsc --noEmit -p .` and `cd remotion && npx tsc --noEmit`.
  Both must be clean before you commit.
- **Content** (projects, library, brand, team files) lives in `workspace/` (its own Git repo,
  synced with the team). On the owner's Mac `projects`, `library`, `brand` at the repo root are links
  into it. The code repo (`gautham8793/polyjuice-studio`, private) never contains content.

## 2. Map of the UI

| Area | File | What it does |
| --- | --- | --- |
| Shell, state, tabs | `dashboard/src/App.tsx` | Loads project / me / members / sync status; Scenes · Script · Publish tabs; top bar (title, chips, owner picker, check-out, Check / Generate voice / Export); autosave |
| Sidebar | `Sidebar.tsx`, `SyncButton.tsx` | Views (All / Unfiled / Needs review / Uploaded), folders (create, rename, drag, Move to…), project rows with status + owner; Sync button with progress |
| Team | `TeamPanel.tsx` | Who-are-you picker, members and roles, sync set-up / join, media store test, activity feed |
| Scenes tab | `SceneCard.tsx`, `ThemePanel.tsx`, `ChannelPanel.tsx`, `Connections.tsx`, `SoundPanel.tsx`, `CharactersPanel.tsx`, `SearchModal.tsx` | Per-scene editing, images (search / upload / AI prompt), theme, captions + channel name, Instagram + YouTube connections, voice + music, characters |
| Script tab | `ScriptPanel.tsx`, `review.ts` | Reading view, per-member scene reviews, owner-only "Approve script" |
| Publish tab | `PublishCard.tsx` (top), `PublishPanel.tsx` | Checklist + one confirmed Publish to YouTube (Private) / Instagram; below it the post text editors and export package |
| Preview | `Preview.tsx` | Remotion Player of the real templates (`remotion/src/templates/SceneVideo.tsx`) |
| Client API | `api.ts` | Every call to the server; types |
| Styles | `styles.css` | All CSS; tokens on `:root` (`--bg --panel --panel-2 --border --text --muted --accent --pink --warn --ok --error --radius`) |
| Server | `dashboard/server/*.ts` | `api.ts` (routes), `team.ts`, `sync.ts`, `blobs.ts`, `youtube.ts`, `instagram.ts`, `paths.ts`, `secrets.ts` |

## 3. Behaviour that UI changes must keep

1. **Saves are version-checked.** `project.json` saves send `If-Match` (file mtime); a 409 reloads
   the project instead of overwriting edits made elsewhere (Claude Code, Codex, another tab).
   Window focus reloads the project, team and review files.
2. **Check-out (team mode).** With a shared content repo and 2+ members, editing a video needs
   **Edit (check out)**. `canEdit` in `App.tsx` drives a `<fieldset className="edit-scope" disabled>`
   around the Scenes and Publish editors, and the server answers 423 without the lock. The **Script
   tab and the Publish card stay outside** that fieldset on purpose: anyone can review; publishing
   needs the publisher role, not the lock. Today there is one member, so you won't see read-only
   mode unless you add a member.
3. **One concern per file.** Reviews go through `/api/projects/:slug/review|approve` (`review.json`),
   owner / uploads through `/team` (`team.json`), folders through `/api/workspace`. Don't fold them
   back into `project.json`; sync merges them by key.
4. **Status is derived** (`stageOf` in `Sidebar.tsx`): Draft → Script approved → Voiced → Exported →
   Uploaded; only "uploaded" is stored (team.json `published`).
5. **Owner rules** (REQ-06, owner memory): agents never press **Export**, **Publish**, **Post now** or
   anything inside a publish confirm box, even while testing UI. Check those screens with screenshots
   / DOM reads; close a confirm box by reloading.
6. **Secrets never reach the browser** (`secrets/*.json` are read only by the server).

## 4. Traps found this week

- **Global element styles** in `styles.css` (~line 96–170): `label` is a flex *column*, `input`,
  `textarea` and `label select` are `width: 100%`. Inline checkboxes, row labels and selects in chips
  break unless you override (`flex-direction: row`, `width: auto; flex: none`). Scope new styles with
  a class rather than changing the globals blindly: many panels rely on them.
- The top bar's meta row wraps onto two lines when many chips show (owner picker, check-out, status,
  "needs voice"), which pushes the tabs down; anything positioned by coordinates moves.
- Vite restarts the server when anything imported by `vite.config.ts` changes (all of
  `dashboard/server`), so a running dashboard picks up server edits; the browser may need a reload.
- `npm run dashboard -- <flags>` does **not** pass flags to Vite (two npm layers); set `PORT` instead.

## 5. Earlier work, now committed

The previous sessions' pending work was committed on 9 Nov (`a0ad761`…`5073d30`): the Publish tab's
collapsible **Accordion** sections (`PublishPanel.tsx` + `.accordion*` styles), preview audio tags,
cinematic background-layer uploads, template fixes, the voice-key fix, agent docs and the tracker.
The working tree was clean except a stray duplicate image, `web-black.png`, at the repo root (not
code; don't commit it).

If more uncommitted work from other sessions appears, don't revert or reformat it. Ask the owner;
if you must commit around it, stage only your own hunks and typecheck the exact staged tree
(`git checkout-index -a --prefix=<tmp>/`, link `node_modules`, run `tsc`).

## 6. Open UX gaps (ideas, not agreed)

- No "Paste script" yet (agreed in Q9: paste first, then a Polyjuice Studio MCP).
- Top bar is crowded; chips + buttons wrap.
- Dark theme only; no light mode.
- Publish tab is long: Publish card + accordions + export package.
- Sidebar rows are dense once owner chips appear (2+ members).
- The Script tab hides the preview; some reviewers may want both.
Agree any change with the owner first (they like to settle the approach before building), and
record agreed decisions in the tracker §8.

## 7. Parked (owner's call, 9 Nov 2026)

Adding the two friends (members, GitHub collaborators, per-person R2 tokens, first Windows run of
`setup.ps1`) is **parked**. Everything for it is ready: `docs/JOINING.md`, `setup.ps1`, `setup.sh`.
