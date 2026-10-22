"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
export function useTemplateNavigation() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const scroll = () => setCompact(scrollY > 45);
    scroll();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("keydown", key);
    return () => {
      removeEventListener("scroll", scroll);
      removeEventListener("keydown", key);
    };
  }, []);
  return { path, open, setOpen, compact, button };
}
