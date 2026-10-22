import { notFound } from "next/navigation";
import ClinicSite from "@/components/ClinicSite";
import { templates, services, doctors } from "@/data/clinic";
export default async function Page({
  params,
}: {
  params: Promise<{ templateId: string; slug?: string[] }>;
}) {
  const { templateId, slug = [] } = await params;
  const t = templates.find((t) => t.id === templateId);
  if (!t) notFound();
  const valid = [
    "about",
    "services",
    "doctors",
    "technology",
    "gallery",
    "reviews",
    "appointments",
    "contact",
  ];
  if (slug.length > 2 || (slug[0] && !valid.includes(slug[0]))) notFound();
  if (
    slug.length === 2 &&
    !(
      (slug[0] === "services" && services.some((s) => s.slug === slug[1])) ||
      (slug[0] === "doctors" && doctors.some((d) => d.slug === slug[1]))
    )
  )
    notFound();
  if (templateId === "01") return <ClinicSite slug={slug} />;
  const { default: Chrome } = await import("@/components/templates/Chrome");
  const id = templateId as import("@/data/experiences").TemplateId;
  if (slug.length) {
    const { default: InternalPage } =
      await import("@/components/templates/InternalPage");
    return (
      <Chrome id={id}>
        <InternalPage id={id} slug={slug} />
      </Chrome>
    );
  }
  const renderers = {
    "02": () => import("@/components/templates/Home02"),
    "03": () => import("@/components/templates/Home03"),
    "04": () => import("@/components/templates/Home04"),
    "05": () => import("@/components/templates/Home05"),
    "06": () => import("@/components/templates/Home06"),
  };
  const { default: Home } = await renderers[id]();
  return (
    <Chrome id={id}>
      <Home />
    </Chrome>
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ templateId: string; slug?: string[] }>;
}) {
  const { templateId, slug = [] } = await params;
  const t = templates.find((t) => t.id === templateId);
  const name = slug[1] || slug[0] || "Home";
  return {
    title: `${name.replaceAll("-", " ")} | ${t?.name || "Web Universe"} — Your Dental Studio`,
    description: `Explore ${t?.name || "Web Universe"}, a distinct interactive fictional dental clinic demonstration.`,
  };
}
