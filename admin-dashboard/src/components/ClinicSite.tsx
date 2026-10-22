"use client";
import Link from "next/link";
import WhatsAppLink from "@/components/contact/WhatsAppLink";
import WhatsAppContact from "@/components/contact/WhatsAppContact";
import Image from "next/image";
import { useState } from "react";
import { useTemplateNavigation } from "./templates/useTemplateNavigation";
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Heart,
  ScanLine,
  Menu,
  X,
  Plus,
  Minus,
  Check,
  MapPin,
  Clock,
  Mail,
  MoveUpRight,
  Play,
  Smile,
} from "lucide-react";
import { clinic, services, doctors, faqs } from "@/data/clinic";
import ToothViewer from "./ToothViewer";
import BookingForm from "./BookingForm";
import Intro from "./Intro";
import ClinicMotion from "./ClinicMotion";
import GalleryGrid from "./templates/GalleryGrid";
import TreatmentFilter from "./templates/TreatmentFilter";
import SmileStudy from "./SmileStudy";
const base = "/templates/01";
export function Logo() {
  return (
    <Link href={base} className="brand" aria-label="Your Dental Studio home">
      <span className="brand-mark">
        <Heart size={25} fill="currentColor" />
        <span>✦</span>
      </span>
      <span>
        {clinic.name}
        <small>{clinic.suffix}</small>
      </span>
    </Link>
  );
}
function Navigation() {
  const { path, open, setOpen, compact, button } = useTemplateNavigation();
  return (
    <header className={`navigation ${compact ? "nav-compact" : ""}`}>
      <Logo />
      <nav
        id="template-menu-01"
        className={open ? "nav-links open" : "nav-links"}
        aria-label="Main navigation"
      >
        {[
          ["Home", ""],
          ["About", "/about"],
          ["Treatments", "/services"],
          ["Our team", "/doctors"],
          ["Technology", "/technology"],
          ["Contact", "/contact"],
        ].map(([label, url]) => (
          <Link
            key={label}
            aria-current={
              path === `${base}${url}` ||
              (url && path.startsWith(`${base}${url}/`))
                ? "page"
                : undefined
            }
            href={`${base}${url}`}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>
      <Link className="button primary nav-book" href={`${base}/appointments`}>
        Book a visit <ArrowUpRight size={15} />
      </Link>
      <button
        ref={button}
        className="mobile-menu icon-button"
        aria-controls="template-menu-01"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <X /> : <Menu />}
      </button>
    </header>
  );
}
function Services({ searchable = false }: { searchable?: boolean }) {
  return (
    <section id="treatments" className="section treatments">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Care, thoughtfully considered</span>
          <h2>
            A little care.
            <br />A whole lot of confidence.
          </h2>
        </div>
        <p>
          From the everyday essentials to a fresh start.
          <br />
          Find the care that’s right for you.
        </p>
      </div>
      <TreatmentFilter
        className="service-grid"
        labels={services.map((s) => s.name)}
        searchable={searchable}
      >
        {services.map((s, i) => (
          <Link
            key={s.slug}
            href={`${base}/services/${s.slug}`}
            className={`service-card service-${i}`}
          >
            <div className="service-visual">
              <DentalArt type={i % 4} />
            </div>
            <div className="service-info">
              <h3>{s.name}</h3>
              <ArrowUpRight size={20} />
            </div>
            <p>{s.text}</p>
          </Link>
        ))}
      </TreatmentFilter>
    </section>
  );
}
function DentalArt({ type }: { type: number }) {
  return (
    <div className={`dental-art art-${type}`} aria-hidden="true">
      {type === 1 ? (
        <div className="braces-art">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i}>
              <i />
            </span>
          ))}
          <b />
        </div>
      ) : type === 3 ? (
        <>
          <div className="little-tooth" />
          <div className="little-tooth small" />
          <Heart className="art-heart" size={30} fill="#dbaafa" />
        </>
      ) : (
        <>
          <div className="little-tooth" />
          {type === 0 ? (
            <div className="implant-screw" />
          ) : (
            <>
              <Sparkles className="art-spark" size={31} />
              <Sparkles className="art-spark second" size={17} />
            </>
          )}
        </>
      )}
    </div>
  );
}
function Technology() {
  return (
    <section className="technology section">
      <div className="tech-art">
        <div className="scan-grid" />
        <div className="scan-ring" />
        <ToothViewer />
        <span className="tech-chip">
          <ScanLine size={17} /> A clearer picture of your care
        </span>
      </div>
      <div className="tech-copy">
        <span className="eyebrow">Precision meets peace of mind</span>
        <h2>
          Better insight.
          <br />
          More thoughtful care.
        </h2>
        <p>
          Explore how digital dentistry can make your experience more
          comfortable, personal, and easy to understand.
        </p>
        <ul>
          {[
            "Digital treatment planning",
            "Comfort-focused scanning",
            "Care designed around you",
          ].map((t) => (
            <li key={t}>
              <Check size={16} />
              {t}
            </li>
          ))}
        </ul>
        <Link href={`${base}/technology`} className="button dark">
          Explore the technology <ArrowUpRight size={16} />
        </Link>
        <small>
          Illustrative technology showcase. Equipment varies by clinic.
        </small>
      </div>
    </section>
  );
}
function Team() {
  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">People first. Always.</span>
          <h2>
            Good hands.
            <br />
            Even better humans.
          </h2>
        </div>
        <Link className="text-link" href={`${base}/doctors`}>
          Meet the team <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="team-grid">
        {doctors.map((d, i) => (
          <Link
            href={`${base}/doctors/${d.slug}`}
            key={d.slug}
            className="doctor-card"
          >
            <div className={`doctor-portrait portrait-${i}`}>
              <div
                className="generated-portrait"
                style={{ backgroundPosition: `${i * 50}% 12%` }}
                role="img"
                aria-label={`Generated portrait of fictional dentist ${d.name}`}
              />
              <small>Fictional demo profile</small>
            </div>
            <div>
              <h3>{d.name}</h3>
              <p>{d.role}</p>
              <ArrowUpRight size={20} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
function Journey() {
  return (
    <section className="journey section">
      <span className="eyebrow">Your next chapter starts here</span>
      <h2>Great care, every step of the way.</h2>
      <div className="journey-grid">
        {[
          ["Let’s talk", "Tell us what matters to you. We start by listening."],
          [
            "Make a plan",
            "Understand your options, with room for every question.",
          ],
          [
            "Feel at ease",
            "Thoughtful treatment, at a pace that works for you.",
          ],
          [
            "Keep smiling",
            "Practical guidance and support for the road ahead.",
          ],
        ].map(([title, text], i) => (
          <div key={title}>
            <span>0{i + 1}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
function Reviews() {
  const [index, setIndex] = useState(0);
  const quotes = [
    "“A space where a visit to the dentist feels a little more like taking care of yourself.”",
    "“Thoughtful conversations, a clear plan, and care that puts you at the centre.”",
    "“A warm welcome for every generation. That’s the kind of care we imagine.”",
  ];
  return (
    <section className="sample-review section">
      <span className="eyebrow">The experience we imagine</span>
      <div className="quote-mark">“</div>
      <blockquote>{quotes[index]}</blockquote>
      <p>Sample testimonial · Fictional demonstration content</p>
      <div className="review-dots">
        {quotes.map((_, i) => (
          <button
            key={i}
            aria-label={`Show sample testimonial ${i + 1}`}
            aria-pressed={index === i}
            onClick={() => setIndex(i)}
            className={index === i ? "active" : ""}
          />
        ))}
      </div>
    </section>
  );
}
function ClinicGallery() {
  return (
    <section className="section exp-gallery template-one-gallery">
      <div className="section-heading">
        <div>
          <span className="eyebrow">A little room to feel at ease</span>
          <h2>
            Thoughtful spaces.
            <br />A warmer welcome.
          </h2>
        </div>
        <p>Explore our illustrative clinic environment.</p>
      </div>
      <GalleryGrid id="01" />
    </section>
  );
}
function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="section faq-section">
      <div>
        <span className="eyebrow">A little clarity</span>
        <h2>
          Questions?
          <br />
          You’re in good company.
        </h2>
        <p>Feeling comfortable starts with feeling informed.</p>
      </div>
      <div>
        {faqs.map((f, i) => (
          <div className="faq" key={f.q}>
            <h3>
              <button
                aria-expanded={open === i}
                aria-controls={`faq-${i}`}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {f.q}
                {open === i ? <Minus size={18} /> : <Plus size={18} />}
              </button>
            </h3>
            <div id={`faq-${i}`} hidden={open !== i}>
              <p>{f.a}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function Booking() {
  return (
    <section id="appointment" className="section appointment-section">
      <div>
        <span className="eyebrow">A brighter beginning</span>
        <h2>
          Your smile.
          <br />
          Your time.
          <br />
          Let’s make a date.
        </h2>
        <p>A simple first step towards care that feels like you.</p>
        <span className="demo-tag">Interactive appointment demo</span>
      </div>
      <BookingForm />
    </section>
  );
}
function Contact() {
  return (
    <div className="contact-strip section">
      <div>
        <MapPin size={22} />
        <span>
          <strong>Find your way to us</strong>
          {clinic.location}
        </span>
      </div>
      <div>
        <Clock size={22} />
        <span>
          <strong>A time that works for you</strong>
          {clinic.hours}
        </span>
      </div>
      <div>
        <Mail size={22} />
        <span>
          <strong>Start a conversation</strong>
          <a href={`mailto:${clinic.email}`}>{clinic.email}</a>
        </span>
      </div>
    </div>
  );
}
function Hero() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-line" /> A fresh perspective on dental care
          </span>
          <h1>
            Healthy smiles.
            <br />
            Brighter
            <br />
            <em>tomorrows.</em>
          </h1>
          <p>
            Thoughtful dentistry. A gentler touch.
            <br />
            Personal care for every version of your smile.
          </p>
          <div className="hero-actions">
            <Link href={`${base}/appointments`} className="button primary">
              Book an appointment <ArrowUpRight size={17} />
            </Link>
            <Link href={`${base}/about`} className="story-link">
              <span>
                <Play size={12} fill="currentColor" />
              </span>
              Our approach
            </Link>
          </div>
          <div className="hero-trust">
            <div className="avatar-stack">
              <span>☺</span>
              <span>☺</span>
              <span>☺</span>
            </div>
            <div>
              <strong>Comfort comes first.</strong>
              <small>A welcoming space for every smile.</small>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <Image
            src="/assets/hero.webp"
            alt="Illustrative fictional dentist welcoming a patient in a bright modern clinic"
            fill
            priority
            sizes="(max-width: 700px) 100vw, 57vw"
            className="hero-photo"
          />
          <div className="hero-photo-overlay" />
          <div className="hero-glass-tooth">
            <ToothViewer />
          </div>
          <div className="care-note">
            <span>
              <ShieldCheck size={21} />
            </span>
            <div>
              <strong>A gentler kind of care</strong>
              <small>Made personal. Made for you.</small>
            </div>
            <Sparkles size={17} />
          </div>
          <span className="photo-label">Illustrative demo imagery</span>
          <div className="hero-orbit" />
        </div>
        <span className="hero-corner">Feel good about your smile.</span>
      </section>
      <div className="care-pillars">
        {[
          [
            ShieldCheck,
            "Comfort-first care",
            "A little reassurance goes a long way.",
          ],
          [ScanLine, "Modern perspective", "Precision with a personal touch."],
          [Heart, "People, not patients", "Care built around your life."],
          [Smile, "Every smile welcome", "From first teeth to fresh starts."],
        ].map(([Icon, title, desc]) => {
          const I = Icon as typeof Heart;
          return (
            <div key={String(title)}>
              <span>
                <I size={25} strokeWidth={1.4} />
              </span>
              <div>
                <h3>{String(title)}</h3>
                <p>{String(desc)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
export default function ClinicSite({ slug = [] }: { slug?: string[] }) {
  const page = slug[0];
  const service = services.find((s) => s.slug === slug[1]);
  const doctor = doctors.find((d) => d.slug === slug[1]);
  return (
    <div className="template-one">
      <div className="demo-bar">
        <span>
          Web Universe <i /> A thoughtfully crafted dental experience
        </span>
        <Link href="/showcase">
          Explore the collection <ArrowUpRight size={12} />
        </Link>
      </div>
      <Navigation />
      <Intro />
      <ClinicMotion />
      <main>
        {!page ? (
          <>
            <Hero />
            <Services />
            <section className="about-strip section">
              <span className="eyebrow">
                A fresh start, with you at the centre
              </span>
              <h2>
                Because feeling good
                <br />
                starts with <em>feeling understood.</em>
              </h2>
              <p>
                We imagine dentistry as it should feel: calm, considered, and
                built around real people. A place for questions, reassurance,
                and a little more confidence.
              </p>
              <Link href={`${base}/about`} className="text-link">
                Get to know us <ArrowUpRight size={16} />
              </Link>
            </section>
            <Technology />
            <Team />
            <Journey />
            <SmileStudy />
            <Reviews />
            <ClinicGallery />
            <FAQ />
            <Booking />
            <Contact />
          </>
        ) : (
          <>
            <section className="inner-hero section">
              <Link href={base} className="text-link">
                Home <ArrowRight size={14} />
              </Link>
              <span className="eyebrow">
                Your Dental Studio · Fictional demo
              </span>
              <h1>
                {service?.name ||
                  doctor?.name ||
                  {
                    about: "Care that feels like you.",
                    services: "Find your kind of care.",
                    doctors: "The humans behind your smile.",
                    technology: "A clearer view of your care.",
                    gallery: "A little room to feel at ease.",
                    reviews: "The experience we imagine.",
                    appointments: "Let’s make a date.",
                    contact: "We’re here to listen.",
                  }[page] ||
                  "Welcome to your next chapter."}
              </h1>
              <p>
                {service?.detail ||
                  (doctor &&
                    `${doctor.role}. A fictional profile demonstrating how your team’s story can be presented. Replace this profile with your own approved biography and credentials.`) ||
                  "A thoughtful approach to dentistry, with comfort and clarity at the heart of every visit."}
              </p>
              {service && (
                <Link href={`${base}/appointments`} className="button primary">
                  Discuss this treatment <ArrowUpRight size={17} />
                </Link>
              )}
            </section>
            {page === "services" && !service && <Services searchable />}
            {page === "doctors" && !doctor && <Team />}
            {page === "technology" && <Technology />}
            {page === "about" && (
              <>
                <section className="section about-detail">
                  <Image
                    src="/assets/hero.webp"
                    width={1400}
                    height={900}
                    alt="Fictional dental care scene"
                  />
                  <div>
                    <h2>A welcome that makes a difference.</h2>
                    <p>
                      Our demonstration studio is designed around a simple idea:
                      make room for the person behind the smile. Clear
                      conversations, time to understand your options, and a calm
                      environment.
                    </p>
                    <p>
                      All names, team profiles, and imagery on this site are
                      fictional demonstration content.
                    </p>
                  </div>
                </section>
                <Journey />
                <FAQ />
              </>
            )}
            {page === "gallery" && <ClinicGallery />}
            {page === "reviews" && <Reviews />}
            {page === "appointments" && <Booking />}
            {page === "contact" && (
              <>
                <Contact />
                <div className="clinic-whatsapp-contact">
                  <WhatsAppContact context="dental website Template 01" />
                </div>
                <Booking />
              </>
            )}
            {doctor && (
              <section className="section profile-detail">
                <div className="doctor-portrait">
                  <span>{doctor.initials}</span>
                  <small>Fictional demo profile</small>
                </div>
                <div>
                  <h2>
                    Time to listen.
                    <br />
                    Care to understand.
                  </h2>
                  <p>
                    This editable profile is ready for your dentist’s real
                    qualifications, philosophy, and areas of practice.
                  </p>
                  <Link
                    className="button primary"
                    href={`${base}/appointments`}
                  >
                    Book a consultation <ArrowUpRight size={16} />
                  </Link>
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <footer>
        <div className="footer-top">
          <Logo />
          <h2>
            A little care.
            <br />A brighter you.
          </h2>
          <Link href={`${base}/appointments`} className="button primary">
            Let’s start with a smile <ArrowUpRight size={17} />
          </Link>
        </div>
        <nav className="footer-links" aria-label="Explore the clinic">
          {[
            ["About", "about"],
            ["Treatments", "services"],
            ["Our team", "doctors"],
            ["Technology", "technology"],
            ["Gallery", "gallery"],
            ["Sample feedback", "reviews"],
            ["Contact", "contact"],
          ].map(([label, route]) => (
            <Link key={route} href={`${base}/${route}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="hotel-footer-whatsapp">
          <span>Discuss this website with Chaitanya</span>
          <WhatsAppLink message="Hi Chaitanya, I’m interested in dental website Template 01." />
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} Your Dental Studio. A Web Universe
            design demo.
          </p>
          <span>Fictional clinic, profiles & sample feedback.</span>
          <Link href="/showcase">
            Template collection <MoveUpRight size={12} />
          </Link>
        </div>
      </footer>
      <div className="mobile-booking">
        <Link href={`${base}/appointments`}>
          Book an appointment <ArrowUpRight size={17} />
        </Link>
      </div>
    </div>
  );
}
