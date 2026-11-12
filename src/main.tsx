import '@fontsource-variable/fraunces/standard.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, loadPrefs } from './prefs';
import './styles.css';

applyTheme(loadPrefs().theme);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
