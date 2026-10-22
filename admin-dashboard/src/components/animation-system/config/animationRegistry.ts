import { clinic } from "@/data/clinic";
export const templateIds = ["01", "02", "03", "04", "05", "06"] as const;
export type AnimationTemplateId = (typeof templateIds)[number];
export type AnimationMode = "initial" | "refresh" | "switch";
export type AnimationClock = {
  time: number;
  ambient: number;
  formation: number;
  assembly: number;
  brand: number;
  scan: number;
  exit: number;
  rotation: number;
  pointerX: number;
  pointerY: number;
};
export type ScenePerformance = {
  frames: number;
  frameMs: number[];
  drawCalls: number;
  triangles: number;
  dpr: number;
  variant: string;
  fallback: boolean;
};
export type AnimationRun = {
  brand?: boolean;
  restaurant?: import("@/data/restaurants").RestaurantSlug;
  school?: import("@/data/education").SchoolSlug;
  hotel?: import("@/data/hotels-resorts").HotelSlug;
  key: number;
  templateId: AnimationTemplateId;
  mode: AnimationMode;
  path: string;
  reduced: boolean;
  origin: { x: number; y: number };
  clock: AnimationClock;
  performance: ScenePerformance;
  startedAt: number;
};
export type CameraPreset = {
  position: [number, number, number];
  fov: number;
  modelScale: number;
  particleCount: number;
  orbitSize: number;
  lightIntensity: number;
  dpr: number;
};
export type AnimationConfig = {
  templateId: AnimationTemplateId;
  theme: {
    background: string;
    primary: string;
    secondary: string;
    ink: string;
  };
  brand: { name: string; subtitle: string; logo?: string };
  tagline: [string, string];
  scene: "glass" | "implant" | "mascot" | "gold" | "pearl" | "hologram";
  transition:
    "lavender" | "portal" | "bubble" | "gold-sweep" | "ribbon" | "tiles";
  duration: { initial: number; refresh: number; switch: number };
  assets: {
    desktop: string;
    mobile: string;
    fallback: string;
    background: string;
    mobileBackground: string;
    sprite: string;
  };
  camera: { mobile: CameraPreset; tablet: CameraPreset; desktop: CameraPreset };
  hero: { headline: string; visual: string; cards: string; actions: string };
};
const descriptions = [
  {
    id: "01",
    bg: "#f5f0ff",
    primary: "#8550d4",
    secondary: "#95d7fa",
    ink: "#33205a",
    scene: "glass",
    transition: "lavender",
    tagline: ["Healthy smiles.", "Brighter tomorrow."],
    headline: ".hero-copy h1",
    visual: ".hero-visual",
    cards: ".care-note,.hero-glass-tooth",
    actions: ".hero-actions",
  },
  {
    id: "02",
    bg: "#080d29",
    primary: "#b26aff",
    secondary: "#4eafff",
    ink: "#f0e7ff",
    scene: "implant",
    transition: "portal",
    tagline: ["Advanced dental care.", "A healthier you."],
    headline: ".cinema-hero-copy h1",
    visual: ".cinema-hero-image",
    cards: ".cinema-holo",
    actions: ".cinema-hero-copy .hero-buttons",
  },
  {
    id: "03",
    bg: "#e6f8ff",
    primary: "#0796b0",
    secondary: "#ec9ac0",
    ink: "#164e69",
    scene: "mascot",
    transition: "bubble",
    tagline: ["Happy smiles.", "Healthy families."],
    headline: ".family-hero-copy h1",
    visual: ".family-hero-portrait",
    cards: ".family-mascot,.family-heart",
    actions: ".family-hero-copy .hero-buttons",
  },
  {
    id: "04",
    bg: "#0c0b09",
    primary: "#d8b676",
    secondary: "#8e6936",
    ink: "#f3e7cd",
    scene: "gold",
    transition: "gold-sweep",
    tagline: ["Exceptional care.", "Beautiful smiles."],
    headline: ".luxury-hero-copy h1",
    visual: ".luxury-portrait",
    cards: ".luxury-sculpture",
    actions: ".luxury-hero-copy .exp-button",
  },
  {
    id: "05",
    bg: "#fff0f4",
    primary: "#c94482",
    secondary: "#f8b9cf",
    ink: "#8c2c58",
    scene: "pearl",
    transition: "ribbon",
    tagline: ["Smile confidently.", "Live beautifully."],
    headline: ".lifestyle-hero-copy h1",
    visual: ".lifestyle-photo",
    cards: ".lifestyle-note,.lifestyle-ribbon",
    actions: ".lifestyle-hero-copy .hero-buttons",
  },
  {
    id: "06",
    bg: "#04192c",
    primary: "#48c9ff",
    secondary: "#2363de",
    ink: "#d0f4ff",
    scene: "hologram",
    transition: "tiles",
    tagline: ["Next-gen dental care.", "Powered by technology."],
    headline: ".digital-hero-copy h1",
    visual: ".digital-hero-image",
    cards: ".diagnostic-chip,.digital-data",
    actions: ".digital-hero-copy .hero-buttons",
  },
] as const;
const preset = (kind: "mobile" | "tablet" | "desktop"): CameraPreset =>
  kind === "mobile"
    ? {
        position: [0, 0.1, 7.7],
        fov: 41,
        modelScale: 0.9,
        particleCount: 24,
        orbitSize: 1.65,
        lightIntensity: 2.5,
        dpr: 1,
      }
    : kind === "tablet"
      ? {
          position: [0, 0.1, 7.4],
          fov: 40,
          modelScale: 1,
          particleCount: 40,
          orbitSize: 1.8,
          lightIntensity: 3,
          dpr: 1.25,
        }
      : {
          position: [0, 0.15, 7.1],
          fov: 39,
          modelScale: 1.05,
          particleCount: 64,
          orbitSize: 1.9,
          lightIntensity: 3.5,
          dpr: 1.5,
        };
