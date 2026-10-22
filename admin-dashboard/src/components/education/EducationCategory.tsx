"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { schools } from "@/data/education";
import UniverseNavigation from "@/components/showcase/UniverseNavigation";
import BrandReady from "@/components/brand/BrandReady";
import { useAnimation } from "@/components/animation-system/AnimationProvider";
import WhatsAppLink from "@/components/contact/WhatsAppLink";
export default function EducationCategory() {
  const [filter, setFilter] = useState("all"),
    [view, setView] = useState("desktop");
  const { switchSchool } = useAnimation();
  return (
    <main className="education-category showroom">
      <BrandReady />
      <UniverseNavigation />
      <section className="education-category-hero">
        <div>
          <span className="showroom-kicker">
            KC Web Universe / Education & Schools
          </span>
          <h1>
            Four stages of learning.
            <br />
            Four unique digital experiences.
          </h1>
          <p>
            Explore immersive school websites designed for every stage of
            education.
          </p>
          <p>
            Preschool wonder. Primary discovery. High school purpose. Senior
            school possibility. Four complete fictional school concepts, each
            with its own character.
          </p>
          <a className="showroom-text-link" href="#school-collection">
            Explore all four schools ↓
          </a>
        </div>
        <div
          className="education-preview-stack"
          aria-label="Four school website previews"
        >
          {schools.map((s) => (
            <Image
              unoptimized
              width={1440}
              height={1000}
              key={s.slug}
              src={`/assets/education-schools/previews/${s.slug}-desktop.webp`}
              alt={`${s.name} website preview`}
              priority
            />
          ))}
        </div>
      </section>
      <section className="education-category-body" id="school-collection">
        <div
          className="education-category-controls"
          role="group"
          aria-label="School template filter"
        >
          {[
            ["all", "All four schools"],
            ...schools.map((s) => [s.slug, s.level.split(" · ")[0]]),
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className="education-category-controls"
          role="group"
          aria-label="School preview size"
        >
          {["desktop", "mobile"].map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === "desktop" ? "Desktop previews" : "Mobile previews"}
            </button>
          ))}
        </div>
        <div className="education-category-grid">
          {schools
            .filter((s) => filter === "all" || filter === s.slug)
            .map((s) => (
              <article key={s.slug} className="education-category-card">
                <div className={view}>
                  <Image
                    unoptimized
                    width={1440}
                    height={1000}
                    src={`/assets/education-schools/previews/${s.slug}-${view}.webp`}
                    alt={`${s.name} ${view} website screenshot`}
                    loading="lazy"
                  />
                </div>
                <small>
                  {s.level} / Template {s.number}
                </small>
                <h2>{s.name}</h2>
                <p>{s.description}</p>
                <p>
                  {s.slug === "little-sprouts"
                    ? "Playful clay campus · 3D learning objects · Parent connection"
                    : s.slug === "sunrise-international"
                      ? "Campus fly-through · Smart classroom · STEM & reading"
                      : s.slug === "maplewood-high"
                        ? "Bright professional theme · Science lab · Learning dashboard"
                        : "Academic campus · Research & guidance · Interactive globe"}
                </p>
                <button
                  className="showroom-text-link"
                  onClick={() =>
                    switchSchool(s.slug, `/education-schools/${s.slug}`)
                  }
                >
                  Open live school demo ↗
                </button>
              </article>
            ))}
        </div>
        <div className="education-comparison" id="compare-schools">
          <h2>Find the right kind of beginning.</h2>
          <table>
            <thead>
              <tr>
                <th>Template</th>
                <th>Learning stage</th>
                <th>Visual direction</th>
                <th>Signature experience</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s, i) => (
                <tr key={s.slug}>
                  <th>{s.name}</th>
                  <td>{s.level}</td>
                  <td>
                    {
                      [
                        "Playful, warm & colourful",
                        "Fresh, bright & welcoming",
                        "Professional, light & confident",
                        "Academic, elegant & global",
                      ][i]
                    }
                  </td>
                  <td>
                    {
                      [
                        "Play-based 3D classroom",
                        "Campus fly-through & STEM",
                        "Science lab & assessment compass",
                        "Academic campus & global learning",
                      ][i]
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <footer className="education-category-footer">
        <Link href="/templates">← All fourteen website templates</Link>
        <Link href="/">✧ KC Web Universe</Link>
        <WhatsAppLink message="Hi Chaitanya, I’d like to discuss an education or school website." />
        <span>Designed & Developed by K. Chaitanya</span>
      </footer>
    </main>
  );
}
