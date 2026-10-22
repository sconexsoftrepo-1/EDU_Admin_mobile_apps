"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState, Component, type ReactNode } from "react";
const Scene = dynamic(() => import("./SignatureScene"), { ssr: false });
class Recovery extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function SignatureObject({ id }: { id: "01" | "05" }) {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) {
          setActive(false);
          setReady(false);
          return;
        }
        try {
          const c = document.createElement("canvas"),
            gl = c.getContext("webgl2");
          setActive(
            Boolean(gl) &&
              !matchMedia("(prefers-reduced-motion: reduce)").matches,
          );
          gl?.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {}
      },
      { rootMargin: "100px" },
    );
    if (root.current) obs.observe(root.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      ref={root}
      className={`signature-object signature-object-${id} ${ready ? "is-ready" : ""}`}
      role="img"
      aria-label="Interactive pearl tooth and satin ribbon. Move the pointer to view its depth."
    >
      <Image
        unoptimized
        src={`/assets/animations/template-${id}/fallbacks/dental.svg`}
        alt=""
        fill
        sizes="220px"
      />
      {active && (
        <Recovery>
          <Scene id={id} onReady={() => setReady(true)} />
        </Recovery>
      )}
    </div>
  );
}
