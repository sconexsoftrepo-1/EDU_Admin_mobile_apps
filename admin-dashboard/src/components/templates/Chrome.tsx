import Link from "next/link";
import WhatsAppLink from "@/components/contact/WhatsAppLink";
import {
  Heart,
  Diamond,
  Orbit,
  Sparkles,
  ScanLine,
  ArrowUpRight,
} from "lucide-react";
import Navigation from "./Navigation";
import Lifecycle from "./Lifecycle";
import { clinic } from "@/data/clinic";
import { experiences, type TemplateId } from "@/data/experiences";
export default function Chrome({
  id,
  children,
}: {
  id: TemplateId;
  children: React.ReactNode;
}) {
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
    <div className={`experience theme-${id}`}>
      <div className="exp-demo-strip">
        <Link href="/">
          Web Universe / {id} — {experiences[id].label}
        </Link>
        <span>Fictional clinic demonstration</span>
      </div>
      <Navigation id={id} />
      <Lifecycle id={id} />
      <main>{children}</main>
      <footer className={`exp-footer footer-${id}`}>
        <div className="exp-footer-brand">
          <Mark size={31} />
          <h2>
            {clinic.name}
            <small>{id === "04" ? "PRIVATE DENTISTRY" : "DENTAL STUDIO"}</small>
          </h2>
          <p>{experiences[id].closing}</p>
        </div>
        <div className="exp-footer-links">
          <div>
            <span>Explore the studio</span>
            {[
              ["Our story", "about"],
              ["Treatments", "services"],
              ["The team", "doctors"],
              ["Technology", "technology"],
            ].map(([label, to]) => (
              <Link key={to} href={`${base}/${to}`}>
                {label}
              </Link>
            ))}
          </div>
          <div>
            <span>A little more clarity</span>
            {[
              ["Gallery", "gallery"],
              ["Sample feedback", "reviews"],
              ["Book a visit", "appointments"],
              ["Contact", "contact"],
            ].map(([label, to]) => (
              <Link key={to} href={`${base}/${to}`}>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="exp-footer-invite">
          <span>
            {id === "04"
              ? "An invitation, just for you."
              : id === "03"
                ? "There’s room for every smile."
                : "Start your next chapter."}
          </span>
          <Link href={`${base}/appointments`}>
            {id === "05" ? "Let’s talk smiles" : "Make a little time for you"}
            <ArrowUpRight size={20} />
          </Link>
        </div>
        <div className="hotel-footer-whatsapp">
          <span>Discuss this website with Chaitanya</span>
          <WhatsAppLink
            message={`Hi Chaitanya, I’m interested in dental website Template ${id}.`}
          />
        </div>
        <div className="exp-footer-bottom">
          <span>
            © {new Date().getFullYear()} Your Dental. Web Universe
            demonstration.
          </span>
          <span>Fictional profiles, generated imagery & sample feedback.</span>
          <Link href="/">
            Explore all six templates
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </footer>
      <div className="exp-mobile-book">
        <Link href={`${base}/appointments`}>
          {id === "04" ? "Reserve a consultation" : "Book an appointment"}
          <ArrowUpRight size={17} />
        </Link>
      </div>
    </div>
  );
}
