"""Print Remotion input props (JSON) for a project, for `remotion render --props=...`.

Usage:
  python tools/render_props.py <slug> > props.json
  (cd remotion && npx remotion render src/index.ts Listicle ../out/x.mp4 --props=../props.json)
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from studio_paths import CONTENT_ROOT, content_path, project_dir as find_project  # noqa: E402

project_dir = find_project(sys.argv[1])
print(json.dumps({
    "project": json.loads((project_dir / "project.json").read_text()),
    "timeline": json.loads((project_dir / "timeline.json").read_text()),
    "brand": json.loads((CONTENT_ROOT / "brand/brand.json").read_text()),
    "projectPath": content_path(project_dir),
}))
