/**
 * Curated channel manifest (fork addition, 2026-11-08).
 *
 * Battery: the app's Xtream accounts are curated against this static manifest
 * (generated off-device by the bge-m3 ML pipeline, NOT embedded at runtime):
 *   - keep: only streams listed in the manifest survive from curated sources
 *   - order: `o` is a global sequence number (group-major, source-num minor)
 *     — the live list is emitted in exactly this order
 *   - group: `g` replaces the source's auto category (which is spam-prone)
 *   - name: `n` is the ML-cleaned display name (flags/quality codes stripped)
 *
 * Key format: `<account>:<stream_id>` where `<account>` is a stable short name.
 * Match at runtime is by the numeric stream id in the live URL tail, which is
 * stable across the get.php m3u and player_api paths.
 */
import curated from '../../assets/curation/curated-manifest.json';

export interface CuratedEntry {
  /** Curated group (replaces the source category) */
  g: string;
  /** Global order sequence (group-major, source order minor) */
  o: number;
  /** ML-cleaned display name */
  n: string;
}

const entries = curated as Record<string, CuratedEntry>;
const byStreamId = new Map<string, CuratedEntry>();
for (const key of Object.keys(entries)) {
  const sep = key.lastIndexOf(':');
  if (sep >= 0) byStreamId.set(key.slice(sep + 1), entries[key]);
}

const CURATED_SOURCE_PATTERNS: RegExp[] = [
  /1tv41\.icu/,
  /195\.128\.27\.253/,
];

/** True when the playlist URL belongs to a curated (manifest-backed) account. */
export function isCuratedSourceUrl(url: string): boolean {
  return CURATED_SOURCE_PATTERNS.some(pattern => pattern.test(url));
}

/** Look up the manifest entry for a live stream URL; null when uncurated/unknown. */
export function curatedForUrl(url: string): CuratedEntry | null {
  const match = /\/live\/[^/?#]+\/[^/?#]+\/(\d+)\.m3u8(?:\?|$)/.exec(url);
  if (!match) return null;
  return byStreamId.get(match[1]) ?? null;
}