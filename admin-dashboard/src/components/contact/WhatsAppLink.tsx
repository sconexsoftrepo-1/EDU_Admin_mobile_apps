import { MessageCircle, ArrowUpRight } from "lucide-react";
import { whatsappUrl } from "@/lib/whatsapp";
export default function WhatsAppLink({
  message,
  label = "Chat on WhatsApp",
  className = "",
}: {
  message?: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      className={`whatsapp-link ${className}`}
      href={whatsappUrl(message)}
      target="_blank"
      rel="noreferrer"
    >
      <MessageCircle size={18} />
      <span>{label}</span>
      <ArrowUpRight size={15} />
    </a>
  );
}
