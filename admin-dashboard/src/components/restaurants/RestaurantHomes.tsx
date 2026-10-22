import Image from "next/image";
import Link from "next/link";
import type { Restaurant } from "@/data/restaurants";
import {
  BuildingStory,
  ChefStories,
  FoodFAQ,
  FoodGallery,
  LocationStory,
  OwnerStory,
} from "./RestaurantSections";
import { FoodBuilder, MenuExplorer, Reservation } from "./Ordering";
import { QRDashboard } from "./QRMenu";
import FoodJourney from "./FoodJourney";
function Actions({ r, order = false }: { r: Restaurant; order?: boolean }) {
  return (
    <div className="food-hero-actions">
      <Link
        className="food-button"
        href={`/restaurants-food/${r.slug}/${order ? "order" : "menu"}`}
      >
        {order ? "Order a demo meal" : "Explore the menu"} ↗
      </Link>
      <Link
        className="food-button food-button-outline"
        href={`/restaurants-food/${r.slug}/${order ? "menu" : "reservations"}`}
      >
        {order ? "Find your flavour" : "Reserve a demo table"} ↗
      </Link>
    </div>
  );
}
function HeroPicture({ r }: { r: Restaurant }) {
  return (
    <picture className="food-hero-picture">
      <source media="(max-width:700px)" srcSet={r.mobile} />
      <Image
        unoptimized
        priority
        src={r.hero}
        width={1920}
        height={1080}
        alt={`${r.name} generated fictional restaurant exterior`}
      />
    </picture>
  );
}
function Foreground({ r, dish = 0 }: { r: Restaurant; dish?: number }) {
  return (
    <div className="food-hero-dish" aria-hidden="true">
      <Image
        unoptimized
        src={r.menu[dish].image}
        width={600}
        height={450}
        alt=""
      />
      <span>{r.menu[dish].name}</span>
    </div>
  );
}
function SharedClosing({ r }: { r: Restaurant }) {
  return (
    <>
      <QRDashboard restaurant={r} />
      <Reservation restaurant={r} />
      <FoodGallery restaurant={r} preview />
      <LocationStory restaurant={r} />
      <FoodFAQ restaurant={r} preview />
    </>
  );
}
export function UrbanHome({ r }: { r: Restaurant }) {
  return (
    <div className="food-home urban-home">
      <section className="food-hero urban-hero">
        <HeroPicture r={r} />
        <div className="food-hero-copy">
          <span>Est. {r.year} / A fictional dining story</span>
          <h1>{r.headline}</h1>
          <p>{r.description}</p>
          <Actions r={r} />
          <small>A little more than dinner.</small>
        </div>
        <Foreground r={r} />
        <div className="urban-hero-rule">
          Cuisine with character / Evenings with atmosphere
        </div>
      </section>
      <OwnerStory restaurant={r} />
      <BuildingStory restaurant={r} />
      <MenuExplorer restaurant={r} preview />
      <ChefStories restaurant={r} />
      <div className="food-wrap">
        <FoodJourney restaurant={r} />
      </div>
      <SharedClosing r={r} />
    </div>
  );
}
export function SpiceHome({ r }: { r: Restaurant }) {
  return (
    <div className="food-home spice-home">
      <section className="food-hero spice-hero">
        <div className="spice-hero-side">
          <span>Est. {r.year} / The spice trail begins</span>
          <h1>{r.headline}</h1>
          <p>{r.description}</p>
          <Actions r={r} />
          <div className="spice-cuisine-list">
            Indian <i /> Tandoor <i /> Chinese <i /> Italian
          </div>
        </div>
        <div className="spice-hero-arch">
          <HeroPicture r={r} />
          <Foreground r={r} dish={1} />
        </div>
        <span className="spice-floating-mark" aria-hidden="true">
          ✳
        </span>
      </section>
      <div className="spice-flavour-ribbon">
        Warming spices. Generous tables. Something for everyone.
      </div>
      <BuildingStory restaurant={r} />
      <OwnerStory restaurant={r} />
      <MenuExplorer restaurant={r} preview />
      <div className="food-wrap">
        <FoodJourney restaurant={r} />
      </div>
      <ChefStories restaurant={r} />
      <SharedClosing r={r} />
    </div>
  );
}
export function GreenHome({ r }: { r: Restaurant }) {
  return (
    <div className="food-home green-home">
      <section className="food-hero green-hero">
        <div className="food-hero-copy">
          <span>Fresh thinking, since {r.year} / Demo concept</span>
          <h1>{r.headline}</h1>
          <p>{r.description}</p>
          <Actions r={r} order />
          <div className="green-hero-values">
            <span>Thoughtfully mixed</span>
            <span>Brightly flavoured</span>
            <span>A moment for you</span>
          </div>
        </div>
        <div className="green-hero-garden">
          <HeroPicture r={r} />
          <Foreground r={r} />
          <span className="green-hero-stamp">
            A fresh
            <br />
            perspective
          </span>
        </div>
      </section>
      <FoodBuilder restaurant={r} />
      <div className="food-wrap">
        <FoodJourney restaurant={r} />
      </div>
      <OwnerStory restaurant={r} />
      <MenuExplorer restaurant={r} preview />
      <BuildingStory restaurant={r} />
      <ChefStories restaurant={r} />
      <SharedClosing r={r} />
    </div>
  );
}
export function OceanHome({ r }: { r: Restaurant }) {
  return (
    <div className="food-home ocean-home">
      <section className="food-hero ocean-hero">
        <HeroPicture r={r} />
        <div className="food-hero-copy">
          <span>Coastal evenings / Est. {r.year} / Fictional venue</span>
          <h1>{r.headline}</h1>
          <p>{r.description}</p>
          <Actions r={r} />
        </div>
        <Foreground r={r} dish={1} />
        <div className="ocean-horizon">The sea. The table. The moment.</div>
        <svg
          className="ocean-wave"
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 50Q360 0 720 55T1440 30V90H0Z" />
        </svg>
      </section>
      <BuildingStory restaurant={r} />
      <MenuExplorer restaurant={r} preview />
      <OwnerStory restaurant={r} />
      <ChefStories restaurant={r} />
      <div className="food-wrap">
        <FoodJourney restaurant={r} />
      </div>
      <SharedClosing r={r} />
    </div>
  );
}
function Slot() {
  return <div className="food-scene-slot" aria-hidden="true" />;
}
export function RoyalHome({ r }: { r: Restaurant }) {
  return (
    <div className="food-home royal-home">
      <section
        className="food-hero royal-hero food-chapter"
        data-food-chapter="hero"
      >
        <HeroPicture r={r} />
        <div className="food-hero-copy">
          <span>A fictional heritage dining house / Est. {r.year}</span>
          <h1>{r.headline}</h1>
          <p>
            Traditional recipes.
            <br />
            Unforgettable flavours.
          </p>
          <Actions r={r} />
          <small>One handi. A whole story.</small>
        </div>
        <Slot />
      </section>
      <section
        className="royal-heritage food-chapter food-chapter-right"
        data-food-chapter="story"
      >
        <Slot />
        <div className="food-chapter-copy">
          <small>From a shared table to a tradition</small>
          <h2>
            A legacy of flavour,
            <br />
            layer by layer.
          </h2>
          <Image
            unoptimized
            src={r.owner.image}
            width={200}
            height={260}
            alt={`${r.owner.name}, generated fictional founder`}
          />
          <h3>{r.owner.name}</h3>
          <p>{r.story[0]}</p>
          <blockquote>“{r.owner.quote}”</blockquote>
          <Link
            className="food-text-link"
            href={`/restaurants-food/${r.slug}/about`}
          >
            The founder’s story ↗
          </Link>
        </div>
      </section>
      <section
        className="royal-cooking food-chapter"
        data-food-chapter="cooking"
      >
        <div className="food-chapter-copy">
          <small>The ritual inside the handi</small>
          <h2>
            Patience is
            <br />
            an ingredient.
          </h2>
          <p>
            Fragrant rice. Warming aromatics. A generous finishing touch. Follow
            the copper handi as the lid lifts to reveal every layer of flavour.
          </p>
          <ol>
            <li>Rice & aromatics</li>
            <li>Flavour in every layer</li>
            <li>The gentle final reveal</li>
          </ol>
          <p className="food-demo-note">
            An illustrative food story, not cooking instructions.
          </p>
        </div>
        <Slot />
      </section>
      <section
        className="food-chapter royal-signature"
        data-food-chapter="signature"
      >
        <div className="food-signature-intro food-wrap">
          <small>Ten ways to gather around</small>
          <h2>Our signature biryanis.</h2>
          <p>
            Chicken, mutton, prawn and vegetable recipes, each with its own
            illustrated dish.
          </p>
        </div>
        <Slot />
        <MenuExplorer restaurant={r} preview />
      </section>
      <section
        className="food-chapter food-chapter-right royal-chef"
        data-food-chapter="chefs"
      >
        <Slot />
        <div className="food-chapter-copy">
          <small>Craft, carried forward</small>
          <Image
            unoptimized
            src={r.chefs[0].image}
            width={400}
            height={480}
            alt={`${r.chefs[0].name}, fictional chef`}
          />
          <h2>{r.chefs[0].name}</h2>
          <p>
            {r.chefs[0].specialty}. {r.chefs[0].bio}
          </p>
          <Link
            className="food-text-link"
            href={`/restaurants-food/${r.slug}/our-chefs`}
          >
            Meet our fictional kitchen team ↗
          </Link>
        </div>
      </section>
      <section
        className="food-chapter royal-ordering"
        data-food-chapter="ordering"
      >
        <div className="food-chapter-copy">
          <small>A little tradition, in your hand</small>
          <h2>
            A table.
            <br />A scan.
            <br />A shared meal.
          </h2>
          <p>
            Confirm a configured demo table, choose a biryani and follow your
            local order simulation.
          </p>
          <Actions r={r} order />
        </div>
        <Slot />
      </section>
      <section
        className="food-chapter royal-closing"
        data-food-chapter="closing"
      >
        <div className="food-chapter-copy">
          <h2>
            Experience
            <br />
            the royal flavour.
          </h2>
          <p>{r.tagline}</p>
          <Actions r={r} />
        </div>
        <Slot />
      </section>
      <BuildingStory restaurant={r} />
      <SharedClosing r={r} />
    </div>
  );
}
export function ExpressHome({ r }: { r: Restaurant }) {
  return (
    <div className="food-home express-home">
      <section
        className="food-hero express-hero food-chapter"
        data-food-chapter="hero"
      >
        <div className="express-hero-lines" aria-hidden="true" />
        <div className="food-hero-copy">
          <span>Est. {r.year} / Dine-in & takeaway demo</span>
          <h1>
            Real flavor.
            <br />
            Served fast.
          </h1>
          <p>{r.description}</p>
          <Actions r={r} order />
          <small>Bold bowls. Big personalities.</small>
        </div>
        <Slot />
      </section>
      <section
        className="food-chapter food-chapter-right express-story"
        data-food-chapter="story"
      >
        <Slot />
        <div className="food-chapter-copy">
          <small>A small kitchen. A big idea.</small>
          <h2>
            Built on
            <br />
            bold flavour.
          </h2>
          <Image
            unoptimized
            src={r.hero}
            width={700}
            height={450}
            alt="Generated fictional Biryani Express storefront"
          />
          <p>{r.story[1]}</p>
          <p>
            Fictional founder: {r.owner.name}. {r.owner.bio}
          </p>
        </div>
      </section>
      <section
        className="food-chapter express-cooking"
        data-food-chapter="cooking"
      >
        <div className="food-chapter-copy">
          <small>From spice to serving</small>
          <h2>
            Bring it
            <br />
            all together.
          </h2>
          <p>
            Rice, chicken, herbs and a lively finish. Scroll to reveal the
            copper handi, lift the lid and get closer to the layers of flavour.
          </p>
          <p>
            A real food photograph flows through the story, from slow cooking to
            your next shared meal.
          </p>
        </div>
        <Slot />
      </section>
      <section
        className="food-chapter express-signature"
        data-food-chapter="signature"
      >
        <div className="food-signature-intro food-wrap">
          <small>Find your flavour</small>
          <h2>Big on biryani.</h2>
        </div>
        <Slot />
        <MenuExplorer restaurant={r} preview />
      </section>
      <section
        className="food-chapter food-chapter-right express-combos"
        data-food-chapter="combos"
      >
        <Slot />
        <div className="food-chapter-copy">
          <small>Your order, your way</small>
          <h2>
            Make it
            <br />a proper combo.
          </h2>
          <p>
            Pick your biryani, starter, drink and dessert. Then try a local
            takeaway or table order.
          </p>
          <Link className="food-button" href="#combo-builder">
            Build your combo ↓
          </Link>
        </div>
      </section>
      <section
        className="food-chapter express-ordering"
        data-food-chapter="ordering"
      >
        <div className="food-chapter-copy">
          <small>The last stop before your first bite</small>
          <h2>
            Take it away.
            <br />
            Or take a seat.
          </h2>
          <p>
            Choose takeaway or a valid demo table. No payment and no real
            kitchen are connected.
          </p>
          <Actions r={r} order />
        </div>
        <Slot />
      </section>
      <section
        className="food-chapter express-closing"
        data-food-chapter="closing"
      >
        <div className="food-chapter-copy">
          <h2>
            Good things.
            <br />
            In great bowls.
          </h2>
          <Actions r={r} order />
        </div>
        <Slot />
      </section>
      <div id="combo-builder">
        <FoodBuilder restaurant={r} />
      </div>
      <OwnerStory restaurant={r} />
      <BuildingStory restaurant={r} />
      <ChefStories restaurant={r} />
      <SharedClosing r={r} />
    </div>
  );
}
export default function RestaurantHome({
  restaurant: r,
}: {
  restaurant: Restaurant;
}) {
  switch (r.slug) {
    case "urban-bistro":
      return <UrbanHome r={r} />;
    case "spice-route":
      return <SpiceHome r={r} />;
    case "greenbowl-cafe":
      return <GreenHome r={r} />;
    case "ocean-grill":
      return <OceanHome r={r} />;
    case "royal-biryani-house":
      return <RoyalHome r={r} />;
    default:
      return <ExpressHome r={r} />;
  }
}
