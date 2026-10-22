"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Component,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowRight, Heart } from "lucide-react";
import type { gsap } from "gsap";
import {
  animationRegistry,
  type AnimationRun,
} from "./config/animationRegistry";
import { buildAnimationTimeline } from "./animationTimeline";
const Scene = dynamic(() => import("./AnimationCanvas"), { ssr: false });
class SceneRecovery extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function AnimationOverlay({
  run,
  onTimeline,
  onCovered,
  onFinishGate,
  onComplete,
  onSkip,
}: {
  run: AnimationRun;
  onTimeline: (key: number, timeline: gsap.core.Timeline) => void;
  onCovered: (key: number) => void;
  onFinishGate: (key: number) => void;
  onComplete: (key: number, reason?: string) => void;
  onSkip: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const cfg = animationRegistry[run.templateId];
  const [sceneReady, setSceneReady] = useState(false);
  const [webgl, setWebgl] = useState(false);
  const ready = useCallback(() => {
    run.performance.fallback = false;
    setSceneReady(true);
  }, [run]);
  const failure = useCallback(() => {
    run.performance.fallback = true;
    setSceneReady(false);
    setWebgl(false);
  }, [run]);
  useLayoutEffect(() => {
    try {
      if (!run.reduced) {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2");
        setWebgl(Boolean(gl));
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      }
    } catch {
      setWebgl(false);
    }
    if (!root.current) return;
    let currentStage = -1;
    const timeline = buildAnimationTimeline(root.current, run, {
      covered: () => onCovered(run.key),
      readyToFinish: () => onFinishGate(run.key),
      complete: () => onComplete(run.key),
      stage: (stage) => {
        if (currentStage === stage) return;
        currentStage = stage;
        root.current?.setAttribute("data-animation-stage", String(stage));
      },
    });
    onTimeline(run.key, timeline);
    return () => {
      timeline.kill();
    };
  }, [run, onTimeline, onCovered, onFinishGate, onComplete]);
  const classes = `animation-overlay animation-theme-${run.templateId} animation-mode-${run.mode} ${run.mode === "switch" ? "route-transition" : run.templateId === "01" ? "intro" : "exp-loader"} ${run.mode} ${run.reduced ? "animation-reduced" : ""}`;
  return (
    <div
      ref={root}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" || run.reduced) return;
        run.clock.pointerX = (event.clientX / innerWidth) * 2 - 1;
        run.clock.pointerY = (event.clientY / innerHeight) * 2 - 1;
      }}
      className={classes}
      data-animation-mode={run.mode}
      data-animation-template={run.templateId}
      data-animation-stage="0"
      aria-label={`${cfg.brand.name} ${run.mode === "refresh" ? "refresh" : run.mode === "switch" ? "template transition" : "introduction"}`}
      style={
        {
          "--animation-bg": cfg.theme.background,
          "--animation-primary": cfg.theme.primary,
          "--animation-secondary": cfg.theme.secondary,
          "--animation-ink": cfg.theme.ink,
          "--animation-orbit-texture": `url(/assets/animations/template-${run.templateId}/textures/orbit.svg)`,
          "--animation-accent-texture": `url(/assets/animations/template-${run.templateId}/particles/accent.svg)`,
          "--animation-background": `url(${cfg.assets.background})`,
          "--animation-mobile-background": `url(${cfg.assets.mobileBackground})`,
        } as React.CSSProperties
      }
    >
      <div className="animation-surface" data-surface data-animation-surface>
        <div className="animation-backdrop" data-backdrop />
        <div className="animation-grid" data-grid />
        {cfg.transition === "tiles" && (
          <div className="animation-tiles" aria-hidden="true">
            {Array.from({ length: 32 }, (_, i) => (
              <i key={i} data-tile />
            ))}
          </div>
        )}
        <div className="animation-atmosphere" aria-hidden="true">
          <span data-dom-orbit />
          <span data-dom-orbit />
          <i className="animation-accent-particle" />
          {run.templateId === "03" && (
            <>
              <i className="animation-bubble bubble-one" />
              <i className="animation-bubble bubble-two" />
              <Heart className="animation-heart" size={28} />
            </>
          )}
          {run.templateId === "05" && (
            <svg
              className="animation-ribbon-sweep"
              viewBox="0 0 1200 700"
              preserveAspectRatio="none"
            >
              <path d="M-150 600C900-70 250 820 1370 20" />
            </svg>
          )}
        </div>
        <div
          className={`animation-scene ${sceneReady ? "scene-ready" : ""}`}
          data-scene
          aria-hidden="true"
        >
          <Image
            unoptimized
            src={cfg.assets.fallback}
            alt=""
            fill
            priority
            sizes="(max-width:600px) 100vw, 650px"
            className="animation-fallback"
          />
          {webgl && !run.reduced && (
            <SceneRecovery onFailure={failure}>
              <Scene run={run} onReady={ready} />
            </SceneRecovery>
          )}
        </div>
        <div className="animation-brand" data-brand>
          {cfg.brand.logo ? (
            <Image
              unoptimized
              src={cfg.brand.logo}
              width={40}
              height={40}
              alt=""
            />
          ) : (
            <svg
              className="animation-brand-mark"
              viewBox="0 0 32 36"
              aria-hidden="true"
            >
              <path
                d="M16 6C5 0 1 9 5 17c2 4 2 14 6 14 3 0 2-12 5-12s2 12 5 12c4 0 4-10 6-14C31 9 27 0 16 6Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          )}
          <span>{cfg.brand.name}</span>
          <small>{cfg.brand.subtitle}</small>
        </div>
        <div className="animation-tagline" aria-hidden="true">
          {cfg.tagline.map((line) => (
            <span key={line} data-tagline>
              {line}
            </span>
          ))}
        </div>
        <div className="animation-gold-sweep" data-sweep aria-hidden="true" />
      </div>
      <button type="button" className="animation-skip" onClick={onSkip}>
        {run.mode === "switch" ? "Continue to template" : "Skip intro"}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
