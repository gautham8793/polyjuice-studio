// Remotion CLI / Studio settings. Images, audio and brand files are served from the content root
// (projects/, library/, brand/): STUDIO_WORKSPACE, else ../workspace if it exists, else the repo root.
// Mirrored by tools/studio_paths.py and dashboard/server/paths.ts.
import { existsSync } from "node:fs";
import path from "node:path";
import { Config } from "@remotion/cli/config";

const codeRoot = path.resolve(process.cwd(), "..");
const workspace = path.join(codeRoot, "workspace");
const contentRoot = process.env.STUDIO_WORKSPACE
  ? path.resolve(codeRoot, process.env.STUDIO_WORKSPACE)
  : existsSync(workspace) ? workspace : codeRoot;

Config.setPublicDir(contentRoot);
