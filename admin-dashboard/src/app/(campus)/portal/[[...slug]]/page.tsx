import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import CollegePage from "@/components/colleges/CollegePage";
import { colleges, validCollegePath } from "@/data/colleges";
type Props = { params: Promise<{ slug?: string[] }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug = [] } = await params;
  return {
    title: `${slug.at(-1)?.replaceAll("-", " ") || "Login"} | ${colleges[0].name}`,
  };
}
export default async function PortalPage({ params }: Props) {
  const { slug = [] } = await params;
  if (!slug.length) redirect("/portal/login");
  const parts = ["portal", ...slug];
  if (!validCollegePath(colleges[0], parts)) notFound();
  return <CollegePage college={colleges[0]} parts={parts} />;
}
