"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";

export default function HeadingBack({
  href,
  label,
  screen,
}: {
  href: string;
  label: string;
  screen: string;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const content = document.getElementById("erp-content");
    if (!content) return;

    const slot = document.createElement("span");
    slot.className = "erp-back-host";
    let heading: HTMLElement | undefined;
    let titleLabel: string | undefined;
    let active = true;

    function detach() {
      if (titleLabel && heading?.getAttribute("aria-label") === titleLabel)
        heading.removeAttribute("aria-label");
      slot.remove();
      titleLabel = undefined;
    }

    const findTitle = (tag: "h1" | "h2") =>
      Array.from(content.querySelectorAll<HTMLElement>(tag)).find(
        (title) =>
          !title.closest('dialog, [role="dialog"], [aria-hidden="true"]') &&
          title.getClientRects().length > 0,
      );

    function place() {
      if (!active) return;
      // Staff screens hide their generic h1, and some older screens use an h2.
      const next = findTitle("h1") ?? findTitle("h2");
      if (next !== heading) {
        detach();
        heading = next;
      }
      if (!heading) return;
      if (slot.parentElement !== heading) {
        heading.prepend(slot);
        setHost(slot);
      }

      // Keep the title and the icon-only link independently named for screen readers.
      const existingLabel = heading.getAttribute("aria-label");
      if (
        (!existingLabel || existingLabel === titleLabel) &&
        !heading.hasAttribute("aria-labelledby")
      ) {
        titleLabel = heading.textContent.trim();
        if (titleLabel && titleLabel !== existingLabel)
          heading.setAttribute("aria-label", titleLabel);
      }
    }

    const observer = new MutationObserver(place);
    observer.observe(content, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    queueMicrotask(place);
    return () => {
      active = false;
      observer.disconnect();
      detach();
    };
  }, [screen]);

  if (!host) return null;
  return createPortal(
    <Link
      href={href}
      className="erp-back"
      aria-label={`Back to ${label}`}
      title={`Back to ${label}`}
    >
      <ArrowLeft size={20} strokeWidth={3} aria-hidden="true" />
    </Link>,
    host,
  );
}
