import { colleges } from "./colleges";
import { restaurants, type RestaurantSlug } from "./restaurants";
import { showcaseTemplates } from "./showcaseTemplates";
import { hotels, type HotelSlug } from "./hotels-resorts";
import { schools, type SchoolSlug } from "./education";
export type ShowroomTemplate = {
  id: string;
  name: string;
  category:
    | "Dental Clinics"
    | "Hotels & Resorts"
    | "Education & Schools"
    | "Restaurants & Food"
    | "Colleges & Institutions";
  description: string;
  color: string;
  bg: string;
  palette: string[];
  desktop: string;
  mobile: string;
  hero: string;
  model: string;
  motion: string;
  navigation: string;
  typography: string;
  href: string;
  identity: string;
  initial: string;
  refresh: string;
  action: string;
  actionRoute: string;
  hotelSlug?: HotelSlug;
  schoolSlug?: SchoolSlug;
  restaurantSlug?: RestaurantSlug;
  collegeSlug?: string;
};
export const showroomCollection: ShowroomTemplate[] = [
  ...showcaseTemplates.map((t) => ({
    ...t,
    category: "Dental Clinics" as const,
    href: `/templates/${t.id}`,
    identity: `/assets/animations/template-${t.id}/fallbacks/dental.svg`,
    initial: `/assets/animations/template-${t.id}/previews/desktop-initial-1_4.webp`,
    refresh: `/assets/animations/template-${t.id}/previews/desktop-refresh-opening.webp`,
    action: "Try the appointment interface",
    actionRoute: "appointments",
  })),
  ...hotels.map((h, i) => ({
    id: h.number,
    name: h.name,
    category: "Hotels & Resorts" as const,
    hotelSlug: h.slug,
    href: `/hotels-resorts/${h.slug}`,
    description: h.description,
    color: h.palette.accent,
    bg: h.palette.bg,
    palette: [h.palette.accent, h.palette.bg, h.palette.ink],
    desktop: `/assets/hotels-resorts/previews/${h.slug}-desktop.webp`,
    mobile: `/assets/hotels-resorts/previews/${h.slug}-mobile.webp`,
    hero: [
      "Tropical sunset panorama",
      "Architectural city editorial",
      "Alpine filmstrip & cabins",
      "Ocean-led island escape",
    ][i],
    model: [
      "Island & overwater villas",
      "City hotel & rooftop",
      "Mountain cabins & forest",
      "Beach villas & lagoon",
    ][i],
    motion: [
      "Sunset parallax & pool reveals",
      "Architectural masks & light",
      "Landscape depth & filmstrips",
      "Water motion & island reveals",
    ][i],
    navigation: [
      "Tropical floating capsule",
      "Luxury architectural bar",
      "Alpine utility navigation",
      "Breezy island navigation",
    ][i],
    typography: [
      "Resort editorial serif",
      "Luxury display serif",
      "Outdoor editorial serif",
      "Coastal expressive serif",
    ][i],
    identity: `/assets/hotels-resorts/${h.slug}/animations/initial-desktop.webp`,
    initial: `/assets/hotels-resorts/${h.slug}/animations/initial-desktop.webp`,
    refresh: `/assets/hotels-resorts/${h.slug}/animations/refresh-desktop.webp`,
    action: "Try the booking interface",
    actionRoute: "booking",
  })),
  ...schools.map((s, i) => ({
    id: s.number,
    name: s.name,
    category: "Education & Schools" as const,
    schoolSlug: s.slug,
    href: `/education-schools/${s.slug}`,
    description: s.description,
    color: s.colors.accent,
    bg: s.colors.bg,
    palette: [s.colors.accent, s.colors.bg, s.colors.ink],
    desktop: `/assets/education-schools/previews/${s.slug}-desktop.webp`,
    mobile: `/assets/education-schools/previews/${s.slug}-mobile.webp`,
    hero: [
      "Clay playground & little explorers",
      "Sunlit campus & discovery",
      "Bright architectural split",
      "Academic masthead & panorama",
    ][i],
    model: [
      "Miniature playground & learning toys",
      "Campus fly-through & STEM",
      "Science lab & modern campus",
      "Academic campus & global learning",
    ][i],
    motion: [
      "Storybook cards & leaf reveals",
      "Sunrise parallax & campus approach",
      "Architectural masks & assessments",
      "Gold lines & academic camera journey",
    ][i],
    navigation: [
      "Rounded playful capsule",
      "Bright academic bar",
      "Professional navy navigation",
      "Elegant academic masthead",
    ][i],
    typography: [
      "Rounded expressive sans",
      "Curious editorial serif",
      "Institutional display serif",
      "Classical academic serif",
    ][i],
    identity: s.logo,
    initial: `/assets/education-schools/${s.slug}/animations/initial-desktop.webp`,
    refresh: `/assets/education-schools/${s.slug}/animations/refresh-desktop.webp`,
    action: "Try the admissions interface",
    actionRoute: "admissions",
  })),
  ...restaurants.map((r, i) => ({
    id: r.number,
    name: r.name,
    category: "Restaurants & Food" as const,
    restaurantSlug: r.slug,
    href: `/restaurants-food/${r.slug}`,
    description: r.description,
    color: r.colors.accent,
    bg: r.colors.bg,
    palette: [r.colors.accent, r.colors.bg, r.colors.gold],
    desktop: `/assets/restaurants-food/previews/${r.slug}-desktop.webp`,
    mobile: `/assets/restaurants-food/previews/${r.slug}-mobile.webp`,
    hero: [
      "Evening architecture & gourmet plate",
      "Heritage arch & spice trail",
      "Botanical cafe & ingredient garden",
      "Ocean horizon & seafood platter",
      "Royal architecture & persistent handi",
      "Bold typography & persistent bowl",
    ][i],
    model: [
      "Gourmet dish & bistro architecture",
      "Spices & copper vessel",
      "Configurable salad bowl",
      "Seafood platter & coastal setting",
      "Copper handi with lifting lid",
      "Biryani bowl & takeaway tray",
    ][i],
    motion: [
      "Copper masks & editorial portraits",
      "Spice orbit & heritage reveals",
      "Botanical ingredient assembly",
      "Wave horizons & coastal parallax",
      "Persistent handi & chapter cameras",
      "Ingredient flight & bowl-to-tray journey",
    ][i],
    navigation: [
      "Charcoal copper dining bar",
      "Cream heritage navigation",
      "Rounded botanical capsule",
      "Translucent coastal bar",
      "Maroon royal emblem navigation",
      "Bold charcoal ordering bar",
    ][i],
    typography:
      i === 2 || i === 5
        ? "Expressive modern sans"
        : "Restaurant editorial serif",
    identity: r.logo,
    initial: `/assets/restaurants-food/${r.slug}/animations/initial-desktop.webp`,
    refresh: `/assets/restaurants-food/${r.slug}/animations/refresh-desktop.webp`,
    action: "Try the ordering interface",
    actionRoute: "order",
  })),
  ...colleges.map((c) => ({
    id: c.number,
    name: c.name,
    category: "Colleges & Institutions" as const,
    collegeSlug: c.slug,
    description: c.description,
    color: c.accent,
    bg: c.slug === "edunexa-college" ? "#f8f5ef" : "#f2f7fd",
    palette: [c.accent, "#14253b", "#ffffff"],
    desktop: `/assets/colleges-institutions/previews/${c.slug}-desktop.webp`,
    mobile: `/assets/colleges-institutions/previews/${c.slug}-mobile.webp`,
    hero: "Cinematic fictional campus",
    model: "Interactive procedural campus",
    motion: "Architectural reveals & scroll storytelling",
    navigation: "College-specific public navigation",
    typography:
      c.slug === "edunexa-college"
        ? "Editorial academic serif"
        : "Contemporary technical sans",
    href: "/portal/login",
    identity: `/assets/colleges-institutions/${c.slug}/crest.svg`,
    initial: `/assets/colleges-institutions/${c.slug}/initial.webp`,
    refresh: `/assets/colleges-institutions/${c.slug}/refresh.webp`,
    action: "Explore the campus management portal",
    actionRoute: "portal/login",
  })),
];
