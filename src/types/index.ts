export type DocumentStatus = "PROCESSING" | "READY" | "ERROR";
export type ExtractionFieldType = "text" | "date" | "number" | "boolean" | "email" | "phone";

export interface DocumentData {
  fileName: string;
  fileType: string;
  fileSize: number;
  pageCount: number;
  textContent: string;
}

export interface ExtractionField {
  id: string;
  label: string;
  type: ExtractionFieldType;
  value: string;
  confidence: number;
}

export interface AdminSession {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
}
