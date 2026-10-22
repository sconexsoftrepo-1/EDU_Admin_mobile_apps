import { whatsappUrl } from "@/lib/whatsapp";
import { brandConfig as brand } from "@/components/brand/config/brandConfig";
export const developerContact = {
  name: brand.developer,
  role: "Mobile & Web Developer",
  phone: brand.phone,
  phoneHref: brand.phoneHref,
  whatsappHref: whatsappUrl(),
  email: brand.email,
  emailHref: brand.emailHref,
  portfolio: brand.portfolio,
  signature: brand.signature,
  artwork: "/assets/showcase/creator/developer-hero.webp",
};
export const featuredProjects = [
  {
    id: "djstores",
    name: "DJ Stores",
    category: "Fashion & commerce",
    description:
      "A complete storefront for everyday essentials, statement looks, and the whole family.",
    url: "https://djstores.in/",
    color: "#e6d63f",
  },
  {
    id: "saashi",
    name: "Saashi Clinic",
    category: "Healthcare",
    description:
      "A welcoming digital home for a clinic, its doctors, treatments, and appointment enquiries.",
    url: "https://saashi-clinic-poc.vercel.app/",
    color: "#d4b391",
  },
  {
    id: "vbr",
    name: "VBR Clinic",
    category: "Healthcare",
    description:
      "A dimensional clinic experience connecting care, diagnostics, pharmacy, and appointments.",
    url: "https://vbr-clinic.vercel.app/",
    color: "#78d6cd",
  },
  {
    id: "portfolio",
    name: "Chaitanya, in motion",
    category: "Personal portfolio",
    description:
      "Mobile, web, cloud, and creative development brought together in one interactive portfolio.",
    url: "https://chaitanya-portfolio-eight.vercel.app/",
    color: "#c6a6ff",
  },
].map((project) => ({
  ...project,
  image: `/assets/showcase/projects/${project.id}${["djstores", "saashi"].includes(project.id) ? "-supplied" : "-desktop"}.webp`,
}));
