import type { SortKey, ThemeName, ViewMode } from './types';

const KEY = 'sleeve.prefs';

export interface Prefs {
  theme: ThemeName;
  view: ViewMode;
  sort: SortKey;
}

const DEFAULTS: Prefs = { theme: 'dark', view: 'grid', sort: 'artist' };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      view: parsed.view === 'list' ? 'list' : 'grid',
      sort: parsed.sort === 'title' || parsed.sort === 'year' || parsed.sort === 'added' ? parsed.sort : 'artist',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(prefs: Prefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
  applyTheme(prefs.theme);
}

export function applyTheme(theme: ThemeName) {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#F7EFE2' : '#1E1713');
}
