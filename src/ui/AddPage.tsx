import { Screen } from './chrome';
import { IconCamera, IconSearch } from './icons';

export function AddPage({
  onFile,
  onManual,
  modelReady,
}: {
  onFile: (file: File) => void;
  onManual: () => void;
  modelReady: boolean;
}) {
  return (
    <Screen title="Add">
      <p className="fine" style={{ marginTop: 0 }}>
        A photo of the sleeve is enough to start.
        {modelReady ? '' : ' Printed text and the barcode work while the image model catches up.'}
      </p>
      <div className="group">
        <label className="row">
          <IconCamera />
          <span className="label">Take a photo</span>
          <input
            className="sr"
            type="file"
            accept="image/*"
            capture="environment"
            data-testid="camera-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onFile(file);
            }}
          />
        </label>
        <label className="row">
          <IconCamera />
          <span className="label">Photo library</span>
          <input
            className="sr"
            type="file"
            accept="image/*"
            data-testid="library-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onFile(file);
            }}
          />
        </label>
        <button className="row" onClick={onManual} data-testid="manual-add">
          <IconSearch />
          <span className="label">Search by artist and album</span>
        </button>
      </div>
    </Screen>
  );
}
