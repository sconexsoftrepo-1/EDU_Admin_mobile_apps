export const hotelSlugs = [
  "resort-paradise",
  "luxury-hotel",
  "mountain-retreat",
  "beach-resort",
] as const;
export type HotelSlug = (typeof hotelSlugs)[number];
export type HotelRoom = {
  slug: string;
  name: string;
  description: string;
  capacity: number;
  beds: string;
  size: number;
  rate: number;
  image: string;
  amenities: string[];
  included: string[];
  cancellation: string;
};
export type HotelExperience = {
  slug: string;
  name: string;
  description: string;
  image: string;
  duration: string;
  detail: string;
};
export type Hotel = {
  slug: HotelSlug;
  number: string;
  name: string;
  short: string;
  monogram: string;
  concept: string;
  location: string;
  headline: string;
  description: string;
  storyTitle: string;
  story: string[];
  closing: string;
  palette: { bg: string; ink: string; accent: string; soft: string };
  hero: string;
  mobileHero: string;
  rooms: HotelRoom[];
  experiences: HotelExperience[];
  dining: { name: string; description: string; menu: string[] };
  wellness: { title: string; description: string; treatments: string[] };
  amenities: string[];
  faqs: { q: string; a: string }[];
  offers: {
    title: string;
    description: string;
    discount: number;
    minimumNights: number;
  }[];
  taxRate: number;
  initialDuration: number;
  refreshDuration: number;
  hotspots: {
    id: string;
    name: string;
    description: string;
    href: string;
    position: [number, number, number];
  }[];
};
const definitions = [
  {
    slug: "resort-paradise",
    number: "07",
    name: "Solara Cove Resort",
    short: "Resort Paradise",
    monogram: "SC",
    concept: "A slower kind of luxury",
    location: "An imagined tropical cove",
    headline: "Where Every Sunset Feels Extraordinary.",
    description:
      "Discover a tropical escape designed for unforgettable moments.",
    storyTitle: "Some places ask you to do less. And feel more.",
    story: [
      "Past the palms, the day unfolds at its own pace. A quiet cove, a table set by the sea, a pool that seems to disappear into the horizon. Solara is our vision of a stay shaped around the simple pleasure of being here.",
      "Our fictional island brings warm timber villas into a landscape of gardens and water. Mornings begin on a private terrace; evenings belong to the changing light. Every space gives you room to reconnect.",
    ],
    closing: "Stay for the sunset. Remember the feeling.",
    palette: {
      bg: "#f7f3e9",
      ink: "#173e38",
      accent: "#ae643c",
      soft: "#e9e3d4",
    },
    roomNames: [
      "Ocean Terrace Suite",
      "Garden Pool Villa",
      "Sunset Residence",
      "Family Cove Villa",
    ],
    roomSlugs: [
      "ocean-suite",
      "garden-pool-villa",
      "sunset-residence",
      "family-cove-villa",
    ],
    rates: [320, 460, 690, 540],
    roomCopy: [
      "A light-filled hideaway with a king bed, natural textures and a terrace facing the sea.",
      "Garden doors open to a shaded lounge and a private plunge pool, with space to linger.",
      "A generous residence with a sunken outdoor lounge, a private pool and the last light of the day.",
      "Two restful bedrooms, a garden dining terrace and an easy gathering space for the whole family.",
    ],
    experienceNames: [
      "Private Beach Dining",
      "Sunset Cruise",
      "Infinity Pool",
      "Tropical Spa",
      "Guided Nature Walk",
    ],
    dining: {
      name: "The Tide Table",
      description:
        "An open-air table, an ocean breeze and a menu shaped around bright produce and slow evenings. Our fictional culinary concept balances familiar comfort with tropical character.",
      menu: [
        "Citrus garden salad · sample $18",
        "Charred seasonal vegetables · sample $26",
        "Coconut and passionfruit parfait · sample $14",
      ],
    },
    wellness: {
      title: "A little room for yourself.",
      description:
        "Quiet garden pavilions and thoughtful rituals invite you to step away from your schedule.",
      treatments: [
        "Botanical massage · 60 min",
        "Garden bathing ritual · 45 min",
        "Sunrise stretch · 30 min",
      ],
    },
    amenities: [
      "Infinity pool",
      "Private terraces",
      "Garden spa",
      "Beach dining",
      "Nature paths",
      "Guest library",
    ],
    initialDuration: 3,
    refreshDuration: 1.1,
  },
  {
    slug: "luxury-hotel",
    number: "08",
    name: "The Aurelia Grand",
    short: "Luxury Hotel",
    monogram: "AG",
    concept: "A considered city address",
    location: "An imagined metropolitan quarter",
    headline: "An Exceptional Stay. A Timeless Address.",
    description:
      "Architecture, thoughtful service and the quiet confidence of an extraordinary city stay.",
    storyTitle: "For those who notice the details.",
    story: [
      "The Aurelia Grand is a fictional city address conceived around light, proportion and a deeply personal sense of place. Beyond the bronze doors, stone, timber and carefully chosen art set a composed rhythm.",
      "Your day might begin above the skyline and end at an intimate dining table. Between those moments, there is the unhurried ease of a beautifully considered suite, an attentive concierge concept and a city waiting to be explored.",
    ],
    closing: "Your next chapter deserves an exceptional address.",
    palette: {
      bg: "#131313",
      ink: "#f2ede3",
      accent: "#c5a977",
      soft: "#24231f",
    },
    roomNames: [
      "Grand City Suite",
      "Aurelia Corner Suite",
      "Penthouse Residence",
      "Signature Family Suite",
    ],
    roomSlugs: [
      "grand-city-suite",
      "corner-suite",
      "penthouse-residence",
      "family-suite",
    ],
    rates: [390, 620, 980, 720],
    roomCopy: [
      "A refined king suite framed by bronze details and an uninterrupted city outlook.",
      "A separate lounge and dining space create an elegant base for longer stays.",
      "An expansive private residence with a skyline bathing suite and elevated living spaces.",
      "Connecting rooms with a generous shared living area, made for effortless city adventures.",
    ],
    experienceNames: [
      "Rooftop Evenings",
      "The Art Walk",
      "Private City Table",
      "The Spa Ritual",
      "Architecture at Dusk",
    ],
    dining: {
      name: "Atelier / The Dining Room",
      description:
        "A small, elegant dining room where precise technique meets the pleasure of a long conversation. The sample menu is a creative hospitality concept, with no real service or reservations implied.",
      menu: [
        "Seasonal tasting menu · sample $120",
        "Market vegetable course · sample $32",
        "Signature cacao dessert · sample $19",
      ],
    },
    wellness: {
      title: "A quieter level of the city.",
      description:
        "Stone, water and considered light form a restorative counterpoint to the city outside.",
      treatments: [
        "Signature stone ritual · 75 min",
        "Facial renewal · 60 min",
        "Private fitness session · 45 min",
      ],
    },
    amenities: [
      "Concierge concept",
      "Indoor pool",
      "Private dining",
      "Spa studio",
      "Fitness room",
      "Meeting salon",
    ],
    initialDuration: 3.2,
    refreshDuration: 0.9,
  },
  {
    slug: "mountain-retreat",
    number: "09",
    name: "Northpine Retreat",
    short: "Mountain Retreat",
    monogram: "N",
    concept: "Find your own elevation",
    location: "An imagined alpine valley",
    headline: "Find Your Place Above the Ordinary.",
    description:
      "Cabin warmth. Mountain quiet. A little more space to breathe.",
    storyTitle: "The best way forward is sometimes away.",
    story: [
      "Northpine is a fictional alpine refuge at the meeting of forest, meadow and high mountain light. Timber cabins gather around quiet paths; each window frames a different kind of stillness.",
      "Days can be as gentle or as adventurous as you choose. Follow an illustrative trail, pause beside a fire, or let the evening stretch out from a private deck. This concept is built around the restorative rhythm of life outdoors.",
    ],
    closing: "Leave with a little more room to breathe.",
    palette: {
      bg: "#efede3",
      ink: "#19372c",
      accent: "#a47753",
      soft: "#dde2d7",
    },
    roomNames: [
      "Peakview Cabin",
      "Fireside Forest Cabin",
      "Alpine Family Lodge",
      "Private Deck Hideaway",
    ],
    roomSlugs: [
      "peakview-cabin",
      "fireside-cabin",
      "family-lodge",
      "deck-hideaway",
    ],
    rates: [280, 340, 520, 390],
    roomCopy: [
      "A quiet king cabin with a picture window, wool textures and a private mountain-facing deck.",
      "A restful woodland cabin centered around a stone fireplace and generous lounge.",
      "An expansive two-bedroom lodge with a shared living space and room for family rituals.",
      "A secluded timber retreat with a private outdoor bath and a sheltered forest deck.",
    ],
    experienceNames: [
      "Guided Alpine Hike",
      "Forest Walks",
      "Stargazing",
      "Mountain Cycling",
      "Scenic Viewpoints",
    ],
    dining: {
      name: "The Hearth",
      description:
        "Comforting seasonal plates, a long timber table and the warmth of a fire. This imagined restaurant celebrates the pleasure of returning after a day outside.",
      menu: [
        "Roasted root vegetable bowl · sample $24",
        "Hearth-baked flatbread · sample $22",
        "Warm berry crumble · sample $12",
      ],
    },
    wellness: {
      title: "Breathe in. Slow down.",
      description:
        "Forest bathing, an outdoor soaking deck and gentle movement create a restorative alpine rhythm.",
      treatments: [
        "Forest immersion · 60 min",
        "Mountain yoga · 45 min",
        "Outdoor soak · 50 min",
      ],
    },
    amenities: [
      "Private fireplaces",
      "Illustrative trail guide",
      "Outdoor bathing",
      "Library lounge",
      "Mountain decks",
      "Seasonal activities",
    ],
    initialDuration: 3.1,
    refreshDuration: 1.2,
  },
  {
    slug: "beach-resort",
    number: "10",
    name: "Azure Tide Villas",
    short: "Beach Resort",
    monogram: "AT",
    concept: "Good days, on island time",
    location: "An imagined turquoise lagoon",
    headline: "Your Paradise Begins Here.",
    description:
      "A private villa, an open horizon and a new way to follow the tide.",
    storyTitle: "Barefoot days. Beautiful possibilities.",
    story: [
      "Azure Tide is our fictional island-villa collection: bright overwater spaces, a clear lagoon and an easy connection between indoors and out. The first thing you notice is the color of the water. The next is how little you need to hurry.",
      "Walk along a timber jetty, ease into the lagoon or share a private meal as the light changes. With villas for couples, friends and families, this concept makes room for your own version of an island escape.",
    ],
    closing: "The horizon is calling. Make a little time.",
    palette: {
      bg: "#f7fbf8",
      ink: "#104b58",
      accent: "#087d8c",
      soft: "#def0ec",
    },
    roomNames: [
      "Ocean Villa",
      "Sunset Villa",
      "Private Pool Villa",
      "Family Beach Villa",
    ],
    roomSlugs: [
      "ocean-villa",
      "sunset-villa",
      "private-pool-villa",
      "family-beach-villa",
    ],
    rates: [420, 510, 680, 590],
    roomCopy: [
      "An airy king bedroom opens to a private deck suspended above the turquoise lagoon.",
      "Soft coral accents and an ocean lounge frame the warmest light of the day.",
      "A generous outdoor living space, its own pool and an easy connection to island life.",
      "Two bedrooms, shaded outdoor dining and a sandy garden create an effortless family base.",
    ],
    experienceNames: [
      "Snorkeling",
      "Kayaking",
      "Sunset Sailing",
      "Private Beach Dining",
      "Island Excursions",
    ],
    dining: {
      name: "Salt & Sand",
      description:
        "Fresh flavors, relaxed island hospitality and a beautifully simple table by the shore. The sample dining concept moves from bright mornings to lantern-lit evenings.",
      menu: [
        "Tropical fruit and coconut breakfast · sample $24",
        "Lagoon garden bowl · sample $23",
        "Sunset sharing menu · sample $75",
      ],
    },
    wellness: {
      title: "Let the ocean set the pace.",
      description:
        "Open-air treatments, sea breezes and unhurried movement bring a lighter touch to wellbeing.",
      treatments: [
        "Ocean breeze massage · 60 min",
        "Sunrise movement · 40 min",
        "Island botanical ritual · 75 min",
      ],
    },
    amenities: [
      "Private villa decks",
      "Lagoon access",
      "Water activity concept",
      "Ocean spa",
      "Island dining",
      "Family spaces",
    ],
    initialDuration: 2.8,
    refreshDuration: 1,
  },
];
const capacities = [2, 3, 4, 5],
  sizes = [58, 92, 150, 125];
