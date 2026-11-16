"use client";

import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  KeyRound,
  LockKeyhole,
  Mail,
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
  onRequestCode,
  onVerifyCode,
  allowPassword = false,
}: {
  college: College;
  roles: { code: string; name: string }[];
  role: string;
  signingIn: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRoleChange: (code: string) => void;
  /** Emails a sign-in code; resolves when the request was accepted. */
  onRequestCode?: (login: string) => Promise<void>;
  /** Signs in with the emailed code. */
  onVerifyCode?: (login: string, code: string) => Promise<void>;
  /** Staff sign in with an emailed code only; true brings back the password form. */
  allowPassword?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  // "code": sign in with a 6-digit code sent to the login's email (staff only).
  const [mode, setMode] = useState<"password" | "code">(
    allowPassword || !onRequestCode ? "password" : "code",
  );
  const [codeLogin, setCodeLogin] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((left) => left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);
  async function sendCode() {
    if (!onRequestCode || !codeLogin.trim()) return;
    try {
      await onRequestCode(codeLogin.trim());
      setCodeSent(true);
      setCode("");
      setResendIn(60);
    } catch {
      /* the error is shown by the parent */
    }
  }
  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signingIn) return;
    if (!codeSent) await sendCode();
    else if (onVerifyCode) await onVerifyCode(codeLogin.trim(), code);
  }
  function switchMode(next: "password" | "code") {
    setMode(next);
    setCodeSent(false);
    setCode("");
  }
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
              width={96}
              height={96}
              priority
            />
            <h2 id="campus-welcome">Welcome to {college.name}</h2>
            <p>Sign in to your campus workspace.</p>
          </header>
          {mode === "code" ? (
          <form key="code-form" className="ca-form" onSubmit={submitCode} aria-busy={signingIn}>
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
              <label htmlFor="campus-code-login">Login ID or email</label>
              <div className="ca-input">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="campus-code-login"
                  name="login"
                  autoComplete="username"
                  placeholder="Enter your login ID or email"
                  required
                  disabled={signingIn || codeSent}
                  value={codeLogin}
                  onChange={(e) => setCodeLogin(e.target.value)}
                  aria-describedby={error ? "sign-in-error" : undefined}
                  aria-invalid={error ? true : undefined}
                />
              </div>
            </div>
            {codeSent && (
              <div className="ca-field">
                <label htmlFor="campus-code">6-digit code</label>
                <div className="ca-input">
                  <KeyRound size={18} aria-hidden="true" />
                  <input
                    id="campus-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Enter the code from your email"
                    pattern="[0-9]{6}"
                    required
                    autoFocus
                    disabled={signingIn}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    aria-describedby="code-help"
                  />
                </div>
                <small id="code-help" className="ca-code-help">
                  If this login is assigned to the selected role and has an
                  email address, a code has been sent to it. It is valid for 5
                  minutes.{" "}
                  <button
                    type="button"
                    className="ca-link"
                    disabled={signingIn || resendIn > 0}
                    onClick={sendCode}
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                  </button>{" "}
                  ·{" "}
                  <button
                    type="button"
                    className="ca-link"
                    disabled={signingIn}
                    onClick={() => {
                      setCodeSent(false);
                      setCode("");
                    }}
                  >
                    Change login
                  </button>
                </small>
              </div>
            )}
            {error && (
              <p id="sign-in-error" role="alert" className="ca-error">
                {error}
              </p>
            )}
            <button className="ca-submit" type="submit" disabled={signingIn}>
              {signingIn ? (
                <>
                  <LoaderCircle className="ca-spinner" size={18} aria-hidden="true" />{" "}
                  {codeSent ? "Signing in…" : "Sending code…"}
                </>
              ) : (
                <>
                  {codeSent ? "Verify and sign in" : "Send code"}{" "}
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
            {allowPassword && (
              <button
                type="button"
                className="ca-link ca-mode-switch"
                disabled={signingIn}
                onClick={() => switchMode("password")}
              >
                Use password instead
              </button>
            )}
          </form>
          ) : (
          <form key="password-form" className="ca-form" onSubmit={onSubmit} aria-busy={signingIn}>
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
            {onRequestCode && (
              <button
                type="button"
                className="ca-link ca-mode-switch"
                disabled={signingIn}
                onClick={() => switchMode("code")}
              >
                Sign in with an email code instead
              </button>
            )}
          </form>
          )}
          <aside className="ca-help">
            <ShieldCheck size={22} strokeWidth={1.6} aria-hidden="true" />
            <p>
              Choose your assigned role, then enter your login ID or email. A
              one-time code is sent to the email on your college account.
            </p>
          </aside>
        </div>
        <p className="ca-panel-caption">Your college. One connected campus.</p>
      </section>
    </main>
  );
}
