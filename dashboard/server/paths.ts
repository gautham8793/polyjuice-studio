// Where things live, and how to run the bundled tools on macOS, Windows and Linux.
// The content root (projects/, library/, brand/) is, in order: STUDIO_WORKSPACE, <code>/workspace if it
// exists, else the code root itself. Mirrored by tools/studio_paths.py and remotion/remotion.config.ts.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const cache = new Map<string, string>();

export const contentRoot = (codeRoot: string) => {
  let dir = cache.get(codeRoot);
  if (!dir) {
    const env = process.env.STUDIO_WORKSPACE;
    const ws = path.join(codeRoot, "workspace");
    dir = env ? path.resolve(codeRoot, env) : existsSync(ws) ? ws : codeRoot;
    cache.set(codeRoot, dir);
  }
  return dir;
};

// The Python in tools/.venv (bin/ on macOS and Linux, Scripts\ on Windows).
export const python = (codeRoot: string) =>
  process.platform === "win32"
    ? path.join(codeRoot, "tools", ".venv", "Scripts", "python.exe")
    : path.join(codeRoot, "tools", ".venv", "bin", "python");

// Remotion's CLI run by Node directly: `npx` is a .cmd script on Windows, which spawn can't run without a shell.
export const remotionCli = (codeRoot: string): [string, string[]] => {
  const pkg = createRequire(path.join(codeRoot, "remotion", "package.json")).resolve("@remotion/cli/package.json");
  return [process.execPath, [path.join(path.dirname(pkg), "remotion-cli.js")]];
};

// Show a folder in Finder / Explorer / the Linux file manager.
export const reveal = (folder: string) => {
  const cmd = { darwin: "open", win32: "explorer" }[process.platform as string] ?? "xdg-open";
  spawn(cmd, [folder], { detached: true, stdio: "ignore" }).unref();
};
