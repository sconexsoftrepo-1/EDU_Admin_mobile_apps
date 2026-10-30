"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LayoutDashboard } from "lucide-react";
import "./portal-not-found.css";

const collegeHome = "/portal/login";
// The sign-in route restores the session and selects the user's authorized workspace.
const dashboardEntry = collegeHome;

export default function PortalNotFound() {
  const router = useRouter();
  return (
    <main className="portal-missing">
      <header className="portal-missing-header">
        <Link href={collegeHome} className="portal-missing-brand">
          <Image src="/favicon.svg" width={44} height={44} alt="" />
          <span>
            <strong>Pragathi College</strong>
            <small>Campus workspace</small>
          </span>
        </Link>
        <span className="portal-missing-location">A little off the map</span>
      </header>
      <section
        className="portal-missing-card"
        aria-labelledby="missing-page-title"
      >
        <div className="portal-missing-art" aria-hidden="true">
          <span className="portal-missing-number">404</span>
          <svg viewBox="0 0 340 240" fill="none" className="portal-missing-map">
            <path
              d="M12 168h72c30 0 30-64 60-64h52c30 0 30 64 60 64h72"
              stroke="#ced9df"
              strokeWidth="28"
              strokeLinecap="round"
            />
            <path
              className="portal-missing-route"
              d="M12 168h72c30 0 30-64 60-64h52c30 0 30 64 60 64h72"
              stroke="#a77524"
              strokeWidth="2.5"
              strokeDasharray="5 9"
              strokeLinecap="round"
            />
            <circle
              cx="63"
              cy="168"
              r="20"
              fill="white"
              stroke="#dbe4e9"
              strokeWidth="2"
            />
            <path
              d="m56 161 14 14m0-14-14 14"
              stroke="#8c6027"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="267" cy="168" r="29" fill="#18384b" />
            <path
              d="m251 163 16-11 16 11v18h-32v-18Zm11 18v-11h10v11m-29-18h34m-22-7v-7h7"
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M170 76c0-16 12-29 28-29s28 13 28 29c0 20-28 42-28 42s-28-22-28-42Z"
              fill="#f9f3e7"
              stroke="#a77524"
              strokeWidth="2.5"
            />
            <circle cx="198" cy="76" r="8" stroke="#a77524" strokeWidth="2.5" />
          </svg>
          <span className="portal-missing-map-label">
            <span /> Your workspace is still here
          </span>
        </div>
        <div className="portal-missing-copy">
          <span className="portal-missing-status">Page not found</span>
          <h1 id="missing-page-title">
            Let’s get you
            <br />
            back on track.
          </h1>
          <p>
            This link may have changed, or the address may be incomplete. Your
            dashboard is a good place to pick up where you left off.
          </p>
          <Link href={dashboardEntry} className="portal-missing-primary">
            <LayoutDashboard size={19} />
            <span>Back to dashboard</span>
            <ArrowRight size={19} />
          </Link>
          <button
            type="button"
            className="portal-missing-back"
            onClick={() => {
              if (window.history.length > 1) router.back();
              else router.replace(dashboardEntry);
            }}
          >
            <ArrowLeft size={17} />
            Go back to the previous page
          </button>
          <div className="portal-missing-help">
            Need a hand? Your college office can help you find the right page.
          </div>
        </div>
      </section>
      <footer className="portal-missing-footer">
        <span>Learning. People. Possibilities.</span>
        <Link href={dashboardEntry}>
          Return to login <ArrowRight size={14} />
        </Link>
      </footer>
    </main>
  );
}
