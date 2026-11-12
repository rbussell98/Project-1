import { allEmbeddings, putEmbedding } from '../db';
import type { IdentifyResult } from '../types';

export interface StatusUpdate {
  step: string;
  progress: number | null;
}

interface Pending {
  kind: 'identify' | 'embed';
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  onStatus?: (s: StatusUpdate) => void;
}

let worker: Worker | null = null;
const pending = new Map<string, Pending>();

function rejectAll(err: Error) {
  for (const [id, job] of pending) {
    pending.delete(id);
    job.reject(err);
  }
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as {
        type: string;
        id: string;
        step?: string;
        progress?: number | null;
        result?: IdentifyResult;
        vec?: ArrayBuffer | null;
        message?: string;
      };
      const job = pending.get(msg.id);
      if (!job) return;
      if (msg.type === 'status') {
        job.onStatus?.({ step: msg.step || '', progress: msg.progress ?? null });
        return;
      }
      pending.delete(msg.id);
      if (msg.type === 'result') job.resolve(msg.result);
      else if (msg.type === 'embedded') job.resolve(msg.vec ?? null);
      else job.reject(new Error(msg.message || 'Match failed'));
    };
    worker.onerror = (ev) => {
      const detail = [ev.message, ev.filename, ev.lineno].filter((part) => part != null && part !== '').join(' ');
      rejectAll(new Error(detail || 'The matcher stopped'));
    };
  }
  return worker;
}

export function identify(file: Blob, onStatus: (s: StatusUpdate) => void): Promise<IdentifyResult> {
  const id = crypto.randomUUID();
  return file.arrayBuffer().then(async (buf) => {
    const users = await allEmbeddings();
    const w = getWorker();
    w.postMessage(
      {
        type: 'identify',
        id,
        buf,
        users: users.map((u) => ({ key: u.key, rgid: u.rgid, artist: u.artist, title: u.title, vec: u.vec })),
      },
      [buf],
    );
    return new Promise<IdentifyResult>((resolve, reject) => {
      pending.set(id, { kind: 'identify', resolve: (v) => resolve(v as IdentifyResult), reject, onStatus });
    });
  });
}

export function cancelIdentify() {
  if (!worker) return;
  worker.postMessage({ type: 'cancel' });
  for (const [id, job] of pending) {
    if (job.kind !== 'identify') continue;
    pending.delete(id);
    job.reject(new DOMException('Cancelled', 'AbortError'));
  }
}

export function embedCover(blob: Blob): Promise<Float32Array | null> {
  const id = crypto.randomUUID();
  return blob.arrayBuffer().then(
    (buf) =>
      new Promise<Float32Array | null>((resolve, reject) => {
        pending.set(id, {
          kind: 'embed',
          resolve: (v) => resolve(v ? new Float32Array(v as ArrayBuffer) : null),
          reject,
        });
        getWorker().postMessage({ type: 'embed', id, buf }, [buf]);
      }),
  );
}

export async function rememberCover(key: string, rgid: string | null, artist: string, title: string, blob: Blob) {
  try {
    const vec = await embedCover(blob);
    if (!vec) return;
    await putEmbedding({ key, rgid, artist, title, vec: vec.buffer });
  } catch {
    /* a saved record is still useful without a vector */
  }
}
