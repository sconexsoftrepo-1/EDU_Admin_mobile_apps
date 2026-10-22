"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Rotate3D } from "lucide-react";
const Scene = dynamic(() => import("./ToothScene"), { ssr: false });
export default function ToothViewer() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      setAvailable(Boolean(canvas.getContext("webgl2")));
    } catch {}
  }, []);
  return (
    <div
      className="tooth-viewer"
      role="img"
      aria-label="Illustrative interactive glass tooth. Drag to rotate."
    >
      {available ? (
        <Scene />
      ) : (
        <svg viewBox="0 0 150 180" className="tooth-static" aria-hidden="true">
          <defs>
            <linearGradient id="tooth-fill">
              <stop stopColor="#fff" />
              <stop offset="1" stopColor="#a1d6f0" />
            </linearGradient>
          </defs>
          <path
            d="M75 32C28 0 12 38 26 78c8 20 10 74 25 77 12 3 10-61 24-61s12 64 24 61c15-3 17-57 25-77C138 38 122 0 75 32Z"
            fill="url(#tooth-fill)"
            stroke="#d6edfa"
            strokeWidth="3"
          />
        </svg>
      )}
      <span className="rotate-hint">
        <Rotate3D size={13} /> Drag to explore
      </span>
    </div>
  );
}
