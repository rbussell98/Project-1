import spec from './model.json';

const DTYPES = ['q8', 'q4', 'q4f16', 'fp16', 'fp32', 'int8', 'uint8'] as const;
type ModelDtype = (typeof DTYPES)[number];

function dtypeOf(value: string): ModelDtype {
  return (DTYPES as readonly string[]).includes(value) ? (value as ModelDtype) : 'q8';
}

export const MODEL = {
  id: spec.id,
  dtype: dtypeOf(spec.dtype),
  dim: spec.dim,
  imageSize: spec.imageSize,
};

export type ModelPhase = 'idle' | 'loading' | 'ready' | 'error';

/** Visual search only after the image model is on device. Until then, barcode + text. */
export function matchPath(phase: ModelPhase): 'visual' | 'text' {
  return phase === 'ready' ? 'visual' : 'text';
}
