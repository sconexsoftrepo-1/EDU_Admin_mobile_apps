import { z } from "zod";
import type { Restaurant } from "@/data/restaurants";
export type CartLine = {
  key: string;
  dish: string;
  portion: string;
  addons: string[];
  quantity: number;
  custom?: { kind: "bowl" | "combo"; choices: string[] };
};
export type CartState = {
  items: CartLine[];
  mode: "dine-in" | "takeaway";
  table: number | null;
  pickup: string;
  disabled: number[];
};
export type DemoOrder = {
  id: string;
  restaurant: string;
  items: CartLine[];
  mode: CartState["mode"];
  table: number | null;
  pickup: string;
  notes: string;
  total: number;
  status: number;
  createdAt: number;
};
export const emptyCart: CartState = {
  items: [],
  mode: "takeaway",
  table: null,
  pickup: "Next available demo slot",
  disabled: [],
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
export function activeTable(
  r: Restaurant,
  n: number | null,
  disabled: number[] = [],
) {
  return r.tables.find(
    (t) => t.number === n && t.active && !disabled.includes(t.number),
  );
}
export function resolveTableToken(r: Restaurant, token: string) {
  return r.tables.find((t) => t.token === token && t.active);
}
export function linePrice(r: Restaurant, line: CartLine) {
  const dish = r.menu.find((d) => d.slug === line.dish);
  if (!dish) return 0;
  const portion =
    dish.portions.find((p) => p.id === line.portion) || dish.portions[0];
  const extras = [...new Set(line.addons)].reduce(
    (n, id) => n + (dish.addons.find((a) => a.id === id)?.price || 0),
    0,
  );
  const customCosts: Record<string, number> =
    line.custom?.kind === "bowl"
      ? { quinoa: 40, tofu: 60, avocado: 50, seeds: 25 }
      : { starter: 180, drink: 90, dessert: 140, large: 120 };
  const custom = line.custom
    ? [...new Set(line.custom.choices)].reduce(
        (n, id) => n + (customCosts[id] || 0),
        0,
      )
    : 0;
  return Math.round(dish.price * portion.multiplier) + extras + custom;
}
export function totals(r: Restaurant, items: CartLine[]) {
  const subtotal = items.reduce((n, l) => n + linePrice(r, l) * l.quantity, 0),
    tax = Math.round(subtotal * r.taxRate),
    service = Math.round(subtotal * r.serviceRate);
  return { subtotal, tax, service, total: subtotal + tax + service };
}
const lineSchema = z.object({
  key: z.string().max(200),
  dish: z.string(),
  portion: z.string(),
  addons: z.array(z.string()).max(6),
  quantity: z.number().int().min(1).max(20),
  custom: z
    .object({
      kind: z.enum(["bowl", "combo"]),
      choices: z.array(z.string()).max(10),
    })
    .optional(),
});
export function restoreCart(r: Restaurant, raw: unknown): CartState {
  const parsed = z
    .object({
      items: z.array(lineSchema).max(50),
      mode: z.enum(["dine-in", "takeaway"]),
      table: z.number().int().nullable(),
      pickup: z.string().max(80),
      disabled: z.array(z.number().int()).max(6),
    })
    .safeParse(raw);
  if (!parsed.success) return { ...emptyCart, items: [], disabled: [] };
  const items = parsed.data.items.filter((l) => {
    const d = r.menu.find((d) => d.slug === l.dish);
    return (
      d &&
      d.portions.some((p) => p.id === l.portion) &&
      l.addons.every((a) => d.addons.some((x) => x.id === a)) &&
      (!l.custom ||
        (r.slug === "greenbowl-cafe" &&
          l.custom.kind === "bowl" &&
          l.custom.choices.every((c) =>
            [
              "rice",
              "quinoa",
              "chickpeas",
              "tofu",
              "greens",
              "avocado",
              "lemon",
              "tahini",
              "seeds",
              "no-extra",
            ].includes(c),
          )) ||
        (r.slug === "biryani-express" &&
          l.custom.kind === "combo" &&
          l.custom.choices.every((c) =>
            [
              "starter",
              "no-starter",
              "drink",
              "no-drink",
              "dessert",
              "no-dessert",
              "large",
              "regular",
            ].includes(c),
          )))
    );
  });
  return {
    ...parsed.data,
    items,
    table: activeTable(r, parsed.data.table, parsed.data.disabled)
      ? parsed.data.table
      : null,
  };
}
export function orderError(r: Restaurant, c: CartState) {
  if (!c.items.length) return "Add at least one dish before checkout.";
  if (c.mode === "dine-in" && !activeTable(r, c.table, c.disabled))
    return "Choose and confirm an active demo table.";
  if (
    c.mode === "takeaway" &&
    ![
      "Next available demo slot",
      "In 30 minutes · illustrative",
      "In 60 minutes · illustrative",
    ].includes(c.pickup)
  )
    return "Choose a valid demo pickup slot.";
  return "";
}
export const reservationSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(100),
  email: z.email("Enter a valid email."),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.")
    .refine((v) => {
      const date = new Date(v + "T12:00:00");
      return (
        !Number.isNaN(+date) &&
        date.toISOString().slice(0, 10) === v &&
        v >= new Date().toLocaleDateString("en-CA")
      );
    }, "Choose a real date today or later."),
  time: z.enum(["12:00", "13:30", "18:00", "19:30", "21:00"], {
    error: "Choose an available demo time.",
  }),
  guests: z.number().int().min(1).max(8),
});
