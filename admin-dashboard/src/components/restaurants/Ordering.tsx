"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { Restaurant, Dish } from "@/data/restaurants";
import {
  activeTable,
  linePrice,
  money,
  orderError,
  reservationSchema,
  totals,
  type CartLine,
} from "@/lib/restaurants/ordering";
import { useRestaurantCart } from "./RestaurantCart";
export function DishCard({
  restaurant: r,
  dish: d,
}: {
  restaurant: Restaurant;
  dish: Dish;
}) {
  const { add } = useRestaurantCart();
  const [favourite, setFavourite] = useState(false),
    [quantity, setQuantity] = useState(1),
    [portion, setPortion] = useState("regular"),
    [addons, setAddons] = useState<string[]>([]);
  const line = { dish: d.slug, portion, addons, quantity };
  return (
    <article className="food-card" style={{ viewTransitionName: undefined }}>
      <Link
        className="food-card-image"
        href={`/restaurants-food/${r.slug}/menu/${d.slug}`}
      >
        <Image
          unoptimized
          src={d.image}
          width={640}
          height={460}
          alt={d.name}
        />
        <span>Explore dish ↗</span>
      </Link>
      <div className="food-card-head">
        <small>
          {d.category} ·{" "}
          {d.vegetarian
            ? "Vegetarian recipe concept"
            : "Non-vegetarian recipe concept"}
        </small>
        <button
          aria-label={`${favourite ? "Unsave" : "Save"} ${d.name}`}
          aria-pressed={favourite}
          onClick={() => setFavourite((v) => !v)}
        >
          {favourite ? "♥" : "♡"}
        </button>
      </div>
      <h3>
        <Link href={`/restaurants-food/${r.slug}/menu/${d.slug}`}>
          {d.name}
        </Link>
      </h3>
      <p>{d.description}</p>
      <span className="food-spice">
        Spice profile: {["Gentle", "Warm", "Lively", "Bold"][d.spice]}
      </span>
      <details className="food-card-options">
        <summary>Portion & extras</summary>
        <label>
          Portion for {d.name}
          <select value={portion} onChange={(e) => setPortion(e.target.value)}>
            {d.portions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {d.addons.map((a) => (
          <label className="food-check" key={a.id}>
            <input
              type="checkbox"
              checked={addons.includes(a.id)}
              onChange={() =>
                setAddons((v) =>
                  v.includes(a.id) ? v.filter((x) => x !== a.id) : [...v, a.id],
                )
              }
            />
            {a.name} +{money(a.price)}
          </label>
        ))}
      </details>
      <div className="food-card-buy">
        <strong>{money(linePrice(r, { ...line, key: "" }))}</strong>
        <label>
          <span className="sr-only">Quantity for {d.name}</span>
          <input
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(e) =>
              setQuantity(
                Math.max(1, Math.min(20, Number(e.target.value) || 1)),
              )
            }
          />
        </label>
        <button
          className="food-button"
          onClick={() => add(line)}
          aria-label={`Add ${d.name} to cart`}
        >
          Add +
        </button>
      </div>
    </article>
  );
}
export function MenuExplorer({
  restaurant: r,
  preview = false,
}: {
  restaurant: Restaurant;
  preview?: boolean;
}) {
  const [category, setCategory] = useState("All"),
    [search, setSearch] = useState("");
  const visible = r.menu.filter(
    (d) =>
      (category === "All" || d.category === category) &&
      `${d.name} ${d.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="food-menu food-wrap" id="menu-explorer">
      <div className="food-section-heading">
        <div>
          <small>A taste of {r.name}</small>
          <h2>
            {preview ? "Find your next favourite." : "The menu, at your pace."}
          </h2>
        </div>
        <p>
          Illustrative recipes and sample prices in Indian rupees. No real
          orders or payments.
        </p>
      </div>
      <label className="food-search">
        <span>Find a dish</span>
        <input
          type="search"
          placeholder="Search dishes or flavours"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="food-menu-tabs" role="group" aria-label="Menu categories">
        {["All", ...r.categories].map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="food-results" role="status">
        {visible.length} dishes{category !== "All" ? ` in ${category}` : ""}
      </p>
      <div className={preview ? "food-dish-rail" : "food-menu-grid"}>
        {visible.map((d) => (
          <DishCard key={d.slug} restaurant={r} dish={d} />
        ))}
      </div>
      {!visible.length && (
        <div className="food-empty">
          <h3>No dish matches that search.</h3>
          <button
            className="food-button"
            onClick={() => {
              setSearch("");
              setCategory("All");
            }}
          >
            Show the full menu
          </button>
        </div>
      )}
      {preview && (
        <Link
          className="food-text-link"
          href={`/restaurants-food/${r.slug}/menu`}
        >
          Explore the complete menu ↗
        </Link>
      )}
    </section>
  );
}
export function DishDetails({
  restaurant: r,
  dish: d,
}: {
  restaurant: Restaurant;
  dish: Dish;
}) {
  return (
    <section className="food-dish-detail food-wrap">
      <div>
        <Image
          unoptimized
          src={d.image}
          width={900}
          height={760}
          alt={d.name}
        />
        <p className="food-image-note">Generated fictional dish illustration</p>
      </div>
      <div>
        <small>{d.category}</small>
        <h1>{d.name}</h1>
        <p>{d.description}</p>
        <h2>In this recipe concept</h2>
        <ul>
          {d.ingredients.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        <p className="food-demo-note">{d.allergens}</p>
        <DishCard restaurant={r} dish={d} />
      </div>
    </section>
  );
}
export function TableSelector({
  restaurant: r,
  prefill,
}: {
  restaurant: Restaurant;
  prefill?: number;
}) {
  const { cart, update } = useRestaurantCart(),
    [input, setInput] = useState(String(prefill || cart.table || "")),
    [error, setError] = useState(""),
    [confirmed, setConfirmed] = useState(false);
  return (
    <section className="food-table-selector">
      <h2>Welcome. Let’s start with your table.</h2>
      <p>
        Confirm an active configured demo table. This does not identify a real
        restaurant table.
      </p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const table = activeTable(r, Number(input), cart.disabled);
          if (!input || !table) {
            setError("Enter an active configured table number.");
            setConfirmed(false);
            return;
          }
          update((c) => ({ ...c, table: table.number, mode: "dine-in" }));
          setError("");
          setConfirmed(true);
        }}
      >
        <label>
          Table number
          <input
            type="number"
            min={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setConfirmed(false);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? "table-error" : undefined}
          />
        </label>
        <button className="food-button">Confirm table</button>
      </form>
      {error && (
        <p id="table-error" role="alert">
          {error}
        </p>
      )}
      {confirmed && (
        <p role="status">Table {cart.table} confirmed for this demo.</p>
      )}
      <p>
        Active demo tables:{" "}
        {r.tables
          .filter((t) => t.active && !cart.disabled.includes(t.number))
          .map((t) => t.number)
          .join(", ") || "none enabled"}
      </p>
    </section>
  );
}
export function OrderMode({ restaurant: r }: { restaurant: Restaurant }) {
  const { cart, update } = useRestaurantCart();
  return (
    <section className="food-order-mode">
      <div role="group" aria-label="Order type">
        {(["takeaway", "dine-in"] as const).map((mode) => (
          <button
            key={mode}
            aria-pressed={cart.mode === mode}
            onClick={() => update((c) => ({ ...c, mode }))}
          >
            {mode === "dine-in" ? "Dine-in" : "Takeaway"}
          </button>
        ))}
      </div>
      {cart.mode === "dine-in" ? (
        <>
          <TableSelector restaurant={r} />
          {cart.table && <p>Current table: {cart.table}</p>}
        </>
      ) : (
        <label>
          Demo pickup time
          <select
            value={cart.pickup}
            onChange={(e) => update((c) => ({ ...c, pickup: e.target.value }))}
          >
            {[
              "Next available demo slot",
              "In 30 minutes · illustrative",
              "In 60 minutes · illustrative",
            ].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}
export function CartContents({ restaurant: r }: { restaurant: Restaurant }) {
  const { cart, update } = useRestaurantCart(),
    total = totals(r, cart.items);
  return (
    <div className="food-cart-contents">
      {cart.items.length ? (
        <>
          <ul>
            {cart.items.map((l) => {
              const dish = r.menu.find((d) => d.slug === l.dish)!;
              return (
                <li key={l.key}>
                  <Image
                    unoptimized
                    src={dish.image}
                    width={90}
                    height={80}
                    alt=""
                  />
                  <div>
                    <strong>{dish.name}</strong>
                    <small>
                      {dish.portions.find((p) => p.id === l.portion)?.name}
                      {l.addons.length
                        ? ` · ${l.addons.map((a) => dish.addons.find((x) => x.id === a)?.name).join(", ")}`
                        : ""}
                      {l.custom ? ` · ${l.custom.choices.join(", ")}` : ""}
                    </small>
                    <span>{money(linePrice(r, l))} each</span>
                    <div className="food-quantity">
                      <button
                        aria-label={`Decrease ${dish.name}`}
                        disabled={l.quantity <= 1}
                        onClick={() =>
                          update((c) => ({
                            ...c,
                            items: c.items.map((x) =>
                              x.key === l.key
                                ? { ...x, quantity: x.quantity - 1 }
                                : x,
                            ),
                          }))
                        }
                      >
                        −
                      </button>
                      <output aria-label={`Quantity of ${dish.name}`}>
                        {l.quantity}
                      </output>
                      <button
                        aria-label={`Increase ${dish.name}`}
                        disabled={l.quantity >= 20}
                        onClick={() =>
                          update((c) => ({
                            ...c,
                            items: c.items.map((x) =>
                              x.key === l.key
                                ? { ...x, quantity: x.quantity + 1 }
                                : x,
                            ),
                          }))
                        }
                      >
                        +
                      </button>
                      <button
                        aria-label={`Remove ${dish.name}`}
                        onClick={() =>
                          update((c) => ({
                            ...c,
                            items: c.items.filter((x) => x.key !== l.key),
                          }))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <b>{money(linePrice(r, l) * l.quantity)}</b>
                </li>
              );
            })}
          </ul>
          <dl className="food-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(total.subtotal)}</dd>
            </div>
            <div>
              <dt>Demo tax · {r.taxRate * 100}%</dt>
              <dd>{money(total.tax)}</dd>
            </div>
            <div>
              <dt>Demo service charge · {r.serviceRate * 100}%</dt>
              <dd>{money(total.service)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{money(total.total)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <div className="food-empty">
          <h2>Your next favourite is waiting.</h2>
          <p>Your demo cart is empty.</p>
          <Link
            className="food-button"
            href={`/restaurants-food/${r.slug}/menu`}
          >
            Explore the menu
          </Link>
        </div>
      )}
    </div>
  );
}
export function CartDrawer({ restaurant: r }: { restaurant: Restaurant }) {
  const { cart } = useRestaurantCart(),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const count = cart.items.reduce((n, l) => n + l.quantity, 0);
  return (
    <>
      <button
        ref={trigger}
        className="food-cart-trigger"
        onClick={() => dialog.current?.showModal()}
        aria-label={`Open cart, ${count} items`}
      >
        Your demo cart <b>{count}</b>
        <span>{money(totals(r, cart.items).total)}</span>
      </button>
      <dialog
        className="food-cart-drawer"
        ref={dialog}
        aria-label="Your demo cart"
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="food-cart-drawer-inner">
          <div className="food-cart-drawer-head">
            <h2>Your demo cart</h2>
            <button
              aria-label="Close cart"
              onClick={() => dialog.current?.close()}
            >
              ✕
            </button>
          </div>
          <p>Local demonstration. No payment or kitchen transmission.</p>
          <CartContents restaurant={r} />
          {!!count && (
            <Link
              className="food-button"
              href={`/restaurants-food/${r.slug}/checkout`}
              onClick={() => dialog.current?.close()}
            >
              Review demo checkout ↗
            </Link>
          )}
        </div>
      </dialog>
    </>
  );
}
export function Checkout({ restaurant: r }: { restaurant: Restaurant }) {
  const { cart, update, setOrder, loaded } = useRestaurantCart(),
    router = useRouter(),
    [error, setError] = useState(""),
    [notes, setNotes] = useState("");
  return (
    <section className="food-checkout food-wrap">
      <div>
        <h1>One last look.</h1>
        <p>
          This checkout is a local demonstration. No payment, real restaurant or
          kitchen is connected.
        </p>
        <OrderMode restaurant={r} />
        <label>
          Optional preparation note
          <textarea
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="No personal or sensitive information, please."
          />
        </label>
        <button
          disabled={!loaded}
          className="food-button"
          onClick={() => {
            const invalid = orderError(r, cart);
            if (invalid) {
              setError(invalid);
              return;
            }
            setOrder({
              id: "DEMO-" + Date.now().toString(36).toUpperCase(),
              restaurant: r.slug,
              items: cart.items.map((l) => ({ ...l })),
              mode: cart.mode,
              table: cart.mode === "dine-in" ? cart.table : null,
              pickup: cart.pickup,
              notes: notes.trim(),
              total: totals(r, cart.items).total,
              status: 0,
              createdAt: Date.now(),
            });
            update((c) => ({ ...c, items: [] }));
            router.push(`/restaurants-food/${r.slug}/order-confirmation`);
          }}
        >
          Place demo order
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
      <CartContents restaurant={r} />
    </section>
  );
}
export function OrderConfirmation({
  restaurant: r,
  kitchen = false,
}: {
  restaurant: Restaurant;
  kitchen?: boolean;
}) {
  const { order, setOrder } = useRestaurantCart();
  const statuses =
    order?.mode === "takeaway"
      ? ["Received", "Preparing", "Ready", "Collected"]
      : ["Received", "Preparing", "Ready", "Served"];
  return (
    <section className="food-confirmation food-wrap">
      <small>{kitchen ? "Local kitchen simulation" : "Order preview"}</small>
      <h1>
        {kitchen
          ? "The demo pass."
          : order
            ? "Demo order placed!"
            : "Start with something delicious."}
      </h1>
      <p>
        No order reaches a restaurant. Status changes below are controlled
        locally, not live kitchen updates.
      </p>
      {order ? (
        <>
          <div className="food-order-receipt">
            <h2>{order.id}</h2>
            <p>
              {r.name} ·{" "}
              {order.mode === "dine-in"
                ? `Demo table ${order.table}`
                : `Takeaway · ${order.pickup}`}
            </p>
            <ul>
              {order.items.map((l) => (
                <li key={l.key}>
                  {l.quantity} × {r.menu.find((d) => d.slug === l.dish)?.name}
                </li>
              ))}
            </ul>
            <strong>{money(order.total)}</strong>
            {order.notes && <p>Demo preparation note: {order.notes}</p>}
            <p>
              Illustrative preparation time: 20–30 minutes. No actual timing is
              promised.
            </p>
          </div>
          <ol className="food-order-status">
            {statuses.map((s, i) => (
              <li
                key={s}
                aria-current={order.status === i ? "step" : undefined}
              >
                <span>{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <button
            className="food-button"
            disabled={order.status === 3}
            onClick={() =>
              setOrder({ ...order, status: Math.min(3, order.status + 1) })
            }
          >
            {order.status === 3
              ? "Demo complete"
              : `Simulate ${statuses[order.status + 1]}`}
          </button>
          {!kitchen && (
            <Link
              className="food-text-link"
              href={`/restaurants-food/${r.slug}/demo-kitchen`}
            >
              View the local kitchen simulation ↗
            </Link>
          )}
        </>
      ) : (
        <>
          <p>
            No demo order exists in this browsing session. Order details are
            held in memory and clear on reload.
          </p>
          <Link
            className="food-button"
            href={`/restaurants-food/${r.slug}/menu`}
          >
            Browse the menu
          </Link>
        </>
      )}
    </section>
  );
}
export function Reservation({ restaurant: r }: { restaurant: Restaurant }) {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<
    z.input<typeof reservationSchema>,
    unknown,
    z.output<typeof reservationSchema>
  >({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      name: "",
      email: "",
      date: "",
      time: undefined,
      guests: 2,
    },
  });
  return (
    <section className="food-reservation food-wrap">
      <div>
        <small>A place at the table</small>
        <h2>
          {r.slug === "biryani-express"
            ? "Dine in. Take a moment."
            : "Make an evening of it."}
        </h2>
        <p>
          A fictional reservation preview. No booking is sent, stored or
          confirmed with a real venue.
        </p>
        <Image
          unoptimized
          src={r.tableImage}
          width={800}
          height={600}
          alt={`${r.name} fictional table setting`}
        />
      </div>
      {done ? (
        <div className="food-demo-success" role="status">
          <h3>Your demo reservation is ready.</h3>
          <p>
            This is a demonstration. No restaurant received your details and no
            table has been reserved.
          </p>
          <button
            className="food-button"
            onClick={() => {
              reset();
              setDone(false);
            }}
          >
            Try another reservation
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={handleSubmit(() => setDone(true))}>
          <h3>Preview a reservation</h3>
          <label>
            Your name
            <input
              {...register("name")}
              aria-label="Your name"
              autoComplete="name"
              aria-invalid={!!errors.name}
            />
            {errors.name && <span role="alert">{errors.name.message}</span>}
          </label>
          <label>
            Email address
            <input
              {...register("email")}
              aria-label="Email address"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
            />
            {errors.email && <span role="alert">{errors.email.message}</span>}
          </label>
          <label>
            Preferred date
            <input
              {...register("date")}
              aria-label="Preferred date"
              type="date"
              aria-invalid={!!errors.date}
            />
            {errors.date && <span role="alert">{errors.date.message}</span>}
          </label>
          <label>
            Preferred time
            <select
              {...register("time")}
              aria-label="Preferred time"
              aria-invalid={!!errors.time}
            >
              <option value="">Choose a time</option>
              {["12:00", "13:30", "18:00", "19:30", "21:00"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            {errors.time && <span role="alert">{errors.time.message}</span>}
          </label>
          <label>
            Guests
            <input
              {...register("guests", { valueAsNumber: true })}
              type="number"
              min={1}
              max={8}
              aria-invalid={!!errors.guests}
            />
            {errors.guests && <span role="alert">{errors.guests.message}</span>}
          </label>
          <button className="food-button">Preview demo reservation</button>
        </form>
      )}
    </section>
  );
}
export function FoodBuilder({ restaurant: r }: { restaurant: Restaurant }) {
  const combo = r.slug === "biryani-express",
    groups = combo
      ? ([
          ["Starter", ["no-starter", "starter"]],
          ["Drink", ["no-drink", "drink"]],
          ["Dessert", ["no-dessert", "dessert"]],
          ["Portion", ["regular", "large"]],
        ] as const)
      : ([
          ["Base", ["rice", "quinoa"]],
          ["Protein", ["chickpeas", "tofu"]],
          ["Vegetables", ["greens", "avocado"]],
          ["Dressing", ["lemon", "tahini"]],
          ["Extra", ["no-extra", "seeds"]],
        ] as const);
  const { add } = useRestaurantCart();
  const [choices, setChoices] = useState<string[]>(groups.map((g) => g[1][0])),
    [biryani, setBiryani] = useState(r.menu[0].slug);
  const line: CartLine = {
    key: "builder",
    dish: combo ? biryani : r.menu[0].slug,
    portion: "regular",
    addons: [],
    quantity: 1,
    custom: { kind: combo ? "combo" : "bowl", choices },
  };
  function choose(i: number, value: string) {
    const next = choices.map((c, n) => (n === i ? value : c));
    setChoices(next);
    window.dispatchEvent(
      new CustomEvent("restaurant:ingredients", {
        detail: { slug: r.slug, choices: next },
      }),
    );
  }
  return (
    <section className="food-builder food-wrap" id="food-builder">
      <div>
        <small>Make the next plate yours</small>
        <h2>
          {combo
            ? "Build a bold little combo."
            : "Your bowl. Your bright idea."}
        </h2>
        <p>
          {combo
            ? "Choose a biryani and build a sample takeaway tray."
            : "Change the base, protein, vegetables and dressing. Ingredient choices update the illustrated 3D bowl."}{" "}
          Sample prices only.
        </p>
        <div
          className="food-builder-illustration"
          aria-label="Selected ingredients"
        >
          {choices.map((c, i) => (
            <span key={i} className={`builder-piece piece-${i}`}>
              {c.replaceAll("-", " ")}
            </span>
          ))}
        </div>
      </div>
      <div>
        {combo && (
          <label>
            Biryani
            <select
              value={biryani}
              onChange={(e) => setBiryani(e.target.value)}
            >
              {r.menu.slice(0, 10).map((d) => (
                <option value={d.slug} key={d.slug}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {groups.map(([label, options], i) => (
          <fieldset key={label}>
            <legend>{label}</legend>
            {options.map((o) => (
              <label className="food-builder-option" key={o}>
                <input
                  type="radio"
                  name={`builder-${r.slug}-${i}`}
                  checked={choices[i] === o}
                  onChange={() => choose(i, o)}
                />
                {o.replaceAll("-", " ")}
              </label>
            ))}
          </fieldset>
        ))}
        <div className="food-builder-price" aria-live="polite">
          Demo price <strong>{money(linePrice(r, line))}</strong>
        </div>
        <button className="food-button" onClick={() => add(line)}>
          Add {combo ? "combo" : "bowl"} to demo cart
        </button>
      </div>
    </section>
  );
}
