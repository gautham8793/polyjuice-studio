# Joining The Polyjuice Project studio

Everyone works on their own computer and shares work with **Sync**. You need about 3 GB of free
space and an hour the first time (most of it is downloads).

## For the person joining

**Before you start, Gautham sends you (privately, not in a group chat):**
- your **member id** (e.g. `priya`)
- an invite to the GitHub repo **polyjuice-channel** (accept it from the email or github.com)
- two small key files: `r2.json` (media storage) and `google-tts.json` (the channel voice)

### Windows 10 / 11
1. Open **PowerShell** and install Git and the GitHub app:
   `winget install --id Git.Git -e` and `winget install --id GitHub.cli -e`, then close PowerShell.
2. Open a new PowerShell and sign in to GitHub: `gh auth login` (choose GitHub.com → HTTPS → browser).
3. Download the studio into your Documents folder:
   `cd $HOME\Documents` then `gh repo clone gautham8793/polyjuice-studio "Polyjuice Studio"`
4. Run the setup (installs Node.js, Python, FFmpeg, the voice and captions engines; takes a while):
   `cd "Polyjuice Studio"` then
   `powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Member <your-member-id>`
5. Put the two key files Gautham sent into the `secrets` folder inside "Polyjuice Studio".
6. Double-click **Polyjuice Studio** on your Desktop. The dashboard opens in your browser.
7. Press **Sync** (bottom left). The first sync downloads the videos' images and audio (about 450 MB).

### macOS
Steps 1–3 the same with Homebrew (`brew install git gh`), then `./setup.sh <your-member-id>`, add the
two key files to `secrets/`, start with `npm run dashboard` and press **Sync**.

### Every day
- **Sync** when you start and when you finish. Changes from the others arrive only when you sync.
- To change a video, click **Edit (check out)** first; when you're done, **Done editing** and Sync.
  While someone else edits a video, you can still read and review its script.
- New videos: ask Claude Code `/new-video <topic>`, or paste a script (coming soon).
- Only the publisher (Gautham) exports and publishes.
- Studio update available? In the studio folder: `git pull`, then run setup again.

### If something goes wrong
- *"isn't a member yet"*: Gautham adds you in **Team & activity**, presses **Sync**; you run setup again.
- *GitHub sign-in fails / repository not found*: accept the invite to `polyjuice-channel` first.
- *Sync says "no blob store"*: `secrets/r2.json` is missing or still has placeholders.
- *Voice fails*: `secrets/google-tts.json` is missing (Kokoro voices still work without it).

## For Gautham: adding someone
1. **Team & activity → Members**: add their name (roles: editor + reviewer), **Save members**, **Sync**.
2. **GitHub**: invite their GitHub username as a collaborator on **polyjuice-channel** (content).
   Also on **polyjuice-studio** (code) so they can install and update.
3. **R2 key**: in Cloudflare R2 → Manage API tokens, create a token **for them** (Object Read & Write,
   bucket `polujuice-media`), put its Access Key ID / Secret in a copy of `secrets/r2.json`, and send
   that file privately. A token per person can be revoked on its own.
4. **Google voice**: send `secrets/google-tts.json` privately (the shared channel voice, Q7).
5. Send them their member id and this page.

To remove someone: delete their R2 token, remove them as collaborator on both repos, and remove
them in Team & activity (their past reviews and activity stay in the history).
