"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { type College } from "@/data/colleges";
import RoleSelect from "./RoleSelect";
import "./college-login.css";

const features = [
  {
    title: "Academics",
    detail: "Classes, Results, Resources",
    Icon: GraduationCap,
  },
  {
    title: "Administration",
    detail: "Manage & monitor with ease",
    Icon: UsersRound,
  },
  {
    title: "Campus Life",
    detail: "Events, Notices, Communities",
    Icon: Building2,
  },
  { title: "Smart Access", detail: "Anytime, anywhere", Icon: Settings },
];

function CampusHero({ college }: { college: College }) {
  const base = `/assets/colleges-institutions/${college.slug}`;
  return (
    <section className="ca-hero" aria-label={`${college.name} campus`}>
      <picture className="ca-campus">
        {college.slug === "edunexa-college" && (
          <>
            <source
              media="(max-width: 767px)"
              srcSet={`${base}/login-mobile.webp`}
            />
            <source
              media="(max-width: 991px)"
              srcSet={`${base}/login-tablet.webp`}
            />
          </>
        )}
        {/* Native picture provides intentional art-directed crops at each breakpoint. */}
        <img src={`${base}/campus.webp`} alt="" fetchPriority="high" />
      </picture>
      <div className="ca-hero-copy">
        <p className="ca-eyebrow">{college.name}</p>
        <h1>
          Your Campus.
          <br />
          <span>Connected.</span>
        </h1>
        <p className="ca-intro">
          One place for the people, learning, and everyday work that make{" "}
          {college.short}.
        </p>
      </div>
      <ul className="ca-features" aria-label="Campus workspace highlights">
        {features.map(({ title, detail, Icon }) => (
          <li key={title}>
            <span className="ca-feature-icon">
              <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <strong>{title}</strong>
            <p>{detail}</p>
          </li>
        ))}
      </ul>
      <footer className="ca-hero-footer">
        <svg
          className="ca-wave"
          viewBox="0 0 800 140"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill="#D9A347"
            fillOpacity=".55"
            d="M0 0C165 190 350 0 800 82V140H0Z"
          />
          <path fill="#193d5f" d="M0 15C180 175 340 9 800 98V140H0Z" />
          <path fill="#10264b" d="M0 23C160 174 380 17 800 112V140H0Z" />
        </svg>
        <p>
          Learn <span>•</span> Grow <span>•</span> Belong
        </p>
        <Building2
          className="ca-footer-building"
          size={100}
          strokeWidth={0.5}
          aria-hidden="true"
        />
      </footer>
    </section>
  );
}

/** Presentation only: credentials and API role codes stay with ConnectedPortal. */
export default function CollegeLogin({
  college,
  roles,
  role,
  signingIn,
  error,
  onSubmit,
  onRoleChange,
}: {
  college: College;
  roles: { code: string; name: string }[];
  role: string;
  signingIn: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRoleChange: (code: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <main
      className="college-login campus-auth"
      style={{ "--college-accent": college.accent } as CSSProperties}
    >
      <CampusHero college={college} />
      <section className="ca-form-panel" aria-labelledby="campus-welcome">
        <div className="ca-card">
          <header className="ca-branding">
            <Image
              className="ca-logo"
              src={
                college.logo ||
                `/assets/colleges-institutions/${college.slug}/crest.svg`
              }
              alt={`${college.name} logo`}
              width={80}
              height={88}
              priority
            />
            <h2 id="campus-welcome">Welcome to {college.name}</h2>
            <p>Sign in to your campus workspace.</p>
          </header>
          <form className="ca-form" onSubmit={onSubmit} aria-busy={signingIn}>
            <div className="ca-field">
              <span id="campus-role-label">Role</span>
              <RoleSelect
                options={roles}
                value={role}
                disabled={signingIn}
                onChange={onRoleChange}
              />
            </div>
            <div className="ca-field">
              <label htmlFor="campus-login">Login ID</label>
              <div className="ca-input">
                <UserRound size={18} aria-hidden="true" />
                <input
                  id="campus-login"
                  name="login"
                  autoComplete="username"
                  placeholder="Enter your login ID"
                  required
                  disabled={signingIn}
                  aria-describedby={error ? "sign-in-error" : undefined}
                  aria-invalid={error ? true : undefined}
                />
              </div>
            </div>
            <div className="ca-field">
              <label htmlFor="campus-password">Password</label>
              <div className="ca-input">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="campus-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                  disabled={signingIn}
                  aria-describedby={error ? "sign-in-error" : undefined}
                  aria-invalid={error ? true : undefined}
                />
                <button
                  className="ca-visibility"
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
            {error && (
              <p id="sign-in-error" role="alert" className="ca-error">
                {error}
              </p>
            )}
            <button className="ca-submit" type="submit" disabled={signingIn}>
              {signingIn ? (
                <>
                  <LoaderCircle
                    className="ca-spinner"
                    size={18}
                    aria-hidden="true"
                  />{" "}
                  Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
            <p className="ca-progress" role="status">
              {signingIn ? "Verifying your college account…" : ""}
            </p>
          </form>
          <aside className="ca-help">
            <ShieldCheck size={22} strokeWidth={1.6} aria-hidden="true" />
            <p>
              Choose your assigned role and use your college account. For
              password help, contact your college administrator.
            </p>
          </aside>
        </div>
        <p className="ca-panel-caption">Your college. One connected campus.</p>
      </section>
    </main>
  );
}
