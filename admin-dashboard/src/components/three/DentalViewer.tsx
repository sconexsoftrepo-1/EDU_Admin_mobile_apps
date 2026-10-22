"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, useState, useEffect, useRef, type ReactNode } from "react";
import {
  RotateCcw,
  RotateCw,
  Rotate3D,
  Layers2,
  Heart,
  ScanLine,
} from "lucide-react";
import type { TemplateId } from "@/data/experiences";
const Scene = dynamic(() => import("./DentalScene"), { ssr: false });
class SceneBoundary extends Component<
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
export default function DentalViewer({
  id,
  compact = false,
  assemblyStory = false,
}: {
  id: TemplateId | "01";
  compact?: boolean;
  assemblyStory?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [webgl, setWebgl] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [assembly, setAssembly] = useState(0.45);
  const [wireframe, setWireframe] = useState(false);
  const [rose, setRose] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const [hotspot, setHotspot] = useState("Enamel");
  const greetingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let checked = false;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting && !checked) {
          checked = true;
          try {
            const canvas = document.createElement("canvas");
            const gl = canvas.getContext("webgl2");
            setWebgl(Boolean(gl));
            gl?.getExtension("WEBGL_lose_context")?.loseContext();
          } catch {
            setWebgl(false);
          }
        }
      },
      { rootMargin: "120px" },
    );
    if (ref.current) obs.observe(ref.current);
    return () => {
      obs.disconnect();
      if (greetingTimer.current) clearTimeout(greetingTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!assemblyStory) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        setAssembly(
          Math.max(
            0,
            Math.min(1, (r.top - innerHeight * 0.1) / (innerHeight * 0.65)),
          ),
        );
      });
    };
    addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      removeEventListener("scroll", update);
      cancelAnimationFrame(frame);
    };
  }, [assemblyStory]);
  const fallback = (
    <Image
      src={
        id === "01"
          ? "/assets/animations/template-01/fallbacks/dental.svg"
          : `/assets/templates/${id}.webp`
      }
      alt="Illustrative dental sculpture"
      fill
      sizes="(max-width: 600px) 90vw, 45vw"
      className="viewer-fallback"
    />
  );
  return (
    <div
      ref={ref}
      className={`dental-viewer viewer-${id} ${compact ? "compact" : ""}`}
    >
      <div
        className="viewer-canvas"
        aria-label="Interactive illustrative dental model. Use the rotation buttons or drag the model."
      >
        {visible && webgl ? (
          <SceneBoundary fallback={fallback}>
            <Scene
              id={id}
              rotation={rotation}
              assembly={assembly}
              wireframe={wireframe}
              rose={rose}
              greeting={greeting}
              spin={false}
            />
          </SceneBoundary>
        ) : (
          fallback
        )}
      </div>
      {!compact && (
        <>
          <div className="viewer-caption">
            <Rotate3D size={14} /> Drag to explore · Illustrative 3D model
          </div>
          <div className="viewer-controls">
            <button
              onClick={() => setRotation((v) => v - 35)}
              aria-label="Rotate model left"
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={() => setRotation((v) => v + 35)}
              aria-label="Rotate model right"
            >
              <RotateCw size={15} />
            </button>
            {(id === "02" || id === "04") && (
              <button
                className="viewer-mode"
                onClick={() => setAssembly((v) => (v > 0.2 ? 0 : 1))}
              >
                <Layers2 size={14} />
                {assembly > 0.2 ? "Assemble" : "Explode"}
              </button>
            )}
            {id === "03" && (
              <button
                className="viewer-mode"
                onClick={() => {
                  setGreeting(true);
                  if (greetingTimer.current)
                    clearTimeout(greetingTimer.current);
                  greetingTimer.current = setTimeout(
                    () => setGreeting(false),
                    2500,
                  );
                }}
              >
                <Heart size={14} />
                {greeting ? "Hello, smile!" : "Say hello"}
              </button>
            )}
            {id === "05" && (
              <button
                className="viewer-mode"
                onClick={() => setRose((v) => !v)}
              >
                {rose ? "Pearl finish" : "Rose finish"}
              </button>
            )}
            {id === "06" && (
              <button
                className="viewer-mode"
                onClick={() => setWireframe((v) => !v)}
              >
                <ScanLine size={14} />
                {wireframe ? "Surface view" : "Wireframe"}
              </button>
            )}
          </div>
          {id === "06" && (
            <div className="hotspot-controls">
              <div role="group" aria-label="Explore tooth anatomy">
                {["Enamel", "Pulp", "Root"].map((label) => (
                  <button
                    aria-pressed={hotspot === label}
                    onClick={() => setHotspot(label)}
                    key={label}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p aria-live="polite">
                {hotspot === "Enamel"
                  ? "The protective outer surface of the crown."
                  : hotspot === "Pulp"
                    ? "The soft tissue inside the tooth, containing nerves and blood vessels."
                    : "The part of the tooth that anchors it beneath the gum."}
              </p>
            </div>
          )}
          {greeting && (
            <span className="mascot-heart" aria-hidden="true">
              <Heart fill="currentColor" />
            </span>
          )}
        </>
      )}
    </div>
  );
}
