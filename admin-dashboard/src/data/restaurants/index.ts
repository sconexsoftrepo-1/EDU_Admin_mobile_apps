export const restaurantSlugs = [
  "urban-bistro",
  "spice-route",
  "greenbowl-cafe",
  "ocean-grill",
  "royal-biryani-house",
  "biryani-express",
] as const;
export type RestaurantSlug = (typeof restaurantSlugs)[number];
export type Dish = {
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  vegetarian: boolean;
  spice: number;
  ingredients: string[];
  allergens: string;
  image: string;
  portions: { id: string; name: string; multiplier: number }[];
  addons: { id: string; name: string; price: number }[];
};
export type Restaurant = {
  slug: RestaurantSlug;
  number: string;
  name: string;
  kind: string;
  tagline: string;
  headline: string;
  description: string;
  year: number;
  owner: { name: string; bio: string; quote: string; image: string };
  story: string[];
  chefs: {
    name: string;
    role: string;
    specialty: string;
    bio: string;
    image: string;
  }[];
  colors: {
    bg: string;
    ink: string;
    accent: string;
    soft: string;
    gold: string;
  };
  hero: string;
  mobile: string;
  interior: string;
  tableImage: string;
  entrance: string;
  kitchen: string;
  logo: string;
  menu: Dish[];
  categories: string[];
  hours: string[];
  locations: { name: string; description: string }[];
  tables: { number: number; token: string; active: boolean; seats: number }[];
  taxRate: number;
  serviceRate: number;
  initialDuration: number;
  refreshDuration: number;
  chapters: string[];
  faq: { q: string; a: string }[];
};
const dishNames = [
  [
    "Truffle Risotto",
    "Grilled Lamb Chops",
    "Seared Scallops",
    "Chocolate Soufflé",
    "Beetroot & Burrata",
    "Roast Pumpkin Soup",
    "Herb Roast Chicken",
    "Lemon Tart",
    "Citrus Sparkler",
    "Espresso",
    "Seasonal Garden Plate",
    "Braised Short Ribs",
  ],
  [
    "Butter Chicken",
    "Paneer Tikka",
    "Hakka Noodles",
    "Chicken Dum Biryani",
    "Dal Makhani",
    "Margherita Pizza",
    "Tandoori Chicken",
    "Gulab Jamun",
    "Mango Lassi",
    "Palak Paneer",
    "Chilli Cauliflower",
    "Wok Fried Rice",
  ],
  [
    "Quinoa Harvest Bowl",
    "Avocado Toast",
    "Superfood Salad",
    "Berry Smoothie",
    "Chickpea Tahini Bowl",
    "Halloumi Sandwich",
    "Cappuccino",
    "Cacao Chia Pudding",
    "Sweet Potato Bowl",
    "Tropical Smoothie",
    "Falafel Wrap",
    "Orange Almond Cake",
  ],
  [
    "Grilled Lobster",
    "Seafood Platter",
    "Garlic Prawns",
    "Fish Tacos",
    "Coastal Fish Curry",
    "Sesame Tuna",
    "Crispy Calamari",
    "Grilled Sea Bass",
    "Citrus Cooler",
    "Coconut Panna Cotta",
    "Crab Cakes",
    "Saffron Seafood Rice",
  ],
  [
    "Hyderabadi Chicken Dum Biryani",
    "Mutton Dum Biryani",
    "Chicken Fry Piece Biryani",
    "Chicken Lollipop Biryani",
    "Nalli Gosht Biryani",
    "Gongura Chicken Biryani",
    "Prawn Biryani",
    "Veg Dum Biryani",
    "Special Pulao",
    "Family Pack Biryani",
    "Chicken Tikka",
    "Rose Falooda",
  ],
  [
    "Chicken Dum Biryani",
    "Mutton Dum Biryani",
    "Chicken Fry Biryani",
    "Chicken Lollipop Biryani",
    "Nalli Gosht Biryani",
    "Gongura Chicken Biryani",
    "Prawn Biryani",
    "Veg Biryani",
    "Special Pulao",
    "Family Packs",
    "Chilli Chicken",
    "Iced Lime Soda",
  ],
];
const categoryLists = [
  [
    "Chef Specials",
    "Main Course",
    "Main Course",
    "Desserts",
    "Starters",
    "Starters",
    "Main Course",
    "Desserts",
    "Drinks",
    "Drinks",
    "Chef Specials",
    "Main Course",
  ],
  [
    "Indian",
    "Tandoor",
    "Chinese",
    "Indian",
    "Indian",
    "Italian",
    "Tandoor",
    "Desserts",
    "Drinks",
    "Indian",
    "Continental",
    "Chinese",
  ],
  [
    "Bowls",
    "Sandwiches",
    "Salads",
    "Smoothies",
    "Bowls",
    "Sandwiches",
    "Coffee",
    "Desserts",
    "Bowls",
    "Smoothies",
    "Sandwiches",
    "Desserts",
  ],
  [
    "Chef Specials",
    "Main Course",
    "Starters",
    "Main Course",
    "Main Course",
    "Chef Specials",
    "Starters",
    "Main Course",
    "Drinks",
    "Desserts",
    "Starters",
    "Main Course",
  ],
  [
    "Chicken",
    "Mutton",
    "Chicken",
    "Special",
    "Mutton",
    "Regional",
    "Special",
    "Regional",
    "Pulao",
    "Family Packs",
    "Starters",
    "Desserts",
  ],
  [
    "Chicken",
    "Mutton",
    "Chicken",
    "Special",
    "Mutton",
    "Regional",
    "Special",
    "Regional",
    "Pulao",
    "Family Packs",
    "Starters",
    "Drinks",
  ],
];
const descs = [
  [
    "Arborio rice folded with mushrooms, parmesan and a truffle-scented finish.",
    "Chargrilled lamb with a glossy pan jus and seasonal vegetables.",
    "Golden-seared scallops with a silky vegetable purée.",
    "Warm dark chocolate with a soft centre and vanilla cream.",
    "Roasted beetroot, creamy burrata and peppery leaves.",
    "Slow-roasted pumpkin blended with aromatics.",
    "Roasted chicken with garden herbs and tender vegetables.",
    "Bright lemon curd in a delicate pastry shell.",
    "Citrus, soda and fresh herbs. Alcohol-free.",
    "A small, rich coffee moment.",
    "Roasted seasonal vegetables with a herb dressing.",
    "Slow-cooked beef with a deep savoury jus.",
  ],
  [
    "A gently spiced tomato and butter sauce with chicken.",
    "Charred paneer, peppers and warming tandoor spices.",
    "Wok-tossed noodles with crunchy vegetables.",
    "Layered basmati rice, chicken and fragrant spices.",
    "Slow-simmered black lentils with cream.",
    "Tomato, mozzarella and basil on a crisp base.",
    "Chicken marinated with yoghurt and aromatic spices.",
    "Warm syrup-soaked dumplings with a cardamom note.",
    "Mango blended with yoghurt.",
    "Paneer folded through spiced spinach.",
    "Crisp cauliflower with a lively chilli glaze.",
    "Wok-tossed rice with vegetables and aromatics.",
  ],
  [
    "Quinoa, roasted vegetables, chickpeas and a herb dressing.",
    "Sourdough, smashed avocado and bright citrus.",
    "Leafy greens, colourful vegetables, seeds and a citrus dressing.",
    "Berries blended with a creamy oat base.",
    "Chickpeas, crunchy vegetables and a tahini drizzle.",
    "Grilled halloumi with vegetables and herb spread.",
    "Espresso with steamed milk.",
    "Cacao, chia and a creamy oat base.",
    "Roasted sweet potato, grains and crisp leaves.",
    "Mango, pineapple and a citrus finish.",
    "Falafel, salad and tahini in a warm wrap.",
    "Orange-scented almond sponge.",
  ],
  [
    "Flame-grilled lobster finished with herb butter.",
    "A generous assortment of grilled seafood and lemon.",
    "Prawns tossed in garlic butter and herbs.",
    "Grilled fish, crisp slaw and lime in soft tacos.",
    "Fish simmered in coconut, spices and coastal aromatics.",
    "Seared tuna with sesame and a bright citrus dressing.",
    "Crisp calamari rings with lemon and a creamy dip.",
    "Whole sea bass grilled with herbs and lemon.",
    "Citrus and soda with fresh herbs. Alcohol-free.",
    "A soft coconut dessert with seasonal fruit.",
    "Golden crab cakes with a citrus dip.",
    "Saffron-scented rice with a seafood selection.",
  ],
];
const configs = [
  [
    "The Urban Bistro",
    "Modern Fine Dining",
    "An evening, beautifully considered.",
    "Modern flavors. Memorable moments.",
    "An intimate dining story, from the warm glow of our fictional bistro to the final spoon of dessert.",
    2018,
    "Arjun Mehta",
    ["#191514", "#f7efe3", "#c38c5d", "#2b2220", "#d5b789"],
  ],
  [
    "Spice Route",
    "Indian & Multi-Cuisine",
    "Many regions. One welcoming table.",
    "A journey of global flavors.",
    "A warm fictional gathering place for fragrant kitchens, generous plates and conversations that linger.",
    2015,
    "Raghav Sharma",
    ["#fbedd7", "#40231b", "#a84024", "#f0dbb9", "#e9af36"],
  ],
  [
    "GreenBowl Café",
    "Botanical Café",
    "A little freshness in your everyday.",
    "Good food. Brighter days.",
    "Sunlight, a thoughtfully filled bowl and a welcoming corner to make your own. A fictional café concept.",
    2020,
    "Nisha Verma",
    ["#f8fbf2", "#24593b", "#39784b", "#e2edda", "#e8c95b"],
  ],
  [
    "Ocean Grill",
    "Coastal & Seafood",
    "Slow down. The sea is setting the pace.",
    "Fresh catch. Unforgettable tastes.",
    "A fictional seaside dining room where coastal flavours meet the last light of the day.",
    2017,
    "Daniel Roy",
    ["#f0f8f6", "#123e51", "#127c8c", "#deedf0", "#ee9874"],
  ],
  [
    "Royal Biryani House",
    "Heritage Biryani Dining",
    "A tradition worth gathering around.",
    "A royal biryani experience.",
    "Traditional recipes. Unforgettable flavours. Discover a fictional dining house built around the ritual of a shared handi.",
    2013,
    "Aamir Rahman",
    ["#34191c", "#f7ebd4", "#d4aa63", "#48272a", "#bc744c"],
  ],
  [
    "Biryani Express",
    "Biryani, Dine-In & Takeaway",
    "Big appetite. Bold flavour.",
    "Real flavor. Served fast.",
    "A fictional modern biryani kitchen with big personalities, generous bowls and a quick route to your next favourite.",
    2020,
    "Vikram Reddy",
    ["#181413", "#fff6e9", "#ee5034", "#2c201c", "#f8a33a"],
  ],
] as const;
const toSlug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const restaurants: Restaurant[] = restaurantSlugs.map((slug, i) => {
  const c = configs[i],
    base = `/assets/restaurants-food/${slug}`;
  const menu = dishNames[i].map((name, j): Dish => ({
    slug: toSlug(name),
    name,
    category: categoryLists[i][j],
    description:
      i < 4
        ? descs[i][j]
        : j < 10
          ? `${["Fragrant layered basmati with golden chicken and warming spices.", "Tender mutton and basmati, finished with slow-cooked aromatics.", "Crisp chicken pieces over fragrant seasoned rice.", "Spiced chicken drumettes with a generous serving of biryani rice.", "Rich marrow shank with deeply aromatic basmati rice.", "Sorrel-style greens bring a lively tang to chicken and basmati.", "Prawns folded through gently spiced rice and herbs.", "A colourful vegetable and basmati rice preparation.", "A lighter aromatic rice composition with vegetables and nuts.", "A generous sharing tray of biryani with side accompaniments."][j]}`
          : j === 10
            ? "A lively chicken starter with warming spices."
            : i === 4
              ? "Rose-scented dessert with milk and delicate toppings."
              : "Lime and sparkling soda. Alcohol-free.",
    price:
      i === 0
        ? [740, 1180, 980, 440, 520, 320, 820, 390, 240, 180, 620, 1100][j]
        : i === 3
          ? [1280, 1680, 640, 490, 690, 890, 540, 980, 220, 340, 580, 820][j]
          : i === 2
            ? [390, 320, 360, 240, 380, 350, 160, 220, 370, 230, 310, 260][j]
            : i >= 4
              ? [320, 430, 360, 390, 520, 380, 460, 260, 250, 990, 280, 150][j]
              : [390, 320, 280, 360, 290, 420, 460, 180, 160, 330, 260, 270][j],
    vegetarian:
      i === 2 ||
      [
        "Paneer",
        "Dal ",
        "Pizza",
        "Gulab",
        "Mango",
        "Palak",
        "Cauliflower",
        "Fried Rice",
        "Veg ",
        "Pulao",
        "Falooda",
        "Soda",
        "Burrata",
        "Pumpkin",
        "Risotto",
        "Tart",
        "Sparkler",
        "Espresso",
        "Garden",
        "Soufflé",
        "Cooler",
        "Panna",
      ].some((v) => name.includes(v)),
    spice: i < 4 ? j % 3 : j < 10 ? (j % 3) + 1 : 1,
    ingredients:
      i >= 4
        ? [
            j === 7
              ? "Vegetables"
              : j === 8
                ? "Vegetables & nuts"
                : j === 6
                  ? "Prawns"
                  : j === 1 || j === 4
                    ? "Mutton"
                    : "Chicken",
            "Basmati rice",
            "Spices",
            "Herbs",
          ]
        : [
            "See the illustrated menu description",
            "Seasonings",
            "Prepared accompaniments",
          ],
    allergens:
      "Allergen information is not verified for this fictional dish. Do not use this demo to make dietary safety decisions.",
    image: `${base}/food/dish-${j + 1}.webp`,
    portions: [
      { id: "regular", name: "Regular", multiplier: 1 },
      { id: "generous", name: "Generous", multiplier: 1.45 },
    ],
    addons: [
      {
        id: "side",
        name: i >= 4 ? "Raita & salan" : "Seasonal side",
        price: i >= 4 ? 60 : 90,
      },
      { id: "drink", name: "Lime soda", price: 90 },
    ],
  }));
  return {
    slug,
    number: String(i + 15).padStart(2, "0"),
    name: c[0],
    kind: c[1],
    tagline: c[2],
    headline: c[3],
    description: c[4],
    year: c[5],
    owner: {
      name: c[6],
      image: `${base}/chefs/person-1.webp`,
      bio: `${c[6]} is the fictional founder of ${c[0]}. This concept began with an idea: give every guest a thoughtful welcome and a meal worth sharing. The story, year and portrait are illustrative, not a claim about an operating business.`,
      quote:
        i === 4
          ? "Every handi holds a story of patience and a place at the table."
          : i === 2
            ? "A good café makes room for the small, bright moments."
            : "A memorable meal begins with how you make someone feel.",
    },
    story: [
      `In this fictional story, ${c[0]} began in ${c[5]} with ${c[6]}’s vision of a welcoming table. The restaurant pairs a distinct setting with a menu shaped by curiosity, care and the pleasure of sharing.`,
      i === 4
        ? "Layers of rice, warming aromatics and unhurried cooking inspire the handi at the heart of our visual story."
        : i === 5
          ? "A small-kitchen-to-neighbourhood-favourite narrative inspires the bold storefront, generous portions and takeaway-first ordering flow."
          : "From the entrance to the final course, every detail in this concept is designed to make a guest feel at ease.",
    ],
    chefs: [
      {
        name: [
          "Arjun Malhotra",
          "Irfan Ali",
          "Nisha Kapoor",
          "Daniel Sen",
          "Rahman Khan",
          "Imran Rao",
        ][i],
        role: "Head Chef",
        specialty:
          i >= 4
            ? "Dum biryani & layered aromatics"
            : i === 2
              ? "Seasonal bowls & flavour pairings"
              : i === 3
                ? "Coastal grilling"
                : "Signature kitchen creations",
        bio: "A fictional culinary lead who brings the restaurant’s flavour story to life. The profile and portrait are generated demo content.",
        image: `${base}/chefs/person-2.webp`,
      },
      {
        name: [
          "Maya Shah",
          "Kavya Rao",
          "Tara Mehta",
          "Rhea Kapoor",
          "Sana Ali",
          "Anika Roy",
        ][i],
        role: "Sous Chef",
        specialty:
          i >= 4
            ? "Regional flavours & accompaniments"
            : "Seasonal plates & thoughtful preparation",
        bio: "A fictional chef with a creative, collaborative approach to the menu. No real qualifications or awards are claimed.",
        image: `${base}/chefs/person-3.webp`,
      },
      {
        name: [
          "Dev Patel",
          "Arun Das",
          "Rohan Sen",
          "Neil D’Souza",
          "Sameer Noor",
          "Ravi Kumar",
        ][i],
        role: i >= 4 ? "Grill & Tandoor Chef" : "Culinary Specialist",
        specialty:
          i >= 4
            ? "Tandoor, starters & spice balance"
            : "Finishing touches & kitchen craft",
        bio: "An illustrative team member focused on the details that complete a meal.",
        image: `${base}/chefs/person-4.webp`,
      },
    ],
    colors: {
      bg: c[7][0],
      ink: c[7][1],
      accent: c[7][2],
      soft: c[7][3],
      gold: c[7][4],
    },
    hero: `${base}/hero/desktop.webp`,
    mobile: `${base}/hero/mobile.webp`,
    interior: `${base}/interiors/dining.webp`,
    tableImage: `${base}/interiors/table.webp`,
    entrance: `${base}/building/entrance.webp`,
    kitchen: `${base}/interiors/kitchen.webp`,
    logo: `${base}/logos/mark.svg`,
    menu,
    categories: [...new Set(categoryLists[i])],
    hours: [
      "Illustrative hours only",
      "Tuesday–Sunday · 12:00–22:00",
      "Monday · A day to reset",
    ],
    locations: [
      {
        name: "Main dining room",
        description: "Fictional showcase venue. No operational street address.",
      },
      ...(i === 5
        ? [
            {
              name: "City takeaway concept",
              description:
                "A second fictional storefront concept, not a real branch.",
            },
            {
              name: "Neighbourhood dining concept",
              description: "Illustrative seating and pickup setting.",
            },
          ]
        : []),
    ],
    tables: [1, 2, 3, 4, 8, 12].map((number, k) => ({
      number,
      token: `${["ub", "sr", "gb", "og", "rb", "be"][i]}-${["fern7k", "amber4p", "cedar9m", "coral3v", "olive6r", "saffron2n"][k]}`,
      active: k !== 4,
      seats: k < 2 ? 2 : k < 5 ? 4 : 8,
    })),
    taxRate: 0.05,
    serviceRate: 0.025,
    initialDuration: [3, 3.2, 2.8, 3.1, 3.6, 3.3][i],
    refreshDuration: [1, 1.1, 0.9, 1.1, 1.3, 1][i],
    chapters: ["hero", "story", "cooking", "signature", "ordering", "closing"],
    faq: [
      {
        q: "Is this a real restaurant?",
        a: "This is a fictional restaurant website demonstration. No business operates through this page.",
      },
      {
        q: "Does checkout place a real order?",
        a: "No. Orders and kitchen updates are local simulations. No payment is taken and no kitchen receives your order.",
      },
      {
        q: "How does table ordering work?",
        a: "Choose an active configured demo table or scan its QR code, confirm the table and browse the menu.",
      },
      {
        q: "Can I rely on the allergen labels?",
        a: "No. This fictional menu has no verified allergen or cross-contact information. It is not a dietary safety reference.",
      },
      {
        q: "Can this design be customised?",
        a: "Yes. Contact the developer through KC Web Universe to discuss a real website and properly connected ordering service.",
      },
    ],
  };
});
export const restaurantBySlug = (slug: string) =>
  restaurants.find((r) => r.slug === slug);
export const restaurantFromPath = (path: string) =>
  restaurantBySlug(path.match(/^\/restaurants-food\/([^/]+)/)?.[1] || "");
export const restaurantRoutes = [
  "",
  "about",
  "menu",
  "our-chefs",
  "gallery",
  "experiences",
  "reservations",
  "order",
  "cart",
  "checkout",
  "order-confirmation",
  "contact",
  "faq",
  "qr",
  "demo-kitchen",
];
export function validRestaurantPath(r: Restaurant, parts: string[]) {
  return (
    !parts.length ||
    (parts.length === 1 && restaurantRoutes.includes(parts[0])) ||
    (parts.length === 2 &&
      parts[0] === "menu" &&
      r.menu.some((d) => d.slug === parts[1])) ||
    (parts.length === 2 && parts[0] === "qr")
  );
}
