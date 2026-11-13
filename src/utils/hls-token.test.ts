import { describe, it, expect } from 'vitest';
import {
  encodeUpstreamToken, decodeUpstreamToken,
  looksLikePlaylistBody, resolveAgainst, absolutizeSegments,
} from './hls-token';

describe('hls token', () => {
  it('round-trips the upstream token', () => {
    const t = encodeUpstreamToken('http://1tv41.icu:8080', 'VMh8na', '793530');
    expect(t).not.toContain('=');
    const d = decodeUpstreamToken(t);
    expect(d.upstreamBase).toBe('http://1tv41.icu:8080');
    expect(d.username).toBe('VMh8na');
    expect(d.apiPassword).toBe('793530');
  });
  it('omits password when absent', () => {
    const t = encodeUpstreamToken('http://x:8080', 'u');
    const d = decodeUpstreamToken(t);
    expect(d.username).toBe('u');
    expect(d.apiPassword).toBeUndefined();
  });
  it('sniffs playlist bodies', () => {
    expect(looksLikePlaylistBody('#EXTM3U\n#EXTINF:8,\nseg.ts')).toBe(true);
    expect(looksLikePlaylistBody('\uFEFF#EXTM3U')).toBe(true);
    expect(looksLikePlaylistBody('ID3')).toBe(false);
    expect(looksLikePlaylistBody('')).toBe(false);
  });
  it('resolves relative segments against final url', () => {
    expect(resolveAgainst('http://lb.example/live/u/p/1.m3u8?token=abc', 'seg1.ts'))
      .toBe('http://lb.example/live/u/p/seg1.ts');
    expect(resolveAgainst('http://lb.example/a.m3u8', '/hlsr/blob/u/p/1.ts'))
      .toBe('http://lb.example/hlsr/blob/u/p/1.ts');
  });
  it('absolutizes segments keeping tags', () => {
    const out = absolutizeSegments('#EXTM3U\n#EXTINF:8.0,\nseg.ts\n', 'http://lb.example/live/u/p/1.m3u8?token=t');
    expect(out).toContain('#EXTINF');
    expect(out).toContain('http://lb.example/live/u/p/seg.ts');
  });
});