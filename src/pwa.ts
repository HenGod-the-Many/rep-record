import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * App updates. A new version downloads in the background and then waits; it is
 * applied only when Taylor taps "Update" on the banner, so a workout in progress
 * is never reloaded mid-set. The app also checks for a new version each
 * time it comes back to the screen, because a home-screen app on iPhone is
 * often resumed rather than relaunched and would otherwise not look.
 */
let ready = false;
const listeners = new Set<() => void>();

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    ready = true;
    listeners.forEach((l) => l());
  },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
    });
  },
});

export function useUpdateReady(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ready,
  );
}

export function applyUpdate(): void {
  void updateSW(true);
}