export const hotels: Hotel[] = definitions.map((d, index) => {
  const base = `/assets/hotels-resorts/${d.slug}`;
  const rooms = d.roomNames.map((name, i) => ({
    slug: d.roomSlugs[i],
    name,
    description: d.roomCopy[i],
    capacity: capacities[i],
    beds: i > 1 ? "One king and two twin beds" : "One king bed",
    size: sizes[i],
    rate: d.rates[i],
    image: `${base}/rooms/room-${Math.min(i + 1, 3)}.webp`,
    amenities: [
      ...d.amenities.slice(0, 3),
      "Wi-Fi concept",
      "Tea & coffee station",
    ],
    included: [
      "Sample breakfast for registered guests",
      "Access to shared leisure spaces",
      "Housekeeping concept",
    ],
    cancellation:
      "Demo policy: complimentary changes up to seven days before the sample arrival date.",
  }));
  const experiences = d.experienceNames.map((name, i) => ({
    slug: name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
    name,
    description: [
      `An unhurried way to discover ${d.concept.toLowerCase()}, with thoughtful details and space to make it your own.`,
      `A carefully imagined ${name.toLowerCase()} experience, shaped around the character of ${d.name}.`,
      `Set aside a little time for ${name.toLowerCase()}. Choose your pace and enjoy a fresh perspective.`,
      `A calm, considered experience for those moments when you simply want to reconnect.`,
      `Discover a quieter side of your surroundings with this thoughtfully designed guest experience.`,
    ][i],
    image:
      i === 0 && index !== 2
        ? `${base}/experiences/dining.webp`
        : i === 3
          ? `${base}/experiences/wellness.webp`
          : `${base}/experiences/adventure.webp`,
    duration: [
      "90 minutes",
      "2 hours",
      "At your own pace",
      "60 minutes",
      "Half day",
    ][i],
    detail: `This is an illustrative ${name.toLowerCase()} itinerary for the fictional ${d.name}. A sample visit includes a personal welcome, an introduction to the setting, and time to explore. Activities, schedules and inclusions are demonstration content and can be adapted for a real property.`,
  }));
  return {
    ...d,
    slug: d.slug as HotelSlug,
    hero: `${base}/hero/desktop.webp`,
    mobileHero: `${base}/hero/mobile.webp`,
    rooms,
    experiences,
    faqs: [
      {
        q: "Is this a real hotel booking?",
        a: "This is an interactive website template for a fictional property. Booking results, rates and availability are local sample data. No real reservation or payment is created.",
      },
      {
        q: "What is included in a sample stay?",
        a: "Sample rates include the room, the listed guest count and breakfast. The booking summary shows configurable sample taxes separately.",
      },
      {
        q: "Can I travel with children?",
        a: "Yes. Select adults and children together with the number of rooms. The demo checks total capacity against the selected accommodation.",
      },
      {
        q: "Can I change my dates?",
        a: "You can update your dates and search again. A sample change policy appears on every accommodation detail page.",
      },
      {
        q: "How can I explore the property without 3D?",
        a: "The property guide includes keyboard-accessible feature buttons, descriptions and page links. The same information is available when WebGL is unavailable.",
      },
    ],
    offers: [
      {
        title: "Stay a little longer",
        description:
          "A sample 10% room discount for stays of four nights or more. Taxes calculated after the room discount.",
        discount: 0.1,
        minimumNights: 4,
      },
      {
        title: "A change of scenery",
        description:
          "A sample two-night itinerary with breakfast and time to explore. Standard sample room rates apply.",
        discount: 0,
        minimumNights: 2,
      },
    ],
    taxRate: 0.1,
    hotspots: [
      {
        id: "stays",
        name: index === 2 ? "Cabins" : index === 3 ? "Villas" : "Stays",
        description: rooms[0].description,
        href: "rooms",
        position: [-1.7, 0.9, 0.1],
      },
      {
        id: "dining",
        name: "Dining",
        description: d.dining.description,
        href: "dining",
        position: [1.8, 1, 0.4],
      },
      {
        id: "wellness",
        name: index === 2 ? "Outdoor bath" : "Spa",
        description: d.wellness.description,
        href: "wellness",
        position: [0.3, 0.8, -1.8],
      },
      {
        id: "pool",
        name: index === 2 ? "Private deck" : index === 1 ? "Rooftop" : "Pool",
        description: d.amenities[0],
        href: "amenities",
        position: [0, 0.8, 1.4],
      },
      {
        id: "view",
        name:
          index === 2 ? "Mountain view" : index === 1 ? "Lobby" : "Ocean view",
        description: d.description,
        href: "experiences",
        position: [2, 0.6, -0.9],
      },
    ],
  };
});
export const hotelBySlug = (slug: string) =>
  hotels.find((h) => h.slug === slug);
export const hotelFromPath = (path: string) =>
  hotelBySlug(path.match(/^\/hotels-resorts\/([^/]+)/)?.[1] || "");
export const hotelRoutes = [
  "",
  "about",
  "rooms",
  "experiences",
  "dining",
  "wellness",
  "amenities",
  "gallery",
  "offers",
  "booking",
  "contact",
  "faq",
];
export function validHotelPath(h: Hotel, parts: string[]) {
  return (
    parts.length === 0 ||
    (parts.length === 1 && hotelRoutes.includes(parts[0])) ||
    (parts.length === 2 &&
      ((parts[0] === "rooms" && h.rooms.some((r) => r.slug === parts[1])) ||
        (parts[0] === "experiences" &&
          h.experiences.some((e) => e.slug === parts[1]))))
  );
}