export const animationRegistry = Object.fromEntries(
  descriptions.map((d) => {
    const base = `/assets/animations/template-${d.id}`;
    return [
      d.id,
      {
        templateId: d.id,
        theme: {
          background: d.bg,
          primary: d.primary,
          secondary: d.secondary,
          ink: d.ink,
        },
        brand: { name: clinic.name, subtitle: clinic.suffix },
        tagline: [...d.tagline],
        scene: d.scene,
        transition: d.transition,
        duration: { initial: 3, refresh: 1.4, switch: 0.8 },
        assets: {
          desktop: `${base}/models/dental.glb`,
          mobile: `${base}/models/dental-mobile.glb`,
          fallback: `${base}/fallbacks/dental.svg`,
          background: `${base}/backgrounds/desktop.svg`,
          mobileBackground: `${base}/backgrounds/mobile.svg`,
          sprite: "/assets/animations/shared/particles/soft-glow.svg",
        },
        camera: {
          mobile: preset("mobile"),
          tablet: preset("tablet"),
          desktop: preset("desktop"),
        },
        hero: {
          headline: d.headline,
          visual: d.visual,
          cards: d.cards,
          actions: d.actions,
        },
      },
    ];
  }),
) as Record<AnimationTemplateId, AnimationConfig>;
export function templateFromPath(path: string): AnimationTemplateId | null {
  const id = path.match(/^\/templates\/(\d{2})(?:\/|$)/)?.[1];
  return templateIds.includes(id as AnimationTemplateId)
    ? (id as AnimationTemplateId)
    : null;
}
export function createClock(mode: AnimationMode): AnimationClock {
  return {
    pointerX: 0,
    pointerY: 0,
    time: 0,
    ambient: 0,
    formation: mode === "initial" ? 0 : 1,
    assembly: mode === "initial" ? 1 : 0,
    brand: 0,
    scan: 0,
    exit: 0,
    rotation: mode === "initial" ? -0.42 : -0.2,
  };
}
