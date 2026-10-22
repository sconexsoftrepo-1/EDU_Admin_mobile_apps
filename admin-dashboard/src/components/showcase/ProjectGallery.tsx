"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Search,
  X,
  Smartphone,
  Code2,
} from "lucide-react";
import { developerContact, featuredProjects } from "@/data/developerContact";
import catalogue from "@/data/creator-projects.json";
import { mobileProjectScreens } from "@/data/mobile-project-screens";
export default function ProjectGallery() {
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState<(typeof catalogue)[number] | null>(
    null,
  );
  const modal = useRef<HTMLDialogElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const appRail = useRef<HTMLDivElement>(null);
  const concept = mobileProjectScreens.find(
    (screen) => screen.projectId === project?.id,
  );
  function scrollApps(direction: number) {
    appRail.current?.scrollBy({
      left: direction * appRail.current.clientWidth * 0.75,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  const apps = catalogue.filter((p) =>
    ["Flutter", "React Native", "Mobile Application"].includes(p.category),
  );
  const selected = catalogue.filter(
    (p) =>
      (filter === "All" ||
        (filter === "Mobile" ? apps.includes(p) : !apps.includes(p))) &&
      `${p.title} ${p.description} ${p.tags.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  function open(p: (typeof catalogue)[number]) {
    setProject(p);
    modal.current?.showModal();
  }
  return (
    <section className="creator-projects showroom-section" id="projects">
      <div className="showroom-section-heading" data-showroom-reveal>
        <div>
          <span className="showroom-kicker">Beyond the dental collection</span>
          <h2>
            Different worlds.
            <br />
            Same attention to detail.
          </h2>
        </div>
        <p>
          Websites, mobile products, and connected systems by K. Chaitanya.
          Explore the work, then imagine what comes next.
        </p>
      </div>
      <div className="project-rail-controls">
        <span>Selected websites</span>
        <div>
          <button
            aria-label="Previous website project"
            onClick={() =>
              rail.current?.scrollBy({
                left: -rail.current.clientWidth * 0.8,
                behavior: "smooth",
              })
            }
          >
            <ArrowLeft size={18} />
          </button>
          <button
            aria-label="Next website project"
            onClick={() =>
              rail.current?.scrollBy({
                left: rail.current.clientWidth * 0.8,
                behavior: "smooth",
              })
            }
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <div className="creator-project-rail" ref={rail}>
        {featuredProjects.map((p) => (
          <article
            className={`creator-web-project project-${p.id}`}
            key={p.id}
            style={{ "--project-accent": p.color } as React.CSSProperties}
          >
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Visit ${p.name}`}
            >
              <div className="creator-project-image">
                <Image
                  unoptimized
                  src={p.image}
                  alt={`${p.name} website preview`}
                  fill
                  sizes="(max-width:700px) 90vw, 65vw"
                />
                <span>
                  Visit website <ArrowUpRight size={18} />
                </span>
              </div>
              <div className="creator-project-caption">
                <div>
                  <small>{p.category}</small>
                  <h3>{p.name}</h3>
                </div>
                <ArrowUpRight size={30} />
              </div>
            </a>
            <p>{p.description}</p>
          </article>
        ))}
      </div>
      <div className="mobile-work-header" data-showroom-reveal>
        <Image
          unoptimized
          src="/assets/showcase/creator/developer-mobile.webp"
          alt="Chaitanya's existing stylized developer character exploring a mobile interface"
          width={240}
          height={360}
        />
        <div>
          <span className="showroom-kicker">Made for life in motion</span>
          <h2>
            Small screens.
            <br />
            Substantial ideas.
          </h2>
          <p>
            From multilingual agriculture assistants to connected field teams.
            Selected mobile work from the portfolio.
          </p>
        </div>
      </div>
      <div className="project-rail-controls mobile-concept-controls">
        <span>Six app concepts · Scroll to explore</span>
        <div>
          <button
            aria-label="Previous mobile app project"
            onClick={() => scrollApps(-1)}
          >
            <ArrowLeft size={18} />
          </button>
          <button
            aria-label="Next mobile app project"
            onClick={() => scrollApps(1)}
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <div
        className="mobile-project-studio mobile-concept-rail"
        ref={appRail}
        role="region"
        aria-label="Mobile app concept screens"
        tabIndex={0}
      >
        {mobileProjectScreens.map((screen) => {
          const p = catalogue.find((p) => p.id === screen.projectId)!;
          return (
            <article className="mobile-concept-card" key={p.id}>
              <button
                className="mobile-project-device project-concept-device"
                onClick={() => open(p)}
                aria-label={`Read about ${p.title}`}
              >
                <Image
                  unoptimized
                  src={screen.image}
                  alt={`AI-generated ${p.title} app screen concept`}
                  width={screen.width}
                  height={screen.height}
                  sizes="(max-width:700px) 240px,275px"
                />
                <span className="project-device-open">
                  Explore {p.title}
                  <ArrowUpRight size={17} />
                </span>
              </button>
              <div className="mobile-concept-caption">
                <small>AI-generated concept</small>
                <h3>{p.title}</h3>
                <p>{p.description}</p>
              </div>
            </article>
          );
        })}
      </div>
      <details className="project-catalogue">
        <summary>
          Browse the full project catalogue{" "}
          <span>
            {catalogue.length} projects <ArrowUpRight size={18} />
          </span>
        </summary>
        <div className="project-filter-bar">
          <div role="group" aria-label="Filter creator projects">
            {["All", "Mobile", "Web & systems"].map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <label>
            <Search size={17} />
            <span className="sr-only">Search creator projects</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a project or technology"
            />
          </label>
        </div>
        <div className="creator-catalogue-grid">
          {selected.map((p) => (
            <button key={p.id} onClick={() => open(p)}>
              <span>
                {apps.includes(p) ? (
                  <Smartphone size={21} />
                ) : (
                  <Code2 size={21} />
                )}
                <ArrowUpRight size={18} />
              </span>
              {mobileProjectScreens.some(
                (screen) => screen.projectId === p.id,
              ) && (
                <Image
                  unoptimized
                  className="project-catalogue-concept"
                  src={
                    mobileProjectScreens.find(
                      (screen) => screen.projectId === p.id,
                    )!.thumbnail
                  }
                  alt={`AI-generated ${p.title} concept thumbnail`}
                  width={140}
                  height={265}
                />
              )}
              <small>{p.category}</small>
              <h3>{p.title}</h3>
              <p>{p.description}</p>
            </button>
          ))}
        </div>
        {!selected.length && (
          <p role="status">No projects match that search.</p>
        )}
      </details>
      <a
        className="showroom-text-link"
        href={developerContact.portfolio}
        target="_blank"
        rel="noreferrer"
      >
        Enter the complete portfolio <ArrowUpRight size={18} />
      </a>
      <dialog
        className="creator-project-dialog"
        ref={modal}
        onClick={(e) => {
          if (e.target === modal.current) modal.current?.close();
        }}
        aria-labelledby="project-dialog-title"
      >
        <button
          className="project-dialog-close"
          aria-label="Close project details"
          onClick={() => modal.current?.close()}
        >
          <X />
        </button>
        {project && (
          <>
            <span className="showroom-kicker">{project.category}</span>
            <h2 id="project-dialog-title">{project.title}</h2>
            <p>{project.description}</p>
            {concept && (
              <figure className="project-concept-detail">
                <Image
                  unoptimized
                  src={concept.image}
                  alt={`AI-generated ${project.title} app screen concept`}
                  width={concept.width}
                  height={concept.height}
                  sizes="(max-width:700px) 75vw,320px"
                />
                <figcaption>
                  AI-generated concept based on this project’s name and
                  description. Illustrative UI, not an actual app screenshot.
                </figcaption>
              </figure>
            )}
            {project.tags.length > 0 && (
              <div className="project-detail-tags">
                {project.tags.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            )}
            <a
              className="showroom-button"
              href={developerContact.portfolio}
              target="_blank"
              rel="noreferrer"
            >
              View Chaitanya’s portfolio <ArrowUpRight size={17} />
            </a>
          </>
        )}
      </dialog>
    </section>
  );
}
