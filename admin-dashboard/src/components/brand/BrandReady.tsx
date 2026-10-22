"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAnimation } from "../animation-system/AnimationProvider";
export default function BrandReady() {
  const path = usePathname(),
    { markReady } = useAnimation();
  useEffect(() => {
    markReady(path, "01");
  }, [path, markReady]);
  return null;
}
