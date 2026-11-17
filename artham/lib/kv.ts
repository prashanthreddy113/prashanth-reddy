// A tiny key-value store with compare-and-set, so credit balances and payments
// can be updated safely when two requests arrive at the same time.
//
// Backends:
//   "blobs" - Netlify Blobs (strong consistency + conditional writes). Used on Netlify.
//   "file"  - a JSON file in .data/ for local development and tests.

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type Versioned<T> = { value: T; version: string };

export interface KV {
  get<T>(key: string): Promise<Versioned<T> | null>;
  /** Writes only if the key does not exist yet. Returns false if it already existed. */
  create<T>(key: string, value: T): Promise<boolean>;
  /** Writes only if the stored version still equals `version`. Returns false on conflict. */
  replace<T>(key: string, value: T, version: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// File backend (single process). Serialises all access with a promise chain.

class FileKV implements KV {
  private file: string;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(file: string) {
    this.file = file;
  }

  private async load(): Promise<Record<string, { v: string; d: unknown }>> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw e;
    }
  }

  private async save(data: Record<string, { v: string; d: unknown }>) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = this.file + "." + process.pid + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(data));
    await fs.rename(tmp, this.file);
  }

  private locked<R>(fn: () => Promise<R>): Promise<R> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => undefined);
    return next;
  }

  get<T>(key: string) {
    return this.locked(async () => {
      const data = await this.load();
      const entry = data[key];
      return entry ? { value: entry.d as T, version: entry.v } : null;
    });
  }

  create<T>(key: string, value: T) {
    return this.locked(async () => {
      const data = await this.load();
      if (data[key]) return false;
      data[key] = { v: randomUUID(), d: value };
      await this.save(data);
      return true;
    });
  }

  replace<T>(key: string, value: T, version: string) {
    return this.locked(async () => {
      const data = await this.load();
      if (!data[key] || data[key].v !== version) return false;
      data[key] = { v: randomUUID(), d: value };
      await this.save(data);
      return true;
    });
  }
}

// ---------------------------------------------------------------------------
// Netlify Blobs backend.

class BlobsKV implements KV {
  private storePromise: Promise<import("@netlify/blobs").Store>;

  constructor(name: string) {
    this.storePromise = import("@netlify/blobs").then(({ getStore }) =>
      getStore({ name, consistency: "strong" }),
    );
  }

  async get<T>(key: string) {
    const store = await this.storePromise;
    const res = await store.getWithMetadata(key, { type: "json" });
    if (!res || res.etag === undefined) return null;
    return { value: res.data as T, version: res.etag };
  }

  async create<T>(key: string, value: T) {
    const store = await this.storePromise;
    const res = await store.setJSON(key, value, { onlyIfNew: true });
    return res.modified;
  }

  async replace<T>(key: string, value: T, version: string) {
    const store = await this.storePromise;
    const res = await store.setJSON(key, value, { onlyIfMatch: version });
    return res.modified;
  }
}

// ---------------------------------------------------------------------------

let instance: KV | null = null;

export function getKV(): KV {
  if (instance) return instance;
  const backend = process.env.STORE_BACKEND || (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT ? "blobs" : "file");
  instance =
    backend === "blobs"
      ? new BlobsKV("artham")
      : new FileKV(process.env.STORE_FILE || path.join(process.cwd(), ".data", "store.json"));
  return instance;
}

/** For tests: use a specific store. */
export function setKVForTests(kv: KV | null) {
  instance = kv;
}

export function createFileKV(file: string): KV {
  return new FileKV(file);
}

/**
 * Read-modify-write with retries. `fn` receives the current value (or null if missing)
 * and returns the new value, or `undefined` to leave the key unchanged.
 */
export async function update<T>(
  kv: KV,
  key: string,
  fn: (current: T | null) => T | undefined,
  attempts = 8,
): Promise<{ value: T | null; changed: boolean }> {
  for (let i = 0; i < attempts; i++) {
    const current = await kv.get<T>(key);
    const next = fn(current ? current.value : null);
    if (next === undefined) return { value: current ? current.value : null, changed: false };
    const ok = current ? await kv.replace(key, next, current.version) : await kv.create(key, next);
    if (ok) return { value: next, changed: true };
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60 * (i + 1)));
  }
  throw new Error(`Could not update ${key}: too many concurrent writes`);
}
