import Link from "next/link";
import WhatsAppContact from "@/components/contact/WhatsAppContact";
import { ArrowLeft, Check, Heart, ScanLine } from "lucide-react";
import { experiences, type TemplateId } from "@/data/experiences";
import { services, doctors } from "@/data/clinic";
import {
  Action,
  Treatments,
  About,
  Technology,
  Team,
  Journey,
  Gallery,
  Testimonials,
  FAQ,
  Booking,
  Contact,
  FamilyFeature,
  Comparison,
  Closing,
  SectionTitle,
} from "./Blocks";
import DentalViewer from "../three/DentalViewer";
const titles: Record<string, string> = {
  about: "A different kind of care.",
  services: "Find your kind of care.",
  doctors: "People behind the practice.",
  technology: "A clearer perspective.",
  gallery: "Step inside the experience.",
  reviews: "The experience we imagine.",
  appointments: "A little time for you.",
  contact: "A conversation starts here.",
};
const pageCopy: Record<string, string> = {
  about:
    "Your story matters. Explore a place for personal attention, thoughtful conversations, and care that fits your life.",
  services:
    "From everyday prevention to new beginnings. Explore the options and find a thoughtful next step.",
  doctors:
    "Expertise is only the beginning. Meet the fictional people behind this demonstration practice.",
  technology:
    "Understand what digital tools can bring to the conversation. These are illustrative technologies, rather than claims about a real clinic.",
  gallery:
    "A collection of generated illustrative environments and moments. Tap an image to take a closer look.",
  reviews:
    "Explore sample feedback that illustrates the tone of the experience. These are fictional examples, not genuine patient reviews.",
  appointments:
    "Share your preferences and explore our booking demonstration. No information is sent to a real clinic.",
  contact:
    "Make room for your questions. These editable contact details are part of a fictional clinic demonstration.",
};
const customTitles: Record<TemplateId, Partial<Record<string, string>>> = {
  "02": {
    about: "Beyond the surface.",
    technology: "A closer look. A new dimension.",
    appointments: "Your next chapter. In focus.",
  },
  "03": {
    about: "A place for your whole family.",
    services: "Little teeth. Big possibilities.",
    doctors: "A friendly face for every visit.",
    appointments: "Let’s find a time for your family.",
  },
  "04": {
    about: "The details make the difference.",
    services: "Disciplines, precisely considered.",
    doctors: "Expertise, with a personal signature.",
    appointments: "Your private consultation.",
  },
  "05": {
    about: "Confidence, in your own way.",
    services: "The smile edit.",
    gallery: "A little inspiration.",
    appointments: "Let’s write your smile story.",
  },
  "06": {
    about: "Human care. Connected thinking.",
    services: "Your care, connected.",
    technology: "Understand more. Plan with clarity.",
    appointments: "Take the next step.",
  },
};
export default function InternalPage({
  id,
  slug,
}: {
  id: TemplateId;
  slug: string[];
}) {
  const page = slug[0];
  const service =
    page === "services" ? services.find((s) => s.slug === slug[1]) : undefined;
  const doctor =
    page === "doctors" ? doctors.find((d) => d.slug === slug[1]) : undefined;
  const title =
    service?.name || doctor?.name || customTitles[id][page] || titles[page];
  return (
    <>
      <section className={`exp-inner-hero inner-${id} inner-${page}`}>
        <div className="exp-breadcrumb">
          <Link href={`/templates/${id}`}>
            <ArrowLeft size={13} />
            Home
          </Link>
          <span>/</span>
          {slug[1] ? (
            <Link href={`/templates/${id}/${page}`}>
              {page === "services" ? "Treatments" : "Our team"}
            </Link>
          ) : (
            <span>{page === "reviews" ? "Sample feedback" : page}</span>
          )}
        </div>
        <div className="inner-title-group">
          <span className="exp-label">{experiences[id].descriptor}</span>
          <h1>{title}</h1>
          <p>
            {service?.detail ||
              (doctor &&
                `${doctor.role}. A fictional demonstration profile, ready to be replaced with your team’s approved story and credentials.`) ||
              pageCopy[page]}
          </p>
        </div>
        <div className="inner-hero-motif" aria-hidden="true">
          {id === "03" ? (
            <Heart size={120} strokeWidth={0.5} />
          ) : id === "06" ? (
            <ScanLine size={140} strokeWidth={0.4} />
          ) : (
            <span />
          )}
        </div>
      </section>
      {page === "services" &&
        (!service ? (
          <>
            <Treatments id={id} searchable />
            <Journey id={id} />
            <FAQ id={id} />
            <Booking id={id} />
          </>
        ) : (
          <>
            <section className={`exp-section treatment-detail detail-${id}`}>
              <div>
                <span className="exp-label">Made personal</span>
                <h2>A considered approach to {service.name.toLowerCase()}.</h2>
                <p>{service.detail}</p>
                <ul>
                  {[
                    "An individual consultation and assessment",
                    "A clear explanation of options and alternatives",
                    "An agreed plan, with space for your questions",
                    "Personal guidance and ongoing care",
                  ].map((t) => (
                    <li key={t}>
                      <Check size={15} />
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="clinical-note">
                  This is general demonstration content. A qualified dentist
                  will assess suitability, explain risks and alternatives, and
                  provide a personal treatment plan.
                </p>
                <Action id={id}>Discuss this treatment</Action>
              </div>
              <DentalViewer id={id} assemblyStory={id === "02"} />
            </section>
            <Journey id={id} />
            <FAQ id={id} />
            <Booking id={id} />
          </>
        ))}
      {page === "doctors" &&
        (!doctor ? (
          <>
            <Team id={id} />
            <About id={id} />
            <Booking id={id} />
          </>
        ) : (
          <>
            <section className={`exp-section exp-profile profile-${id}`}>
              <div
                className="profile-photo"
                style={{
                  backgroundPosition: `${doctors.indexOf(doctor) * 50}% 12%`,
                }}
                role="img"
                aria-label={`Generated illustrative portrait for fictional ${doctor.name}`}
              >
                <span>Fictional demo profile</span>
              </div>
              <div>
                <span className="exp-label">{doctor.role}</span>
                <h2>
                  Time to listen.
                  <br />
                  Care to understand.
                </h2>
                <p>
                  A thoughtful approach starts with understanding the person
                  behind the smile. This demonstration profile is designed to
                  share a dentist’s philosophy, areas of interest, and personal
                  approach.
                </p>
                <p>
                  Replace this fictional identity with a real team member’s
                  approved biography, verified qualifications, professional
                  registration, and portrait before use by an actual clinic.
                </p>
                <Action id={id}>Arrange a consultation</Action>
              </div>
            </section>
            <FAQ id={id} />
          </>
        ))}
      {page === "about" && (
        <>
          <About id={id} />
          {id === "03" ? <FamilyFeature /> : <Journey id={id} />}
          <Team id={id} />
          <Gallery id={id} />
          <FAQ id={id} />
          <Booking id={id} />
        </>
      )}
      {page === "technology" && (
        <>
          <Technology id={id} />
          <section className="exp-section tech-explanation">
            <SectionTitle
              label="Tools that support the conversation"
              title="A clearer picture. A more personal plan."
            />
            <div className="tech-explanation-grid">
              {[
                [
                  "See",
                  "Digital imaging can help a dentist understand the details of a smile and explain findings.",
                ],
                [
                  "Understand",
                  "Three-dimensional views can support a clearer conversation about options and alternatives.",
                ],
                [
                  "Plan",
                  "The right tools can help inform an individual approach, alongside a clinical assessment.",
                ],
              ].map(([title, copy]) => (
                <article key={title}>
                  <ScanLine size={25} />
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
            <p className="clinical-note">
              Technologies shown are educational illustrations. Equipment
              availability, radiation exposure where applicable, and clinical
              suitability must be confirmed with an actual clinic.
            </p>
          </section>
          <Journey id={id} />
          <FAQ id={id} />
        </>
      )}
      {page === "gallery" && (
        <>
          <Gallery id={id} />
          <About id={id} />
        </>
      )}
      {page === "reviews" && (
        <>
          <Testimonials id={id} />
          <Comparison id={id} />
          <FAQ id={id} />
        </>
      )}
      {page === "appointments" && (
        <>
          <Booking id={id} />
          <FAQ id={id} />
          <Contact id={id} />
        </>
      )}
      {page === "contact" && (
        <>
          <Contact id={id} />
          <div className="clinic-whatsapp-contact">
            <WhatsAppContact context={`dental website Template ${id}`} />
          </div>
          <section className="exp-section contact-location">
            <div className="location-illustration">
              <MapMarker />
              <span>Your clinic location</span>
              <small>
                Add your address and map integration when customizing.
              </small>
            </div>
            <div>
              <SectionTitle
                label="A warm welcome"
                title={
                  id === "03"
                    ? "Find your way to a friendly hello."
                    : "A little space for your questions."
                }
              />
              <p>
                Your real contact details, accessibility information, parking
                guidance, and opening hours can be added to the central clinic
                data.
              </p>
              <Action id={id}>Plan your visit</Action>
            </div>
          </section>
          <Booking id={id} />
        </>
      )}
      <Closing id={id} />
    </>
  );
}
function MapMarker() {
  return (
    <svg viewBox="0 0 150 150" width="140" height="140" aria-hidden="true">
      <path
        d="M5 45L145 105M5 95L145 35M40 5L115 145M95 5L35 145"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity=".2"
      />
      <path
        d="M75 27c-20 0-33 14-33 32 0 24 33 54 33 54s33-30 33-54c0-18-13-32-33-32z"
        fill="currentColor"
        opacity=".8"
      />
      <circle cx="75" cy="59" r="10" fill="var(--exp-bg)" />
    </svg>
  );
}
