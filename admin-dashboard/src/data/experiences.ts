export type TemplateId = "02" | "03" | "04" | "05" | "06";
export type ClinicPage =
  | "about"
  | "services"
  | "doctors"
  | "technology"
  | "gallery"
  | "reviews"
  | "appointments"
  | "contact";
export type Experience = {
  id: TemplateId;
  label: string;
  descriptor: string;
  accent: string;
  background: string;
  hero: string;
  headline: string;
  intro: string;
  serviceTitle: string;
  techTitle: string;
  teamTitle: string;
  bookingTitle: string;
  closing: string;
  specialties: string[];
};
export const experiences: Record<TemplateId, Experience> = {
  "02": {
    id: "02",
    label: "Premium 3D",
    descriptor: "Precision. Comfort. Confidence.",
    accent: "#c680ff",
    background: "#080c21",
    hero: "/assets/templates/02.webp",
    headline: "Advanced dental care. A healthier you.",
    intro:
      "A new dimension of care, where considered technology meets a deeply personal approach.",
    serviceTitle: "Exceptional care. Every dimension.",
    techTitle: "A closer look changes everything.",
    teamTitle: "The minds behind your smile.",
    bookingTitle: "Your next chapter. In focus.",
    closing: "A new dimension of you.",
    specialties: [
      "Precision planning",
      "Comfort-led dentistry",
      "Digital perspective",
      "Personal care",
    ],
  },
  "03": {
    id: "03",
    label: "Friendly & Family",
    descriptor: "Gentle care for every generation",
    accent: "#007f91",
    background: "#f4fbfc",
    hero: "/assets/templates/03.webp",
    headline: "Healthy smiles. Happy families.",
    intro:
      "Little teeth, big milestones, and everything in between. A friendly place to feel right at home.",
    serviceTitle: "A little care for every smile.",
    techTitle: "Big on comfort. Gentle on you.",
    teamTitle: "Friendly faces. Caring people.",
    bookingTitle: "Let’s find a time for your family.",
    closing: "Growing together. Smiling together.",
    specialties: [
      "Little smiles",
      "Everyday prevention",
      "Braces & aligners",
      "Whole-family care",
    ],
  },
  "04": {
    id: "04",
    label: "Dark Premium",
    descriptor: "Your smile. Our expertise.",
    accent: "#d5b370",
    background: "#10100f",
    hero: "/assets/templates/04.webp",
    headline: "Modern dentistry. Refined.",
    intro:
      "Exceptional attention to the smallest details. A considered experience, entirely your own.",
    serviceTitle: "The art of considered care.",
    techTitle: "Precision is in the details.",
    teamTitle: "Expertise, with a personal signature.",
    bookingTitle: "A private moment for your smile.",
    closing: "Distinctly you.",
    specialties: [
      "Aesthetic dentistry",
      "Dental implants",
      "Smile refinement",
      "Personal consultation",
    ],
  },
  "05": {
    id: "05",
    label: "Lifestyle & Aesthetic",
    descriptor: "Beautiful smiles. Confident you.",
    accent: "#c51d69",
    background: "#fff7f7",
    hero: "/assets/templates/05.webp",
    headline: "Smile confidently. Live beautifully.",
    intro:
      "A fresh perspective on your smile. Thoughtful aesthetic dentistry that celebrates what makes you, you.",
    serviceTitle: "Your smile, your expression.",
    techTitle: "A thoughtful touch. A natural finish.",
    teamTitle: "Meet your smile collaborators.",
    bookingTitle: "Your new smile story starts here.",
    closing: "More you. More beautifully.",
    specialties: [
      "Cosmetic dentistry",
      "Teeth whitening",
      "Veneers",
      "Smile design",
    ],
  },
  "06": {
    id: "06",
    label: "Tech & Futuristic",
    descriptor: "Next-generation dental perspective",
    accent: "#62d9ff",
    background: "#051827",
    hero: "/assets/templates/06.webp",
    headline: "Technology meets your smile.",
    intro:
      "Discover a more connected approach to care. Digital insight, clear conversations, and precision with purpose.",
    serviceTitle: "Designed around your next step.",
    techTitle: "Understand more. Plan with clarity.",
    teamTitle: "Human insight. Digital precision.",
    bookingTitle: "Your future smile starts here.",
    closing: "The future feels personal.",
    specialties: [
      "Digital diagnostics",
      "3D scanning",
      "Treatment planning",
      "Precision care",
    ],
  },
};
export const journey = [
  {
    name: "Conversation",
    description:
      "Your story comes first. Tell us about your comfort, goals, and questions.",
  },
  {
    name: "Clarity",
    description:
      "Explore your options and see a plan explained in everyday language.",
  },
  {
    name: "Care",
    description:
      "A thoughtful treatment experience with space to pause and ask questions.",
  },
  {
    name: "Continuity",
    description: "Practical guidance and a plan to keep caring for your smile.",
  },
];
