"use client";
import Link from "next/link";
import { colleges } from "@/data/colleges";
import {
  restaurants,
  restaurantFromPath,
  validRestaurantPath,
  type Restaurant,
} from "@/data/restaurants";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Layers2, X, Check, Copy, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import {
  schools,
  schoolFromPath,
  validSchoolPath,
  type School,
} from "@/data/education";
import { templates } from "@/data/clinic";
import {
  hotels,
  hotelFromPath,
  validHotelPath,
  type Hotel,
} from "@/data/hotels-resorts";
import { useAnimation } from "./animation-system/AnimationProvider";
import type { AnimationTemplateId } from "./animation-system/config/animationRegistry";
export default function TemplateSwitcher() {
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const path = usePathname();
  const { switchTemplate, switchHotel, switchSchool, switchRestaurant } =
    useAnimation();
  const activeCollege = colleges.find((c) =>
    path.startsWith(`/colleges-institutions/${c.slug}`),
  );
  const activeRestaurant = restaurantFromPath(path);
  const activeSchool = schoolFromPath(path);
  const activeHotel = hotelFromPath(path),
    active =
      activeCollege?.number ||
      activeRestaurant?.number ||
      activeSchool?.number ||
      activeHotel?.number ||
      path.match(/templates\/(\d+)/)?.[1] ||
      "01";
  const [copied, setCopied] = useState(false);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function close() {
    dialog.current?.close();
    trigger.current?.focus();
  }
  function origin() {
    const r = trigger.current?.getBoundingClientRect();
    return r
      ? {
          x: ((r.x + r.width / 2) / innerWidth) * 100,
          y: ((r.y + r.height / 2) / innerHeight) * 100,
        }
      : { x: 50, y: 50 };
  }
  function select(id: string) {
    close();
    if (active === id && path.startsWith("/templates/")) return;
    const suffix = path.match(/^\/templates\/\d+(\/.*)?$/)?.[1] || "";
    switchTemplate(
      id as AnimationTemplateId,
      `/templates/${id}${suffix}`,
      origin(),
    );
  }
  function selectHotel(h: Hotel) {
    close();
    if (activeHotel?.slug === h.slug) return;
    let parts = activeHotel ? path.split("/").slice(3) : [];
    if (parts[0] === "rooms" && parts.length === 2) {
      const index =
        activeHotel?.rooms.findIndex((r) => r.slug === parts[1]) ?? -1;
      if (index >= 0) parts = ["rooms", h.rooms[index].slug];
    }
    if (!validHotelPath(h, parts)) parts = [];
    switchHotel(
      h.slug,
      `/hotels-resorts/${h.slug}${parts.length ? "/" + parts.join("/") : ""}`,
      origin(),
    );
  }
  function selectSchool(s: School) {
    close();
    if (activeSchool?.slug === s.slug) return;
    let parts = activeSchool ? path.split("/").slice(3) : [];
    if (parts[0] === "academics" && parts.length === 2) {
      const index =
        activeSchool?.programs.findIndex((p) => p.slug === parts[1]) ?? -1;
      if (index >= 0 && s.programs[index])
        parts = ["academics", s.programs[index].slug];
      else parts = ["academics"];
    }
    if (!validSchoolPath(s, parts)) parts = [];
    switchSchool(
      s.slug,
      `/education-schools/${s.slug}${parts.length ? "/" + parts.join("/") : ""}`,
      origin(),
    );
  }
  function selectRestaurant(r: Restaurant) {
    close();
    if (activeRestaurant?.slug === r.slug) return;
    let parts = activeRestaurant ? path.split("/").slice(3) : [];
    if (parts[0] === "menu" && parts.length === 2) {
      const index =
        activeRestaurant?.menu.findIndex((d) => d.slug === parts[1]) ?? -1;
      parts =
        index >= 0 && r.menu[index] ? ["menu", r.menu[index].slug] : ["menu"];
    }
    if (
      ["cart", "checkout", "order-confirmation", "qr", "demo-kitchen"].includes(
        parts[0],
      )
    )
      parts = ["menu"];
    if (!validRestaurantPath(r, parts)) parts = [];
    switchRestaurant(
      r.slug,
      `/restaurants-food/${r.slug}${parts.length ? "/" + parts.join("/") : ""}`,
      origin(),
    );
  }
  if (
    path === "/portal" ||
    path.startsWith("/portal/") ||
    (path.startsWith("/colleges-institutions/") && path.includes("/portal"))
  )
    return null;
  return (
    <>
      <button
        ref={trigger}
        className="switch-trigger"
        title="Change template"
        aria-label="Change template"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        <Layers2 size={23} />
        <span>{active}</span>
      </button>
      <dialog
        ref={dialog}
        className="switch-dialog"
        aria-labelledby="switch-title"
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="switch-head">
          <div>
            <span className="eyebrow">Find your world</span>
            <h2 id="switch-title">Twenty-two ways to explore.</h2>
          </div>
          <button
            className="icon-button"
            onClick={close}
            aria-label="Close template switcher"
          >
            <X size={20} />
          </button>
        </div>
        <div
          className="switch-options"
          onKeyDown={(e) => {
            if (
              ![
                "ArrowDown",
                "ArrowRight",
                "ArrowUp",
                "ArrowLeft",
                "Home",
                "End",
              ].includes(e.key)
            )
              return;
            e.preventDefault();
            const buttons = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>("button, a"),
            );
            const i = buttons.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            buttons[
              e.key === "Home"
                ? 0
                : e.key === "End"
                  ? buttons.length - 1
                  : (i +
                      (["ArrowDown", "ArrowRight"].includes(e.key) ? 1 : -1) +
                      buttons.length) %
                    buttons.length
            ]?.focus();
          }}
        >
          <h3 className="switch-group-title">Dental Clinics · 6</h3>
          {templates.map((t) => (
            <button
              className={`switch-option ${active === t.id ? "selected" : ""}`}
              key={t.id}
              onClick={() => select(t.id)}
              aria-current={active === t.id ? "page" : undefined}
            >
              <span className={`mini-preview preview-${t.id}`}>
                <Image
                  unoptimized
                  className="switch-thumbnail"
                  src={`/assets/previews/${t.id}-desktop-live.webp`}
                  fill
                  sizes="160px"
                  alt=""
                />
              </span>
              <span className="option-text">
                <small>Template {t.id}</small>
                <strong>{t.name}</strong>
                <span className="swatches">
                  <i style={{ background: t.color }} />
                  <i style={{ background: t.bg }} />
                </span>
              </span>
              {active === t.id ? (
                <span className="selected-check">
                  <Check size={14} />
                </span>
              ) : (
                <ArrowUpRight size={16} />
              )}
            </button>
          ))}
          <h3 className="switch-group-title">Hotels & Resorts · 4</h3>
          {hotels.map((h) => (
            <button
              className={`switch-option ${active === h.number ? "selected" : ""}`}
              key={h.slug}
              onClick={() => selectHotel(h)}
              aria-current={active === h.number ? "page" : undefined}
            >
              <span className="mini-preview">
                <Image
                  unoptimized
                  className="switch-thumbnail"
                  src={`/assets/hotels-resorts/previews/${h.slug}-desktop.webp`}
                  fill
                  sizes="160px"
                  alt=""
                />
              </span>
              <span className="option-text">
                <small>
                  Template {h.number} · {h.short}
                </small>
                <strong>{h.name}</strong>
                <span className="swatches">
                  <i style={{ background: h.palette.accent }} />
                  <i style={{ background: h.palette.bg }} />
                </span>
              </span>
              {active === h.number ? (
                <span className="selected-check">
                  <Check size={14} />
                </span>
              ) : (
                <ArrowUpRight size={16} />
              )}
            </button>
          ))}
          <h3 className="switch-group-title">Education & Schools · 4</h3>
          {schools.map((s) => (
            <button
              className={`switch-option ${active === s.number ? "selected" : ""}`}
              key={s.slug}
              onClick={() => selectSchool(s)}
              aria-current={active === s.number ? "page" : undefined}
            >
              <span className="mini-preview">
                <Image
                  unoptimized
                  className="switch-thumbnail"
                  src={`/assets/education-schools/previews/${s.slug}-desktop.webp`}
                  fill
                  sizes="160px"
                  alt=""
                />
              </span>
              <span className="option-text">
                <small>Template {s.number} · Education</small>
                <strong>{s.name}</strong>
                <span className="swatches">
                  <i style={{ background: s.colors.accent }} />
                  <i style={{ background: s.colors.bg }} />
                  <i style={{ background: s.colors.secondary }} />
                </span>
              </span>
              {active === s.number ? (
                <span className="selected-check">
                  <Check size={14} />
                </span>
              ) : (
                <ArrowUpRight size={16} />
              )}
            </button>
          ))}
          <h3 className="switch-group-title">Restaurants & Food · 6</h3>
          {restaurants.map((r) => (
            <button
              key={r.slug}
              className={`switch-option ${active === r.number ? "selected" : ""}`}
              onClick={() => selectRestaurant(r)}
              aria-current={active === r.number ? "page" : undefined}
            >
              <span className="mini-preview">
                <Image
                  unoptimized
                  className="switch-thumbnail"
                  src={`/assets/restaurants-food/previews/${r.slug}-desktop.webp`}
                  fill
                  sizes="160px"
                  alt=""
                />
              </span>
              <span className="option-text">
                <small>Template {r.number} · Restaurant</small>
                <strong>{r.name}</strong>
                <span className="swatches">
                  <i style={{ background: r.colors.accent }} />
                  <i style={{ background: r.colors.bg }} />
                  <i style={{ background: r.colors.gold }} />
                </span>
              </span>
              {active === r.number ? (
                <span className="selected-check">
                  <Check size={14} />
                </span>
              ) : (
                <ArrowUpRight size={16} />
              )}
            </button>
          ))}
          <h3 className="switch-group-title">Colleges & Institutions · 2</h3>
          {colleges.map((c) => (
            <Link
              key={c.slug}
              className={`switch-option ${path.includes(c.slug) ? "selected" : ""}`}
              href="/portal/login"
              onClick={close}
              aria-current={path.includes(c.slug) ? "page" : undefined}
            >
              <span className="mini-preview">
                <Image
                  unoptimized
                  className="switch-thumbnail"
                  src={`/assets/colleges-institutions/previews/${c.slug}-desktop.webp`}
                  fill
                  sizes="160px"
                  alt=""
                />
              </span>
              <span className="option-text">
                <small>Template {c.number} · Colleges</small>
                <strong>{c.name}</strong>
                <span className="swatches">
                  <i style={{ background: c.accent }} />
                  <i style={{ background: "#14253b" }} />
                </span>
              </span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
        <div className="switch-foot">
          <span>
            Selected:{" "}
            {activeCollege?.name ||
              activeRestaurant?.name ||
              activeSchool?.name ||
              activeHotel?.name ||
              `Template ${active}`}
          </span>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(location.href);
                setCopied(true);
                if (timer.current) clearTimeout(timer.current);
                timer.current = setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
          >
            <Copy size={13} />
            {copied ? "Copied!" : "Copy route"}
          </button>
        </div>
      </dialog>
    </>
  );
}
