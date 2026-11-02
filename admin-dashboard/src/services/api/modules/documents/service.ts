/** Document endpoints (backend: app/modules/documents). */
import { apiDownload, apiRequest } from "../../client";
import { apiUrl } from "../../config";
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

  remove(kind: string, code: string) {
    return apiRequest(`documents/${kind}/${encodeURIComponent(code)}/file`, {
      method: "DELETE",
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

  /** View a private PDF in the in-app preview ("view") or save it ("download"). */
  async open(
    kind: DownloadKind | string,
    code: string,
    filename = `${code}.pdf`,
    mode: "view" | "download" = "download",
  ) {
    if (mode === "download") return this.download(kind, code, filename);
    return this.openPath(
      DOCUMENT_ENDPOINTS.download(kind, code),
      filename,
      mode,
    );
  }

  /** View or save any PDF endpoint (e.g. finance/ledger/pdf?period=month). */
  async openPath(
    path: string,
    filename: string,
    mode: "view" | "download" = "download",
  ) {
    if (mode === "download") return apiDownload(path, filename);
    const response = await fetch(apiUrl(path), { cache: "no-store" });
    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      throw new Error(
        (body && typeof body.detail === "string" && body.detail) ||
          "The PDF could not be opened. Please retry.",
      );
    }
    const blob = await response.blob();
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    window.dispatchEvent(
      new CustomEvent("college:pdf-preview", {
        detail: { name: filename.replace(/\.pdf$/, ""), blob, trigger },
      }),
    );
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
