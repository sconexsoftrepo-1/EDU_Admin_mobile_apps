"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAnimation } from "./AnimationProvider";
import type { AnimationTemplateId } from "./config/animationRegistry";
export default function AnimationReady({
  templateId,
}: {
  templateId: AnimationTemplateId;
}) {
  const path = usePathname();
  const { markReady } = useAnimation();
  useEffect(() => {
    markReady(path, templateId);
  }, [path, templateId, markReady]);
  return null;
}
