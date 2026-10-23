import CollegeWorkspaceProvider from "@/components/colleges/CollegeWorkspaceProvider";
export default async function CollegeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ collegeSlug: string }>;
}) {
  const { collegeSlug } = await params;
  return (
    <CollegeWorkspaceProvider slug={collegeSlug}>
      {children}
    </CollegeWorkspaceProvider>
  );
}
