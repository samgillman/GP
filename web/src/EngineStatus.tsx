import { useEffect, useState } from "react";
import type { EngineStage } from "./api";

const STEPS: Partial<Record<EngineStage, [number, string]>> = {
  starting: [1, "Starting"],
  runtime: [1, "Loading Python"],
  packages: [2, "Loading NumPy and SciPy"],
  code: [3, "Loading GP analyses"],
};

/** Title-bar indicator for the browser analysis engine. It stays visible
 * while the engine loads (first visit only), while graph export tools load,
 * and briefly once everything is ready. `busy` means the user is waiting on it. */
export default function EngineStatus({ stage, busy }: { stage: EngineStage; busy: boolean }) {
  const [justReady, setJustReady] = useState(false);
  const [seenLoading, setSeenLoading] = useState(stage !== "ready");
  useEffect(() => {
    if (stage !== "ready") {
      setSeenLoading(true);
      return;
    }
    if (!seenLoading) return;
    setJustReady(true);
    const timer = setTimeout(() => setJustReady(false), 2500);
    return () => clearTimeout(timer);
  }, [stage, seenLoading]);
  if (stage === "ready" && !justReady) return null;
  const step = STEPS[stage];
  const text =
    stage === "failed"
      ? "Analysis engine stopped — reload the page to retry"
      : stage === "graphics"
        ? "Preparing graph export (first export only)…"
        : stage === "ready"
          ? "Analysis engine ready"
          : `Preparing analysis engine — ${step![1]}… (step ${step![0]} of 3)`;
  return (
    <span
      className={`engine-status${busy ? " is-waiting" : ""}${stage === "ready" ? " is-ready" : ""}${stage === "failed" ? " is-failed" : ""}`}
      role="status"
      aria-live="polite"
    >
      {stage !== "ready" && stage !== "failed" && <span className="engine-spinner" aria-hidden="true" />}
      <span>{text}</span>
      {step && (
        <span className="engine-bar" aria-hidden="true">
          <span style={{ width: `${(step[0] / 3) * 100}%` }} />
        </span>
      )}
    </span>
  );
}

/** Shown over the sheet when an analysis or export is waiting for the engine. */
export function EngineWaitBanner({ stage }: { stage: EngineStage }) {
  const step = STEPS[stage];
  return (
    <div className="engine-wait" role="status" aria-live="polite">
      <span className="engine-spinner" aria-hidden="true" />
      <div>
        <strong>
          {stage === "graphics" ? "Preparing graph export…" : "Starting the analysis engine…"}
        </strong>
        <p>
          {stage === "graphics"
            ? "The first export loads the graph renderer. Your file downloads as soon as it is ready."
            : `This happens once per visit and takes about 10 seconds${step ? ` (step ${step[0]} of 3: ${step[1]})` : ""}. Your request runs as soon as it is ready.`}
        </p>
      </div>
    </div>
  );
}
