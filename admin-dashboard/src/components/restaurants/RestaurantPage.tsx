import Link from "next/link";
import Image from "next/image";
import type { Restaurant } from "@/data/restaurants";
import { resolveTableToken } from "@/lib/restaurants/ordering";
import RestaurantHome from "./RestaurantHomes";
import {
  OwnerStory,
  BuildingStory,
  ChefStories,
  FoodFAQ,
  FoodGallery,
  LocationStory,
} from "./RestaurantSections";
import {
  MenuExplorer,
  DishDetails,
  OrderMode,
  CartContents,
  Checkout,
  OrderConfirmation,
  Reservation,
  FoodBuilder,
} from "./Ordering";
import { QRMenu, QRDashboard } from "./QRMenu";
import FoodJourney from "./FoodJourney";
import WhatsAppContact from "@/components/contact/WhatsAppContact";
export default function RestaurantPage({
  restaurant: r,
  parts,
}: {
  restaurant: Restaurant;
  parts: string[];
}) {
  const route = parts[0] || "",
    base = `/restaurants-food/${r.slug}`;
  if (!route) return <RestaurantHome restaurant={r} />;
  if (route === "menu" && parts[1])
    return (
      <>
        <Breadcrumb r={r} label="Dish details" />
        <DishDetails
          restaurant={r}
          dish={r.menu.find((d) => d.slug === parts[1])!}
        />
      </>
    );
  if (route === "qr" && parts[1]) {
    const table = resolveTableToken(r, parts[1]);
    return (
      <QRMenu restaurant={r} table={table?.number} tokenInvalid={!table} />
    );
  }
  const titles: Record<string, string> = {
    about: "A place. A point of view.",
    menu: "Something to look forward to.",
    "our-chefs": "The people behind the plates.",
    gallery: "A little look into our world.",
    experiences: "More than a meal.",
    reservations: "A place at the table.",
    order: "Your next favourite starts here.",
    cart: "Your demo cart.",
    checkout: "",
    "order-confirmation": "",
    contact: "Let’s make a little room.",
    faq: "A little clarity, before you order.",
    qr: "A smart menu. A simple scan.",
    "demo-kitchen": "",
  };
  return (
    <>
      <Breadcrumb r={r} label={route.replaceAll("-", " ")} />
      {titles[route] && (
        <header className={`food-page-heading food-wrap heading-${route}`}>
          <small>
            {r.name} / {r.kind}
          </small>
          <h1>{titles[route]}</h1>
          <p>
            {route === "menu"
              ? "Sample menu, clearly priced. Find a flavour and make it your own."
              : r.description}
          </p>
        </header>
      )}
      {route === "about" && (
        <>
          <OwnerStory restaurant={r} />
          <BuildingStory restaurant={r} />
          <section className="food-philosophy food-wrap">
            <h2>Our culinary point of view.</h2>
            <p>{r.story[1]}</p>
            <blockquote>“{r.owner.quote}”</blockquote>
            <p>
              Every story, year and profile here is fictional. This design is
              ready to be configured with verified details for a real business.
            </p>
          </section>
        </>
      )}
      {route === "menu" && <MenuExplorer restaurant={r} />}{" "}
      {route === "our-chefs" && <ChefStories restaurant={r} full />}
      {route === "gallery" && <FoodGallery restaurant={r} />}{" "}
      {route === "experiences" && (
        <>
          <div className="food-wrap">
            <FoodJourney restaurant={r} />
          </div>
          <BuildingStory restaurant={r} />
          {(r.slug === "greenbowl-cafe" || r.slug === "biryani-express") && (
            <FoodBuilder restaurant={r} />
          )}
          <ChefStories restaurant={r} />
        </>
      )}
      {route === "reservations" && <Reservation restaurant={r} />}{" "}
      {route === "order" && (
        <>
          <div className="food-wrap">
            <OrderMode restaurant={r} />
          </div>
          {(r.slug === "greenbowl-cafe" || r.slug === "biryani-express") && (
            <FoodBuilder restaurant={r} />
          )}
          <MenuExplorer restaurant={r} />
          <div className="food-wrap food-order-next">
            <Link className="food-button" href={`${base}/cart`}>
              Review your demo cart ↗
            </Link>
          </div>
        </>
      )}
      {route === "cart" && (
        <section className="food-wrap food-cart-page">
          <CartContents restaurant={r} />
          <Link className="food-button" href={`${base}/checkout`}>
            Continue to demo checkout ↗
          </Link>
        </section>
      )}
      {route === "checkout" && <Checkout restaurant={r} />}{" "}
      {route === "order-confirmation" && <OrderConfirmation restaurant={r} />}{" "}
      {route === "demo-kitchen" && <OrderConfirmation restaurant={r} kitchen />}
      {route === "contact" && (
        <>
          <LocationStory restaurant={r} />
          <section className="food-contact-developer food-wrap">
            <h2>Interested in this website design?</h2>
            <p>
              The restaurant is fictional. This form opens a WhatsApp draft to
              the developer for website enquiries.
            </p>
            <WhatsAppContact context={`${r.name} restaurant website enquiry`} />
          </section>
        </>
      )}
      {route === "faq" && <FoodFAQ restaurant={r} />}{" "}
      {route === "qr" && <QRDashboard restaurant={r} />}
    </>
  );
}
function Breadcrumb({ r, label }: { r: Restaurant; label: string }) {
  return (
    <nav className="food-breadcrumb food-wrap" aria-label="Breadcrumb">
      <Link href="/restaurants-food">Restaurants & Food</Link>
      <span>/</span>
      <Link href={`/restaurants-food/${r.slug}`}>{r.name}</Link>
      <span>/</span>
      <span>{label}</span>
    </nav>
  );
}
