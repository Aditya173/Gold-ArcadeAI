// Client-side checks from BRIEF_MARKETPLACE.md (S3 / §2.7).
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export const INSTAGRAM_RE = /^@?[A-Za-z0-9._]{1,30}$/;

export const MAX_IMAGE_BYTES = 1_000_000; // 1 MB per image
export const MAX_IMAGES = 6;
export const MAX_STYLE_REFS = 3;
export const PALETTE_MIN = 2;
export const PALETTE_MAX = 6;

export const isHex = (s: string) => HEX_RE.test(s.trim());
export const isInstagramHandle = (s: string) => INSTAGRAM_RE.test(s.trim());
export const normalizeHex = (s: string) => s.trim().toLowerCase();
export const stripAt = (s: string) => s.trim().replace(/^@/, '');

// Size of a base64 payload in bytes (without decoding it).
export const base64Bytes = (b64: string) =>
  Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);

// creatorId = 'creator-' + slug(handle): A-Z a-z 0-9 -, at most 56 characters (§2.3).
export const slug = (handle: string) =>
  stripAt(handle).replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56);

export const validPalette = (hexes: string[]) =>
  hexes.length >= PALETTE_MIN && hexes.length <= PALETTE_MAX && hexes.every(isHex);
