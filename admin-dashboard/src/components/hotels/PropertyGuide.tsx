"use client";
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Hotel } from "@/data/hotels-resorts";
const Scene = dynamic(() => import("./PropertyCanvas"), {
  ssr: false,
  loading: () => (
    <p className="hotel-scene-loading">Preparing the property model…</p>
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
export default function PropertyGuide({ hotel }: { hotel: Hotel }) {
  const el = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false),
    [enabled, setEnabled] = useState(true),
    [preset, setPreset] = useState(0),
    [selected, setSelected] = useState(hotel.hotspots[0].id),
    [reduced, setReduced] = useState(false),
    [reset, setReset] = useState(0);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    media.addEventListener("change", motion);
    let checked = false;
    const observer = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting && !document.hidden);
        setReduced(media.matches);
        if (e.isIntersecting && !checked) {
          checked = true;
          checkWebGL();
        }
      },
      { rootMargin: "150px" },
    );
    if (el.current) observer.observe(el.current);
    const visibility = () => {
      if (document.hidden) setVisible(false);
      else if (el.current) {
        const r = el.current.getBoundingClientRect();
        setVisible(r.bottom > 0 && r.top < innerHeight + 150);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    function checkWebGL() {
      try {
        const c = document.createElement("canvas");
        const gl = c.getContext("webgl2");
        if (!gl) setEnabled(false);
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        setEnabled(false);
      }
    }
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
    };
  }, []);
  const feature = hotel.hotspots.find((h) => h.id === selected)!;
  return (
    <section className="hotel-property" ref={el} id="property">
      <div className="hotel-property-heading">
        <span className="hotel-kicker">
          A new perspective / Interactive property guide
        </span>
        <h2>
          {hotel.slug === "luxury-hotel"
            ? "An address. Every angle."
            : hotel.slug === "mountain-retreat"
              ? "Your little corner of the wild."
              : hotel.slug === "beach-resort"
                ? "Find your place in the blue."
                : "An island of possibilities."}
        </h2>
        <p>
          Rotate the model, choose a view, or explore the guide. An illustrative
          3D layout of a fictional property.
        </p>
      </div>
      <div className="hotel-property-layout">
        <div
          className="hotel-scene"
          aria-label={`${hotel.name} interactive 3D property`}
        >
          <Boundary
            fallback={
              <p>
                3D is unavailable. Every feature is in the guide beside this
                view.
              </p>
            }
          >
            {visible && enabled ? (
              <Scene
                resetToken={reset}
                hotel={hotel}
                preset={preset}
                reduced={reduced}
                onSelect={setSelected}
                onError={() => setEnabled(false)}
              />
            ) : (
              <div className="hotel-scene-poster">
                <Image
                  unoptimized
                  width={1200}
                  height={800}
                  src={hotel.hero}
                  alt={`${hotel.name} property illustration`}
                />
                <p>
                  {enabled
                    ? "Property view pauses when off screen."
                    : "Use the complete property guide to explore."}
                </p>
              </div>
            )}
          </Boundary>
          <div
            className="hotel-camera-controls"
            role="group"
            aria-label="Camera views"
          >
            {[
              "Overview",
              hotel.slug === "luxury-hotel" ? "Facade" : "Stays",
              "Garden",
              "Above",
              "Deck",
            ].map((v, i) => (
              <button
                key={v}
                aria-pressed={preset === i}
                onClick={() => {
                  setPreset(i);
                  setReset((r) => r + 1);
                }}
              >
                {v}
              </button>
            ))}
            <button
              onClick={() => {
                setPreset(0);
                setReset((r) => r + 1);
              }}
            >
              Reset view
            </button>
            <button
              aria-pressed={!enabled}
              onClick={() => setEnabled((v) => !v)}
            >
              {enabled ? "Use still view" : "Enable 3D"}
            </button>
          </div>
        </div>
        <div className="hotel-property-info">
          <div role="group" aria-label="Property features">
            {hotel.hotspots.map((h, i) => (
              <button
                key={h.id}
                aria-pressed={selected === h.id}
                onClick={() => {
                  setSelected(h.id);
                  setPreset(i % 5);
                }}
              >
                <span>0{i + 1}</span>
                {h.name}
                <b>↗</b>
              </button>
            ))}
          </div>
          <div className="hotel-feature-detail" aria-live="polite">
            <h3>{feature.name}</h3>
            <p>{feature.description}</p>
            <Link
              className="hotel-text-link"
              href={`/hotels-resorts/${hotel.slug}/${feature.href}`}
            >
              Discover {feature.name.toLowerCase()} ↗
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
