import { getStore } from "@netlify/blobs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Thin wrapper over Netlify Blobs with a local-filesystem fallback so that
 * `astro dev` / `netlify dev` work without cloud Blobs configured.
 * Each store maps to `.netlify/blobs-local/<store>/<key>.json` locally.
 */

const LOCAL_DIR = ".netlify/blobs-local";

function isMissingBlobsEnv(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("environment has not been configured to use Netlify Blobs");
}

function localPath(store: string, key: string): string {
  return join(LOCAL_DIR, store, `${key}.json`);
}

async function localRead<T>(store: string, key: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(localPath(store, key), "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

async function localWrite(store: string, key: string, data: unknown): Promise<void> {
  const path = localPath(store, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

async function localKeys(store: string): Promise<string[]> {
  try {
    const files = await readdir(join(LOCAL_DIR, store));
    return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function readJSON<T>(store: string, key: string, fallback: T): Promise<T> {
  try {
    const raw = await getStore(store).get(key, { type: "json" });
    return (raw as T | null) ?? fallback;
  } catch (err) {
    if (isMissingBlobsEnv(err)) return localRead(store, key, fallback);
    throw err;
  }
}

export async function writeJSON(store: string, key: string, data: unknown): Promise<void> {
  try {
    await getStore(store).setJSON(key, data);
  } catch (err) {
    if (!isMissingBlobsEnv(err)) throw err;
    await localWrite(store, key, data);
  }
}

export async function listKeys(store: string): Promise<string[]> {
  try {
    const { blobs } = await getStore(store).list();
    return blobs.map((b) => b.key);
  } catch (err) {
    if (isMissingBlobsEnv(err)) return localKeys(store);
    throw err;
  }
}
