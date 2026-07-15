export interface ExcelRow {
  id: string;
  PN: string;
  ShortQty: number;
  MMO: string;
  PartName?: string; // optional part description/name
  rawShortQty?: string; // stored to preserve original text input during edits
}

export interface UploadedExcelFile {
  id: string;
  name: string;
  rows: ExcelRow[];
  pnColIndex?: number;
  qtyColIndex?: number;
  mmoColIndex?: number;
  nameColIndex?: number;
}

export interface EmailData {
  pns: string[];
  mmos: string[];
  rawPns: string;
  rawMmos: string;
  pnToMmoMap?: Record<string, string>;
}

export type MatchStatus = 'Not reported' | '1st' | '2nd' | 'Good';

export interface ComparedResult {
  id: string;
  PN: string;
  MMO: string;
  ShortQty: number;
  PartName?: string; // optional part description/name
  e: boolean; // ShortQty > 0
  m: boolean; // PN in Email
  mmoInEmail: boolean; // MMO in Email
  status: MatchStatus;
}

export interface Stats {
  total: number;
  notReported: number;
  first: number;
  second: number;
  good: number;
}
