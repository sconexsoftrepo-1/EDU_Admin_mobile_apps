"use client";
import { useId, useState } from "react";
import { enquiryMessage, whatsappDisplay } from "@/lib/whatsapp";
import WhatsAppLink from "./WhatsAppLink";
export default function WhatsAppContact({
  context = "a website or mobile app project",
  compact = false,
}: {
  context?: string;
  compact?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState({ name: "", email: "", message: "" });
  return (
    <section
      className={`whatsapp-contact ${compact ? "is-compact" : ""}`}
      aria-label="WhatsApp enquiry"
    >
      <div>
        <span className="whatsapp-kicker">Let’s start a conversation</span>
        <h2>
          Talk to Chaitanya
          <br />
          on WhatsApp.
        </h2>
        <p>
          Tell me about your idea. Your message will be ready to review in
          WhatsApp at <strong>{whatsappDisplay}</strong>.
        </p>
      </div>
      <div className="whatsapp-compose">
        <label htmlFor={`${id}-name`}>Your name (optional)</label>
        <input
          id={`${id}-name`}
          autoComplete="name"
          maxLength={100}
          value={draft.name}
          onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))}
        />
        <label htmlFor={`${id}-email`}>Email address (optional)</label>
        <input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          maxLength={200}
          value={draft.email}
          onChange={(e) => setDraft((v) => ({ ...v, email: e.target.value }))}
        />
        <label htmlFor={`${id}-message`}>Your WhatsApp message</label>
        <textarea
          id={`${id}-message`}
          rows={4}
          maxLength={2000}
          placeholder="I’d like a website for…"
          value={draft.message}
          onChange={(e) => setDraft((v) => ({ ...v, message: e.target.value }))}
        />
        <WhatsAppLink
          message={enquiryMessage(context, draft)}
          label="Continue in WhatsApp"
        />
        <small>
          Opens WhatsApp with your text prefilled. You choose when to send it.
        </small>
      </div>
    </section>
  );
}
