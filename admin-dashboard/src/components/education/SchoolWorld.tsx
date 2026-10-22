"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import type { School } from "@/data/education";
import type { WorldPoint } from "./SchoolCanvas";
const Scene = dynamic(() => import("./SchoolCanvas"), {
  ssr: false,
  loading: () => (
    <p className="school-world-loading">Preparing your learning world…</p>
  ),
});
class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
const learning = [
  [
    "blocks",
    "Alphabet & counting blocks",
    "Build number sense, recognise letters and explore patterns through hands-on play.",
    [-1, 0.9, 0.3],
  ],
  [
    "books",
    "Stories & reading",
    "Language grows through shared stories, questions and a welcoming reading routine.",
    [-2.2, 0.9, -0.8],
  ],
  [
    "puzzle",
    "Creative exploration",
    "Open-ended materials help children test an idea, try again and celebrate a new discovery.",
    [1.4, 1, 0.2],
  ],
  [
    "board",
    "A shared learning board",
    "Pictures, stories and collaborative activities make a lesson a conversation.",
    [0, 1.2, -1.5],
  ],
] as const;
const science = [
  [
    "robot",
    "Robotics & coding",
    "Break a challenge into small steps, build a simple program and reflect on what changes.",
    [-1.2, 1.4, 0.1],
  ],
  [
    "microscope",
    "Close observation",
    "Notice patterns and ask testable questions through guided scientific observation.",
    [1.3, 1.2, -0.5],
  ],
  [
    "experiment",
    "Scientific investigation",
    "Explore physics, chemistry and biology through supervised concept investigations. No experiment instructions are provided.",
    [1.3, 1, 0.35],
  ],
  [
    "globe",
    "A wider perspective",
    "Connect a lesson with people, places and questions beyond the classroom.",
    [-1.2, 1, -0.7],
  ],
  [
    "board",
    "Smart teaching",
    "A shared display connects explanations, visual lessons, discussion and feedback.",
    [0, 1.2, -1.5],
  ],
] as const;
export default function SchoolWorld({
  school,
  kind = "campus",
}: {
  school: School;
  kind?: "campus" | "learning" | "globe";
}) {
  const root = useRef<HTMLElement>(null),
    progress = useRef(0),
    manualRef = useRef(false);
  const [visible, setVisible] = useState(false),
    [enabled, setEnabled] = useState(true),
    [preset, setPreset] = useState(0),
    [reset, setReset] = useState(0),
    [reduced, setReduced] = useState(false),
    [scroll, setScroll] = useState(
      kind === "campus" && school.slug !== "little-sprouts",
    );
  const basePoints: WorldPoint[] =
    kind === "campus"
      ? school.facilities
      : kind === "globe"
        ? [
            {
              id: "dialogue",
              name: "Global dialogue",
              description:
                "A fictional example of cross-cultural discussion through literature, debate and shared questions. No international partnership is claimed.",
              position: [-1, 1.5, 1],
            },
            {
              id: "languages",
              name: "Languages & perspectives",
              description:
                "An example language and culture workshop that explores how a new perspective changes a familiar idea.",
              position: [1.2, 1.6, 0.7],
            },
            {
              id: "community",
              name: "Community projects",
              description:
                "An illustrative local-to-global project connecting research, empathy and community contribution.",
              position: [0.4, 0.3, 1.4],
            },
          ]
        : (school.slug === "little-sprouts" ? learning : science).map(
            ([id, name, description, position]) => ({
              id,
              name,
              description,
              position: [...position] as [number, number, number],
            }),
          );
  const points: WorldPoint[] = basePoints.map((point, i) => {
    if (kind === "learning" && school.slug === "maplewood-high")
      return {
        ...point,
        name: ["Physics", "Biology", "Chemistry", "Experiments", "Lab safety"][
          i
        ],
        description: [
          "Explore patterns of motion and energy through observation, models and thoughtful questions.",
          "Guided observation connects living systems with careful records and new questions.",
          "Explore materials and scientific reasoning through supervised concept investigations.",
          "A good investigation connects a question, an observation and a reflective explanation.",
          "A real school defines approved supervision, apparatus and safety policies before practical work.",
        ][i],
        ...(i === 0
          ? {
              id: "physics",
              position: [-0.2, 1.6, 0.2] as [number, number, number],
            }
          : {}),
      };
    if (kind === "learning" && school.slug === "evergreen-global")
      return {
        ...point,
        name: [
          "Robotics challenge",
          "Research methods",
          "Scientific inquiry",
          "Global perspectives",
          "Peer review",
        ][i],
      };
    return point;
  });
  const [selected, setSelected] = useState(points[0].id);
  const feature = points.find((p) => p.id === selected) || points[0];
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    media.addEventListener("change", motion);
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting && !document.hidden);
        setReduced(media.matches);
      },
      { rootMargin: "0px" },
    );
    if (root.current) observer.observe(root.current);
    const visibility = () => {
      const r = root.current?.getBoundingClientRect();
      setVisible(
        !document.hidden && !!r && r.top < innerHeight && r.bottom > 0,
      );
    };
    document.addEventListener("visibilitychange", visibility);
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: root.current,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          progress.current = self.progress;
        },
      });
    }, root);
    return () => {
      observer.disconnect();
      ctx.revert();
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const poster = (
    <div className="school-world-poster">
      <Image
        unoptimized
        width={1200}
        height={800}
        src={
          kind === "campus" || kind === "globe"
            ? school.hero
            : `/assets/education-schools/${school.slug}/facilities/${school.slug === "little-sprouts" ? "classroom" : "lab"}.webp`
        }
        alt={`${school.name} ${kind} illustration`}
      />
      <span>Every feature is available in the guide.</span>
    </div>
  );
  return (
    <section
      className={`school-world school-world-${kind}`}
      ref={root}
      id={
        kind === "campus"
          ? "campus-explorer"
          : kind === "learning"
            ? "learning-lab"
            : "global-learning"
      }
    >
      <div className="school-world-title school-wrap">
        <span className="school-eyebrow">
          {kind === "campus"
            ? "Your campus, from a new perspective"
            : kind === "learning"
              ? "Ideas come to life"
              : "Learning beyond borders"}
        </span>
        <h2>
          {kind === "campus"
            ? school.slug === "little-sprouts"
              ? "Our little world."
              : school.slug === "evergreen-global"
                ? "A place for greater possibilities."
                : "Step into a day of discovery."
            : kind === "learning"
              ? school.slug === "little-sprouts"
                ? "Learning, through play."
                : school.slug === "maplewood-high"
                  ? "Ask. Investigate. Understand."
                  : "Make an idea tangible."
              : "A wider world of ideas."}
        </h2>
        <p>
          {kind === "campus"
            ? "Rotate the fictional campus, choose a view and discover its spaces."
            : "Select an object to explore the learning it can inspire."}{" "}
          The complete guide works with or without 3D.
        </p>
      </div>
      <div className="school-world-layout school-wrap">
        <div
          className="school-world-stage"
          aria-label={`${school.name} interactive ${kind}`}
        >
          <Boundary fallback={poster}>
            {visible && enabled ? (
              <Scene
                url={`/assets/education-schools/${school.slug}/models/${kind}.glb`}
                points={points}
                selected={selected}
                onSelect={setSelected}
                preset={preset}
                reset={reset}
                reduced={reduced}
                progress={progress}
                scroll={scroll}
                manualRef={manualRef}
                onError={() => setEnabled(false)}
                fallback={poster}
              />
            ) : (
              poster
            )}
          </Boundary>
          <div
            className="school-world-controls"
            role="group"
            aria-label={`${kind} camera views`}
          >
            {["Overview", "Entrance", "Side view", "Aerial"].map((name, i) => (
              <button
                key={name}
                aria-pressed={preset === i}
                onClick={() => {
                  manualRef.current = true;
                  setPreset(i);
                  setReset((v) => v + 1);
                }}
              >
                {name}
              </button>
            ))}
            <button
              onClick={() => {
                manualRef.current = false;
                setPreset(0);
                setReset((v) => v + 1);
              }}
            >
              Reset view
            </button>
            <button
              aria-pressed={scroll}
              onClick={() => {
                manualRef.current = false;
                setScroll((v) => !v);
              }}
            >
              Scroll camera {scroll ? "on" : "off"}
            </button>
            <button
              aria-pressed={!enabled}
              onClick={() => setEnabled((v) => !v)}
            >
              {enabled ? "Still view" : "Enable 3D"}
            </button>
          </div>
        </div>
        <div className="school-world-guide">
          <div role="group" aria-label={`${kind} features`}>
            {points.map((p, i) => (
              <button
                key={p.id}
                aria-pressed={selected === p.id}
                onClick={() => {
                  setSelected(p.id);
                  manualRef.current = true;
                  setPreset(i % 4);
                }}
              >
                <span>{i + 1}</span>
                {p.name}
                <b>↗</b>
              </button>
            ))}
          </div>
          <div aria-live="polite" className="school-world-detail">
            <h3>{feature.name}</h3>
            <p>{feature.description}</p>
            <Link
              href={`/education-schools/${school.slug}/${kind === "campus" ? "facilities#" + feature.id : "academics"}`}
            >
              Explore {kind === "campus" ? "this space" : "our approach"} ↗
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
