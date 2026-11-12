import { useState } from 'react';
import { exportBackup, importBackup } from '../db';
import type { BackupFile, ThemeName } from '../types';
import { Screen } from './chrome';
import { Mark } from './icons';

export function SettingsPage({ theme, onTheme }: { theme: ThemeName; onTheme: (t: ThemeName) => void }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onExport() {
    setError('');
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sleeve-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage(`Exported ${data.records.length} record${data.records.length === 1 ? '' : 's'}.`);
  }

  async function onImport(file: File) {
    setError('');
    setMessage('');
    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupFile;
      const n = await importBackup(data);
      setMessage(`Imported ${n} record${n === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that backup.');
    }
  }

  return (
    <Screen title="Settings">
      <div className="lockup">
        <Mark size={52} />
        <div className="wordmark">Sleeve</div>
        <p>A quiet listening room.</p>
      </div>
      <p className="section-label">Appearance</p>
      <div className="seg" role="group" aria-label="Appearance">
        <button className={theme === 'dark' ? 'on' : undefined} onClick={() => onTheme('dark')}>
          Dark
        </button>
        <button className={theme === 'light' ? 'on' : undefined} onClick={() => onTheme('light')} data-testid="theme-light">
          Light
        </button>
      </div>
      <p className="section-label">Library</p>
      <div className="group">
        <button className="row" onClick={() => void onExport()} data-testid="export">
          <span className="label">Export backup</span>
        </button>
        <label className="row">
          <span className="label">Import backup</span>
          <input
            className="sr"
            type="file"
            accept="application/json,.json"
            data-testid="import"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void onImport(file);
            }}
          />
        </label>
      </div>
      {message ? <p className="fine">{message}</p> : null}
      {error ? <p className="err">{error}</p> : null}
      <p className="fine">
        Records stay on this phone. The image model downloads once, the first time you add a photo. Names and cover art come from MusicBrainz and the Cover Art Archive.
      </p>
    </Screen>
  );
}
