import { colleges } from "./colleges";
import { restaurants, type RestaurantSlug } from "./restaurants";
import { schools, type SchoolSlug } from "./education";
import { hotels, type HotelSlug } from "./hotels-resorts";
import { showcaseTemplates } from "./showcaseTemplates";
import { featuredProjects } from "./developerContact";
export type UniverseTemplate = {
  id: string;
  hotelSlug?: HotelSlug;
  schoolSlug?: SchoolSlug;
  restaurantSlug?: RestaurantSlug;
  collegeSlug?: string;
  title: string;
  description: string;
  image: string;
  mobile?: string;
  href: string;
  external: boolean;
  accent: string;
  category: string;
};
const project = (id: string, category: string): UniverseTemplate => {
  const p = featuredProjects.find((p) => p.id === id)!;
  return {
    id: p.id,
    title: p.name,
    description: p.description,
    image: p.image,
    href: p.url,
    external: true,
    accent: p.color,
    category,
  };
};
export const templateCategories: {
  id: string;
  title: string;
  short: string;
  description: string;
  accent: string;
  items: UniverseTemplate[];
}[] = [
  {
    id: "dental",
    title: "Dental templates",
    short: "Dental",
    description: "Six independent design directions for modern dental care.",
    accent: "#b69ae7",
    items: showcaseTemplates.map((t) => ({
      id: t.id,
      title: t.name,
      description: t.description,
      image: t.desktop,
      mobile: t.mobile,
      href: `/templates/${t.id}`,
      external: false,
      accent: t.color,
      category: "Dental templates",
    })),
  },
  {
    id: "hotels-resorts",
    title: "Hotels & Resorts",
    short: "Hotels & Resorts",
    description:
      "Four complete hospitality experiences, from tropical coves to alpine cabins.",
    accent: "#b69aff",
    items: hotels.map((h) => ({
      id: h.number,
      hotelSlug: h.slug,
      title: h.name,
      description: h.description,
      image: `/assets/hotels-resorts/previews/${h.slug}-desktop.webp`,
      mobile: `/assets/hotels-resorts/previews/${h.slug}-mobile.webp`,
      href: `/hotels-resorts/${h.slug}`,
      external: false,
      accent: h.palette.accent,
      category: "Hotels & Resorts",
    })),
  },
  {
    id: "education-schools",
    title: "Education & Schools",
    short: "Education & Schools",
    description:
      "Four stages of learning, four independent school experiences.",
    accent: "#85beea",
    items: schools.map((s) => ({
      id: s.number,
      schoolSlug: s.slug,
      title: s.name,
      description: s.description,
      image: `/assets/education-schools/previews/${s.slug}-desktop.webp`,
      mobile: `/assets/education-schools/previews/${s.slug}-mobile.webp`,
      href: `/education-schools/${s.slug}`,
      external: false,
      accent: s.colors.accent,
      category: "Education & Schools",
    })),
  },
  {
    id: "restaurants-food",
    title: "Restaurants & Food",
    short: "Restaurants & Food",
    description:
      "Six flavours of dining, from intimate bistros to bold biryani kitchens.",
    accent: "#e9ab6e",
    items: restaurants.map((r) => ({
      id: r.number,
      restaurantSlug: r.slug,
      title: r.name,
      description: r.description,
      image: `/assets/restaurants-food/previews/${r.slug}-desktop.webp`,
      mobile: `/assets/restaurants-food/previews/${r.slug}-mobile.webp`,
      href: `/restaurants-food/${r.slug}`,
      external: false,
      accent: r.colors.accent,
      category: "Restaurants & Food",
    })),
  },
  {
    id: "colleges-institutions",
    title: "Colleges & Institutions",
    short: "Colleges & Institutions",
    description:
      "Two distinctive college websites with connected campus management portals.",
    accent: "#d5b77a",
    items: colleges.map((c) => ({
      id: c.number,
      collegeSlug: c.slug,
      title: c.name,
      description: c.description,
      image: `/assets/colleges-institutions/previews/${c.slug}-desktop.webp`,
      mobile: `/assets/colleges-institutions/previews/${c.slug}-mobile.webp`,
      href: `/colleges-institutions/${c.slug}`,
      external: false,
      accent: c.accent,
      category: "Colleges & Institutions",
    })),
  },
  {
    id: "ortho-child",
    title: "Ortho & Child Care templates",
    short: "Ortho & Child Care",
    description: "A warm welcome for growing families and healthy movement.",
    accent: "#d7b18d",
    items: [project("saashi", "Ortho & Child Care templates")],
  },
  {
    id: "ecommerce",
    title: "E-commerce templates",
    short: "E-commerce",
    description:
      "Expressive storefronts that put collections and products first.",
    accent: "#f4ad72",
    items: [project("djstores", "E-commerce templates")],
  },
  {
    id: "clinics",
    title: "Clinic templates",
    short: "Clinics",
    description:
      "Clear, confident digital experiences for connected healthcare.",
    accent: "#78d6cd",
    items: [project("vbr", "Clinic templates")],
  },
  {
    id: "portfolios",
    title: "Portfolio templates",
    short: "Portfolios",
    description:
      "Personal stories, selected work, and a memorable first impression.",
    accent: "#c6a6ff",
    items: [project("portfolio", "Portfolio templates")],
  },
];
export const universeTemplates: UniverseTemplate[] = templateCategories.flatMap(
  (c) => c.items,
);
