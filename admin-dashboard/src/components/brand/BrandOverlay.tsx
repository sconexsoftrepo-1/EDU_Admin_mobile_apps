"use client";
import InitialCosmicIntro from "../brand-animations/InitialCosmicIntro";
import RefreshSignatureIntro from "../brand-animations/RefreshSignatureIntro";
import CosmicTemplateTransition from "./CosmicTemplateTransition";
import type { BrandOverlayProps } from "../brand-animations/types";
/** Lifecycle is shared by AnimationProvider; the visual timelines and assets are independent. */
export default function BrandOverlay(props: BrandOverlayProps) {
  if (props.run.mode === "initial") return <InitialCosmicIntro {...props} />;
  if (props.run.mode === "refresh") return <RefreshSignatureIntro {...props} />;
  return <CosmicTemplateTransition {...props} />;
}
