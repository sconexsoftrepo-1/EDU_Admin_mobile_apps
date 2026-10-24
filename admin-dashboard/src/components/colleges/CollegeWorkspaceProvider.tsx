"use client";
import { usePathname } from "next/navigation";
import { CollegeStore } from "./CollegeStore";
import { Toaster } from "./toast";
import "./brand-buttons.css";
import "./data-tables.css";
export default function CollegeWorkspaceProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const portal = path.includes("/portal/") && !path.endsWith("/portal/login");
  return (
    <>
      {portal ? <CollegeStore slug={slug}>{children}</CollegeStore> : children}
      <Toaster />
    </>
  );
}
