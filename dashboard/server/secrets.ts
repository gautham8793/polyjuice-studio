// Credentials for connected accounts live in secrets/<name>.json (gitignored, owner-only).
// They are read and written only here, on the server; the browser never sees a token.
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const NAME = /^[a-z0-9-]+$/;

const secretPath = (root: string, name: string) => {
  if (!NAME.test(name)) throw new Error(`bad secret name: ${name}`);
  return path.join(root, "secrets", `${name}.json`);
};

export async function readSecret<T>(root: string, name: string): Promise<T | null> {
  const file = secretPath(root, name);
  return existsSync(file) ? (JSON.parse(await readFile(file, "utf8")) as T) : null;
}

export async function writeSecret(root: string, name: string, data: unknown) {
  const file = secretPath(root, name);
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  await chmod(file, 0o600);
}

export async function deleteSecret(root: string, name: string) {
  await rm(secretPath(root, name), { force: true });
}
