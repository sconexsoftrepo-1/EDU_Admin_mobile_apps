/** Document endpoints (backend: app/modules/documents). */
import { apiDownload, apiRequest } from "../../client";
import type { Row } from "../../consts";
import type {
  Certificate,
  CertificateVerification,
  DownloadKind,
  IssueCertificatePayload,
  UploadPayload,
} from "./consts";

export const DOCUMENT_ENDPOINTS = {
  upload: "documents/upload",
  download: (kind: DownloadKind | string, code: string) =>
    `documents/${kind}/${encodeURIComponent(code)}/download`,
  issueCertificate: "documents/certificates/issue",
  verifyCertificate: (token: string) =>
    `documents/certificates/verify/${encodeURIComponent(token)}`,
} as const;

export class DocumentService {
  upload(payload: UploadPayload) {
    return apiRequest<Row>(DOCUMENT_ENDPOINTS.upload, {
      method: "POST",
      body: payload,
    });
  }

  /** Save a private PDF (payslip, receipt, certificate, ...) in the browser. */
  download(
    kind: DownloadKind | string,
    code: string,
    filename = `${code}.pdf`,
  ) {
    return apiDownload(DOCUMENT_ENDPOINTS.download(kind, code), filename);
  }

  /** Authorize and issue the certificate for a pending request. */
  issueCertificate(payload: IssueCertificatePayload) {
    return apiRequest<Certificate>(DOCUMENT_ENDPOINTS.issueCertificate, {
      method: "POST",
      body: payload,
    });
  }

  /** Public verification of a certificate link. */
  verifyCertificate(token: string) {
    return apiRequest<CertificateVerification>(
      DOCUMENT_ENDPOINTS.verifyCertificate(token),
    );
  }
}

export const documentService = new DocumentService();
