import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './pwa'; // registers the service worker; see pwa.ts for how updates are applied
import { db } from './db/db';
import { ensureSeeded } from './db/seed';
import { pruneUnusedCopies } from './db/reschedule';
// Plate fonts, bundled so the app works offline (W-20, decision 0008). Latin only.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import './styles.css';
import { applyTheme, watchSystemTheme } from './theme';

// Colour the page before anything renders, then follow the phone while open.
applyTheme();
watchSystemTheme();

// Ask Safari/Chrome not to evict our data under storage pressure.
navigator.storage?.persist?.().catch(() => undefined);

const root = createRoot(document.getElementById('root')!);

ensureSeeded(db)
  .then(() => pruneUnusedCopies(db))
  .then(() =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
  .catch((err: unknown) => {
    root.render(
      <div className="screen">
        <h1>Could not open your data</h1>
        <p className="error">{String(err)}</p>
      </div>,
    );
  });
