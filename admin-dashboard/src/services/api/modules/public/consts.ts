/** Public website intake: admission applications and visit/contact requests (no sign-in). */

export interface IntakeOption {
  code: string;
  name: string;
}

/** GET public/options. */
export interface PublicOptions {
  programs: IntakeOption[];
  sources: IntakeOption[];
}

/** POST public/applications. */
export interface ApplicationPayload {
  name: string;
  email: string;
  guardian: string;
  contact: string;
  program: string;
  source: string;
  scholarship?: string;
  documents?: string;
  consent: boolean;
}

/** POST public/contact. */
export interface ContactPayload {
  name: string;
  email: string;
  visit_date?: string;
  message: string;
}

export interface IntakeReceipt {
  reference: string;
  [key: string]: unknown;
}

export type IntakeKind = "applications" | "contact";
