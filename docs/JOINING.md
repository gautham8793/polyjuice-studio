# Joining The Polyjuice Project studio

Everyone works on their own computer and shares work with **Sync**. You need about 3 GB of free
space and an hour the first time (most of it is downloads).

## For the person joining

**Before you start, Gautham sends you (privately, not in a group chat):**
- your **member id** (e.g. `priya`)
- an invite to the GitHub repo **polyjuice-channel** (accept it from the email or github.com)
- two small key files: `r2.json` (media storage) and `google-tts.json` (the channel voice)

### Windows 10 / 11
1. Accept both GitHub invites (`polyjuice-channel` and `polyjuice-studio`) from the email or
   github.com/notifications.
2. Open **PowerShell** (Start → type "PowerShell"). Install Git and the GitHub app:
   `winget install --id Git.Git -e` and `winget install --id GitHub.cli -e`
   (if `winget` isn't found, install **App Installer** from the Microsoft Store first).
   Then **close PowerShell and open a new one**.
3. Sign in to GitHub once, through the browser: `gh auth login` (choose **GitHub.com**, **HTTPS**,
   **Yes** to authenticate Git, **Login with a web browser**; copy the code it shows), then
   `gh auth setup-git`. Git never asks for a password after this (GitHub doesn't accept passwords).
4. Download the studio into a folder **without spaces** in its name:
   `cd $HOME\Documents` then `git clone https://github.com/gautham8793/polyjuice-studio.git PolyjuiceStudio`.
5. Run the setup (installs Node.js, Python, FFmpeg, the voice and captions engines; 20–40 minutes):
   `cd PolyjuiceStudio` then
   `powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Member <your-member-id>`
6. Put the two key files Gautham sent into the `secrets` folder (`explorer secrets` opens it). Check
   the names are exactly `r2.json` and `google-tts.json` (`dir secrets`), not `r2.json.txt`.
7. Double-click **Polyjuice Studio** on your Desktop. A black window starts the studio (keep it open)
   and the dashboard opens in your browser after a few seconds.
8. Press **Sync** (bottom left). The first sync downloads the videos' images and audio (about 450 MB).

### macOS
Accept the invites, `git clone https://github.com/gautham8793/polyjuice-studio.git PolyjuiceStudio`, then
`./setup.sh <your-member-id>`, add the
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
