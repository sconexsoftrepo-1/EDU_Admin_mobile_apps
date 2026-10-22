"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Restaurant } from "@/data/restaurants";
import {
  emptyCart,
  restoreCart,
  totals,
  type CartState,
  type CartLine,
  type DemoOrder,
} from "@/lib/restaurants/ordering";
type Store = {
  cart: CartState;
  order: DemoOrder | null;
  loaded: boolean;
  update: (next: CartState | ((prev: CartState) => CartState)) => void;
  add: (line: Omit<CartLine, "key">) => void;
  setOrder: (order: DemoOrder | null) => void;
  message: string;
};
const Context = createContext<Store | null>(null);
export function useRestaurantCart() {
  const c = useContext(Context);
  if (!c) throw Error("RestaurantCartProvider is required");
  return c;
}
export function RestaurantCartProvider({
  restaurant: r,
  children,
}: {
  restaurant: Restaurant;
  children: ReactNode;
}) {
  const [cart, setCart] = useState<CartState>({
      ...emptyCart,
      items: [],
      disabled: [],
    }),
    [loaded, setLoaded] = useState(false),
    [order, setOrder] = useState<DemoOrder | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    const load = () => {
      try {
        setCart(
          restoreCart(
            r,
            JSON.parse(
              sessionStorage.getItem("restaurant-cart-" + r.slug) || "null",
            ),
          ),
        );
      } catch {}
      setLoaded(true);
    };
    const frame = requestAnimationFrame(load);
    return () => cancelAnimationFrame(frame);
  }, [r]);
  const update = useCallback(
    (next: CartState | ((prev: CartState) => CartState)) =>
      setCart((prev) => {
        const value = restoreCart(
          r,
          typeof next === "function" ? next(prev) : next,
        );
        try {
          sessionStorage.setItem(
            "restaurant-cart-" + r.slug,
            JSON.stringify(value),
          );
        } catch {}
        return value;
      }),
    [r],
  );
  const add = useCallback(
    (line: Omit<CartLine, "key">) => {
      const key = [
        line.dish,
        line.portion,
        [...line.addons].sort().join(","),
        line.custom?.choices.join(",") || "",
      ].join("|");
      update((c) => {
        const exists = c.items.find((l) => l.key === key);
        return {
          ...c,
          items: exists
            ? c.items.map((l) =>
                l.key === key
                  ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) }
                  : l,
              )
            : [...c.items, { ...line, key }],
        };
      });
      setMessage("Added to your demo cart.");
    },
    [update],
  );
  const value = useMemo(
    () => ({ cart, order, loaded, update, add, setOrder, message }),
    [cart, order, loaded, update, add, message],
  );
  return (
    <Context.Provider value={value}>
      {children}
      <span className="sr-only" role="status">
        {message} {cart.items.reduce((n, l) => n + l.quantity, 0)} items. Demo
        total {totals(r, cart.items).total} rupees.
      </span>
    </Context.Provider>
  );
}
