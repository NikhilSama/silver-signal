declare module 'pdf-parse' {
  interface PDFInfo {
    total: number;
    info: {
      PDFFormatVersion: string;
      Language: string | null;
      EncryptFilterName: string | null;
      IsLinearized: boolean;
      IsAcroFormPresent: boolean;
      IsXFAPresent: boolean;
      IsCollectionPresent: boolean;
      IsSignaturesPresent: boolean;
    };
    metadata: unknown;
    fingerprints: [string, string | null];
    permission: unknown;
    outline: unknown;
    pages: unknown[];
  }

  interface PDFTextResult {
    pages: Array<{ text: string; num: number }>;
    text: string;
    total: number;
  }

  export class PDFParse {
    constructor(data: Uint8Array);
    load(): Promise<void>;
    destroy(): Promise<void>;
    getInfo(): Promise<PDFInfo>;
    getText(): Promise<PDFTextResult>;
    getPageText(pageNum: number): Promise<unknown>;
    getPageTables(pageNum: number): Promise<unknown>;
  }
}
