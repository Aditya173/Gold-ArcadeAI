// Typed client for every endpoint in BRIEF_MARKETPLACE.md §2.4.
// Errors are always {"error":{code,message}}; they are thrown as ApiError.
import { idToken } from './firebase';

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? 'http://127.0.0.1:5001/demo-storefront/us-central1/api';

// ---------- types ----------
export type Role = 'creator' | 'fan';
export type Maker = 'creator' | 'fan';
export type ItemStatus = 'generating' | 'listed' | 'not_makeable';
export type ImageKind = 'logo' | 'reference' | 'instagram';

export interface Price {
  amount: string;
  currency: string;
  mock?: boolean;
  basis?: string;
}

export interface Pack {
  id: string;
  kind: 'archetype' | 'fixture';
  name: string | null;
  oneLine: string | null;
  photos?: { count: number; events: number };
  ideas?: string[];
  palette?: string[];
  signatureReliability?: string;
}

export interface SignatureIdea {
  idea: string;
  share_of_events: number;
  strength?: number;
  synonyms?: string[];
}

export interface Reading {
  schema: 'gold.reading.v0';
  subject: string;
  stub: boolean;
  photos?: { count: number; events: number };
  signature: SignatureIdea[];
  palette: { name: string; hex: string; share?: number; source?: string }[];
  places: unknown[];
  reliability?: unknown;
  archetype?: { name: string; one_line: string; title_phrasings?: string[] };
}

export interface Insights {
  pack: string;
  kind: string;
  attachedAt: number;
  reading: Reading;
  role?: Role;
  creatorId?: string;
}

export interface PaletteEntry {
  name: string;
  hex: string;
  role?: string;
}

export interface StyleImage {
  kind: ImageKind;
  status: string;
  referenceId?: string;
}

export interface OnboardImage {
  kind: ImageKind;
  mediaType: string;
  dataBase64: string;
}

export type OnboardRequest =
  | {
      name: string;
      handle: string;
      instagram: string;
      palette: string[];
      styleWords?: string[];
      images: OnboardImage[];
      instagramMediaIds?: string[];
      styleRefs?: number[];
    }
  | { fixture: 'brand_wishbonekitchen' };

export interface OnboardResponse {
  creatorId: string;
  style: { images: StyleImage[]; styleRefs: string[]; palette: PaletteEntry[] | string[]; styleWords: string[] };
}

export interface ScrapedImage {
  mediaId: string;
  shortcode?: string;
  takenAt?: string | number;
  caption?: string;
  mediaType: string;
  byteLength?: number;
  width?: number;
  height?: number;
  dataBase64: string;
}

export interface InstagramMedia {
  id: string;
  mediaType: string;
  mediaUrl: string;
  permalink?: string;
  timestamp?: string;
}

export interface CreatorSummary {
  creatorId: string;
  name: string;
  handle: string;
  instagram?: string;
  palette: PaletteEntry[];
  listedCount: number;
}

export interface Creator {
  schema?: string;
  creatorId: string;
  name: string;
  handle: string;
  instagram?: string;
  voice?: string;
  palette: PaletteEntry[];
  motifs?: string[];
  styleWords?: string[];
  styleThumbs?: string[];
  assets?: { assetId: string; kind: string }[];
  templates?: { templateId: string; category: string; world: string; required_brand_element?: string[] }[];
  rules?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

export interface Reason {
  kind: 'insight' | 'colour' | 'style' | 'product' | string;
  text: string;
}

export interface Item {
  itemId: string;
  creatorId?: string;
  templateId?: string;
  category: string;
  world?: string;
  status: ItemStatus;
  title?: string;
  description?: string;
  brief?: string;
  colors?: string[];
  public_tag?: string;
  maker: Maker;
  makerName?: string;
  creatorName?: string;
  creatorHandle?: string;
  selectionLabel?: string;
  productId?: string;
  imageUrl?: string | null;
  images?: string[];
  price: Price | null;
  stats?: { buys: number };
  why?: string;
  reasons?: Reason[]; // owner-only
  reason?: string; // not_makeable
  mine?: boolean;
  createdAt?: number;
  owner?: { why?: string };
  owner_only?: { fan_idea?: string; why?: string };
}

export interface BuyResponse {
  orderId: string;
  checkoutId?: string;
  checkoutUrl: string;
  mock: boolean;
}

export type Sort = 'new' | 'popular';

// ---------- transport ----------
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

type Opts = { method?: string; body?: unknown; auth?: 'required' | 'optional' | 'none'; query?: Record<string, string | number | undefined> };

async function call<T>(path: string, { method = 'GET', body, auth = 'none', query }: Opts = {}): Promise<T> {
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth !== 'none') {
    const token = await idToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (auth === 'required') throw new ApiError(401, 'unauthenticated', 'Please sign in first.');
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ''}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError(0, 'network', `Can't reach the server (${API_BASE}). Are the emulators running?`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(res.status, err?.code ?? 'internal', err?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

const enc = encodeURIComponent;

// ---------- endpoints (§2.4) ----------
export const api = {
  packs: () => call<{ packs: Pack[] }>('/packs'),

  attachInsights: (uid: string, pack: string, role: Role) =>
    call<Insights>(`/users/${enc(uid)}/insights`, { method: 'POST', body: { pack, role }, auth: 'required' }),
  getInsights: (uid: string) => call<Insights>(`/users/${enc(uid)}/insights`, { auth: 'required' }),

  onboard: (req: OnboardRequest) =>
    call<OnboardResponse>('/creators/onboard', { method: 'POST', body: req, auth: 'required' }),

  instagramScrape: (handle: string, max = 6) =>
    call<{ handle: string; source: string; images: ScrapedImage[] }>('/instagram/scrape', {
      method: 'POST',
      body: { handle, max },
      auth: 'required',
    }),
  instagramConnect: () => call<{ authUrl: string }>('/instagram/connect', { auth: 'required' }),
  instagramStatus: () => call<{ connected: boolean; username?: string }>('/instagram/status', { auth: 'required' }),
  instagramMedia: (limit = 24) =>
    call<{ media: InstagramMedia[] }>('/instagram/media', { auth: 'required', query: { limit } }),

  creators: (q?: string) => call<{ creators: CreatorSummary[] }>('/creators', { query: { q } }),
  creator: (id: string) => call<Creator>(`/creators/${enc(id)}`),

  suggest: (creatorId: string, count?: number) =>
    call<{ items: Item[] }>('/suggest', { method: 'POST', body: { creatorId, count }, auth: 'required' }),
  suggestions: (creatorId: string, count?: number) =>
    call<{ items: Item[] }>('/suggestions', { auth: 'required', query: { creatorId, count } }),

  marketplace: (f: { sort?: Sort; creatorId?: string; category?: string; maker?: Maker } = {}) =>
    call<{ items: Item[] }>('/marketplace', { auth: 'optional', query: f }),
  item: (itemId: string) => call<Item>(`/marketplace/${enc(itemId)}`, { auth: 'optional' }),
  buy: (itemId: string, quantity = 1) =>
    call<BuyResponse>(`/marketplace/${enc(itemId)}/buy`, { method: 'POST', body: { quantity }, auth: 'required' }),
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
