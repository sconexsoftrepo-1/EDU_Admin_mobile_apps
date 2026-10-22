import type { Metadata } from "next";
import UniverseNavigation from "@/components/showcase/UniverseNavigation";
import BrandReady from "@/components/brand/BrandReady";
import WhatsAppContact from "@/components/contact/WhatsAppContact";
import { developerContact } from "@/data/developerContact";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Contact Chaitanya — KC Web Universe",
  description:
    "Discuss a website or mobile app project with Chaitanya. Write your message and continue the conversation on WhatsApp.",
};
export default function Page() {
  return (
    <main className="showroom platform-contact-page">
      <BrandReady />
      <UniverseNavigation />
      <div className="platform-contact-content">
        <span className="showroom-kicker">Your idea. A new possibility.</span>
        <h1>
          Let’s create your
          <br />
          next experience.
        </h1>
        <WhatsAppContact />
        <div className="platform-contact-alternatives">
          <a href={developerContact.emailHref}>
            Email · {developerContact.email} ↗
          </a>
          <a href={developerContact.phoneHref}>
            Call · {developerContact.phone} ↗
          </a>
          <Link href="/templates">← Explore the templates</Link>
        </div>
      </div>
    </main>
  );
}
