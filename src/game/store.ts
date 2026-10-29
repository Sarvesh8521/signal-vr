export interface Store { get(k: string): string | null; set(k: string, v: string): void; }
/** localStorage can be empty/blocked in some contexts: always try/catch, fall back to memory. */
export function makeStore(): Store {
  const mem = new Map<string, string>();
  return {
    get(k) { try { const v = globalThis.localStorage?.getItem('signal:' + k); if (v != null) return v; } catch {} return mem.get(k) ?? null; },
    set(k, v) { mem.set(k, v); try { globalThis.localStorage?.setItem('signal:' + k, v); } catch {} },
  };
}
export function memoryStore(): Store { const m = new Map<string, string>(); return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) }; }
