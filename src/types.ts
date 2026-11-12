export type Shelf = 'collection' | 'wishlist';
export type CoverKind = 'caa' | 'photo' | 'none';
export type SortKey = 'artist' | 'title' | 'year' | 'added';
export type ViewMode = 'grid' | 'list';
export type ThemeName = 'dark' | 'light';
export type TabId = 'collection' | 'wishlist' | 'add' | 'settings';

export interface SleeveRecord {
  id: string;
  list: Shelf;
  artist: string;
  title: string;
  year: number | null;
  label: string;
  format: string;
  notes: string;
  rgid: string | null;
  cover: Blob | null;
  coverKind: CoverKind;
  addedAt: number;
  updatedAt: number;
}

export interface RankedAlbum {
  rgid: string;
  artist: string;
  title: string;
  sim: number;
  text: number;
  score: number;
  src: string;
}

export interface IdentifyResult {
  fast: boolean;
  confident: boolean;
  cropFound: boolean;
  clip: boolean;
  phrases: { text: string; score: number }[];
  ranked: RankedAlbum[];
  timing: Record<string, number>;
  barcode: string | null;
  mbQueries: number;
}

export interface DraftCandidate {
  rgid: string | null;
  artist: string;
  title: string;
  year: number | null;
  label: string;
  sim: number | null;
  score: number | null;
}

export interface Draft {
  photoBlob: Blob | null;
  photoUrl: string | null;
  usePhoto: boolean;
  list: Shelf;
  selected: number;
  candidates: DraftCandidate[];
  confident: boolean;
  fast: boolean;
  clip: boolean;
  status: string;
}

export interface BackupFile {
  sleeve: 1;
  exportedAt: string;
  records: Array<Omit<SleeveRecord, 'cover'> & { cover: string | null }>;
}
