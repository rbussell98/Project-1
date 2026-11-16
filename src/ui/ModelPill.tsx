import { useEffect, useState } from 'react';
import type { ModelSnapshot } from '../matcher/client';

export function ModelPill({ state }: { state: ModelSnapshot }) {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (state.phase !== 'ready') {
      setFlash(false);
      return;
    }
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), 1200);
    return () => window.clearTimeout(t);
  }, [state.phase]);

  if (state.phase === 'loading') {
    const pct = Math.round(Math.max(0, Math.min(1, state.progress)) * 100);
    return (
      <div className="model-pill" data-testid="model-pill" role="status">
        <span className="model-dot" />
        Image model {pct}%
      </div>
    );
  }
  if (state.phase === 'error') {
    return (
      <div className="model-pill err" data-testid="model-pill" role="status">
        Text and barcode only
      </div>
    );
  }
  if (flash) {
    return (
      <div className="model-pill ready" data-testid="model-pill" role="status">
        Image model ready
      </div>
    );
  }
  return null;
}
