import { apiDownload, apiRequest } from "../client";

export type CertificateTemplate = { code: string; name: string; description: string; paper_size?: string };
export type CertificateRow = Record<string, any> & { code: string; status: string };
export type CertificateOptions = { templates: CertificateTemplate[]; courses: any[]; academic_years: any[]; students: any[] };
export const certificates = {
  options: (query: {course_level?: string; program_code?: string; academic_year_code?: string} = {}) => apiRequest<CertificateOptions>("certificates/workspace/options", {query}),
  list: (studentCode?: string) => apiRequest<{items: CertificateRow[]; certificates: CertificateRow[]; can_review: boolean}>(`certificates/workspace${studentCode ? `?student_code=${encodeURIComponent(studentCode)}` : ""}`),
  request: (template_code: string, student_code?: string, reason = "") => apiRequest<CertificateRow>("certificates/workspace/requests", {method:"POST", body:{template_code, student_code, reason}}),
  approve: (code: string) => apiRequest<CertificateRow>(`certificates/workspace/requests/${encodeURIComponent(code)}/approve`, {method:"POST", body:{}}),
  reject: (code: string, message = "") => apiRequest<CertificateRow>(`certificates/workspace/requests/${encodeURIComponent(code)}/reject`, {method:"POST", body:{message}}),
  issue: (student_code: string, template_code: string, program_code: string, academic_year_code: string) => apiRequest<CertificateRow>("certificates/workspace/issue", {method:"POST", body:{student_code, template_code, program_code, academic_year_code}}),
  download: (code: string) => apiDownload(`documents/certificate/${encodeURIComponent(code)}/download`, `certificate-${code}.pdf`),
};
