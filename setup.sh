#!/usr/bin/env bash
# Polyjuice Video Studio: macOS setup (DEC-15 step 5). Safe to run again: done steps are skipped.
#   ./setup.sh <your-member-id>
# Full walkthrough: docs/JOINING.md
set -euo pipefail
cd "$(dirname "$0")"
MEMBER="${1:-}"
CONTENT_REPO="${CONTENT_REPO:-https://github.com/gautham8793/polyjuice-channel.git}"
step() { printf '\n== %s\n' "$1"; }

# Retry a command a few times (downloads from GitHub / PyPI sometimes time out).
retry() { local n; for n in 1 2 3; do "$@" && return 0; echo "  attempt $n failed; retrying in $((n * 10)) s"; sleep $((n * 10)); done; return 1; }

step "Tools: Git, Node.js, Python 3.12, FFmpeg, whisper.cpp"
# Only what's missing is installed (Homebrew); tools that already work are left alone.
need() { command -v "$1" >/dev/null 2>&1 || { command -v brew >/dev/null || { echo "Install Homebrew first: https://brew.sh"; exit 1; }; brew install "$2"; }; }
need git git
need node node
need ffmpeg ffmpeg
need whisper-cli whisper-cpp
need python3.12 python@3.12
PY="$(command -v python3.12)"

step "Studio packages (npm)"
npm ci

step "Python packages (tools/.venv)"
[ -x tools/.venv/bin/python ] || "$PY" -m venv tools/.venv
retry tools/.venv/bin/python -m pip install --upgrade pip
retry tools/.venv/bin/python -m pip install -r tools/requirements.txt

step "Captions model"
mkdir -p tools/models
[ -f tools/models/ggml-base.en.bin ] || retry curl -L --fail -o tools/models/ggml-base.en.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin

step "Channel content (workspace/)"
if [ ! -d workspace/.git ]; then
  if [ -d workspace ] && [ -n "$(ls -A workspace)" ]; then
    echo "workspace/ exists but isn't the channel repo; move it away and run again."; exit 1
  fi
  git clone "$CONTENT_REPO" workspace || { echo "Couldn't download the content: has Gautham invited your GitHub account to polyjuice-channel?"; exit 1; }
fi

step "Who you are on this computer"
if [ -z "$MEMBER" ]; then
  python3 -c 'import json; [print(f"  {m[\"id\"]:<12} {m[\"name\"]}") for m in json.load(open("workspace/members.json"))["members"]]'
  read -r -p "Your member id: " MEMBER
fi
python3 - "$MEMBER" <<'EOF'
import json, sys
ids = [m["id"] for m in json.load(open("workspace/members.json"))["members"]]
if sys.argv[1] not in ids:
    sys.exit(f"'{sys.argv[1]}' isn't a member yet. Ask Gautham to add you in Team & activity and Sync, then run this again.")
EOF
mkdir -p .studio
printf '{ "member": "%s" }\n' "$MEMBER" > .studio/me.json

step "Keys (secrets/)"
mkdir -p secrets && chmod 700 secrets
for f in r2.json google-tts.json; do
  [ -f "secrets/$f" ] || echo "  missing secrets/$f : save the file Gautham sends you (privately) there"
done

printf '\nDone. Start the studio with:  npm run dashboard   (http://localhost:3200), then press Sync.\n'
