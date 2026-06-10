// Browser-only storage for the Analysis Studio BYOK config.
// Holds { provider, model, key } in localStorage. This NEVER goes to our servers —
// it is read in the browser and passed straight to the chosen LLM provider.

const STORE_KEY = 'gp_analyze_byok_v1';

export function loadByok() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (v && v.provider && v.model && v.key) return v;
    return null;
  } catch {
    return null;
  }
}

export function saveByok({ provider, model, key }) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ provider, model, key }));
  } catch {
    // ignore quota / private-mode write errors
  }
}

export function clearByok() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // ignore
  }
}

// True once the user has chosen a provider/model and pasted a key.
export function hasByok() {
  return loadByok() !== null;
}
