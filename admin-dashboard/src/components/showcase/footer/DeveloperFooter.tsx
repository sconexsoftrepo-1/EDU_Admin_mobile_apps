"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion, motion } from "motion/react";
import { ArrowUpRight, Mail, Phone, MessageCircle } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { developerContact as developer } from "@/data/developerContact";
import WhatsAppContact from "@/components/contact/WhatsAppContact";
import BrandLogo from "../../brand/BrandLogo";
import { brandConfig } from "../../brand/config/brandConfig";
import type { CompanionMood } from "./AICompanionScene";
const Scene = dynamic(() => import("./AICompanionScene"), { ssr: false });
export class CompanionBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export default function DeveloperFooter() {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [webgl, setWebgl] = useState(false);
  const [ready, setReady] = useState(false);
  const [mood, setMood] = useState<CompanionMood>("idle");
  const [message, setMessage] = useState("");
  const pointer = useRef({ x: 0, y: 0 });
  const touchStart = useRef(0);
  const cycle = useRef(0);
  const reduced = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (!e.isIntersecting) {
          setReady(false);
          return;
        }
        try {
          const canvas = document.createElement("canvas"),
            gl = canvas.getContext("webgl2");
          setWebgl(Boolean(gl));
          gl?.getExtension("WEBGL_lose_context")?.loseContext();
        } catch {
          setWebgl(false);
        }
      },
      { rootMargin: "100px" },
    );
    if (root.current) obs.observe(root.current);
    return () => {
      obs.disconnect();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (reduced || !root.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: root.current, start: "top 85%", once: true },
      });
      tl.fromTo(
        ".creator-footer-headline > span",
        { yPercent: 100 },
        { yPercent: 0, duration: 0.7, stagger: 0.1, ease: "power3.out" },
      )
        .fromTo(
          ".creator-portrait-stage",
          { y: 35, opacity: 0.4 },
          { y: 0, opacity: 1, duration: 0.7 },
          0.2,
        )
        .fromTo(
          ".creator-contact-card",
          { y: 16, opacity: 0.6 },
          { y: 0, opacity: 1, duration: 0.4, stagger: 0.1 },
          0.6,
        )
        .fromTo(
          ".creator-signature-line",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.6 },
          0.7,
        );
    }, root);
    return () => ctx.revert();
  }, [reduced]);
  function react(next: CompanionMood, text: string) {
    if (timer.current) clearTimeout(timer.current);
    setMood(next);
    setMessage(text);
    timer.current = setTimeout(() => {
      setMood("idle");
      setMessage("");
    }, 3200);
  }
  const click = () => {
    const moods: CompanionMood[] = ["happy", "curious", "excited"];
    const next = moods[cycle.current++ % 3];
    react(
      next,
      next === "happy"
        ? "Hey there! 👋"
        : next === "curious"
          ? "Have a project in mind?"
          : "Let’s create something amazing!",
    );
  };
  return (
    <footer
      className="creator-footer"
      id="contact"
      ref={root}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || reduced) return;
        const box = e.currentTarget.getBoundingClientRect();
        pointer.current = {
          x: ((e.clientX - box.left) / box.width) * 2 - 1,
          y: ((e.clientY - box.top) / box.height) * 2 - 1,
        };
      }}
    >
      <div className="creator-footer-grid">
        <div className="creator-contact-copy">
          <div className="creator-brand">
            <BrandLogo tagline />
          </div>
          <span className="showroom-kicker">
            The creator behind the experience
          </span>
          <h2 className="creator-footer-headline">
            <span>Have an idea?</span>
            <span>Let’s make</span>
            <span>it iconic.</span>
          </h2>
          <div className="creator-signature">
            <span>K. Chaitanya</span>
            <p>
              Crafting interactive digital experiences
              <br />
              with design, motion & technology.
            </p>
          </div>
          <div className="creator-contact-cards">
            <motion.a
              whileTap={{ scale: 0.98 }}
              href={developer.emailHref}
              className="creator-contact-card creator-email"
              onMouseEnter={() =>
                react("email", "Let’s create something amazing!")
              }
              onFocus={() => react("email", "Let’s create something amazing!")}
            >
              <Mail size={20} />
              <span>
                <small>Email me</small>
                <strong>{developer.email}</strong>
              </span>
              <ArrowUpRight size={20} />
            </motion.a>
            <motion.a
              whileTap={{ scale: 0.98 }}
              href={developer.phoneHref}
              className="creator-contact-card creator-phone"
              onMouseEnter={() => react("phone", "Let’s connect!")}
              onFocus={() => react("phone", "Let’s connect!")}
            >
              <Phone size={20} />
              <span>
                <small>Call me</small>
                <strong>{developer.phone}</strong>
              </span>
              <ArrowUpRight size={20} />
            </motion.a>
            <motion.a
              whileTap={{ scale: 0.98 }}
              href={developer.whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="creator-contact-card creator-whatsapp-card"
              onMouseEnter={() => react("phone", "Let’s chat on WhatsApp!")}
              onFocus={() => react("phone", "Let’s chat on WhatsApp!")}
            >
              <MessageCircle size={20} />
              <span>
                <small>WhatsApp</small>
                <strong>Chat on +91 83670 48538</strong>
              </span>
              <ArrowUpRight size={20} />
            </motion.a>
          </div>
          <details className="creator-whatsapp-compose">
            <summary>Write a message for WhatsApp ↗</summary>
            <WhatsAppContact compact />
          </details>
        </div>
        <div className="creator-portrait-stage">
          <div className="creator-orbit" aria-hidden="true" />
          <Image
            unoptimized
            className="creator-portrait"
            src={developer.artwork}
            alt="Chaitanya's stylized developer character at his laptop, reused from his portfolio"
            width={1200}
            height={800}
          />
          <a
            className="creator-portfolio-link"
            href={developer.portfolio}
            target="_blank"
            rel="noreferrer"
          >
            Step into my portfolio <ArrowUpRight size={17} />
          </a>
          <div className="companion-dock">
            <button
              className={`companion-control ${ready && webgl && !reduced && visible ? "companion-ready" : ""}`}
              aria-label="Greet the AI companion and change its expression"
              onPointerDown={(e) => {
                touchStart.current = e.clientX;
              }}
              onPointerMove={(e) => {
                if (e.pointerType === "touch" && !reduced)
                  pointer.current.x = Math.max(
                    -1,
                    Math.min(1, (e.clientX - touchStart.current) / 100),
                  );
              }}
              onClick={click}
              onMouseEnter={() => react("greeting", "Hey there! 👋")}
              onFocus={() => react("greeting", "Hey there! 👋")}
              data-mood={mood}
            >
              <Image
                unoptimized
                src="/assets/showcase/creator/companion-fallback.webp"
                alt=""
                fill
                sizes="200px"
                className="companion-fallback"
              />
              {visible && webgl && !reduced && (
                <CompanionBoundary
                  onError={() => {
                    setWebgl(false);
                    setReady(false);
                  }}
                >
                  <Scene
                    mood={mood}
                    pointer={pointer}
                    onReady={() => setReady(true)}
                  />
                </CompanionBoundary>
              )}
            </button>
            {message && (
              <motion.p
                initial={reduced ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="companion-speech"
                role="status"
              >
                {message}
              </motion.p>
            )}
            <span className="companion-invitation">Tap to say hello</span>
          </div>
        </div>
      </div>
      <div className="creator-signature-line" />
      <div className="creator-footer-bottom">
        <span>{developer.signature}</span>
        <span>
          {brandConfig.wordmark} / {new Date().getFullYear()}
        </span>
        <a href="#home">Back to the beginning ↑</a>
      </div>
    </footer>
  );
}
