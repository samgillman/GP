export const browserOnly = import.meta.env.MODE === "static";
type Pending = {
  resolve: (response: globalThis.Response) => void;
  reject: (error: Error) => void;
};
let worker: Worker | null = null;

/** Where the static build's Python engine is: "starting" before the worker
 * reports, then runtime → packages → code → ready. "graphics" is the one-time
 * Matplotlib load before the first graph export; "failed" if the worker stops. */
export type EngineStage = "starting" | "runtime" | "packages" | "code" | "ready" | "graphics" | "failed";
let stage: EngineStage = browserOnly ? "starting" : "ready";
const listeners = new Set<(stage: EngineStage) => void>();
function setStage(next: EngineStage) {
  stage = next;
  for (const listener of listeners) listener(next);
}
/** Subscribe to engine loading stages; returns an unsubscribe function. */
export function onEngineProgress(listener: (stage: EngineStage) => void) {
  listeners.add(listener);
  listener(stage);
  return () => {
    listeners.delete(listener);
  };
}
let nextId = 0;
const pending = new Map<number, Pending>();

// The static build performs the same validated Python operations in a worker.
// Only application code and runtime packages are fetched; data stays in memory.
export function apiFetch(
  path: string,
  options: RequestInit,
): Promise<globalThis.Response> {
  if (!browserOnly) return fetch(path, options);
  if (!worker) {
    worker = new Worker(new URL("./compute.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onerror = () => {
      for (const job of pending.values())
        job.reject(
          new Error(
            "The browser analysis engine stopped. Reload the page and try again.",
          ),
        );
      pending.clear();
      worker?.terminate();
      worker = null;
      setStage("failed");
    };
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") {
        setStage(data.stage);
        return;
      }
      const job = pending.get(data.id);
      if (!job) return;
      pending.delete(data.id);
      const body = data.bytes
        ? new Uint8Array(data.bytes)
        : JSON.stringify(data.body);
      job.resolve(
        new globalThis.Response(body, {
          status: data.status,
          headers: { "Content-Type": data.mime || "application/json" },
        }),
      );
    };
  }
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    if (options.signal?.aborted)
      return reject(new DOMException("Aborted", "AbortError"));
    const abort = () => {
      pending.delete(id);
      reject(new DOMException("Aborted", "AbortError"));
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    pending.set(id, {
      resolve: (value) => {
        options.signal?.removeEventListener("abort", abort);
        resolve(value);
      },
      reject: (error) => {
        options.signal?.removeEventListener("abort", abort);
        reject(error);
      },
    });
    worker!.postMessage({
      id,
      path,
      body: JSON.parse(String(options.body)),
      base: new URL("./", document.baseURI).href,
    });
  });
}

/** Starts the static build's Python engine in the background at startup so the
 * first analysis does not wait for the runtime download. A failure is retried
 * by the next real request, which reports its own error. */
export async function warmUpEngine(): Promise<boolean> {
  if (!browserOnly) return true;
  try {
    return (await apiFetch("/api/warmup", { method: "POST", body: "{}" })).ok;
  } catch {
    return false;
  }
}
