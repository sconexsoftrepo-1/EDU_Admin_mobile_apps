"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import type { Restaurant } from "@/data/restaurants";
import { useRestaurantCart } from "./RestaurantCart";
import { MenuExplorer, TableSelector } from "./Ordering";
export function QRMenu({
  restaurant: r,
  table,
  tokenInvalid = false,
}: {
  restaurant: Restaurant;
  table?: number;
  tokenInvalid?: boolean;
}) {
  return (
    <div className="food-qr-menu food-wrap">
      <h1>
        {tokenInvalid
          ? "This table link isn’t available."
          : "Your table. Your menu."}
      </h1>
      <p>
        {tokenInvalid
          ? "The token is invalid, disabled or belongs to another restaurant. Choose an active configured demo table below."
          : "Confirm the table, explore the menu and review your local demo order."}
      </p>
      <TableSelector restaurant={r} prefill={table} />
      <MenuExplorer restaurant={r} />
    </div>
  );
}
export function QRDashboard({ restaurant: r }: { restaurant: Restaurant }) {
  const { cart, update } = useRestaurantCart(),
    [table, setTable] = useState(r.tables[0].number),
    [svg, setSvg] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const current = r.tables.find((t) => t.number === table)!,
    enabled = current.active && !cart.disabled.includes(table);
  useEffect(() => {
    let cancelled = false;
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    let target = "";
    try {
      const parsed = new URL(origin);
      if (!["http:", "https:"].includes(parsed.protocol)) throw Error();
      target = new URL(
        `/restaurants-food/${r.slug}/qr/${current.token}`,
        parsed.origin,
      ).toString();
    } catch {
      setTimeout(
        () =>
          setError(
            "Configure a valid public website origin to generate QR links.",
          ),
        0,
      );
      return;
    }
    QRCode.toString(target, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 4,
      width: 320,
      color: { dark: "#131313", light: "#ffffff" },
    })
      .then((value) => {
        if (!cancelled) {
          setSvg(value);
          setUrl(target);
          setError("");
        }
      })
      .catch(() => {
        if (!cancelled)
          setError("The QR could not be generated. Use the menu link instead.");
      });
    return () => {
      cancelled = true;
    };
  }, [r.slug, current.token]);
  const download = (format: "svg" | "png") => {
    if (!enabled) return;
    if (format === "svg") {
      const a = document.createElement("a");
      a.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      a.download = `${r.slug}-table-${table}.svg`;
      a.click();
    } else
      QRCode.toDataURL(url, {
        width: 900,
        margin: 4,
        errorCorrectionLevel: "M",
      }).then((href) => {
        const a = document.createElement("a");
        a.href = href;
        a.download = `${r.slug}-table-${table}.png`;
        a.click();
      });
  };
  return (
    <section className="food-qr-dashboard food-wrap" id="qr-menu">
      <div>
        <small>Smart menu / Demo table studio</small>
        <h2>Scan. Choose. Enjoy the demo.</h2>
        <p>
          Real QR codes, a validated table and a menu that fits in your hand.
          Nothing reaches a real kitchen.
        </p>
        <label>
          Configured demo table
          <select
            value={table}
            onChange={(e) => setTable(Number(e.target.value))}
          >
            {r.tables.map((t) => (
              <option key={t.number} value={t.number}>
                Table {t.number} · {t.seats} seats
                {!t.active ? " · unavailable" : ""}
              </option>
            ))}
          </select>
        </label>
        <ul className="food-table-list">
          {r.tables.map((t) => (
            <li key={t.number}>
              <span>
                Table {t.number} / {t.seats} seats
              </span>
              <button
                disabled={!t.active}
                aria-pressed={!t.active || cart.disabled.includes(t.number)}
                onClick={() =>
                  update((c) => ({
                    ...c,
                    disabled: c.disabled.includes(t.number)
                      ? c.disabled.filter((n) => n !== t.number)
                      : [...c.disabled, t.number],
                  }))
                }
              >
                {!t.active
                  ? "Configured inactive"
                  : cart.disabled.includes(t.number)
                    ? "Enable locally"
                    : "Disable locally"}
              </button>
            </li>
          ))}
        </ul>
        <p className="food-demo-note">
          Table disabling is local to this browser session. A production system
          needs server validation and staff authorization. Codes use the
          configured public origin, or this browsing origin during local
          development.
        </p>
      </div>
      <div className="qr-print-card">
        {svg && (
          <Image
            unoptimized
            className="food-qr-image"
            width={320}
            height={320}
            src={"data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)}
            alt={`${r.name} QR code for demo table ${table}`}
          />
        )}
        <h3>{r.name}</h3>
        <p>
          Demo table {table} · {enabled ? "Active" : "Disabled"}
        </p>
        {error && <p role="alert">{error}</p>}
        {enabled ? (
          <a className="food-button" href={url}>
            Test this table link ↗
          </a>
        ) : (
          <p role="status">
            This table is disabled. Choose or enable an active table.
          </p>
        )}
        <div className="food-qr-actions">
          <button disabled={!enabled || !svg} onClick={() => download("svg")}>
            Download SVG
          </button>
          <button disabled={!enabled || !svg} onClick={() => download("png")}>
            Download PNG
          </button>
          <button disabled={!enabled || !svg} onClick={() => window.print()}>
            Print QR card
          </button>
        </div>
        <p className="food-qr-url">{url}</p>
      </div>
    </section>
  );
}
