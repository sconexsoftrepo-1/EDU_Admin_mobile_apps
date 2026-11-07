"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X, type LucideIcon } from "lucide-react";
import { hubIcons, screenLabel } from "@/lib/colleges/module-hubs";
import { workspaceDetails } from "@/lib/colleges/workspace-details";
import { SCREEN_CATALOG } from "@/services/api/modules/workspace/catalog";
import { Empty } from "./AnalyticsParts";

const screenTitles = Object.fromEntries(
  SCREEN_CATALOG.map(({ key, title }) => [key, title]),
);

function WorkspaceIllustration({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="mhub-link-icon" aria-hidden="true">
      <svg viewBox="0 0 88 72" focusable="false">
        <ellipse cx="44" cy="61" rx="31" ry="6" className="mhub-art-shadow" />
        <path d="M14 55v4l30 8 30-8v-4" className="mhub-art-base" />
        <path d="m14 55 30-9 30 9-30 8z" className="mhub-art-top" />
        <path d="M13 26h8m-4-4v8m49-14h8m-4-4v8" className="mhub-art-spark" />
        <Icon x={23} y={8} width={42} height={42} strokeWidth={1.65} />
      </svg>
    </span>
  );
}

export default function ModuleWorkspaceSection({
  moduleKey,
  screens,
  labels,
  nav,
  canCreateCampus,
}: {
  moduleKey: string;
  screens: string[];
  labels: Record<string, string>;
  nav: (screen: string) => string;
  canCreateCampus: boolean;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const orderedScreens = screens.filter(
    (screen) => screen !== "module-admissions",
  );
  if (
    moduleKey === "academics" &&
    canCreateCampus &&
    screens.includes("module-academics")
  ) {
    orderedScreens.unshift("create-campus");
  }
  const titles = { ...screenTitles, ...labels };
  const cards = orderedScreens.map((screen) => {
    const title =
      screen === "create-campus"
        ? "Create Campus"
        : screenLabel(screen, titles);
    const [icon, category, description] = workspaceDetails[screen] ?? [
      hubIcons[moduleKey],
      "Other",
      `Manage ${title.toLowerCase()} records.`,
    ];
    return {
      screen,
      icon,
      category,
      description,
      title,
      href: nav(
        screen === "create-campus" ? "module-academics?create=campus" : screen,
      ),
    };
  });
  const groups = [...new Set(cards.map((card) => card.category))];
  const activeGroup = groups.includes(group) ? group : "";
  const search = query.trim().toLocaleLowerCase();
  const visibleCards = cards.filter(
    (card) =>
      (!activeGroup || card.category === activeGroup) &&
      `${card.title} ${card.description}`.toLocaleLowerCase().includes(search),
  );

  return (
    <section
      className="mhub-workspaces"
      aria-labelledby="mhub-workspaces-title"
    >
      <div className="mhub-section-head">
        <div>
          <h2 id="mhub-workspaces-title">
            {moduleKey === "reports"
              ? "Reports & exports"
              : "Module workspaces"}
          </h2>
          <p>
            Access tools, manage records, and complete daily operations from one
            place.
          </p>
        </div>
        <div className="mhub-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Find a workspace"
            placeholder="Find a workspace…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              aria-label="Clear workspace search"
              onClick={() => setQuery("")}
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {cards.length >= 5 && groups.length > 1 && (
        <div
          className="mhub-workspace-groups"
          role="group"
          aria-label="Workspace categories"
        >
          {["", ...groups].map((category) => (
            <button
              type="button"
              key={category}
              aria-pressed={activeGroup === category}
              onClick={() => setGroup(category)}
            >
              {category || "All workspaces"}
            </button>
          ))}
        </div>
      )}
      <div className="mhub-links">
        {visibleCards.map(({ screen, href, title, description, icon }) => (
          <Link key={screen} href={href} prefetch={false}>
            <WorkspaceIllustration icon={icon} />
            <span className="mhub-link-copy">
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <span className="mhub-link-arrow" aria-hidden="true">
              <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
      {!visibleCards.length && (
        <div role="status">
          <Empty>
            {cards.length
              ? "No workspaces match your search and filters."
              : "No workspaces are available."}
          </Empty>
          {!!cards.length && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setGroup("");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </section>
  );
}
