import { redirect, notFound } from "next/navigation";
import { collegeBySlug, validCollegePath } from "@/data/colleges";
export default async function LegacyCollegePage({
  params,
}: {
  params: Promise<{ collegeSlug: string; slug?: string[] }>;
}) {
  const { collegeSlug, slug = [] } = await params;
  const college = collegeBySlug(collegeSlug);
  if (!college) notFound();
  if (!["portal", "verify-certificate"].includes(slug[0]))
    redirect("/portal/login");
  if (!validCollegePath(college, slug)) notFound();
  redirect("/" + slug.join("/"));
}
