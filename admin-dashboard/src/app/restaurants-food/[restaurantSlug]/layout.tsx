import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { restaurantBySlug } from "@/data/restaurants";
import RestaurantChrome from "@/components/restaurants/RestaurantChrome";
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = await params,
    r = restaurantBySlug(restaurantSlug);
  if (!r) notFound();
  return <RestaurantChrome restaurant={r}>{children}</RestaurantChrome>;
}
