"use client";
import { useState } from "react";
import Image from "next/image";
import type { School } from "@/data/education";
export default function SchoolHeroArt({ school }: { school: School }) {
  const [sunny, setSunny] = useState(false);
  return (
    <div
      className={`school-hero-art ${sunny ? "is-sunny" : ""}`}
      onPointerMove={(e) => {
        if (
          e.pointerType !== "mouse" ||
          e.buttons ||
          matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return;
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty(
          "--school-pointer-x",
          String((e.clientX - r.left) / r.width - 0.5),
        );
        e.currentTarget.style.setProperty(
          "--school-pointer-y",
          String((e.clientY - r.top) / r.height - 0.5),
        );
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.setProperty("--school-pointer-x", "0");
        e.currentTarget.style.setProperty("--school-pointer-y", "0");
      }}
    >
      <picture>
        <source media="(max-width:600px)" srcSet={school.mobile} />
        <Image
          unoptimized
          width={1920}
          height={1080}
          src={school.hero}
          alt={`${school.name} fictional ${school.slug === "little-sprouts" ? "illustrated preschool world" : "daylight campus"}`}
          priority
          fetchPriority="high"
        />
      </picture>
      {school.slug === "little-sprouts" && (
        <button
          className="school-hero-sun"
          aria-label="Make the sun smile"
          aria-pressed={sunny}
          onClick={() => setSunny((v) => !v)}
        >
          {sunny ? "☀" : "✺"}
          <span>
            {sunny
              ? "A little sunshine for a curious day!"
              : "Tap for sunshine"}
          </span>
        </button>
      )}
      <span className="school-hero-art-caption">
        A fictional campus, thoughtfully imagined.
      </span>
    </div>
  );
}
