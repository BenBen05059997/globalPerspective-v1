// safeHttpUrl — the only way a URL from a reader's run reaches a stored share. http(s) only; no
// credentials in the URL; bounded length; normalised by the WHATWG parser. Anything else -> null
// (javascript:, data:, file:, //host, about:, mailto:, control characters, ...).
const MAX_URL = 2000;

export function safeHttpUrl(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > MAX_URL || /[\u0000-\u001f\u007f\s]/.test(s)) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (!u.hostname) return null;
  return u.href;
}
