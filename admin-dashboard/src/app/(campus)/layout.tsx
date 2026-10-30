import type { Metadata } from "next";
import CollegeWorkspaceProvider from "@/components/colleges/CollegeWorkspaceProvider";
import { colleges } from "@/data/colleges";
import "@/styles/colleges.css";
import "@/styles/college-erp.css";
import "@/styles/college-operations.css";
import "@/styles/academic-calendar.css";
import "@/styles/college-timetable.css";
export const metadata: Metadata = {
  title: `${colleges[0].name} | Campus portal`,
  description: `Sign in to ${colleges[0].name} campus management.`,
  robots: { index: false, follow: false },
};
export default function CampusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CollegeWorkspaceProvider slug={colleges[0].slug}>
      {children}
    </CollegeWorkspaceProvider>
  );
}
