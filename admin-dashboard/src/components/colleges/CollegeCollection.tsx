"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  ChevronRight,
  FileCheck,
  GraduationCap,
  Layers2,
  Monitor,
  MousePointer2,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";
import UniverseNavigation from "@/components/showcase/UniverseNavigation";
import { colleges, collegeRoot } from "@/data/colleges";
const journeys = [
  {
    id: "admissions",
    label: "Admissions",
    icon: GraduationCap,
    title: "From first hello to first day.",
    copy: "Explore programs, submit a demo application, and follow its journey through review, approval, and enrollment.",
    path: "admissions",
  },
  {
    id: "finance",
    label: "Campus finance",
    icon: Wallet,
    title: "Every payment. One clear picture.",
    copy: "Explore connected fee ledgers, scholarships, payment simulations, downloadable receipts, and reports.",
    path: "portal/login",
  },
  {
    id: "certificates",
    label: "Certificates",
    icon: FileCheck,
    title: "A request becomes a milestone.",
    copy: "Request, review, and issue demo certificates with PDF downloads and QR-based verification references.",
    path: "portal/login",
  },
  {
    id: "community",
    label: "Campus life",
    icon: Building2,
    title: "A whole campus, connected.",
    copy: "Discover interactive campus spaces, student services, residential life, and hostel leave workflows.",
    path: "campus",
  },
];
type Preview = "desktop" | "mobile" | "admin";
export default function CollegeCollection() {
  const [selected, setSelected] = useState(0),
    [preview, setPreview] = useState<Preview>("desktop"),
    [journey, setJourney] = useState(0);
  const reduced = useReducedMotion(),
    stage = useRef<HTMLDivElement>(null);
  const college = colleges[selected],
    skyline = selected === 1,
    root = collegeRoot(college),
    feature = journeys[journey],
    FeatureIcon = feature.icon;
  const image = `/assets/colleges-institutions/previews/${college.slug}-${preview === "admin" ? "admin" : preview}.webp`;
  const motionIn = { opacity: 0, y: reduced ? 0 : 18 },
    motionOut = { opacity: 0, y: reduced ? 0 : -12 };
  function choose(i: number) {
    setSelected(i);
    if (stage.current) stage.current.style.transform = "";
  }
  return (
    <main
      className={`college-collection ${skyline ? "collection-skyline" : "collection-edunexa"}`}
      style={{ "--hub-accent": college.accent } as React.CSSProperties}
    >
      <UniverseNavigation />
      <section className="hub-hero">
        <div className="hub-hero-copy">
          <Link href="/templates" className="hub-breadcrumb">
            <Layers2 size={14} /> The template collection{" "}
            <ChevronRight size={12} />
            <span>Colleges & Institutions</span>
          </Link>
          <div className="hub-heading">
            <span className="hub-crest-pair">
              {colleges.map((c) => (
                <Image
                  key={c.slug}
                  src={`/assets/colleges-institutions/${c.slug}/crest.svg`}
                  alt=""
                  width={30}
                  height={34}
                />
              ))}
            </span>
            <h1>
              Extraordinary campuses.
              <br />
              Connected experiences.
            </h1>
            <p>
              Two college identities. A world of possibilities.
              <br />
              Discover beautiful websites with a complete campus management
              experience behind them.
            </p>
          </div>
          <div
            className="hub-college-picker"
            role="group"
            aria-label="Choose a college identity"
          >
            {colleges.map((c, i) => (
              <button
                key={c.slug}
                aria-pressed={selected === i}
                onClick={() => choose(i)}
              >
                <Image
                  src={`/assets/colleges-institutions/${c.slug}/crest.svg`}
                  alt=""
                  width={33}
                  height={38}
                />
                <span>
                  <strong>{c.short}</strong>
                  <small>
                    {i ? "Science & technology" : "Modern multidisciplinary"}
                  </small>
                </span>
                <span className="hub-picker-dot">
                  {selected === i && <Check size={11} />}
                </span>
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={college.slug}
              className="hub-selected-copy"
              initial={motionIn}
              animate={{ opacity: 1, y: 0 }}
              exit={motionOut}
              transition={{ duration: reduced ? 0 : 0.25 }}
            >
              <h2>{college.name}</h2>
              <p>{college.motto}</p>
              <div className="hub-cta-row">
                <Link className="hub-primary" href={root}>
                  Explore website <ArrowUpRight size={16} />
                </Link>
                <Link className="hub-secondary" href={`${root}/portal/login`}>
                  Try the management portal <ArrowRight size={15} />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
          <a className="hub-scroll-link" href="#campus-journey">
            <span>
              <ArrowDown size={13} />
            </span>
            See what’s connected
          </a>
        </div>
        <div className="hub-exhibition">
          <div className="hub-exhibition-caption">
            <span>
              <i /> Your live design preview
            </span>
            <small>
              {skyline
                ? "Blue / Glass / Innovation"
                : "Ivory / Gold / Possibility"}
            </small>
          </div>
          <div
            className="hub-stage-wrap"
            onPointerMove={(e) => {
              if (reduced || e.pointerType === "touch" || !stage.current)
                return;
              const r = e.currentTarget.getBoundingClientRect();
              stage.current.style.transform = `perspective(1500px) rotateY(${((e.clientX - r.left) / r.width - 0.5) * 5}deg) rotateX(${(0.5 - (e.clientY - r.top) / r.height) * 4}deg)`;
            }}
            onPointerLeave={() => {
              if (stage.current) stage.current.style.transform = "";
            }}
          >
            <div className="hub-campus-atmosphere">
              <AnimatePresence mode="wait">
                <motion.div
                  key={college.slug}
                  initial={{ opacity: 0, scale: reduced ? 1 : 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduced ? 0 : 0.5 }}
                >
                  <Image
                    src={`/assets/colleges-institutions/${college.slug}/campus.webp`}
                    alt={`Fictional ${college.short} campus atmosphere`}
                    fill
                    sizes="(max-width:900px) 90vw, 55vw"
                    loading="eager"
                    fetchPriority="high"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className={`hub-live-stage hub-view-${preview}`} ref={stage}>
              <div className="hub-browser-bar">
                <span>
                  <i />
                  <i />
                  <i />
                </span>
                <small>
                  {college.short.toLowerCase()}.campus /{" "}
                  {preview === "admin"
                    ? "management portal"
                    : preview === "mobile"
                      ? "mobile website"
                      : "website"}
                </small>
                <ArrowUpRight size={12} />
              </div>
              <div className="hub-screen">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={college.slug + preview}
                    className="hub-screen-content"
                    initial={{ opacity: 0, scale: reduced ? 1 : 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.25 }}
                  >
                    <Image
                      src={image}
                      alt={`${college.name} ${preview} actual website preview`}
                      width={preview === "mobile" ? 390 : 1440}
                      height={preview === "mobile" ? 844 : 1000}
                      sizes="(max-width:900px) 88vw, 55vw"
                      unoptimized
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <div className="hub-floating-note">
              <span className="hub-note-icon">
                {preview === "admin" ? (
                  <ShieldCheck size={22} />
                ) : (
                  <GraduationCap size={22} />
                )}
              </span>
              <div>
                <strong>
                  {preview === "admin"
                    ? "A smarter campus."
                    : "A future worth exploring."}
                </strong>
                <small>
                  {preview === "admin"
                    ? "8 role-based demo experiences"
                    : college.motto}
                </small>
              </div>
              <span className="hub-note-spark" />
            </div>
          </div>
          <div className="hub-preview-toolbar">
            <div role="group" aria-label="Preview format">
              {(
                [
                  ["desktop", Monitor, "Website"],
                  ["mobile", Smartphone, "Mobile"],
                  ["admin", Wallet, "Management"],
                ] as const
              ).map(([id, Icon, label]) => (
                <button
                  key={id}
                  aria-pressed={preview === id}
                  onClick={() => setPreview(id)}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <Link
              href={preview === "admin" ? `${root}/portal/login` : root}
              aria-label={`Open ${college.short} ${preview === "admin" ? "management portal" : "website"}`}
            >
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <span className="hub-preview-hint">
            <MousePointer2 size={12} /> Switch views. Explore the details. Make
            it your own.
          </span>
        </div>
      </section>
      <section
        className="hub-capability-strip"
        aria-label="Included experiences"
      >
        {[
          [Monitor, "A distinct public website"],
          [Building2, "Interactive campus tours"],
          [Users, "Connected student services"],
          [ShieldCheck, "Role-based management"],
        ].map(([Icon, text]) => {
          const I = Icon as typeof Monitor;
          return (
            <span key={String(text)}>
              <I size={19} />
              {String(text)}
            </span>
          );
        })}
      </section>
      <section className="hub-journey" id="campus-journey">
        <div className="hub-section-heading">
          <div>
            <span>A website is only the beginning.</span>
            <h2>
              Follow the whole
              <br />
              campus journey.
            </h2>
          </div>
          <p>
            From a student’s first application to everyday campus life, explore
            the experiences that bring an institution together.
          </p>
        </div>
        <div className="hub-journey-layout">
          <div
            className="hub-journey-tabs"
            role="group"
            aria-label="Explore campus journeys"
          >
            {journeys.map((j, i) => (
              <button
                key={j.id}
                aria-pressed={journey === i}
                onClick={() => setJourney(i)}
              >
                <j.icon size={21} />
                <span>
                  <strong>{j.label}</strong>
                  <small>
                    {
                      [
                        "Apply. Review. Enroll.",
                        "Collect. Reconcile. Report.",
                        "Request. Approve. Verify.",
                        "Discover. Belong. Grow.",
                      ][i]
                    }
                  </small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={feature.id + college.slug}
              className="hub-journey-detail"
              initial={motionIn}
              animate={{ opacity: 1, y: 0 }}
              exit={motionOut}
              transition={{ duration: reduced ? 0 : 0.25 }}
            >
              <div className="hub-detail-copy">
                <FeatureIcon size={28} />
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
                <Link href={`${root}/${feature.path}`}>
                  Explore {feature.label.toLowerCase()}{" "}
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              <div className="hub-detail-visual">
                <Image
                  src={
                    journey === 0 || journey === 3
                      ? `/assets/colleges-institutions/${college.slug}/${journey === 3 ? "learning" : "campus"}.webp`
                      : `/assets/colleges-institutions/previews/${college.slug}-admin.webp`
                  }
                  alt={`${college.short} ${feature.label} experience`}
                  fill
                  sizes="(max-width:700px) 80vw, 38vw"
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
      <section className="hub-two-worlds">
        <div className="hub-section-heading">
          <div>
            <span>Two ways to make an impression.</span>
            <h2>
              Choose your
              <br />
              college’s character.
            </h2>
          </div>
          <p>
            A considered identity for every ambition. Explore both complete
            experiences, from the first screen to the last detail.
          </p>
        </div>
        <div className="hub-world-grid">
          {colleges.map((c, i) => (
            <article
              className={`hub-world-card ${i ? "hub-world-blue" : "hub-world-gold"}`}
              key={c.slug}
            >
              <div className="hub-world-image">
                <Image
                  src={`/assets/colleges-institutions/${c.slug}/campus.webp`}
                  alt={`${c.name} fictional campus`}
                  fill
                  sizes="(max-width:700px) 88vw, 43vw"
                />
                <Image
                  className="hub-world-crest"
                  src={`/assets/colleges-institutions/${c.slug}/crest.svg`}
                  alt=""
                  width={50}
                  height={58}
                />
                <span>
                  {i
                    ? "Research. Innovation. Impact."
                    : "Learn today. Lead tomorrow."}
                </span>
              </div>
              <div className="hub-world-copy">
                <h3>{c.name}</h3>
                <p>{c.description}</p>
                <div>
                  <span>{i ? "#1769E0" : "#C99A45"}</span>
                  <i />
                  <i />
                  <i />
                </div>
                <footer>
                  <Link href={collegeRoot(c)}>
                    View website <ArrowUpRight size={15} />
                  </Link>
                  <Link href={`${collegeRoot(c)}/portal/login`}>
                    Admin demo <ArrowUpRight size={15} />
                  </Link>
                </footer>
              </div>
            </article>
          ))}
        </div>
      </section>
      <footer className="hub-footer">
        <div>
          <GraduationCap size={28} />
          <h2>
            Built around people.
            <br />
            Ready for possibilities.
          </h2>
          <p>
            Explore the public website, step inside the campus,
            <br />
            or try a role in the management portal.
          </p>
          <Link className="hub-primary" href={`${root}/portal/login`}>
            Step inside {college.short} <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="hub-footer-bottom">
          <Link href="/">KC Web Universe</Link>
          <span>
            Fictional institutions. Interactive frontend demonstrations.
          </span>
          <Link href="/templates">
            All 22 templates <ArrowUpRight size={13} />
          </Link>
        </div>
      </footer>
    </main>
  );
}
