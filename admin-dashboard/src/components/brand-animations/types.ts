import type { gsap } from "gsap";
import type { AnimationRun } from "../animation-system/config/animationRegistry";
export type BrandOverlayProps = {
  run: AnimationRun;
  onTimeline: (key: number, tl: gsap.core.Timeline) => void;
  onCovered: (key: number) => void;
  onFinishGate: (key: number) => void;
  onComplete: (key: number, reason?: string) => void;
  onSkip: () => void;
};
