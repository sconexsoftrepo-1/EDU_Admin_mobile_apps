/** Private documents, certificate issue/verification and PDF downloads (backend: documents). */

/** Kinds accepted by POST documents/upload. */
export const UPLOAD_KINDS = [
  "form_16",
  "form_16a",
  "employee_document",
  "student_document",
  "admission_document",
] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

/** POST documents/upload (file content base64, at most ~650 KB of file data). */
export interface UploadPayload {
  kind: UploadKind;
  person_code: string;
  filename: string;
  content_base64: string;
  /** Tax documents (form_16, form_16a). */
  financial_year?: string;
  /** Admission documents. */
  document_type_code?: string;
  /** Student/employee documents: what the file is (aadhaar_copy, student_photo, ...). */
  document_label?: string;
}

/** Download kinds: GET documents/{kind}/{code}/download. */
export type DownloadKind =
  | "payslip"
  | "tax-document"
  | "certificate"
  | "receipt"
  | "admission-document"
  | "document";

/** Table name -> download kind, for the Download button on record screens. */
export const DOWNLOAD_KIND_BY_TABLE: Record<string, DownloadKind> = {
  payslips: "payslip",
  employee_tax_documents: "tax-document",
  certificates: "certificate",
  receipts: "receipt",
  admission_documents: "admission-document",
  documents: "document",
};

export interface IssueCertificatePayload {
  request_code: string;
}

export interface Certificate {
  code: string;
  request_code: string;
  certificate_number: string;
  issued_on: string;
  issued_by_code: string;
  document_url: string;
  revoked_on: string | null;
}

/** GET documents/certificates/verify/{token} (public). */
export interface CertificateVerification {
  certificate_number: string;
  valid: boolean;
  issued_on: string;
  signer_type: string;
  revoked: boolean;
}
