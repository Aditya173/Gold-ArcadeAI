// S3 -> S4 hand-off: the onboard request S3 built and the local thumbnails for each image row.
// S4 makes the POST /creators/onboard call so it can show every row as "uploading" during it (brief S4).
import type { ImageKind, OnboardRequest } from '../../services/api';

export interface DraftRow {
  kind: ImageKind;
  uri?: string | null;
}

export interface Draft {
  req: OnboardRequest;
  rows: DraftRow[]; // same order as the images the backend registers (uploads, then instagramMediaIds)
  shopName: string;
}

let draft: Draft | null = null;
export const setDraft = (d: Draft) => {
  draft = d;
};
export const getDraft = () => draft;
