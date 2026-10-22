"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Building2,
  FlaskConical,
  Globe2,
  Users,
  Menu,
  X,
  Play,
  Check,
  MapPin,
  Mail,
  Phone,
} from "lucide-react";
import SkylineTheme from "./SkylineTheme";
import EngineeringCatalog from "./EngineeringCatalog";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { collegeRoot, type College } from "@/data/colleges";
import { useCollege } from "./CollegeStore";
const Scene = dynamic(() => import("./CampusScene"), {
  ssr: false,
  loading: () => (
    <div className="college-scene-loading">Preparing the campus model…</div>
  ),
});
const locations = [
  "Main Block",
  "Academic Departments",
  "Library",
  "Computer Labs",
  "Science Labs",
  "Auditorium",
  "Sports Ground",
  "Hostel",
];
export default function CollegePublic({
  college: c,
  parts,
}: {
  college: College;
  parts: string[];
}) {
  const root = collegeRoot(c),
    blue = c.slug === "skyline-institute",
    page = parts[0] || "",
    title =
      parts.length === 2 && page === "academics"
        ? c.programs.find((p) => p.slug === parts[1])?.name
        : page.replaceAll("-", " ");
  const [menu, setMenu] = useState(false),
    [hotspot, setHotspot] = useState(0),
    [scene, setScene] = useState(false);
  const region = useRef<HTMLDivElement>(null);
  const { state, run, message } = useCollege();
  useEffect(() => {
    if (!menu) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        document.querySelector<HTMLButtonElement>(".college-menu")?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [menu]);
  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    region.current
      ?.querySelector(".college-intro")
      ?.classList.toggle("college-intro-refresh", nav?.type === "reload");
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.from(".college-hero-copy > *", {
          y: 28,
          opacity: 0,
          stagger: 0.14,
          duration: 0.9,
          delay: 0.3,
        });
        gsap.utils.toArray<HTMLElement>(".college-reveal").forEach((el) =>
          gsap.from(el, {
            y: 35,
            opacity: 0.3,
            duration: 0.8,
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
          }),
        );
        gsap.to(".college-hero-image", {
          yPercent: 12,
          ease: "none",
          scrollTrigger: {
            trigger: ".college-hero",
            start: "top top",
            end: "bottom top",
            scrub: true,
          },
        });
      }, region);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, [page]);
  const image = `/assets/colleges-institutions/${c.slug}/campus.webp`;
  const section = (key: string) => !page || page === key;
  return (
    <div
      ref={region}
      className={`college-site ${blue ? "college-skyline" : "college-edunexa"}`}
      style={{ "--college-accent": c.accent } as React.CSSProperties}
    >
      <div className="college-intro" aria-hidden="true">
        <GraduationCap />
        <span>{c.short}</span>
      </div>
      <div className="college-utility">
        <span>
          {blue
            ? "Engineering & Technology College · Fictional demo"
            : "Welcome to a world of possibility"}
        </span>
        {blue && <SkylineTheme />}
        <div>
          <Link href={`${root}/portal/student`}>Student access</Link>
          <Link href={`${root}/contact`}>
            Plan your visit <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
      <header className="college-nav">
        <Link href={root} className="college-brand">
          <Image
            src={
              blue
                ? "/assets/colleges/skyline/branding/symbol.svg"
                : `/assets/colleges-institutions/${c.slug}/crest.svg`
            }
            width={46}
            height={50}
            alt=""
          />
          <span>
            <strong>{blue ? "Skyline Institute" : "EduNexa College"}</strong>
            <small>{c.motto}</small>
          </span>
        </Link>
        <nav className={menu ? "is-open" : ""} aria-label="College navigation">
          {[
            ["Home", ""],
            ["About", "about"],
            ["Academics", "academics"],
            ["Campus", "campus"],
            ["Admissions", "admissions"],
            ["Student Life", "student-life"],
            ["Contact", "contact"],
          ].map(([label, url]) => (
            <Link
              key={label}
              href={`${root}${url ? "/" + url : ""}`}
              aria-current={page === url ? "page" : undefined}
              onClick={() => setMenu(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link
          className="college-button college-portal-button"
          href={`${root}/portal/login`}
        >
          Admin Portal <ArrowUpRight size={14} />
        </Link>
        <button
          className="college-menu"
          onClick={() => setMenu(!menu)}
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main>
        {!page ? (
          <>
            <section className="college-hero">
              <Image
                className="college-hero-image"
                src={image}
                alt={`Generated fictional ${c.short} campus`}
                fill
                loading="eager"
                fetchPriority="high"
                sizes="100vw"
              />
              <div className="college-hero-shade" />
              <div className="college-hero-copy">
                <span className="college-hero-label">
                  <span />{" "}
                  {blue
                    ? "Ideas without boundaries"
                    : "A modern approach to education"}
                </span>
                <h1>{c.headline}</h1>
                <p>{c.description}</p>
                <div className="college-actions">
                  <Link
                    className="college-button"
                    href={`${root}/admissions/apply`}
                  >
                    {blue ? "Apply Now" : "Apply for Admission"}{" "}
                    <ArrowUpRight size={17} />
                  </Link>
                  <Link
                    className="college-button college-outline"
                    href={`${root}/campus`}
                  >
                    <Play size={14} />{" "}
                    {blue ? "Explore Campus" : "Take a Virtual Tour"}
                  </Link>
                </div>
                <div className="college-hero-note">
                  <span className="college-avatars">A R M</span>
                  <span>
                    A community of curious minds.
                    <br />
                    <strong>Your next chapter starts here.</strong>
                  </span>
                </div>
              </div>
              <aside className="college-stats">
                {[
                  [blue ? "1996" : "2001", "Our founding year"],
                  [String(c.programs.length), "Academic programs"],
                  ["8", "Campus destinations"],
                  ["2026", "Admissions open"],
                ].map(([n, l]) => (
                  <div key={l}>
                    <strong>{n}</strong>
                    <span>{l}</span>
                  </div>
                ))}
              </aside>
              <div className="college-hero-caption">
                <MapPin size={14} /> A fictional campus. A real sense of
                possibility.
              </div>
            </section>
            <section className="college-values">
              {[
                [Building2, "A world-class campus"],
                [Users, "Experienced faculty"],
                [FlaskConical, "Learning through discovery"],
                [BookOpen, "Smart classrooms"],
                [Globe2, "A wider perspective"],
                [GraduationCap, "Career preparation"],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Building2;
                return (
                  <Link href={`${root}/facilities`} key={String(label)}>
                    <I size={25} />
                    <span>{String(label)}</span>
                  </Link>
                );
              })}
            </section>
            <div className="college-editorial-strip">
              {[
                "Academic excellence",
                "A culture of discovery",
                "Life beyond the classroom",
                "Your next chapter",
              ].map((s, i) => (
                <Link
                  key={s}
                  href={`${root}/${["academics", "facilities", "student-life", "admissions"][i]}`}
                >
                  <div className={`college-strip-img strip-${i}`}>
                    <Image
                      src={
                        i < 2
                          ? `/assets/colleges-institutions/${c.slug}/learning.webp`
                          : image
                      }
                      alt={s}
                      fill
                      sizes="25vw"
                    />
                  </div>
                  <strong>{s}</strong>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
          </>
        ) : (
          <section className="college-inner-hero">
            <div>
              <Link href={root}>Home</Link> / <span>{title}</span>
              <h1>{title}</h1>
              <p>
                {page === "academics"
                  ? "An education that turns curiosity into capability."
                  : c.description}
              </p>
            </div>
            <Image
              src={image}
              alt={`Fictional ${c.short} campus`}
              width={720}
              height={420}
            />
          </section>
        )}
        {section("about") && (
          <section className="college-section college-about college-reveal">
            <div>
              <span className="college-overline">
                An education for the whole person
              </span>
              <h2>
                {blue
                  ? "Built for what comes next."
                  : "Rooted in purpose. Open to possibility."}
              </h2>
              <p>
                At {c.short}, education begins with a question: what could you
                become? Small learning communities, thoughtful mentoring, and
                hands-on exploration help you find your answer.
              </p>
              <p>
                Founded in {blue ? "1996" : "2001"} in this fictional
                institutional story, our campus brings the sciences, creative
                thinking, and practical skills together.
              </p>
              <Link className="college-text-link" href={`${root}/leadership`}>
                Meet the people shaping our future <ArrowUpRight />
              </Link>
            </div>
            <div className="college-about-visual">
              <Image
                src={image}
                alt="Architectural campus view"
                fill
                sizes="45vw"
              />
              <div>
                <BookOpen />
                <strong>Learn with purpose.</strong>
                <span>Grow with a community.</span>
              </div>
            </div>
            <div className="college-timeline">
              {[
                "Foundation",
                "A growing community",
                "New learning spaces",
                "Your chapter",
              ].map((t, i) => (
                <div key={t}>
                  <small>
                    {[blue ? "1996" : "2001", "2010", "2020", "2026"][i]}
                  </small>
                  <strong>{t}</strong>
                </div>
              ))}
            </div>
          </section>
        )}
        {section("leadership") && (
          <section className="college-section college-leadership college-reveal">
            <div className="college-section-heading">
              <h2>People with a shared purpose.</h2>
              <p>
                Guidance that opens doors, and a vision that looks beyond them.
              </p>
            </div>
            {[
              [
                "Dr. Anjali Rao",
                "Chairperson",
                "Education should create opportunity. Our responsibility is to make room for every curious mind, and to support the courage to explore.",
              ],
              [
                "Dr. R. Sharma",
                "Principal",
                "The most important lesson we teach is how to keep learning. Our faculty bring academic depth and personal care to every classroom.",
              ],
            ].map(([n, r, quote], i) => (
              <article key={r}>
                <div className="college-person-emblem">
                  {i ? <GraduationCap size={62} /> : <BookOpen size={62} />}
                </div>
                <blockquote>“{quote}”</blockquote>
                <strong>{n}</strong>
                <span>{r} · Fictional leadership profile</span>
              </article>
            ))}
          </section>
        )}
        {blue &&
          (!page || page === "academics" || page === "departments") &&
          !parts[1] && <EngineeringCatalog />}
        {(section("academics") || page === "departments") &&
          (!blue || !!parts[1]) && (
            <section className="college-section college-programs college-reveal">
              <div className="college-section-heading">
                <div>
                  <span className="college-overline">Find your direction</span>
                  <h2>
                    {blue
                      ? "Ideas into impact."
                      : "Many paths. One bright future."}
                  </h2>
                </div>
                <p>
                  Explore disciplines that connect rigorous thinking with
                  meaningful practice.
                </p>
              </div>
              <div className="college-program-grid">
                {c.programs
                  .filter((p) => !parts[1] || p.slug === parts[1])
                  .map((p, i) => (
                    <article key={p.slug}>
                      <span className="college-program-icon">
                        {i % 2 ? <FlaskConical /> : <BookOpen />}
                      </span>
                      <small>
                        {p.department} / {p.duration}
                      </small>
                      <h3>{p.name}</h3>
                      <p>
                        Foundational study, applied projects, collaborative
                        seminars, and individual mentorship. Build a portfolio
                        of work and a lifelong habit of inquiry.
                      </p>
                      <ul>
                        <li>Classroom and practical learning</li>
                        <li>Faculty-guided capstone project</li>
                        <li>Career and postgraduate guidance</li>
                      </ul>
                      <Link href={`${root}/academics/${p.slug}`}>
                        Program details <ArrowUpRight size={17} />
                      </Link>
                      {parts[1] && (
                        <Link
                          className="college-button"
                          href={`${root}/admissions/apply`}
                        >
                          Apply for this program
                        </Link>
                      )}
                    </article>
                  ))}
              </div>
            </section>
          )}
        {(section("campus") || page === "facilities") && (
          <section className="college-campus college-reveal">
            <div className="college-section">
              <div className="college-section-heading">
                <div>
                  <span className="college-overline">Room to explore</span>
                  <h2>A campus made for discovery.</h2>
                </div>
                <p>
                  Choose a destination to explore the campus. Rotate the model
                  with a mouse or touch.
                </p>
              </div>
              <div className="college-campus-layout">
                <div className="college-campus-model">
                  {scene ? (
                    <Scene
                      blue={blue}
                      selected={hotspot}
                      onSelect={setHotspot}
                    />
                  ) : (
                    <>
                      <Image
                        src={image}
                        alt="Static campus alternative"
                        fill
                        sizes="60vw"
                      />
                      <button
                        className="college-button"
                        onClick={() => setScene(true)}
                      >
                        <Play size={16} /> Start interactive 3D tour
                      </button>
                    </>
                  )}
                </div>
                <div className="college-campus-locations">
                  {locations.map((l, i) => (
                    <button
                      key={l}
                      aria-pressed={i === hotspot}
                      onClick={() => setHotspot(i)}
                    >
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      {l}
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                  <p>
                    <strong>{locations[hotspot]}</strong>
                    <br />
                    {
                      [
                        "The heart of campus life, with teaching spaces and student services.",
                        "A home for every discipline, built around collaboration.",
                        "Quiet reading, research collections, and digital resources.",
                        "Workstations for coding, design, and computational discovery.",
                        "Hands-on experimentation with faculty guidance.",
                        "A stage for ideas, music, and community gatherings.",
                        "Open space for sport, teamwork, and recreation.",
                        "A welcoming residential community with warden support.",
                      ][hotspot]
                    }
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
        {(section("faculty") || page === "departments") && (
          <section className="college-section college-reveal">
            <div className="college-section-heading">
              <h2>Mentors for your journey.</h2>
              <p>Meet a few of our fictional faculty profiles.</p>
            </div>
            <div className="college-faculty-grid">
              {[
                "Dr. Meera Nair",
                "Dr. Arjun Patel",
                "Prof. Kavya Reddy",
                "Dr. Sanjay Das",
              ].map((n, i) => (
                <article key={n}>
                  <div className="college-faculty-avatar">
                    <GraduationCap size={40} />
                  </div>
                  <h3>{n}</h3>
                  <p>{c.programs[i].department}</p>
                  <Link href={`${root}/contact`}>
                    Ask about the department <ArrowUpRight size={14} />
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}
        {(section("student-life") ||
          page === "gallery" ||
          page === "achievements" ||
          page === "placements") && (
          <section className="college-section college-life college-reveal">
            <div className="college-section-heading">
              <div>
                <span className="college-overline">
                  Beyond the lecture hall
                </span>
                <h2>
                  {blue ? "Make your mark." : "Belong. Discover. Become."}
                </h2>
              </div>
              <p>
                Clubs, cultural exchange, sport, and service bring a richer
                dimension to learning.
              </p>
            </div>
            <div className="college-life-grid">
              {[
                "Research & innovation",
                "Arts & cultural life",
                "Sports & well-being",
                "Career preparation",
              ].map((t, i) => (
                <article key={t}>
                  <div>
                    <Image
                      src={
                        i === 0 || i === 1
                          ? `/assets/colleges-institutions/${c.slug}/learning.webp`
                          : image
                      }
                      alt="Fictional campus atmosphere"
                      fill
                      sizes="45vw"
                    />
                  </div>
                  <h3>{t}</h3>
                  <p>
                    {
                      [
                        "Student research circles explore sustainable materials, digital tools, and community questions.",
                        "From theatre to music and literature, find your voice among friends.",
                        "Make time for movement, teamwork, and a healthier daily rhythm.",
                        "Practice interviews, develop your portfolio, and meet faculty mentors. All outcomes shown are fictional; no employer partnership or placement rate is claimed.",
                      ][i]
                    }
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
        {section("admissions") && (
          <section className="college-section college-admissions college-reveal">
            <div>
              <span className="college-overline">Admissions 2026–27</span>
              <h2>
                Your next chapter
                <br />
                starts with a conversation.
              </h2>
              <p>
                Discover a program, prepare your documents, and submit your
                application. Our demo admission team will guide your application
                from inquiry to enrollment.
              </p>
              <Link
                className="college-button"
                href={`${root}/admissions/apply`}
              >
                Begin your application <ArrowUpRight size={17} />
              </Link>
              <Link className="college-text-link" href={`${root}/contact`}>
                Arrange a campus visit
              </Link>
            </div>
            <ol>
              {[
                "Choose your program",
                "Submit your application",
                "Document review",
                "Admission & enrollment",
              ].map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            <div className="college-scholarship">
              <GraduationCap />
              <h3>Potential deserves opportunity.</h3>
              <p>
                Explore merit, need-based, sports, and institutional
                scholarships. Eligibility and approvals are simulated in the
                management portal.
              </p>
            </div>
          </section>
        )}
        {page === "admissions" && parts[1] === "apply" && (
          <section className="college-section">
            <form
              className="college-form"
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(
                  new FormData(e.currentTarget),
                ) as Record<string, string>;
                if (run({ type: "admission.create", data }))
                  e.currentTarget.reset();
              }}
            >
              <h2>Application for admission</h2>
              <p>
                Use fictional information only. Submissions are saved in this
                browser’s demo admissions register.
              </p>
              {[
                ["name", "Student name"],
                ["email", "Email"],
                ["guardian", "Guardian name"],
                ["contact", "Contact reference"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    required
                    type={key === "email" ? "email" : "text"}
                  />
                </label>
              ))}
              <label>
                Program
                <select name="program">
                  {c.programs.map((p) => (
                    <option key={p.slug}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Admission source
                <select name="source">
                  {[
                    "Website",
                    "Walk-in",
                    "Social Media",
                    "Referral",
                    "Education Fair",
                    "Other",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Scholarship interest
                <select name="scholarship">
                  <option>None</option>
                  <option>Merit</option>
                  <option>Need-Based</option>
                  <option>Sports</option>
                </select>
              </label>
              <label>
                Documents checklist
                <textarea
                  name="note"
                  required
                  placeholder="List the fictional documents prepared for review"
                />
              </label>
              <button className="college-button">
                Submit demo application <ArrowRight size={16} />
              </button>
              <p role="status">{message}</p>
            </form>
          </section>
        )}
        {(!page || page === "faq") && (
          <section className="college-section college-faq college-reveal">
            <h2>A little clarity for the journey.</h2>
            {[
              [
                "How do I apply?",
                "Choose a program and complete the demo application. Follow its status in the admissions portal.",
              ],
              [
                "Are scholarships available?",
                "The demo supports merit, need-based, sports, and institutional awards. Accounts staff can propose awards for approval.",
              ],
              [
                "Can I explore the campus?",
                "Use our interactive 3D campus, or contact the fictional admissions team to simulate a visit.",
              ],
              [
                "Is this a real institution?",
                "This is a fictional college template with a browser-based ERP demonstration. No real admissions, payments, SMS messages or credentials are processed.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </section>
        )}
        {page === "contact" && (
          <section className="college-section college-contact">
            <div>
              <h2>Let’s talk about your future.</h2>
              <p>
                <MapPin /> Knowledge Avenue, Demo City, India
              </p>
              <p>
                <Mail /> admissions@{c.slug}.example
              </p>
              <p>
                <Phone /> Fictional contact — no live phone service
              </p>
            </div>
            <form
              className="college-form"
              onSubmit={(e) => {
                e.preventDefault();
                alert(
                  "Demo campus visit request received. No message was sent.",
                );
                e.currentTarget.reset();
              }}
            >
              <label>
                Your name
                <input required />
              </label>
              <label>
                Demo email
                <input type="email" required />
              </label>
              <label>
                Preferred visit date
                <input type="date" required />
              </label>
              <label>
                Your question
                <textarea required />
              </label>
              <button className="college-button">Request a demo visit</button>
            </form>
          </section>
        )}
        {!page && (
          <section className="college-portal-promo">
            <div>
              <span className="college-overline">One connected campus</span>
              <h2>
                A smarter way to manage
                <br />
                everyday college life.
              </h2>
              <p>
                Admissions, students, fees, certificates, and hostel life —
                connected in one interactive management experience.
              </p>
              <Link className="college-button" href={`${root}/portal/login`}>
                Explore the management portal <ArrowUpRight size={17} />
              </Link>
            </div>
            <div className="college-dashboard-preview">
              <div>
                <span>{c.short} / Campus overview</span>
                <span>Demo</span>
              </div>
              <h3>A good day to make progress.</h3>
              <div className="college-preview-metrics">
                <span>
                  <Users /> Students<strong>{state.students.length}</strong>
                </span>
                <span>
                  <BookOpen /> Programs<strong>{c.programs.length}</strong>
                </span>
                <span>
                  <GraduationCap /> Campus beds
                  <strong>
                    {state.rooms.reduce((n, r) => n + (r.capacity || 0), 0)}
                  </strong>
                </span>
              </div>
              <div className="college-preview-chart">
                {[45, 60, 43, 75, 65, 92, 74, 100, 84].map((h, i) => (
                  <i key={i} style={{ height: h + "%" }} />
                ))}
              </div>
              <p>
                <Check size={14} /> A connected, fictional campus dataset
              </p>
            </div>
          </section>
        )}
      </main>
      <footer className="college-footer">
        <div>
          <Link className="college-brand" href={root}>
            <Image
              src={
                blue
                  ? "/assets/colleges/skyline/branding/symbol.svg"
                  : `/assets/colleges-institutions/${c.slug}/crest.svg`
              }
              alt=""
              width={44}
              height={50}
            />
            <strong>{c.short}</strong>
          </Link>
          <p>{c.motto}</p>
          <small>
            Fictional institution. Interactive frontend demonstration.
          </small>
        </div>
        <div>
          <h3>Discover</h3>
          {[
            "about",
            "leadership",
            "academics",
            "faculty",
            "campus",
            "facilities",
          ].map((p) => (
            <Link key={p} href={`${root}/${p}`}>
              {p.replaceAll("-", " ")}
            </Link>
          ))}
        </div>
        <div>
          <h3>Your journey</h3>
          {[
            "admissions",
            "student-life",
            "achievements",
            "placements",
            "gallery",
            "faq",
            "contact",
          ].map((p) => (
            <Link key={p} href={`${root}/${p}`}>
              {p.replaceAll("-", " ")}
            </Link>
          ))}
        </div>
        <div>
          <h3>Campus access</h3>
          <Link href={`${root}/portal/login`}>Management portal</Link>
          <Link href={`${root}/portal/student`}>Student portal</Link>
          <Link href="/colleges-institutions">Explore both institutions</Link>
          <Link href="/">Back to KC Web Universe</Link>
        </div>
        <p className="college-footer-bottom">
          © 2026 {c.name}. Demo content only. Designed for possibility.
        </p>
      </footer>
    </div>
  );
}
