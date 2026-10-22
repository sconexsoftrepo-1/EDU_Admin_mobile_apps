"use client";
import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import {
  engineeringPrograms,
  engineeringCourses,
} from "@/data/colleges/engineering";
export default function EngineeringCatalog() {
  const [type, setType] = useState("B.Tech");
  return (
    <section className="engineering-catalog">
      <header>
        <span className="skyline-eyebrow">ENGINEERING / NEXT GENERATION</span>
        <h2>Find your field. Build your future.</h2>
        <p>
          23 fictional programs. Eight engineering disciplines. A practical path
          from foundations to advanced research.
        </p>
      </header>
      <div
        className="engineering-tabs"
        role="group"
        aria-label="Engineering program type"
      >
        {["Diploma", "B.Tech", "M.Tech"].map((t) => (
          <button key={t} aria-pressed={type === t} onClick={() => setType(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="engineering-program-grid">
        {engineeringPrograms
          .filter((p) => p.type === type)
          .map((p, i) => (
            <Link
              href={`/colleges-institutions/skyline-institute/academics/${p.slug}`}
              key={p.slug}
            >
              <Image
                src={`/assets/colleges/skyline/departments/${p.department.replace(/\W/g, "").toLowerCase()}.svg`}
                alt=""
                width="44"
                height="44"
                loading="lazy"
              />
              <small>
                {String(i + 1).padStart(2, "0")} / {p.department}
              </small>
              <h3>{p.branch}</h3>
              <p>
                {p.duration} · {p.semesters} semesters
                {p.lateralEntry ? " · Lateral entry configurable" : ""}
              </p>
              <span>Explore curriculum ↗</span>
            </Link>
          ))}
      </div>
      <p className="engineering-demo-note">
        Fictional institution and illustrative curricula. Official affiliation
        and accreditation: to be configured.
      </p>
      <details>
        <summary>Preview semester curriculum</summary>
        {engineeringPrograms
          .filter((p) => p.type === type)
          .slice(0, 1)
          .map((p) => (
            <div key={p.slug}>
              {Array.from({ length: p.semesters }, (_, i) => (
                <p key={i}>
                  <strong>Semester {i + 1}: </strong>
                  {engineeringCourses(p.name, i + 1)
                    .map((c) => `${c.name} (${c.credits} credits)`)
                    .join(" · ")}
                </p>
              ))}
            </div>
          ))}
      </details>
    </section>
  );
}
