import Image from "next/image";
import type { College } from "@/data/colleges";
import WorkspaceSkeleton from "./WorkspaceSkeleton";
/** Keeps the college frame visible during initial session verification; reveals no private navigation. */
export default function PortalShellSkeleton({ college }: { college: College }) {
  return (
    <div
      className="college-erp erp-compact"
      style={{ "--college-accent": college.accent } as React.CSSProperties}
      aria-busy="true"
    >
      <aside className="erp-sidebar">
        <div className="erp-sidebar-brand">
          <Image
            src={`/assets/colleges-institutions/${college.slug}/crest.svg`}
            alt={college.short}
            width={32}
            height={38}
          />
          <strong>{college.short}</strong>
        </div>
        <div className="erp-shell-nav-skeleton" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      </aside>
      <div className="erp-workspace">
        <header className="erp-topbar">
          <strong>{college.short}</strong>
          <span className="erp-shell-header-skeleton" aria-hidden="true" />
        </header>
        <main className="erp-content">
          <WorkspaceSkeleton label="Preparing your assigned workspace" />
        </main>
      </div>
    </div>
  );
}
