/**
 * HLS token / `hlsr` handling - ported from mediaflow-proxy into a Chromium-53
 * (webOS 4) safe TS module, no runtime deps.
 */

export interface ManifestFetch {
  text: string;
  finalUrl: string;
  bytes: number;
  status: number;
}

function urlSafeB64(bytes: string): string {
  return btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return atob(b64 + pad);
}

function toLatin1(s: string): string {
  return unescape(encodeURIComponent(s));
}

function fromLatin1(s: string): string {
  try { return decodeURIComponent(escape(s)); } catch { return s; }
}

export function encodeUpstreamToken(upstreamBase: string, username: string, apiPassword?: string): string {
  const payload = apiPassword !== undefined ? [upstreamBase, username, apiPassword] : [upstreamBase, username];
  return urlSafeB64(toLatin1(JSON.stringify(payload)));
}

export function decodeUpstreamToken(token: string): { upstreamBase: string; username: string; apiPassword?: string } {
  const arr = JSON.parse(fromLatin1(b64UrlDecode(token))) as string[];
  return { upstreamBase: arr[0], username: arr[1], apiPassword: arr.length > 2 ? arr[2] : undefined };
}

export function looksLikePlaylistBody(body: string): boolean {
  return /^\uFEFF?\s*#EXTM3U/.test(body);
}

export function resolveAgainst(url: string, ref: string): string {
  try { return new URL(ref, url).href; } catch { return ref; }
}

export async function fetchHlsManifest(url: string, timeoutMs = 8000): Promise<ManifestFetch | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20', Accept: '*/*' },
      signal: ctl.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || !looksLikePlaylistBody(text)) return null;
    return { text, finalUrl: res.url || url, bytes: text.length, status: res.status };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function absolutizeSegments(text: string, finalUrl: string): string {
  return text.split('\n').map((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    return resolveAgainst(finalUrl, t);
  }).join('\n');
}