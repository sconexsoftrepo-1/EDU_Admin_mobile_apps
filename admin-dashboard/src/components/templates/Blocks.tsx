import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Heart,
  ScanLine,
  Sparkles,
  MapPin,
  Clock,
  Mail,
  Check,
  Diamond,
} from "lucide-react";
import { experiences, journey, type TemplateId } from "@/data/experiences";
import { services, doctors, clinic } from "@/data/clinic";
import BookingForm from "../BookingForm";
import SmileStudy from "../SmileStudy";
import GalleryGrid from "./GalleryGrid";
import TreatmentFilter from "./TreatmentFilter";
import DentalViewer from "../three/DentalViewer";
import {
  FamilyCare,
  Questions,
  Feedback,
  DigitalTimeline,
} from "./Interactive";
export function Action({
  id,
  children = "Book an appointment",
  to = "appointments",
  secondary = false,
}: {
  id: TemplateId;
  children?: React.ReactNode;
  to?: string;
  secondary?: boolean;
}) {
  return (
    <Link
      className={`exp-button ${secondary ? "secondary" : ""}`}
      href={`/templates/${id}/${to}`}
    >
      {children}
      <ArrowUpRight size={16} />
    </Link>
  );
}
export function SectionTitle({
  label,
  title,
  text,
}: {
  label?: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="exp-section-title">
      {label && <span className="exp-label">{label}</span>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}
export function Pillars({ id }: { id: TemplateId }) {
  const icons = [ShieldCheck, Heart, ScanLine, Sparkles];
  return (
    <div className={`exp-pillars pillars-${id}`}>
      {experiences[id].specialties.map((t, i) => {
        const Icon = icons[i];
        return (
          <div key={t}>
            <Icon size={23} strokeWidth={1.4} />
            <span>{t}</span>
          </div>
        );
      })}
    </div>
  );
}
export function Treatments({
  id,
  searchable = false,
}: {
  id: TemplateId;
  searchable?: boolean;
}) {
  const data = experiences[id];
  return (
    <section
      className={`exp-section exp-treatments treatments-${id} scroll-reveal`}
      id="treatments"
    >
      <SectionTitle
        label={id === "04" ? "Our disciplines" : "Thoughtfully considered care"}
        title={data.serviceTitle}
        text={
          id === "05"
            ? "Explore a few ways to feel more like yourself."
            : "A personal approach to the everyday and the extraordinary."
        }
      />
      <TreatmentFilter
        labels={services.map((s) => s.name)}
        searchable={searchable}
      >
        {services.map((s, i) => (
          <Link
            className="exp-service"
            href={`/templates/${id}/services/${s.slug}`}
            key={s.slug}
          >
            {id === "04" && <span className="service-index">0{i + 1}</span>}
            <div className={`exp-service-art service-art-${i % 4}`}>
              <div className={`dental-art art-${i % 4}`}>
                {i % 4 === 1 ? (
                  <div className="braces-art">
                    {Array.from({ length: 5 }, (_, n) => (
                      <span key={n}>
                        <i />
                      </span>
                    ))}
                    <b />
                  </div>
                ) : (
                  <>
                    <div className="little-tooth" />
                    {i % 4 === 0 ? (
                      <div className="implant-screw" />
                    ) : i % 4 === 2 ? (
                      <Sparkles className="art-spark" size={30} />
                    ) : (
                      <>
                        <div className="little-tooth small" />
                        <Heart className="art-heart" size={26} />
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="exp-service-body">
              <h3>{s.name}</h3>
              <p>{s.text}</p>
              <span>
                {id === "04" ? "Discover the discipline" : "Explore treatment"}
                <ArrowUpRight size={17} />
              </span>
            </div>
          </Link>
        ))}
      </TreatmentFilter>
    </section>
  );
}
export function About({ id }: { id: TemplateId }) {
  return (
    <section className={`exp-section exp-about about-${id} scroll-reveal`}>
      <div className="about-image">
        <Image
          src="/assets/templates/interior.webp"
          alt="Generated illustrative contemporary dental clinic interior"
          fill
          sizes="(max-width:700px) 100vw, 45vw"
        />
        <span>Illustrative clinic environment</span>
      </div>
      <div className="about-text">
        <SectionTitle
          label={
            id === "04"
              ? "A quieter kind of excellence"
              : "A space to feel understood"
          }
          title={
            id === "03"
              ? "A modern clinic. A familiar feeling."
              : id === "05"
                ? "Confidence looks different on everyone."
                : id === "06"
                  ? "Advanced thinking. Human care."
                  : id === "04"
                    ? "Considered in every detail."
                    : "A different perspective on dentistry."
          }
        />
        <p>
          {id === "03"
            ? "From first visits to new beginnings, we imagine a place where the whole family feels welcome. Space for little questions, big feelings, and a little reassurance."
            : "Behind every smile is a person with a story. We imagine care that makes time for yours, with clear conversations, a calm environment, and an individual plan."}
        </p>
        <Action id={id} to="about" secondary>
          Our approach
        </Action>
      </div>
    </section>
  );
}
export function Technology({ id }: { id: TemplateId }) {
  return (
    <section
      className={`exp-section exp-technology technology-${id} scroll-reveal`}
      id="technology"
    >
      <div className="tech-text">
        <SectionTitle
          label={
            id === "06"
              ? "Digital care, explained"
              : "A more informed perspective"
          }
          title={experiences[id].techTitle}
        />
        <p>
          Explore the role of digital planning and three-dimensional views in a
          more understandable care experience.
        </p>
        {id === "06" ? (
          <DigitalTimeline />
        ) : (
          <ul>
            {[
              "A clearer view of your options",
              "A plan shaped around you",
              "More room for your questions",
            ].map((t) => (
              <li key={t}>
                <Check size={15} />
                {t}
              </li>
            ))}
          </ul>
        )}
        <Action id={id} to="technology" secondary>
          Explore the technology
        </Action>
        <small>
          Illustrative technology. Equipment and suitability vary by clinic.
        </small>
      </div>
      <div className="tech-model">
        <DentalViewer id={id} assemblyStory={id === "02"} />
        {id === "02" && (
          <span className="model-note">
            Scroll to explore the implant assembly
          </span>
        )}
      </div>
    </section>
  );
}
export function Team({ id }: { id: TemplateId }) {
  return (
    <section className={`exp-section exp-team team-${id} scroll-reveal`}>
      <SectionTitle
        label={
          id === "04"
            ? "The people, beyond the practice"
            : "Meet your care team"
        }
        title={experiences[id].teamTitle}
      />
      <div className="exp-doctors">
        {doctors.map((d, i) => (
          <Link
            key={d.slug}
            href={`/templates/${id}/doctors/${d.slug}`}
            className="exp-doctor"
          >
            <div
              className="exp-portrait"
              style={{ backgroundPosition: `${i * 50}% 12%` }}
            >
              <span>Fictional demo profile</span>
            </div>
            <div className="exp-doctor-caption">
              {id === "04" && (
                <span className="doctor-discipline">{d.role}</span>
              )}
              <h3>{d.name}</h3>
              {id !== "04" && <p>{d.role}</p>}
              <ArrowUpRight size={18} />
            </div>
          </Link>
        ))}
      </div>
      <Link className="exp-text-link" href={`/templates/${id}/doctors`}>
        Get to know the team
        <ArrowRight size={16} />
      </Link>
    </section>
  );
}
export function Journey({ id }: { id: TemplateId }) {
  return (
    <section className={`exp-section exp-journey journey-${id} scroll-reveal`}>
      <SectionTitle
        label="From the first hello"
        title={
          id === "03"
            ? "A happy little journey."
            : id === "04"
              ? "Your experience, considered."
              : id === "06"
                ? "Connected care. At every step."
                : "Good care has a clear path."
        }
      />
      <ol>
        {journey.map((j, i) => (
          <li key={j.name}>
            <span>0{i + 1}</span>
            <div>
              <h3>{j.name}</h3>
              <p>{j.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function Comparison({ id }: { id: TemplateId }) {
  return (
    <div className={`exp-comparison compare-${id}`}>
      <SmileStudy />
    </div>
  );
}
export function Gallery({ id }: { id: TemplateId }) {
  return (
    <section className={`exp-section exp-gallery gallery-${id} scroll-reveal`}>
      <SectionTitle
        label={id === "05" ? "The smile edit" : "A closer look"}
        title={
          id === "03"
            ? "Room for every smile."
            : id === "04"
              ? "An atmosphere of quiet confidence."
              : id === "05"
                ? "A little inspiration. A lot of possibility."
                : "Designed to feel different."
        }
      />
      <GalleryGrid id={id} />
    </section>
  );
}
export function Testimonials({ id }: { id: TemplateId }) {
  return (
    <section
      className={`exp-section exp-feedback feedback-${id} scroll-reveal`}
    >
      <span className="exp-label">The experience we imagine</span>
      <Feedback id={id} />
    </section>
  );
}
export function FAQ({ id }: { id: TemplateId }) {
  return (
    <section
      className={`exp-section exp-questions questions-${id} scroll-reveal`}
    >
      <SectionTitle
        label="A little clarity"
        title={
          id === "03"
            ? "Big questions. Gentle answers."
            : id === "04"
              ? "Everything you would like to know."
              : "Let’s make things clear."
        }
      />
      <Questions />
    </section>
  );
}
export function Booking({ id }: { id: TemplateId }) {
  return (
    <section
      className={`exp-section exp-booking booking-${id}`}
      id="appointment"
    >
      <div className="booking-intro">
        <span className="exp-label">An invitation to begin</span>
        <h2>{experiences[id].bookingTitle}</h2>
        <p>
          {id === "04"
            ? "Share a few details. Make space for a conversation, entirely your own."
            : id === "03"
              ? "One simple step towards a little more comfort for your whole family."
              : "Tell us what you have in mind. We’ll show you how the next step could feel."}
        </p>
        <span className="exp-demo-tag">
          Interactive appointment demonstration
        </span>
        {id === "05" && (
          <Image
            src={experiences[id].hero}
            width={600}
            height={400}
            alt="Illustrative fictional lifestyle portrait"
          />
        )}
        {id === "06" && (
          <div className="booking-checklist">
            <span>
              <Check size={14} />
              Choose your care
            </span>
            <span>
              <Check size={14} />
              Find your date
            </span>
            <span>
              <Check size={14} />
              Review your request
            </span>
          </div>
        )}
      </div>
      <div className="exp-form-shell">
        <BookingForm />
      </div>
    </section>
  );
}
export function Contact({ id }: { id: TemplateId }) {
  return (
    <section className={`exp-section exp-contact contact-${id}`}>
      <div>
        <MapPin size={22} />
        <span>
          Find your way<strong>{clinic.location}</strong>
        </span>
      </div>
      <div>
        <Clock size={22} />
        <span>
          Your time matters<strong>{clinic.hours}</strong>
        </span>
      </div>
      <div>
        <Mail size={22} />
        <span>
          Let’s start a conversation
          <strong>
            <a href={`mailto:${clinic.email}`}>{clinic.email}</a>
          </strong>
        </span>
      </div>
    </section>
  );
}
export function FamilyFeature() {
  return (
    <section className="exp-section family-feature scroll-reveal">
      <div>
        <SectionTitle
          label="From little teeth to big milestones"
          title="One family. A world of smiles."
        />
        <FamilyCare />
      </div>
      <div className="family-feature-image">
        <Image
          src={experiences["03"].hero}
          fill
          sizes="(max-width:700px) 100vw, 45vw"
          alt="Generated fictional smiling family"
        />
        <Heart size={45} />
      </div>
    </section>
  );
}
export function Closing({ id }: { id: TemplateId }) {
  return (
    <section className={`exp-closing closing-${id} scroll-reveal`}>
      <span>
        {id === "03" ? (
          <Heart size={35} />
        ) : id === "04" ? (
          <Diamond size={28} />
        ) : (
          <Sparkles size={30} />
        )}
      </span>
      <h2>{experiences[id].closing}</h2>
      <Action id={id}>
        {id === "04" ? "Your private consultation" : "Let’s start with a smile"}
      </Action>
    </section>
  );
}
