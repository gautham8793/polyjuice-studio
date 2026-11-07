"""Where things live: the code (this checkout) and the channel's content (projects, library, brand).

The content root is, in order:
  1. STUDIO_WORKSPACE (absolute, or relative to the code root), if set
  2. <code root>/workspace, if it exists
  3. the code root itself (the original single-folder layout)
Mirrored by dashboard/server/paths.ts and remotion/remotion.config.ts.
"""
import os
from pathlib import Path

CODE_ROOT = Path(__file__).resolve().parent.parent


def _content_root() -> Path:
    env = os.environ.get("STUDIO_WORKSPACE")
    if env:
        return (CODE_ROOT / env).resolve()
    ws = CODE_ROOT / "workspace"
    return ws if ws.is_dir() else CODE_ROOT


CONTENT_ROOT = _content_root()


def project_dir(arg: str) -> Path:
    """Accepts a slug, "projects/<slug>", or any path to the project folder."""
    for candidate in (Path(arg), CONTENT_ROOT / arg, CONTENT_ROOT / "projects" / arg):
        if (candidate / "project.json").is_file():
            return candidate.resolve()
    raise SystemExit(f"no project.json found for '{arg}' (content root: {CONTENT_ROOT})")


def content_path(p: Path) -> str:
    """A path inside the content root as the forward-slash string the videos and dashboard use."""
    return p.resolve().relative_to(CONTENT_ROOT).as_posix()
