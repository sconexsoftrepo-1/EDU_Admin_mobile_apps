import type { College } from "@/data/colleges";
import type { InstitutionDetails } from "./fees";
export type PDFContext = {
  college?: College;
  institution?: InstitutionDetails;
  reference?: string;
  preparedBy?: string;
  filters?: string;
};
export type PDFSection = {
  image?: string;
  title: string;
  fields?: [string, string][];
  columns?: string[];
  rows?: string[][];
  paragraphs?: string[];
};
export type PDFReport = {
  title: string;
  context?: PDFContext;
  sections: PDFSection[];
  verification?: string;
  landscape?: boolean;
};
