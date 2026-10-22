import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { templateCategories } from "@/data/templateCatalogue";
export default function TemplateCategories() {
  return (
    <section className="universe-categories showroom-section" id="categories">
      <div className="showroom-section-heading" data-showroom-reveal>
        <div>
          <span className="showroom-kicker">The Web Universe collections</span>
          <h2>
            A world for
            <br />
            every kind of idea.
          </h2>
        </div>
        <Link href="/templates" className="showroom-button">
          Browse all templates <ArrowUpRight size={17} />
        </Link>
      </div>
      <div className="universe-category-grid">
        {templateCategories.map((category) => (
          <Link
            key={category.id}
            href={
              category.id === "colleges-institutions" ||
              category.id === "restaurants-food" ||
              category.id === "education-schools" ||
              category.id === "hotels-resorts"
                ? `/${category.id}`
                : `/templates#${category.id}`
            }
            className={`universe-category category-${category.id}`}
            style={
              { "--category-accent": category.accent } as React.CSSProperties
            }
          >
            <div>
              {category.id === "colleges-institutions" ? (
                <div className="education-category-mini college-category-mini">
                  {category.items.map((item, i) => (
                    <Image
                      unoptimized
                      width={1440}
                      height={1000}
                      key={item.id}
                      src={item.image}
                      alt={`${item.title} website preview`}
                      style={{ "--mini-index": i } as React.CSSProperties}
                    />
                  ))}
                  <Image
                    unoptimized
                    className="college-mini-dashboard"
                    src={`/assets/colleges-institutions/previews/${category.items[0].collegeSlug}-admin.webp`}
                    width={1200}
                    height={834}
                    alt="College management dashboard preview"
                  />
                  <svg viewBox="0 0 90 80" aria-hidden="true">
                    <path
                      d="M45 5 79 18v25c0 16-16 26-34 33C27 69 11 59 11 43V18Z"
                      fill="#14253b"
                      stroke="#d5b77a"
                      strokeWidth="3"
                    />
                    <path
                      d="m22 33 23-12 23 12-23 13Z M29 43v14l16 8 16-8V43"
                      fill="none"
                      stroke="#d5b77a"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
              ) : category.id === "restaurants-food" ? (
                <div className="restaurant-category-mini">
                  {category.items.map((item, i) => (
                    <Image
                      unoptimized
                      key={item.id}
                      src={item.image}
                      width={1440}
                      height={1000}
                      alt={`${item.title} layered website preview`}
                      style={{ "--mini-index": i } as React.CSSProperties}
                    />
                  ))}
                  <svg viewBox="0 0 80 80" aria-hidden="true">
                    <path
                      d="M20 48Q3 40 12 24Q19 12 31 18Q40 3 53 18Q70 13 74 29Q78 43 60 48V67H20Z"
                      fill="#f7ead5"
                      stroke="#edb878"
                      strokeWidth="3"
                    />
                    <path
                      d="M20 56H60M32 49V61M47 49V61"
                      stroke="#b68b51"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
              ) : category.id === "education-schools" ? (
                <div className="education-category-mini">
                  {category.items.map((item, i) => (
                    <Image
                      unoptimized
                      width={1440}
                      height={1000}
                      key={item.id}
                      src={item.image}
                      alt={`${item.title} layered website preview`}
                      style={{ "--mini-index": i } as React.CSSProperties}
                    />
                  ))}
                  <svg viewBox="0 0 90 70" aria-hidden="true">
                    <path d="M5 23L45 3L85 23L45 43Z" fill="#a9c9ff" />
                    <path d="M21 34V52Q45 70 69 52V34L45 47Z" fill="#7698de" />
                    <path
                      d="M82 25V57"
                      fill="none"
                      stroke="#e8c882"
                      strokeWidth="4"
                    />
                    <circle cx="82" cy="58" r="5" fill="#e8c882" />
                  </svg>
                </div>
              ) : (
                <Image
                  unoptimized
                  src={category.items[0].image}
                  fill
                  sizes="(max-width:700px) 90vw, 45vw"
                  alt={`${category.title} preview`}
                />
              )}
              <span>
                {category.items.length}{" "}
                {category.items.length === 1 ? "experience" : "experiences"}
              </span>
            </div>
            <section>
              <h3>{category.title}</h3>
              <ArrowUpRight size={23} />
              <p>{category.description}</p>
            </section>
          </Link>
        ))}
      </div>
    </section>
  );
}
