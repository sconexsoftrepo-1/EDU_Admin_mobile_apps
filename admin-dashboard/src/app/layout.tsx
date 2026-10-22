import type { Metadata } from "next";
import "./globals.css";
import "@/styles/hotels.css";
import "@/styles/contact.css";
import "@/styles/education.css";
import "@/styles/restaurants.css";
import "@/styles/experiences.css";
import "@/styles/template-02.css";
import "@/styles/template-03.css";
import "@/styles/template-04.css";
import "@/styles/template-05.css";
import "@/styles/template-06.css";
import TemplateSwitcher from "@/components/TemplateSwitcher";
import AnimationProvider from "@/components/animation-system/AnimationProvider";
import "@/styles/animation-system.css";
import "@/styles/showroom.css";
import "@/styles/template-interactions.css";
import "@/styles/brand.css";
import "@/styles/brand-animations.css";
import { brandConfig } from "@/components/brand/config/brandConfig";
export const metadata: Metadata = {
  title: `${brandConfig.wordmark} — Design × Code × Create`,
  icons: {
    icon: "/assets/brand/logos/favicon.webp",
    apple: "/assets/brand/logos/app-icon.webp",
  },
  description: brandConfig.description,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          as="image"
          href="/assets/brand/cosmic-environment/cosmic-background.webp"
          media="(min-width:701px)"
        />
        <link
          rel="preload"
          as="image"
          href="/assets/brand/mobile/cosmic-background.webp"
          media="(max-width:700px)"
        />
      </head>
      <body>
        <AnimationProvider>
          {children}
          <TemplateSwitcher />
        </AnimationProvider>
      </body>
    </html>
  );
}
