import { Sheet } from './chrome';

const STEPS = ['Finding the cover', 'Matching the artwork', 'Reading text', 'Searching MusicBrainz'];

function stage(step: string): number {
  if (step.startsWith('Found')) return 4;
  if (step.startsWith('Searching')) return 3;
  if (step.startsWith('Reading')) return 2;
  if (step.startsWith('Downloading') || step.startsWith('Matching')) return 1;
  return 0;
}

export function PhotoSheet({
  preview,
  step,
  progress,
  error,
  onClose,
  onRetry,
  onType,
}: {
  preview: string;
  step: string;
  progress: number | null;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onType: () => void;
}) {
  const at = stage(step);
  return (
    <Sheet onClose={onClose} testId="photo-sheet" title="Add by photo">
      <img className="photo-frame" src={preview} alt="Sleeve you photographed" />
      <p className="step-now" data-testid="photo-status">
        {error ? 'Something got in the way' : step}
      </p>
      {progress != null && !error && (
        <div className="meter" aria-hidden>
          <div style={{ width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
        </div>
      )}
      {!error && (
        <ol className="steps">
          {STEPS.map((label, i) => (
            <li key={label} className={i < at ? 'done' : i === at ? 'on' : undefined}>
              <span className="dot" />
              {label}
            </li>
          ))}
        </ol>
      )}
      {error ? <p className="err">{error}</p> : null}
      <div className="btn-row">
        {error ? (
          <>
            <button className="btn primary block" onClick={onRetry}>
              Try again
            </button>
            <button className="btn ghost block" onClick={onType}>
              Enter it myself
            </button>
          </>
        ) : (
          <button className="btn ghost block" onClick={onClose}>
            Cancel
          </button>
        )}
      </div>
    </Sheet>
  );
}
