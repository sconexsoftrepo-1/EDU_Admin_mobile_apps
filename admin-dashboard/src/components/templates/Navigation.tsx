"use client";
import Link from "next/link";
import { useTemplateNavigation } from "./useTemplateNavigation";
import {
  Menu,
  X,
  ArrowUpRight,
  Heart,
  Orbit,
  Diamond,
  Sparkles,
  ScanLine,
} from "lucide-react";
import type { TemplateId } from "@/data/experiences";
import { clinic } from "@/data/clinic";
export default function Navigation({ id }: { id: TemplateId }) {
  const { path, open, setOpen, compact, button } = useTemplateNavigation();
  const base = `/templates/${id}`;
  const Mark =
    id === "02"
      ? Orbit
      : id === "03"
        ? Heart
        : id === "04"
          ? Diamond
          : id === "05"
            ? Sparkles
            : ScanLine;
  return (
    <header className={`exp-nav exp-nav-${id} ${compact ? "nav-compact" : ""}`}>
      <Link
        href={base}
        className="exp-brand"
        aria-label="Your Dental Studio home"
      >
        <Mark size={27} />
        <span>
          {clinic.name}
          <small>
            {id === "04"
              ? "PRIVATE DENTISTRY"
              : id === "06"
                ? "DIGITAL STUDIO"
                : "DENTAL STUDIO"}
          </small>
        </span>
      </Link>
      <nav
        id={`template-menu-${id}`}
        className={open ? "exp-links open" : "exp-links"}
        aria-label="Main navigation"
      >
        {[
          ["Home", ""],
          ["About", "/about"],
          ["Treatments", "/services"],
          ["Our team", "/doctors"],
          ["Technology", "/technology"],
          ["Gallery", "/gallery"],
        ].map(([label, url]) => (
          <Link
            href={`${base}${url}`}
            key={label}
            aria-current={
              path === `${base}${url}` ||
              (url && path.startsWith(`${base}${url}/`))
                ? "page"
                : undefined
            }
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Link className="exp-button nav-cta" href={`${base}/appointments`}>
        {id === "04"
          ? "Reserve a visit"
          : id === "05"
            ? "Let’s talk smiles"
            : "Book an appointment"}
        <ArrowUpRight size={14} />
      </Link>
      <button
        ref={button}
        className="exp-menu"
        aria-controls={`template-menu-${id}`}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={21} /> : <Menu size={21} />}
      </button>
    </header>
  );
}
