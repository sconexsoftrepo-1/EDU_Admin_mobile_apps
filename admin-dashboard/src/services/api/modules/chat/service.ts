/** Chats (backend: app/core/chat_workspace.py). */
import { apiRequest, fileToBase64 } from "../../client";
import { apiUrl } from "../../config";

export interface Conversation {
  code: string;
  kind: "direct" | "group";
  title: string;
  subtitle: string;
  role: string;
  members: number;
  can_post: boolean;
  last_message: string;
  last_sender: string;
  last_mine: boolean;
  last_at?: string | null;
  unread: number;
  people?: Contact[];
}

export interface Attachment {
  code: string;
  name?: string | null;
  mime?: string | null;
  size?: number | null;
  duration_ms?: number | null;
}

export interface ChatMessage {
  code: string;
  body: string;
  kind: "text" | "image" | "pdf" | "audio";
  sent_at: string;
  mine: boolean;
  sender_code: string;
  sender_name: string;
  sender_role: string;
  attachment: Attachment | null;
  client_id?: string | null;
  status?: "delivered" | "read" | null;
  /** Client-side only while sending. */
  pending?: boolean;
  failed?: boolean;
  localUrl?: string;
}

export interface Contact {
  code: string;
  name: string;
  role: string;
  detail: string;
  admission_number?: string | null;
  parents?: {
    code: string | null;
    name: string;
    relationship: string;
    phone?: string | null;
    can_chat: boolean;
  }[];
}

export interface GroupOptions {
  can_create_groups: boolean;
  course_levels: string[];
  programs: {
    code: string;
    name: string;
    branch?: string | null;
    course_level?: string | null;
  }[];
  academic_years: {
    code: string;
    name: string;
    program_code?: string | null;
  }[];
  sections: {
    code: string;
    name: string;
    label: string;
    course_level?: string | null;
    program_code?: string | null;
    academic_year_code?: string | null;
  }[];
}

export interface GroupInput {
  title?: string;
  course_level?: string;
  program_code?: string;
  academic_year_code?: string;
  section_code?: string;
  audience: "students" | "parents" | "both";
  include_teachers: boolean;
  allow_replies: boolean;
}

const conv = (code: string) => `chat/conversations/${encodeURIComponent(code)}`;
const uploads = "academics/assignment-workspace/files";

export const chatService = {
  conversations: () =>
    apiRequest<{
      items: Conversation[];
      unread: number;
      can_create_groups: boolean;
    }>("chat/conversations"),
  unread: () => apiRequest<{ unread: number }>("chat/unread"),
  conversation: (code: string) => apiRequest<Conversation>(conv(code)),
  messages: (code: string, query: { after?: string; before?: string } = {}) =>
    apiRequest<{ items: ChatMessage[]; has_more: boolean }>(
      `${conv(code)}/messages`,
      { query },
    ),
  send: (
    code: string,
    body: {
      body?: string;
      attachment_code?: string;
      duration_ms?: number;
      client_id: string;
    },
  ) =>
    apiRequest<ChatMessage>(`${conv(code)}/messages`, {
      method: "POST",
      body,
    }),
  direct: (account: string) =>
    apiRequest<Conversation>("chat/direct", {
      method: "POST",
      body: { recipient_user_code: account },
    }),
  group: (body: GroupInput) =>
    apiRequest<Conversation>("chat/groups", { method: "POST", body }),
  directory: (query: { q?: string; role?: string; section_code?: string }) =>
    apiRequest<{ items: Contact[]; side: string; everyone: boolean }>(
      "chat/directory",
      { query },
    ),
  options: () => apiRequest<GroupOptions>("chat/options"),
  /** Browser URL of an attachment (the proxy adds the session). */
  fileUrl: (code: string) =>
    apiUrl(`chat/attachments/${encodeURIComponent(code)}`),
  /** Chunked upload for conversation `thread`; returns the attachment code. */
  async upload(thread: string, file: File): Promise<string> {
    if (!file.size || file.size > 10 * 1024 * 1024)
      throw new Error("Choose files up to 10 MB.");
    const started = await apiRequest<{ code: string; chunk_size: number }>(
      `${uploads}/start`,
      {
        method: "POST",
        body: {
          filename: file.name,
          size_bytes: file.size,
          chat_thread_code: thread,
        },
      },
    );
    for (
      let offset = 0, index = 0;
      offset < file.size;
      offset += started.chunk_size, index++
    ) {
      const part = new File(
        [file.slice(offset, offset + started.chunk_size)],
        file.name,
      );
      await apiRequest(`${uploads}/${started.code}/chunk`, {
        method: "POST",
        body: { index, content_base64: await fileToBase64(part) },
      });
    }
    await apiRequest(`${uploads}/${started.code}/finish`, { method: "POST" });
    return started.code;
  },
};
