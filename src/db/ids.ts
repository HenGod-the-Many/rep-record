/**
 * Random id. crypto.randomUUID needs a secure context (https or localhost),
 * so fall back to getRandomValues when testing over plain http on the LAN.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}
