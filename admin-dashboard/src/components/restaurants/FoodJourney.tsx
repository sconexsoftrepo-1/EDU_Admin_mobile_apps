"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Restaurant } from "@/data/restaurants";
import { useLiveReducedMotion } from "@/components/showcase/hooks/useLiveReducedMotion";
import type { FoodClock } from "./FoodCanvas";
import HandiJourney from "./HandiJourney";
const Scene = dynamic(() => import("./FoodCanvas"), { ssr: false });
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
function FoodModelJourney({
  restaurant: r,
  persistent = false,
}: {
  restaurant: Restaurant;
  persistent?: boolean;
}) {
  const root = useRef<HTMLElement>(null),
    clock = useRef<FoodClock>({ progress: 0, chapter: 0, manual: false }),
    path = usePathname(),
    reduced = useLiveReducedMotion();
  const [visible, setVisible] = useState(false),
    [mounted, setMounted] = useState(false),
    [enabled, setEnabled] = useState(true),
    [ready, setReady] = useState(false),
    [open, setOpen] = useState(false),
    [assembly, setAssembly] = useState(0),
    [preset, setPreset] = useState(0),
    [reset, setReset] = useState(0),
    [ingredients, setIngredients] = useState<string[]>([]),
    [feature, setFeature] = useState("Ingredients"),
    [building, setBuilding] = useState(false);
  const home = path === `/restaurants-food/${r.slug}`,
    active = !persistent || home;
  const modelReady = useCallback(() => setReady(true), []),
    failed = useCallback(() => setEnabled(false), []);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting && !document.hidden);
        if (e.isIntersecting) setMounted(true);
      },
      { rootMargin: "100px" },
    );
    observer.observe(el);
    const visibility = () =>
      setVisible(
        !document.hidden &&
          el.getBoundingClientRect().bottom > 0 &&
          el.getBoundingClientRect().top < innerHeight,
      );
    document.addEventListener("visibilitychange", visibility);
    const custom = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (d?.slug === r.slug) setIngredients(d.choices);
    };
    addEventListener("restaurant:ingredients", custom);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      removeEventListener("restaurant:ingredients", custom);
    };
  }, [r.slug]);
  useEffect(() => {
    if (!active || !root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const el = root.current;
    const update = () => {
      if (persistent) {
        const chapters = [
          ...document.querySelectorAll<HTMLElement>(".food-chapter"),
        ];
        if (!chapters.length) return;
        const positions = chapters.map(
          (chapter) => chapter.getBoundingClientRect().top + scrollY,
        );
        const travel = scrollY + innerHeight * 0.12;
        let closest = 0;
        while (
          closest < positions.length - 1 &&
          travel >= positions[closest + 1]
        )
          closest++;
        const next = Math.min(closest + 1, positions.length - 1);
        const local =
          next === closest
            ? 0
            : Math.max(
                0,
                Math.min(
                  1,
                  (travel - positions[closest]) /
                    (positions[next] - positions[closest]),
                ),
              );
        const eased = local * local * (3 - 2 * local);
        const inStory =
          chapters[0].getBoundingClientRect().top < innerHeight &&
          chapters[chapters.length - 1].getBoundingClientRect().bottom > 0;
        setVisible(inStory && !document.hidden);
        if (!inStory) {
          el.style.visibility = "hidden";
          return;
        }
        const chapter = chapters[closest];
        clock.current.chapter = closest;
        clock.current.progress = Math.min(
          1,
          Math.max(0, (closest + eased) / (chapters.length - 1)),
        );
        el.dataset.chapter = String(closest);
        if (innerWidth <= 700) {
          const slot = chapter.querySelector<HTMLElement>(".food-scene-slot");
          const rect = slot?.getBoundingClientRect();
          el.style.top = rect ? `${rect.top}px` : "110px";
          el.style.left = rect ? `${rect.left}px` : "5vw";
          el.style.width = rect ? `${rect.width}px` : "90vw";
          el.style.height = "410px";
          el.style.transform = "none";
          el.style.visibility =
            rect && rect.bottom > 70 && rect.top < innerHeight
              ? "visible"
              : "hidden";
        } else {
          el.style.top = "21vh";
          el.style.left = "auto";
          el.style.width = "44vw";
          el.style.height = "58vh";
          el.style.visibility = "visible";
          const offsets = [0, -92, 0, 8, -92, 0, 0],
            scales = [1.12, 1, 0.96, 0.68, 0.9, 0.85, 1.1];
          const x =
            (offsets[closest] || 0) +
            ((offsets[next] || 0) - (offsets[closest] || 0)) * eased;
          const scale =
            scales[closest] + (scales[next] - scales[closest]) * eased;
          el.style.transform = `translateX(${reduced ? 0 : x}%) scale(${reduced ? 1 : scale})`;
          el.dataset.storyProgress = clock.current.progress.toFixed(4);
          const alphas = [1, 1, 1, 0.18, 0.95, 1, 1];
          const alpha =
            alphas[closest] + (alphas[next] - alphas[closest]) * eased;
          el.style.opacity = String(alpha);
          el.style.pointerEvents = alpha < 0.4 ? "none" : "auto";
        }
      } else {
        const box = el.getBoundingClientRect();
        clock.current.progress = Math.max(
          0,
          Math.min(1, (innerHeight - box.top) / (innerHeight + box.height)),
        );
      }
    };
    const trigger = ScrollTrigger.create({
      trigger: persistent ? document.querySelector(".food-home") : el,
      start: "top bottom",
      end: "bottom top",
      onUpdate: update,
    });
    update();
    addEventListener("resize", update);
    return () => {
      trigger.kill();
      removeEventListener("resize", update);
    };
  }, [persistent, active, path, reduced]);
  const poster = (
    <Image
      unoptimized
      fill
      src={r.menu[0].image}
      alt={`${r.name} signature dish illustration`}
      sizes="(max-width:700px) 90vw,45vw"
    />
  );
  return (
    <section
      ref={root}
      className={
        persistent
          ? "food-journey food-persistent"
          : "food-journey food-inline-world"
      }
      data-active={active}
      data-ready={ready}
      aria-hidden={!active}
      inert={!active}
      style={
        !active ? { visibility: "hidden", pointerEvents: "none" } : undefined
      }
    >
      {!persistent && (
        <div className="food-section-heading">
          <div>
            <small>Change your perspective</small>
            <h2>
              {r.slug === "greenbowl-cafe"
                ? "Fresh ideas, from every angle."
                : r.slug === "spice-route"
                  ? "A little spice. A whole journey."
                  : "A closer look at the craft."}
            </h2>
          </div>
          <p>
            Real 3D geometry. Drag to rotate, change the camera or use the
            illustrated guide.
          </p>
        </div>
      )}
      <div className="food-model-stage" data-model-ready={ready}>
        {mounted && enabled ? (
          <Boundary fallback={poster}>
            <Scene
              key={building ? "building" : "food"}
              url={`/assets/restaurants-food/${r.slug}/models/${building ? "building" : "food"}.glb`}
              clockRef={clock}
              open={open}
              assembly={assembly}
              ingredients={ingredients}
              preset={preset}
              reset={reset}
              reduced={reduced}
              visible={visible && active}
              onReady={modelReady}
              onError={failed}
            />
          </Boundary>
        ) : (
          poster
        )}
        {enabled && !ready && (
          <span className="food-model-loading" role="status">
            Preparing the 3D scene…
          </span>
        )}
        <span className="food-model-caption">
          {building
            ? "Illustrative restaurant architecture"
            : r.slug === "royal-biryani-house"
              ? "The signature handi"
              : "A closer look at the flavours"}{" "}
          · {persistent ? "One scene, through the story" : "Drag to rotate"}
        </span>
      </div>
      <div
        className="food-model-controls"
        role="group"
        aria-label={`${r.name} 3D controls`}
      >
        {["Portrait", "Top view", "Side view", "Front"].map((name, i) => (
          <button
            key={name}
            aria-pressed={preset === i}
            onClick={() => {
              clock.current.manual = true;
              setPreset(i);
              setReset((v) => v + 1);
            }}
          >
            {name}
          </button>
        ))}
        <button
          onClick={() => {
            clock.current.manual = false;
            setPreset(0);
            setReset((v) => v + 1);
          }}
        >
          Reset view
        </button>
        {r.slug === "royal-biryani-house" && (
          <button aria-pressed={open} onClick={() => setOpen((v) => !v)}>
            {open ? "Lower lid" : "Lift lid"}
          </button>
        )}
        <button
          aria-pressed={assembly > 0}
          onClick={() => setAssembly((v) => (v ? 0 : 1))}
        >
          {assembly ? "Bring together" : "Separate ingredients"}
        </button>
        {!persistent && (
          <button
            aria-pressed={building}
            onClick={() => {
              setBuilding((v) => !v);
              setReady(false);
            }}
          >
            {building ? "Food sculpture" : "Restaurant model"}
          </button>
        )}
        <button aria-pressed={!enabled} onClick={() => setEnabled((v) => !v)}>
          {enabled ? "Still view" : "Try 3D"}
        </button>
      </div>
      {!persistent && (
        <div className="food-model-guide">
          <div role="group" aria-label="Food story details">
            {["Ingredients", "Preparation", "Setting"].map((f) => (
              <button
                key={f}
                aria-pressed={feature === f}
                onClick={() => setFeature(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <p aria-live="polite">
            {feature === "Ingredients"
              ? r.menu[0].description
              : feature === "Preparation"
                ? "An illustrative visual sequence: ingredients assemble, the vessel opens and the camera moves above the dish. This is not a cooking or food-safety guide."
                : "Explore the fictional restaurant model or the generated interior gallery. No real business or venue is depicted."}
          </p>
        </div>
      )}
    </section>
  );
}

export default function FoodJourney(props: {
  restaurant: Restaurant;
  persistent?: boolean;
}) {
  return props.restaurant.slug.includes("biryani") ? (
    <HandiJourney {...props} />
  ) : (
    <FoodModelJourney {...props} />
  );
}
