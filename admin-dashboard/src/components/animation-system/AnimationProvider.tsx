"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";
import AnimationOverlay from "./AnimationOverlay";
import SchoolLoader from "../education/SchoolLoader";
import RestaurantLoader from "../restaurants/RestaurantLoader";
import {
  restaurantBySlug,
  restaurantFromPath,
  type RestaurantSlug,
} from "@/data/restaurants";
import {
  schoolBySlug,
  schoolFromPath,
  type SchoolSlug,
} from "@/data/education";
import HotelLoader from "../hotels/HotelLoader";
import {
  hotelBySlug,
  hotelFromPath,
  type HotelSlug,
} from "@/data/hotels-resorts";
import BrandOverlay from "../brand/BrandOverlay";
import { brandConfig, isBrandPath } from "../brand/config/brandConfig";
import {
  animationRegistry,
  createClock,
  templateFromPath,
  type AnimationMode,
  type AnimationRun,
  type AnimationTemplateId,
} from "./config/animationRegistry";
import {
  chooseAnimationMode,
  hasVisited,
  markVisited,
} from "./hooks/useAnimationMode";
type ContextValue = {
  switchRestaurant: (
    slug: RestaurantSlug,
    path: string,
    origin?: { x: number; y: number },
  ) => void;
  switchSchool: (
    slug: SchoolSlug,
    path: string,
    origin?: { x: number; y: number },
  ) => void;
  switchHotel: (
    slug: HotelSlug,
    path: string,
    origin?: { x: number; y: number },
  ) => void;
  switchTemplate: (
    id: AnimationTemplateId,
    path: string,
    origin?: { x: number; y: number },
  ) => void;
  markReady: (path: string, id: AnimationTemplateId) => void;
  busy: boolean;
  skip: () => void;
};
const AnimationContext = createContext<ContextValue | null>(null);
type Active = {
  run: AnimationRun;
  timeline: gsap.core.Timeline | null;
  watchdog: ReturnType<typeof setTimeout> | null;
  navigated: boolean;
  atGate: boolean;
  ready: boolean;
  finished: boolean;
  qaPaused: boolean;
  qaSeekTime?: number;
};
type Metric = {
  templateId: AnimationTemplateId;
  hotel?: HotelSlug;
  school?: SchoolSlug;
  restaurant?: RestaurantSlug;
  mode: AnimationMode;
  durationMs: number;
  frames: number;
  averageFrameMs: number;
  p95FrameMs: number;
  longFrames: number;
  drawCalls: number;
  triangles: number;
  dpr: number;
  variant: string;
  fallback: boolean;
  reason: string;
};
type QA = {
  snapshot: () => {
    templateId: AnimationTemplateId;
    mode: AnimationMode;
    time: number;
    stage: string | null;
    paused: boolean;
  } | null;
  seek: (time: number) => void;
  play: () => void;
  skip: () => void;
  switchTo: (id: AnimationTemplateId, destination?: string) => void;
  metrics: Metric[];
};
declare global {
  interface Window {
    __DENTAL_ANIMATION_QA__?: QA;
    __DENTAL_ANIMATION_METRICS__?: Metric[];
  }
}
function scenePreload(id: AnimationTemplateId) {
  const cfg = animationRegistry[id];
  const image = new Image();
  image.src = cfg.assets.fallback;
  void import("./AnimationCanvas")
    .then((module) => module.preloadAnimationModel(id))
    .catch(() => {
      /* The local SVG remains visible if WebGL preparation fails. */
    });
}
export function useAnimation() {
  const context = useContext(AnimationContext);
  if (!context) throw Error("AnimationProvider is required");
  return context;
}
export default function AnimationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [run, setRun] = useState<AnimationRun | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const active = useRef<Active | null>(null);
  const path = useRef(pathname);
  path.current = pathname;
  const lastPath = useRef<string | null>(null);
  const readyPaths = useRef(new Set<string>());
  const historyNavigation = useRef(false);
  const counter = useRef(0);
  const mountGeneration = useRef(0);
  const heroContext = useRef<gsap.Context | null>(null);
  const operations = useRef<{
    complete: (key: number, reason?: string) => void;
    resume: () => void;
    skip: () => void;
  }>({ complete: () => {}, resume: () => {}, skip: () => {} });
  const revealHero = useCallback((id: AnimationTemplateId, focus: boolean) => {
    requestAnimationFrame(() => {
      if (active.current || templateFromPath(path.current) !== id) return;
      const cfg = animationRegistry[id];
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      heroContext.current?.revert();
      if (!reduced) {
        heroContext.current = gsap.context(() => {
          const headline = document.querySelector(cfg.hero.headline);
          if (!headline) return;
          const visual = document.querySelector(cfg.hero.visual),
            cards = gsap.utils.toArray<HTMLElement>(cfg.hero.cards),
            actions = document.querySelector(cfg.hero.actions);
          const tl = gsap.timeline();
          tl.fromTo(
            headline,
            { opacity: 0, y: 15 },
            { opacity: 1, y: 0, duration: 0.48, ease: "power2.out" },
            0,
          );
          if (visual)
            tl.fromTo(
              visual,
              { opacity: 0.65, scale: 1.015 },
              { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" },
              0.05,
            );
          if (cards.length)
            tl.fromTo(
              cards,
              { opacity: 0, y: 8 },
              { opacity: 1, y: 0, stagger: 0.06, duration: 0.35 },
              0.23,
            );
          if (actions)
            tl.fromTo(
              actions,
              { opacity: 0, y: 6 },
              { opacity: 1, y: 0, duration: 0.3 },
              0.32,
            );
        });
      }
      if (focus) {
        const heading = document.querySelector<HTMLElement>("main h1");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      }
      window.dispatchEvent(
        new CustomEvent("dentalverse:animation-complete", {
          detail: { templateId: id },
        }),
      );
    });
  }, []);
  const complete = useCallback(
    (key: number, reason = "completed") => {
      const state = active.current;
      if (!state || state.run.key !== key || state.finished) return;
      state.finished = true;
      gsap.ticker.lagSmoothing(500, 33);
      state.timeline?.kill();
      if (state.watchdog) clearTimeout(state.watchdog);
      const stats = state.run.performance,
        sorted = [...stats.frameMs].sort((a, b) => a - b);
      const metric: Metric = {
        templateId: state.run.templateId,
        hotel: state.run.hotel,
        school: state.run.school,
        restaurant: state.run.restaurant,
        mode: state.run.mode,
        durationMs: Math.round(performance.now() - state.run.startedAt),
        frames: stats.frames,
        averageFrameMs: sorted.length
          ? Math.round(
              (sorted.reduce((a, b) => a + b, 0) / sorted.length) * 100,
            ) / 100
          : 0,
        p95FrameMs: sorted.length
          ? Math.round(sorted[Math.floor((sorted.length - 1) * 0.95)] * 100) /
            100
          : 0,
        longFrames: sorted.filter((ms) => ms > 50).length,
        drawCalls: stats.drawCalls,
        triangles: stats.triangles,
        dpr: stats.dpr,
        variant: stats.variant,
        fallback: stats.fallback,
        reason,
      };
      window.__DENTAL_ANIMATION_METRICS__ = [
        ...(window.__DENTAL_ANIMATION_METRICS__ || []).slice(-59),
        metric,
      ];
      performance.mark(`dental-animation-end-${key}`);
      performance.measure(
        `dental-animation-${state.run.templateId}-${state.run.mode}`,
        `dental-animation-start-${key}`,
        `dental-animation-end-${key}`,
      );
      if (state.run.brand && state.run.mode !== "switch" && !state.run.reduced)
        gsap.set(".cosmic-hero-copy > *", { opacity: 0, y: 18 });
      active.current = null;
      setRun(null);
      document.documentElement.removeAttribute("data-dental-animation");
      setAnnouncement(
        state.run.restaurant
          ? `${restaurantBySlug(state.run.restaurant)!.name} is ready.`
          : state.run.school
            ? `${schoolBySlug(state.run.school)!.name} is ready.`
            : `${state.run.brand && state.run.mode !== "switch" ? brandConfig.wordmark : state.run.hotel ? hotelBySlug(state.run.hotel)!.name : animationRegistry[state.run.templateId].brand.name} is ready.`,
      );
      if (state.run.brand && state.run.mode !== "switch")
        window.dispatchEvent(new CustomEvent("brand:animation-complete"));
      if (
        state.run.brand &&
        state.run.mode !== "switch" &&
        reason === "skipped"
      )
        requestAnimationFrame(() => {
          const h = document.querySelector<HTMLElement>("main h1");
          if (h) {
            h.tabIndex = -1;
            h.focus({ preventScroll: true });
          }
        });
      const focus = state.run.mode === "switch" || reason === "skipped";
      if (state.run.school || state.run.restaurant) {
        window.dispatchEvent(
          new CustomEvent(
            state.run.restaurant
              ? "restaurant:animation-complete"
              : "school:animation-complete",
          ),
        );
        if (focus)
          requestAnimationFrame(() => {
            const h = document.querySelector<HTMLElement>("main h1");
            if (h) {
              h.tabIndex = -1;
              h.focus({ preventScroll: true });
            }
          });
      } else if (state.run.hotel) {
        window.dispatchEvent(new CustomEvent("hotel:animation-complete"));
        if (focus)
          requestAnimationFrame(() => {
            const h = document.querySelector<HTMLElement>("main h1");
            if (h) {
              h.tabIndex = -1;
              h.focus({ preventScroll: true });
            }
          });
      } else revealHero(state.run.templateId, focus);
    },
    [revealHero],
  );
  operations.current.complete = complete;
  const cancel = useCallback(() => {
    const state = active.current;
    if (!state) return;
    gsap.ticker.lagSmoothing(500, 33);
    state.timeline?.kill();
    if (state.watchdog) clearTimeout(state.watchdog);
    state.finished = true;
    active.current = null;
    setRun(null);
    document.documentElement.removeAttribute("data-dental-animation");
  }, []);
  const begin = useCallback(
    (
      id: AnimationTemplateId,
      mode: AnimationMode,
      destination: string,
      origin = { x: 50, y: 50 },
      hotel?: HotelSlug,
      school?: SchoolSlug,
      restaurant?: RestaurantSlug,
    ) => {
      cancel();
      heroContext.current?.revert();
      heroContext.current = null;
      const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced && mode !== "switch") {
        if (isBrandPath(destination)) {
          try {
            sessionStorage.setItem("cosmic-brand-visited", "1");
          } catch {}
        } else if (restaurant) {
          try {
            sessionStorage.setItem(`restaurant-${restaurant}`, "1");
          } catch {}
        } else if (school) {
          try {
            sessionStorage.setItem(`school-${school}`, "1");
          } catch {}
        } else if (hotel) {
          try {
            sessionStorage.setItem(`hotel-${hotel}`, "1");
          } catch {}
        } else markVisited(id);
        return;
      }
      // Keep wall-clock duration through shader compilation instead of GSAP stretching a stalled frame.
      // Restore the normal page animation policy when this single foreground sequence ends.
      gsap.ticker.lagSmoothing(0);
      const key = ++counter.current;
      const branded = mode === "switch" || isBrandPath(destination);
      const next: AnimationRun = {
        brand: branded,
        hotel,
        school,
        restaurant,
        key,
        templateId: id,
        mode,
        path: destination,
        reduced,
        origin,
        clock: createClock(mode),
        performance: {
          frames: 0,
          frameMs: [],
          drawCalls: 0,
          triangles: 0,
          dpr: 0,
          variant: "fallback",
          fallback: true,
        },
        startedAt: performance.now(),
      };
      const state: Active = {
        run: next,
        timeline: null,
        watchdog: null,
        navigated: mode !== "switch",
        atGate: false,
        ready:
          mode !== "switch" &&
          readyPaths.current.has(destination) &&
          path.current === destination,
        finished: false,
        qaPaused: false,
      };
      active.current = state;
      if (branded && mode !== "switch") {
        try {
          sessionStorage.setItem("cosmic-brand-visited", "1");
        } catch {}
      } else if (restaurant) {
        try {
          sessionStorage.setItem(`restaurant-${restaurant}`, "1");
        } catch {}
      } else if (school) {
        try {
          sessionStorage.setItem(`school-${school}`, "1");
        } catch {}
      } else if (hotel) {
        try {
          sessionStorage.setItem(`hotel-${hotel}`, "1");
        } catch {}
      } else markVisited(id);
      performance.mark(`dental-animation-start-${key}`);
      document.documentElement.setAttribute(
        "data-dental-animation",
        mode === "switch" ? "transition" : "active",
      );
      state.watchdog = setTimeout(() => {
        if (active.current?.run.key !== key) return;
        if (mode === "switch" && !state.navigated) {
          state.navigated = true;
          router.push(destination);
        }
        operations.current.complete(key, "safety-timeout");
      }, 8000);
      setAnnouncement(
        restaurant
          ? `Opening ${restaurantBySlug(restaurant)!.name}`
          : school
            ? `Opening ${schoolBySlug(school)!.name}`
            : `Opening ${branded && mode !== "switch" ? brandConfig.wordmark : animationRegistry[id].brand.name}, ${branded ? brandConfig.tagline : animationRegistry[id].tagline.join(" ")}`,
      );
      setRun(next);
      if (!reduced && !branded && !hotel && !school && !restaurant)
        scenePreload(id);
      window.dispatchEvent(
        new CustomEvent("dentalverse:animation-start", {
          detail: { templateId: id, mode, key },
        }),
      );
    },
    [cancel, router],
  );
  const resume = useCallback(() => {
    const state = active.current;
    if (
      !state ||
      state.finished ||
      !state.atGate ||
      !state.ready ||
      !state.timeline ||
      state.qaPaused
    )
      return;
    state.atGate = false;
    queueMicrotask(() => {
      if (active.current?.run.key === state.run.key && !state.qaPaused)
        state.timeline?.resume();
    });
  }, []);
  operations.current.resume = resume;
  const markReady = useCallback(
    (destination: string, id: AnimationTemplateId) => {
      readyPaths.current.add(destination);
      const state = active.current;
      if (
        state &&
        state.run.path === destination &&
        state.run.templateId === id &&
        path.current === destination
      ) {
        state.ready = true;
        operations.current.resume();
      }
    },
    [],
  );
  const switchTemplate = useCallback(
    (
      id: AnimationTemplateId,
      destination: string,
      origin?: { x: number; y: number },
    ) => {
      if (templateFromPath(path.current) === id && !active.current) return;
      if (
        active.current?.run.templateId === id &&
        active.current.run.path === destination
      )
        return;
      router.prefetch(destination);
      begin(id, "switch", destination, origin);
    },
    [begin, router],
  );
  const switchHotel = useCallback(
    (
      slug: HotelSlug,
      destination: string,
      origin?: { x: number; y: number },
    ) => {
      if (path.current === destination && !active.current) return;
      router.prefetch(destination);
      begin("01", "switch", destination, origin, slug);
    },
    [begin, router],
  );
  const switchSchool = useCallback(
    (
      slug: SchoolSlug,
      destination: string,
      origin?: { x: number; y: number },
    ) => {
      if (path.current === destination && !active.current) return;
      router.prefetch(destination);
      begin("01", "switch", destination, origin, undefined, slug);
    },
    [begin, router],
  );
  const switchRestaurant = useCallback(
    (
      slug: RestaurantSlug,
      destination: string,
      origin?: { x: number; y: number },
    ) => {
      if (path.current === destination && !active.current) return;
      router.prefetch(destination);
      begin("01", "switch", destination, origin, undefined, undefined, slug);
    },
    [begin, router],
  );
  const attachTimeline = useCallback(
    (key: number, timeline: gsap.core.Timeline) => {
      const state = active.current;
      if (!state || state.run.key !== key) {
        timeline.kill();
        return;
      }
      state.timeline = timeline;
      // Align a new foreground timeline with real time rather than the previous RAF tick.
      if (state.run.brand && !state.qaPaused) {
        gsap.ticker.tick();
        state.run.startedAt = performance.now();
      }
      if (state.qaSeekTime !== undefined) {
        timeline.pause();
        timeline.time(state.qaSeekTime, false);
        timeline.pause();
      } else timeline.play(0);
    },
    [],
  );
  const covered = useCallback(
    (key: number) => {
      const state = active.current;
      if (!state || state.run.key !== key) return;
      state.atGate = true;
      document.documentElement.setAttribute("data-dental-animation", "active");
      if (!state.navigated) {
        state.navigated = true;
        if (path.current === state.run.path)
          state.ready = readyPaths.current.has(state.run.path);
        else router.push(state.run.path);
      }
      if (
        state.run.mode !== "switch" &&
        path.current === state.run.path &&
        readyPaths.current.has(state.run.path)
      )
        state.ready = true;
      operations.current.resume();
    },
    [router],
  );
  const finishGate = useCallback((key: number) => {
    const state = active.current;
    if (!state || state.run.key !== key) return;
    state.atGate = true;
    state.ready =
      path.current === state.run.path && readyPaths.current.has(state.run.path);
    operations.current.resume();
  }, []);
  const skip = useCallback(() => {
    const state = active.current;
    if (!state) return;
    if (state.run.mode === "switch" && !state.ready) {
      state.timeline?.pause();
      document.documentElement.setAttribute("data-dental-animation", "active");
      gsap.set(document.querySelector("[data-animation-surface]"), {
        clipPath: "inset(0 0 0 0)",
        "--aperture": "0%",
      });
      state.atGate = true;
      if (!state.navigated) {
        state.navigated = true;
        router.push(state.run.path);
      }
      if (state.timeline) {
        state.timeline.eventCallback("onComplete", () =>
          operations.current.complete(state.run.key, "skipped"),
        );
        state.timeline.seek(
          state.run.reduced ? 0.05 : state.run.brand ? 0.4 : 0.32,
          true,
        );
      }
      operations.current.resume();
      return;
    }
    operations.current.complete(state.run.key, "skipped");
  }, [router]);
  operations.current.skip = skip;
  useEffect(() => {
    if (lastPath.current === pathname) return;
    setBooting(false);
    const previous = lastPath.current;
    lastPath.current = pathname;
    const id = templateFromPath(pathname);
    const state = active.current;
    if (state?.run.mode === "switch") {
      if (state.run.path === pathname) {
        operations.current.resume();
      }
      return;
    }
    if (state && state.run.path !== pathname) cancel();
    const restaurant = restaurantFromPath(pathname);
    if (restaurant) {
      if (previous === null && !historyNavigation.current) {
        let visited = false;
        try {
          visited =
            sessionStorage.getItem(`restaurant-${restaurant.slug}`) === "1";
        } catch {}
        const reload =
          (
            performance.getEntriesByType("navigation")[0] as
              PerformanceNavigationTiming | undefined
          )?.type === "reload";
        if (!visited || reload)
          begin(
            "01",
            visited && reload ? "refresh" : "initial",
            pathname,
            undefined,
            undefined,
            undefined,
            restaurant.slug,
          );
      }
      historyNavigation.current = false;
      return;
    }
    const school = schoolFromPath(pathname);
    if (school) {
      if (previous === null && !historyNavigation.current) {
        let visited = false;
        try {
          visited = sessionStorage.getItem(`school-${school.slug}`) === "1";
        } catch {}
        const reload =
          (
            performance.getEntriesByType("navigation")[0] as
              PerformanceNavigationTiming | undefined
          )?.type === "reload";
        if (!visited || reload)
          begin(
            "01",
            visited && reload ? "refresh" : "initial",
            pathname,
            undefined,
            undefined,
            school.slug,
          );
      }
      historyNavigation.current = false;
      return;
    }
    const hotel = hotelFromPath(pathname);
    if (hotel) {
      if (previous === null && !historyNavigation.current) {
        let visited = false;
        try {
          visited = sessionStorage.getItem(`hotel-${hotel.slug}`) === "1";
        } catch {}
        const reload =
          (
            performance.getEntriesByType("navigation")[0] as
              PerformanceNavigationTiming | undefined
          )?.type === "reload";
        if (!visited || reload)
          begin(
            "01",
            visited && reload ? "refresh" : "initial",
            pathname,
            undefined,
            hotel.slug,
          );
      }
      historyNavigation.current = false;
      return;
    }
    if (!id) {
      if (
        isBrandPath(pathname) &&
        previous === null &&
        !historyNavigation.current
      ) {
        let visited = false;
        try {
          visited = sessionStorage.getItem("cosmic-brand-visited") === "1";
        } catch {}
        const reload =
          (
            performance.getEntriesByType("navigation")[0] as
              PerformanceNavigationTiming | undefined
          )?.type === "reload";
        if (!visited || reload)
          begin("01", reload && visited ? "refresh" : "initial", pathname);
      }
      historyNavigation.current = false;
      return;
    }
    const mode = chooseAnimationMode({
      id,
      previousPath: previous,
      documentEntry: previous === null,
      reload:
        (
          performance.getEntriesByType("navigation")[0] as
            PerformanceNavigationTiming | undefined
        )?.type === "reload",
      visited: hasVisited(id),
      history: historyNavigation.current,
    });
    historyNavigation.current = false;
    if (mode) begin(id, mode, pathname);
  }, [pathname, begin, cancel]);
  useEffect(() => {
    const generation = ++mountGeneration.current;
    const pop = () => {
      historyNavigation.current = true;
      cancel();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && active.current) {
        e.preventDefault();
        operations.current.skip();
      }
    };
    const visibility = () => {
      const state = active.current;
      if (!state?.timeline) return;
      if (document.hidden) state.timeline.pause();
      else if (!state.atGate && !state.qaPaused) state.timeline.resume();
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("keydown", key);
    document.addEventListener("visibilitychange", visibility);
    if (process.env.NODE_ENV === "development") {
      window.__DENTAL_ANIMATION_QA__ = {
        snapshot: () => {
          const s = active.current;
          return s
            ? {
                templateId: s.run.templateId,
                mode: s.run.mode,
                time: s.timeline?.time() || 0,
                stage:
                  document
                    .querySelector("[data-animation-mode]")
                    ?.getAttribute("data-animation-stage") || null,
                paused: s.timeline?.paused() || false,
              }
            : null;
        },
        seek: (time) => {
          const s = active.current;
          if (!s) return;
          s.qaPaused = true;
          if (s.watchdog) {
            clearTimeout(s.watchdog);
            s.watchdog = null;
          }
          s.qaSeekTime = time;
          if (!s.timeline) return;
          s.timeline.pause();
          s.timeline.time(time, false);
          s.timeline.pause();
        },
        play: () => {
          const s = active.current;
          if (s) {
            s.qaPaused = false;
            s.qaSeekTime = undefined;
            if (!s.watchdog)
              s.watchdog = setTimeout(() => {
                if (active.current?.run.key === s.run.key)
                  operations.current.complete(s.run.key, "qa-safety-timeout");
              }, 8000);
            if (s.atGate) operations.current.resume();
            else s.timeline?.resume();
          }
        },
        switchTo: (id, destination = `/templates/${id}`) =>
          switchTemplate(id, destination),
        skip: () => operations.current.skip(),
        get metrics() {
          return window.__DENTAL_ANIMATION_METRICS__ || [];
        },
      };
    }
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("keydown", key);
      document.removeEventListener("visibilitychange", visibility);
      queueMicrotask(() => {
        // The generation check intentionally reads the latest value to distinguish Strict Mode replay.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        if (mountGeneration.current === generation) {
          cancel();
          heroContext.current?.revert();
          delete window.__DENTAL_ANIMATION_QA__;
        }
      });
    };
  }, [cancel, switchTemplate]);
  const bootTemplate = booting ? templateFromPath(pathname) : null;
  const bootBrand = booting && isBrandPath(pathname);
  const bootHotel = booting ? hotelFromPath(pathname) : null;
  const bootSchool = booting ? schoolFromPath(pathname) : null;
  const bootRestaurant = booting ? restaurantFromPath(pathname) : null;
  const blocked = Boolean(
    run ||
    bootTemplate ||
    bootBrand ||
    bootHotel ||
    bootSchool ||
    bootRestaurant,
  );
  return (
    <AnimationContext.Provider
      value={{
        switchTemplate,
        switchHotel,
        switchSchool,
        switchRestaurant,
        markReady,
        busy: blocked,
        skip,
      }}
    >
      <fieldset
        className="animation-content"
        disabled={blocked}
        inert={blocked}
        aria-busy={blocked}
      >
        {children}
      </fieldset>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {bootBrand && !run && (
        <div className="brand-boot" aria-label="Preparing brand introduction">
          <i className="brand-boot-ignition" aria-hidden="true" />
        </div>
      )}
      {bootRestaurant && !run && (
        <div
          className="animation-boot"
          aria-label="Preparing restaurant introduction"
          style={{ background: bootRestaurant.colors.bg }}
        />
      )}
      {bootSchool && !run && (
        <div
          className="animation-boot"
          aria-label="Preparing school introduction"
          style={{ background: bootSchool.colors.bg }}
        />
      )}
      {bootHotel && !run && (
        <div
          className="animation-boot"
          aria-label="Preparing property introduction"
          style={{ background: bootHotel.palette.bg }}
        />
      )}
      {bootTemplate && !run && (
        <div
          className="animation-boot"
          aria-label="Preparing introduction"
          style={{
            background: animationRegistry[bootTemplate].theme.background,
          }}
        />
      )}
      {run?.brand && (
        <BrandOverlay
          key={run.key}
          run={run}
          onTimeline={attachTimeline}
          onCovered={covered}
          onFinishGate={finishGate}
          onComplete={complete}
          onSkip={skip}
        />
      )}
      {run?.restaurant && !run.brand && (
        <RestaurantLoader
          key={run.key}
          run={run}
          onTimeline={attachTimeline}
          onCovered={covered}
          onFinishGate={finishGate}
          onComplete={complete}
          onSkip={skip}
        />
      )}
      {run?.school && !run.brand && (
        <SchoolLoader
          key={run.key}
          run={run}
          onTimeline={attachTimeline}
          onCovered={covered}
          onFinishGate={finishGate}
          onComplete={complete}
          onSkip={skip}
        />
      )}
      {run?.hotel && !run.brand && (
        <HotelLoader
          key={run.key}
          run={run}
          onTimeline={attachTimeline}
          onCovered={covered}
          onFinishGate={finishGate}
          onComplete={complete}
          onSkip={skip}
        />
      )}
      {run && !run.brand && !run.hotel && !run.school && !run.restaurant && (
        <AnimationOverlay
          key={run.key}
          run={run}
          onTimeline={attachTimeline}
          onCovered={covered}
          onFinishGate={finishGate}
          onComplete={complete}
          onSkip={skip}
        />
      )}
    </AnimationContext.Provider>
  );
}
