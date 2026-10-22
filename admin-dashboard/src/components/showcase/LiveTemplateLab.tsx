"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLiveReducedMotion } from "./hooks/useLiveReducedMotion";
import { schools } from "@/data/education";
import { restaurants } from "@/data/restaurants";
import FoodJourney from "@/components/restaurants/FoodJourney";
import { hotels } from "@/data/hotels-resorts";
import type { ShowroomTemplate } from "@/data/showroomCollection";
import type { AnimationTemplateId } from "../animation-system/config/animationRegistry";
const DentalViewer = dynamic(() => import("../three/DentalViewer"), {
  ssr: false,
});
const Scene = dynamic(() => import("../education/SchoolCanvas"), {
  ssr: false,
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
function SpatialStage({ template }: { template: ShowroomTemplate }) {
  const root = useRef<HTMLDivElement>(null),
    progress = useRef(0),
    manualRef = useRef(false);
  const reduced = useLiveReducedMotion();
  const [visible, setVisible] = useState(false),
    [enabled, setEnabled] = useState(true),
    [preset, setPreset] = useState(0),
    [reset, setReset] = useState(0),
    [scroll, setScroll] = useState(true);
  const school = schools.find((s) => s.slug === template.schoolSlug),
    hotel = hotels.find((h) => h.slug === template.hotelSlug);
  const points = school
    ? school.facilities.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        position: f.position,
      }))
    : hotel!.hotspots;
  const [selected, setSelected] = useState(points[0].id);
  const feature = points.find((p) => p.id === selected) || points[0];
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(([e]) =>
      setVisible(e.isIntersecting && !document.hidden),
    );
    observer.observe(el);
    const visibility = () => {
      const r = el.getBoundingClientRect();
      setVisible(!document.hidden && r.top < innerHeight && r.bottom > 0);
    };
    document.addEventListener("visibilitychange", visibility);
    gsap.registerPlugin(ScrollTrigger);
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        progress.current = self.progress;
      },
    });
    return () => {
      observer.disconnect();
      trigger.kill();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const poster = (
    <div className="lab-fallback">
      <Image
        unoptimized
        src={template.desktop}
        fill
        alt={`${template.name} website preview`}
      />
      <span>Explore every space using the guide.</span>
    </div>
  );
  return (
    <div className="collection-spatial-stage" ref={root}>
      <div
        className="collection-canvas"
        style={
          {
            "--school-accent": template.color,
            "--school-ink": "#16213b",
          } as React.CSSProperties
        }
      >
        {visible && enabled ? (
          <Boundary fallback={poster}>
            <Scene
              url={
                school
                  ? school.model
                  : `/assets/hotels-resorts/${hotel!.slug}/models/property.glb`
              }
              points={points}
              selected={selected}
              onSelect={setSelected}
              preset={preset}
              reset={reset}
              reduced={Boolean(reduced)}
              progress={progress}
              scroll={scroll && !reduced}
              manualRef={manualRef}
              onError={() => setEnabled(false)}
              fallback={poster}
            />
          </Boundary>
        ) : (
          poster
        )}
        <span className="lab-scene-label">
          {enabled
            ? "Drag to rotate · Scroll to approach"
            : "Still view · Complete guide below"}
        </span>
      </div>
      <div
        className="lab-camera-controls"
        role="group"
        aria-label="Live preview camera angles"
      >
        {["Overview", "Entrance", "Side", "Aerial"].map((name, i) => (
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
        <button aria-pressed={!enabled} onClick={() => setEnabled((v) => !v)}>
          {enabled ? "Still view" : "Try 3D"}
        </button>
      </div>
      <div
        className="lab-feature-points"
        role="group"
        aria-label="Live preview spaces"
      >
        {points.map((p) => (
          <button
            key={p.id}
            aria-pressed={feature.id === p.id}
            onClick={() => setSelected(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <p className="lab-feature-detail" aria-live="polite">
        <strong>{feature.name}</strong> {feature.description}
      </p>
    </div>
  );
}
export default function LiveTemplateLab({
  template,
  templates,
  onChoose,
}: {
  template: ShowroomTemplate;
  templates: ShowroomTemplate[];
  onChoose: (index: number) => void;
}) {
  return (
    <article className="feature-anatomy collection-live-lab">
      <div className="lab-heading">
        <span>01 / Twenty-two worlds. Real interaction.</span>
        <h3>A different angle on every world.</h3>
        <p>
          Select a design. Rotate its model, choose a camera view and explore
          the details.
        </p>
      </div>
      <div
        className="lab-template-picker"
        role="group"
        aria-label="Interactive template previews"
      >
        {templates.map((t, i) => (
          <button
            key={t.id}
            aria-pressed={t.id === template.id}
            onClick={() => onChoose(i)}
            aria-label={`Interact with ${t.name}`}
          >
            <Image
              unoptimized
              src={t.desktop}
              width={180}
              height={125}
              alt=""
            />
            <span>
              {t.id} / {t.name}
            </span>
          </button>
        ))}
      </div>
      <div className="lab-current-title" aria-live="polite">
        <span>{template.category}</span>
        <h4>{template.name}</h4>
      </div>
      {template.collegeSlug ? (
        <div className="lab-college-preview">
          <h3>{template.name}</h3>
          <p>
            Explore admissions, campus finance, certificate requests, and hostel
            management in the connected demo portal.
          </p>
          <a className="showroom-button" href={`${template.href}/portal/login`}>
            Open college management demo
          </a>
        </div>
      ) : template.restaurantSlug ? (
        (() => {
          const r = restaurants.find(
            (r) => r.slug === template.restaurantSlug,
          )!;
          return (
            <div
              className={`collection-restaurant-preview restaurant-site food-${r.slug}`}
              style={
                {
                  "--food-bg": r.colors.bg,
                  "--food-ink": r.colors.ink,
                  "--food-accent": r.colors.accent,
                  "--food-soft": r.colors.soft,
                  "--food-gold": r.colors.gold,
                } as React.CSSProperties
              }
            >
              <FoodJourney key={r.slug} restaurant={r} />
            </div>
          );
        })()
      ) : template.schoolSlug || template.hotelSlug ? (
        <SpatialStage key={template.id} template={template} />
      ) : (
        <DentalViewer
          key={template.id}
          id={template.id as AnimationTemplateId}
        />
      )}
    </article>
  );
}
