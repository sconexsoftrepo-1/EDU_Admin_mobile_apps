import { brandConfig } from "@/components/brand/config/brandConfig";
/** A deep link only. The visitor reviews and sends the message in WhatsApp. */
export const whatsappNumber = brandConfig.phoneHref.replace(/\D/g, "");
export const whatsappDisplay = "+91 83670 48538";
export function whatsappUrl(
  message = "Hi Chaitanya, I’d like to discuss a website or mobile app project.",
) {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message.trim())}`;
}
export function enquiryMessage(
  context: string,
  draft: { name?: string; email?: string; message?: string },
) {
  return [
    `Hi Chaitanya,`,
    `I’m contacting you about ${context}.`,
    draft.name?.trim() ? `Name: ${draft.name.trim()}` : "",
    draft.email?.trim() ? `Email: ${draft.email.trim()}` : "",
    draft.message?.trim() ? `\n${draft.message.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
