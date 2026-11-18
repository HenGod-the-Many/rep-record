import { useSyncExternalStore } from 'react';

/**
 * Minimal hash router: "#/plans/abc?mode=add" -> { parts: ['plans','abc'], query }.
 * Hash routing works on GitHub Pages without server rewrites.
 */
export interface Route {
  parts: string[];
  query: URLSearchParams;
}

function parse(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const decode = (s: string) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s; // malformed %-escape: use it as typed rather than crash
    }
  };
  return { parts: path.split('/').filter(Boolean).map(decode), query: new URLSearchParams(qs) };
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parse(hash);
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const url = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (opts.replace) window.location.replace(url);
  else window.location.hash = url;
}
