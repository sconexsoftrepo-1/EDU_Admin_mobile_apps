import { notFound } from "next/navigation";
import CollegePage from "@/components/colleges/CollegePage";
import { colleges, validCollegePath } from "@/data/colleges";
export default async function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parts = ["verify-certificate", token];
  if (!validCollegePath(colleges[0], parts)) notFound();
  return <CollegePage college={colleges[0]} parts={parts} />;
}
