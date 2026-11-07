"""One-off migration to the team files of DEC-15 build step 2. Safe to run again.

  python3 tools/migrate_team.py --owner gautham --name Gautham

- members.json (one admin) and .studio/me.json, if missing
- projects/_workspace.json → workspace.json (folders) + projects/<slug>/team.json (owner, uploads,
  Instagram posts)
- the `review` block in project.json → projects/<slug>/review.json, as the owner's review
Everything replaced is copied to .studio/migration-backup/ first.
"""
import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from studio_paths import CODE_ROOT, CONTENT_ROOT  # noqa: E402

BACKUP = CODE_ROOT / ".studio" / "migration-backup"


def read(p: Path, default=None):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def write(p: Path, data) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def backup(p: Path) -> None:
    dest = BACKUP / p.relative_to(CONTENT_ROOT)
    if p.exists() and not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, dest)


def ts(s: str) -> float:
    return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--owner", required=True)
    ap.add_argument("--name", required=True)
    args = ap.parse_args()
    me = args.owner

    members = CONTENT_ROOT / "members.json"
    if not members.exists():
        write(members, {"members": [{"id": me, "name": args.name, "roles": ["admin", "publisher", "editor", "reviewer"]}]})
        print("wrote members.json")
    me_file = CODE_ROOT / ".studio" / "me.json"
    if not me_file.exists():
        write(me_file, {"member": me})
        print("wrote .studio/me.json")

    old_ws_file = CONTENT_ROOT / "projects" / "_workspace.json"
    old_ws = read(old_ws_file, {"folders": [], "projects": {}})
    ws_file = CONTENT_ROOT / "workspace.json"
    if not ws_file.exists():
        write(ws_file, {
            "folders": old_ws.get("folders", []),
            "projects": {s: {"folder": e["folder"]} for s, e in old_ws.get("projects", {}).items() if e.get("folder")},
        })
        print(f"wrote workspace.json ({len(old_ws.get('folders', []))} folders)")

    for project_file in sorted((CONTENT_ROOT / "projects").glob("*/project.json")):
        d = project_file.parent
        slug = d.name
        team_file = d / "team.json"
        if not team_file.exists():
            entry = old_ws.get("projects", {}).get(slug, {})
            published = {}
            ig = entry.get("instagram")
            if ig:
                published["instagram"] = {**ig, "by": me}
            up = entry.get("uploadedAt")
            # The Instagram publish also stamped uploadedAt; only a separate, earlier mark means YouTube.
            if up and not (ig and abs(ts(up) - ts(ig["at"])) < 600):
                published["youtube"] = {"at": up, "by": me, **({"url": entry["url"]} if entry.get("url") else {})}
            write(team_file, {"owner": me, **({"published": published} if published else {})})

        project = read(project_file)
        old = project.get("review")
        if old is not None:
            backup(project_file)
            review = {
                "scenes": {sid: {me: r} for sid, r in (old.get("scenes") or {}).items()},
                "approval": {"by": me, "at": old["approvedAt"], "scriptHash": old["scriptHash"]}
                if old.get("approvedAt") else None,
            }
            if not (d / "review.json").exists():
                write(d / "review.json", review)
            del project["review"]
            write(project_file, project)
            print(f"{slug}: review moved to review.json")

    if old_ws_file.exists():
        backup(old_ws_file)
        old_ws_file.unlink()
        print("removed projects/_workspace.json (backup in .studio/migration-backup/)")


if __name__ == "__main__":
    main()
