"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "motion/react";
import { useLiveReducedMotion } from "./hooks/useLiveReducedMotion";
import {
  ArrowDown,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Smartphone,
  Monitor,
  Check,
  Layers2,
} from "lucide-react";
import { showroomCollection as templates } from "@/data/showroomCollection";
import LiveTemplateLab from "./LiveTemplateLab";
import { useAnimation } from "../animation-system/AnimationProvider";
import type { AnimationTemplateId } from "../animation-system/config/animationRegistry";
import { BrowserMockup, MobileMockup } from "./Mockups";
import ProjectGallery from "./ProjectGallery";
import DeveloperFooter from "./footer/DeveloperFooter";
import { useShowroomMotion } from "./hooks/useShowroomMotion";
import UniverseNavigation from "./UniverseNavigation";
import UniverseHero from "./UniverseHero";
import CosmicHero from "../brand/CosmicHero";
import BrandReady from "../brand/BrandReady";
import TemplateCategories from "./TemplateCategories";
export default function Showroom() {
  const router = useRouter();
  const root = useRef<HTMLElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [motionView, setMotionView] = useState("Spread");
  const [arrival, setArrival] = useState<"initial" | "refresh">("initial");
  const [emblaRef, embla] = useEmblaCarousel({
    loop: true,
    align: "center",
    skipSnaps: false,
    containScroll: false,
  });
  const { switchTemplate, switchHotel, switchSchool, switchRestaurant } =
    useAnimation();
  const reduced = useLiveReducedMotion();
  const t = templates[active];
  useShowroomMotion(root);
  const choose = useCallback(
    (index: number) => {
      const next = (index + templates.length) % templates.length;
      setActive(next);
      embla?.scrollTo(next, Boolean(reduced));
    },
    [embla, reduced],
  );
  useEffect(() => {
    if (!embla) return;
    const select = () => setActive(embla.selectedScrollSnap());
    embla.on("select", select);
    return () => {
      embla.off("select", select);
    };
  }, [embla]);
  useEffect(() => {
    const el = region.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (document.activeElement !== el || !e.shiftKey) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) > 20) embla?.scrollNext();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [embla]);
  useEffect(() => {
    if (!embla) return;
    const paint = () => {
      const viewport = region.current?.getBoundingClientRect();
      if (!viewport) return;
      embla.slideNodes().forEach((slide) => {
        const box = slide.getBoundingClientRect();
        const distance = Math.max(
          -1.5,
          Math.min(
            1.5,
            (box.left + box.width / 2 - viewport.left - viewport.width / 2) /
              box.width,
          ),
        );
        const frame = slide.querySelector<HTMLElement>(".explorer-slide-frame");
        if (frame)
          frame.style.transform = reduced
            ? "none"
            : `perspective(1600px) rotateY(${-distance * 23}deg) translateZ(${-Math.abs(distance) * 95}px)`;
      });
    };
    paint();
    embla.on("scroll", paint).on("reInit", paint);
    return () => {
      embla.off("scroll", paint).off("reInit", paint);
    };
  }, [embla, reduced]);
  function live(id = t.id) {
    const item = templates.find((template) => template.id === id)!;
    if (item.collegeSlug) router.push(item.href);
    else if (item.restaurantSlug)
      switchRestaurant(item.restaurantSlug, item.href);
    else if (item.schoolSlug) switchSchool(item.schoolSlug, item.href);
    else if (item.hotelSlug) switchHotel(item.hotelSlug, item.href);
    else switchTemplate(id as AnimationTemplateId, item.href);
  }
  return (
    <main
      className="showroom"
      ref={root}
      style={
        {
          "--showroom-accent": t.color,
          "--showroom-soft": t.bg,
        } as React.CSSProperties
      }
    >
      <BrandReady />
      <UniverseNavigation />
      <CosmicHero />
      <UniverseHero />
      <TemplateCategories />
      <section
        className="showroom-six-reveal showroom-section"
        aria-label="Twenty-two design perspectives"
      >
        <div className="showroom-reveal-intro" data-showroom-reveal>
          <span className="showroom-kicker">
            Five collections. Twenty-two possibilities.
          </span>
          <h2>
            One starting point.
            <br />
            Twenty-two completely different worlds.
          </h2>
          <p>
            Six dental studios. Four hotel escapes. Four schools of thought. Six
            culinary worlds. Choose the feeling. Step into the experience.
          </p>
        </div>
        <div className="showroom-reveal-strip">
          {(
            [
              "Dental Clinics",
              "Hotels & Resorts",
              "Education & Schools",
              "Restaurants & Food",
              "Colleges & Institutions",
            ] as const
          ).map((category, groupIndex) => (
            <div className="showroom-reveal-world" key={category}>
              <div className="reveal-world-label">
                <span>
                  0{groupIndex + 1} / {category}
                </span>
                <b>
                  {String(
                    templates.filter((t) => t.category === category).length,
                  ).padStart(2, "0")}{" "}
                  worlds
                </b>
              </div>
              <div className="reveal-world-previews">
                {templates
                  .filter((template) => template.category === category)
                  .map((template, i) => (
                    <button
                      key={template.id}
                      className="reveal-browser"
                      onClick={() => {
                        choose(templates.indexOf(template));
                        document.getElementById("collection")?.scrollIntoView({
                          behavior: reduced ? "instant" : "smooth",
                        });
                      }}
                      aria-label={`Discover ${template.name}`}
                      style={
                        {
                          "--reveal-color": template.color,
                          "--reveal-angle": `${(i % 2 ? 1 : -1) * 3}deg`,
                        } as React.CSSProperties
                      }
                    >
                      <Image
                        unoptimized
                        src={template.desktop}
                        width={420}
                        height={292}
                        alt={`${template.name} actual homepage`}
                      />
                      <span>
                        <b>{template.id}</b>
                        {template.name}
                      </span>
                    </button>
                  ))}
              </div>
              <p>
                {groupIndex === 0
                  ? "Precision, personality and six expressions of care."
                  : groupIndex === 1
                    ? "From island sunsets to mountain mornings."
                    : groupIndex === 2
                      ? "From playful beginnings to a world of possibility."
                      : "Six flavours. A memorable place at every table."}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="showroom-explorer" id="collection">
        <div
          className="showroom-section-heading showroom-section"
          data-showroom-reveal
        >
          <div>
            <span className="showroom-kicker">
              All 22 templates / The interactive collection
            </span>
            <h2>
              Find your kind
              <br />
              of extraordinary.
            </h2>
          </div>
          <p>
            Drag the stage. Follow your curiosity.
            <br />
            Every design is a complete website.
          </p>
        </div>
        <div
          className="collection-jump showroom-section"
          role="group"
          aria-label="Explore a template collection"
        >
          {(
            [
              "Dental Clinics",
              "Hotels & Resorts",
              "Education & Schools",
              "Restaurants & Food",
              "Colleges & Institutions",
            ] as const
          ).map((category) => (
            <button
              key={category}
              aria-pressed={t.category === category}
              onClick={() =>
                choose(
                  templates.findIndex((item) => item.category === category),
                )
              }
            >
              {category}
              <span>
                {category === "Dental Clinics" ||
                category === "Restaurants & Food"
                  ? "6"
                  : category === "Colleges & Institutions"
                    ? "2"
                    : "4"}{" "}
                complete websites ↗
              </span>
            </button>
          ))}
        </div>
        <div
          className="explorer-stage"
          ref={region}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Website template explorer"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              choose(active + (e.key === "ArrowRight" ? 1 : -1));
            }
          }}
        >
          <div className="explorer-glow" aria-hidden="true" />
          <div className="explorer-viewport" ref={emblaRef}>
            <div className="explorer-track">
              {templates.map((template, i) => (
                <article
                  key={template.id}
                  className={`collection-card explorer-slide explorer-theme-${template.id} ${active === i ? "is-selected" : ""}`}
                  aria-label={`${template.id} ${template.name}`}
                  style={
                    {
                      "--preview-accent": template.color,
                      "--preview-bg": template.bg,
                    } as React.CSSProperties
                  }
                >
                  <div className="explorer-slide-frame">
                    <div className="showcase-browser-chrome">
                      <i />
                      <i />
                      <i />
                      <span>{template.name}</span>
                      <span>{template.id} / 22</span>
                    </div>
                    <div className="explorer-image">
                      <Image
                        unoptimized
                        className="collection-screenshot"
                        src={template.desktop}
                        fill
                        sizes="(max-width:700px) 85vw, 72vw"
                        alt={`${template.name} desktop website preview`}
                      />
                      <div className="collection-mobile-preview explorer-slide-phone">
                        <Image
                          unoptimized
                          src={template.mobile}
                          fill
                          sizes="(max-width:700px) 95px, 160px"
                          alt={`${template.name} mobile website preview`}
                        />
                      </div>
                      <span className="explorer-frame-shine" />
                    </div>
                    <button
                      onClick={() =>
                        active === i ? live(template.id) : choose(i)
                      }
                      className="explorer-slide-open"
                      aria-label={`Open Template ${template.id} ${template.name}`}
                    >
                      <span>
                        {active === i ? "Enter experience" : "Bring to centre"}
                      </span>
                      <ArrowUpRight size={19} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
        <div className="explorer-controls showroom-section">
          <div className="explorer-pagination" aria-label="Choose a template">
            {templates.map((template, i) => (
              <button
                key={template.id}
                aria-label={`Show ${template.name}`}
                aria-pressed={active === i}
                onClick={() => choose(i)}
              >
                {template.id}
              </button>
            ))}
          </div>
          <span className="explorer-instruction">
            Drag / Swipe / Arrow keys
          </span>
          <div className="explorer-arrows">
            <button
              aria-label="Previous website template"
              onClick={() => choose(active - 1)}
            >
              <ArrowLeft />
            </button>
            <button
              aria-label="Next website template"
              onClick={() => choose(active + 1)}
            >
              <ArrowRight />
            </button>
          </div>
        </div>
        <div className="explorer-caption showroom-section" aria-live="polite">
          <motion.div key={t.id} initial={false} animate={{ opacity: 1, y: 0 }}>
            <span className="showroom-kicker">
              {t.category} / Template {t.id} of 22
            </span>
            <h3>{t.name}</h3>
            <p>{t.description}</p>
          </motion.div>
          <div className="explorer-caption-side">
            <div className="showroom-swatches">
              {t.palette.map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
              <span>{t.model}</span>
            </div>
            <div className="showroom-actions">
              <button className="showroom-button" onClick={() => live()}>
                Explore live website <ArrowUpRight size={17} />
              </button>
              <a className="showroom-text-link" href="#spotlight">
                View details <ArrowDown size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>
      <section
        className={`showroom-spotlight showroom-section spotlight-${t.id}`}
        id="spotlight"
      >
        <div className="spotlight-copy" data-showroom-reveal>
          <div className="spotlight-index">
            {t.id}
            <span>/ 22</span>
          </div>
          <span className="showroom-kicker">Under the spotlight</span>
          <h2>{t.name}</h2>
          <p>{t.description}</p>
          <ul>
            <li>
              <Check size={16} />
              {t.hero}
            </li>
            <li>
              <Check size={16} />
              {t.motion}
            </li>
            <li>
              <Check size={16} />
              {t.navigation}
            </li>
          </ul>
          <div className="showroom-actions">
            <button className="showroom-button" onClick={() => live()}>
              Open live demo <ArrowUpRight size={17} />
            </button>
            <button
              className="showroom-text-link"
              onClick={() => choose(active + 1)}
            >
              Next template <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className={`spotlight-devices ${mobile ? "mobile-focused" : ""}`}>
          <BrowserMockup src={t.desktop} label={t.name} />
          <MobileMockup src={t.mobile} label={t.name} />
          <div
            className="spotlight-device-toggle"
            role="group"
            aria-label="Spotlight device view"
          >
            <button aria-pressed={!mobile} onClick={() => setMobile(false)}>
              <Monitor size={16} />
              Desktop
            </button>
            <button aria-pressed={mobile} onClick={() => setMobile(true)}>
              <Smartphone size={16} />
              Mobile
            </button>
          </div>
        </div>
        <div
          className="spotlight-template-tabs"
          role="tablist"
          aria-label="Inspect a template"
        >
          {templates.map((template, i) => (
            <button
              key={template.id}
              role="tab"
              aria-selected={i === active}
              aria-controls="spotlight"
              onClick={() => choose(i)}
              style={{ "--tab-color": template.color } as React.CSSProperties}
            >
              {template.id}
              <span>{template.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="showroom-features showroom-section" id="features">
        <div className="showroom-section-heading" data-showroom-reveal>
          <div>
            <span className="showroom-kicker">
              There’s more beneath the surface
            </span>
            <h2>
              Designed to feel.
              <br />
              Built to respond.
            </h2>
          </div>
          <p>
            These are working interactions.
            <br />
            Go ahead. Get a little closer.
          </p>
        </div>
        <div className="showroom-feature-grid">
          <LiveTemplateLab
            template={t}
            templates={templates}
            onChoose={choose}
          />
          <article className="feature-scroll">
            <span>02 / Scroll storytelling</span>
            <h3>
              Motion with
              <br />a sense of purpose.
            </h3>
            <div
              className="motion-study"
              data-mode={motionView}
              aria-label="Scroll-linked reveal demonstration"
            >
              {[
                t,
                templates[(active + 1) % templates.length],
                templates[(active + 2) % templates.length],
              ].map((item, i) => (
                <Image
                  unoptimized
                  key={item.id}
                  src={item.desktop}
                  width={640}
                  height={444}
                  alt={`${item.name} motion preview`}
                  style={{ "--motion-layer": i } as React.CSSProperties}
                />
              ))}
            </div>
            <div
              className="motion-view-controls"
              role="group"
              aria-label="Motion study composition"
            >
              {["Spread", "Stack", "Focus"].map((view) => (
                <button
                  key={view}
                  aria-pressed={motionView === view}
                  onClick={() => setMotionView(view)}
                >
                  {view}
                </button>
              ))}
            </div>
            <p>Scroll through layered screens, or choose a composition.</p>
          </article>
          <article className="feature-mobile">
            <span>03 / Mobile, from the start</span>
            <h3>
              Small screen.
              <br />
              Full experience.
            </h3>
            <MobileMockup src={t.mobile} label={t.name} />
            <button
              className="feature-small-button"
              onClick={() => choose(active + 1)}
            >
              Try another design <ArrowRight size={15} />
            </button>
          </article>
          <article className="feature-loaders">
            <span>04 / A memorable first second</span>
            <h3>Twenty-two ways to arrive.</h3>
            <div className="loader-identities">
              {templates.map((template, i) => (
                <button
                  key={template.id}
                  onClick={() => choose(i)}
                  aria-label={`Preview ${template.name} identity`}
                  aria-pressed={active === i}
                >
                  <Image
                    unoptimized
                    src={template.identity}
                    width={80}
                    height={80}
                    alt=""
                  />
                  <span>{template.id}</span>
                </button>
              ))}
            </div>
            <div
              className="arrival-mode"
              role="group"
              aria-label="Arrival animation preview"
            >
              <button
                aria-pressed={arrival === "initial"}
                onClick={() => setArrival("initial")}
              >
                First arrival
              </button>
              <button
                aria-pressed={arrival === "refresh"}
                onClick={() => setArrival("refresh")}
              >
                Refresh
              </button>
            </div>
            <div className="arrival-frame">
              <Image
                unoptimized
                src={t[arrival]}
                width={640}
                height={444}
                alt={`${t.name} ${arrival} animation frame`}
              />
            </div>
            <p>
              {t.name} /{" "}
              {arrival === "initial"
                ? "A distinct first impression."
                : "A shorter welcome back."}
            </p>
            <button className="showroom-text-link" onClick={() => live()}>
              Experience this design <ArrowUpRight size={15} />
            </button>
          </article>
          <article className="feature-booking">
            <span>05 / Clear next steps</span>
            <h3>
              Good experiences
              <br />
              make room for you.
            </h3>
            <div className="booking-study">
              <span>
                {t.restaurantSlug
                  ? "A great meal starts with a little curiosity."
                  : t.schoolSlug
                    ? "A new chapter starts here."
                    : t.hotelSlug
                      ? "Your next escape starts here."
                      : "Let’s talk about your smile."}
              </span>
              <div>
                <i />
                <i />
                <i />
              </div>
              <button
                onClick={() =>
                  t.collegeSlug
                    ? router.push(`${t.href}/${t.actionRoute}`)
                    : t.restaurantSlug
                      ? switchRestaurant(
                          t.restaurantSlug,
                          `${t.href}/${t.actionRoute}`,
                        )
                      : t.schoolSlug
                        ? switchSchool(
                            t.schoolSlug,
                            `${t.href}/${t.actionRoute}`,
                          )
                        : t.hotelSlug
                          ? switchHotel(
                              t.hotelSlug,
                              `${t.href}/${t.actionRoute}`,
                            )
                          : switchTemplate(
                              t.id as AnimationTemplateId,
                              `${t.href}/${t.actionRoute}`,
                            )
                }
              >
                {t.action} <ArrowUpRight size={16} />
              </button>
            </div>
          </article>
          <article className="feature-switch">
            <span>06 / Keep your place</span>
            <Layers2 size={48} strokeWidth={1} />
            <h3>
              Change the world.
              <br />
              Keep the context.
            </h3>
            <p>
              Explore 22 independent designs. Within each collection, switch
              compatible treatment, room or academic pages and keep your place.
            </p>
            <button
              className="showroom-text-link"
              onClick={() =>
                live(templates[(active + 1) % templates.length].id)
              }
            >
              Step into the next design <ArrowUpRight size={15} />
            </button>
          </article>
        </div>
      </section>
      <section className="showroom-compare showroom-section" id="compare">
        <div className="showroom-section-heading" data-showroom-reveal>
          <div>
            <span className="showroom-kicker">A style for your story</span>
            <h2>
              One universe.
              <br />
              Different character.
            </h2>
          </div>
          <p>
            Compare the visual language.
            <br />
            Choose the feeling that fits.
          </p>
        </div>
        <div
          className="comparison-picker"
          role="group"
          aria-label="Compare template styles"
        >
          {templates.map((template, i) => (
            <button
              key={template.id}
              aria-pressed={active === i}
              onClick={() => choose(i)}
            >
              {template.id}
              <span>{template.name}</span>
            </button>
          ))}
        </div>
        <div className="comparison-detail">
          <h3>{t.name}</h3>
          <dl>
            <div>
              <dt>Hero</dt>
              <dd>{t.hero}</dd>
            </div>
            <div>
              <dt>Typography</dt>
              <dd>{t.typography}</dd>
            </div>
            <div>
              <dt>3D signature</dt>
              <dd>{t.model}</dd>
            </div>
            <div>
              <dt>Movement</dt>
              <dd>{t.motion}</dd>
            </div>
            <div>
              <dt>Navigation</dt>
              <dd>{t.navigation}</dd>
            </div>
            <div>
              <dt>Mobile</dt>
              <dd>
                Dedicated composition, touch controls, clear booking actions
              </dd>
            </div>
          </dl>
        </div>
        <details className="comparison-matrix">
          <summary>Compare all twenty-two at once</summary>
          <div>
            <table>
              <caption className="sr-only">
                Twenty-two website design perspectives
              </caption>
              <thead>
                <tr>
                  <th>Design</th>
                  <th>Hero</th>
                  <th>3D signature</th>
                  <th>Motion</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <th>
                      {template.id} {template.name}
                    </th>
                    <td>{template.hero}</td>
                    <td>{template.model}</td>
                    <td>{template.motion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <ProjectGallery />
      <section className="showroom-final showroom-section">
        <div className="final-preview-orbit" aria-hidden="true">
          {templates
            .filter((template) => template.category === t.category)
            .map((template, i) => (
              <Image
                unoptimized
                key={template.id}
                src={template.desktop}
                width={250}
                height={174}
                alt=""
                style={{ "--orbit-index": i } as React.CSSProperties}
              />
            ))}
        </div>
        <span className="showroom-kicker">
          Your next experience could start here
        </span>
        <h2 data-showroom-reveal>
          One vision.
          <br />
          Twenty-two experiences.
          <br />
          Endless possibilities.
        </h2>
        <div className="showroom-actions">
          <a className="showroom-button" href="#collection">
            Explore the templates <ArrowUpRight size={17} />
          </a>
          <a className="showroom-text-link" href="#contact">
            Let’s build yours <ArrowDown size={17} />
          </a>
        </div>
        <p>
          Fictional clinic, hotel, school and restaurant demonstrations.
          Generated imagery and sample profiles.
        </p>
      </section>
      <DeveloperFooter />
    </main>
  );
}
