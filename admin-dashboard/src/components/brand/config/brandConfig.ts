/** Change wordmark to 'KC Orbit' here; artwork and animation stay unchanged. */
export const brandConfig = {
  wordmark: "Chaitanya",
  monogram: "KC",
  tagline: "DESIGN × CODE × CREATE",
  eyebrow: "MY CREATIVE SPACE",
  subtitle: "UI/UX DESIGNER & DEVELOPER",
  description:
    "Where ideas turn into interactive experiences. Explore a universe of creativity, technology and design.",
  developer: "K. Chaitanya",
  phone: "+91 8367048538",
  phoneHref: "tel:+918367048538",
  email: "kattachaitanya507@gmail.com",
  emailHref: "mailto:kattachaitanya507@gmail.com",
  portfolio: "https://chaitanya-portfolio-eight.vercel.app/",
  signature: "Designed & Developed by K. Chaitanya",
  colors: {
    violet: "#6C63FF",
    purple: "#A855F7",
    cyan: "#22D3EE",
    white: "#F8FAFC",
    background: "#080D13",
  },
} as const;
export const brandAnimationConfig = {
  initial: { duration: 6, stages: [0, 0.8, 1.8, 2.9, 4, 5.2] },
  refresh: { duration: 2.2, stages: [0, 0.55, 1.45] },
  switch: { duration: 0.7, stages: [0, 0.2, 0.4, 0.6] },
  safeTimeoutMs: 8000,
} as const;
export const isBrandPath = (path: string) =>
  path === "/" ||
  path === "/showcase" ||
  path === "/templates" ||
  path === "/hotels-resorts" ||
  path === "/education-schools" ||
  path === "/restaurants-food";
