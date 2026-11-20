import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './pwa'; // registers the service worker; see pwa.ts for how updates are applied
import { db } from './db/db';
import { ensureSeeded } from './db/seed';
import { pruneUnusedCopies } from './db/reschedule';
import './styles.css';

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
