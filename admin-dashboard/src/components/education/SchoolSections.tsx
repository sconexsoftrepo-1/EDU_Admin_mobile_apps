import Image from "next/image";
import Link from "next/link";
import type { School } from "@/data/education";
export function SchoolVision({ school }: { school: School }) {
  return (
    <section className="school-vision school-wrap" id="vision">
      <span className="school-eyebrow">The heart of {school.name}</span>
      <div>
        <h2>
          {school.vision.split(" ").map((word, i) => (
            <span key={i}>
              <span>{word} </span>
            </span>
          ))}
        </h2>
        <div>
          <p>{school.story[0]}</p>
          <Link
            href={`/education-schools/${school.slug}/about`}
            className="school-text-link"
          >
            Discover our story ↗
          </Link>
        </div>
      </div>
      <ul className="school-values">
        {(school.slug === "little-sprouts"
          ? ["Play based", "Creative", "Safe spaces", "Caring teachers"]
          : school.slug === "evergreen-global"
            ? [
                "Academic depth",
                "Research & inquiry",
                "Personal mentoring",
                "Wider perspectives",
              ]
            : [
                "Academic curiosity",
                "Character & care",
                "Practical discovery",
                "Room to grow",
              ]
        ).map((value, i) => (
          <li key={value}>
            <span aria-hidden="true">{["✧", "☀", "♧", "◎"][i]}</span>
            {value}
          </li>
        ))}
      </ul>
    </section>
  );
}
export function Leadership({
  school,
  full = false,
}: {
  school: School;
  full?: boolean;
}) {
  return (
    <section
      className={`school-leadership school-wrap ${full ? "is-full" : ""}`}
      id="leadership"
    >
      <div className="school-section-heading">
        <div>
          <span className="school-eyebrow">A shared vision for learning</span>
          <h2>
            {school.slug === "little-sprouts"
              ? "Big hearts. A thoughtful vision."
              : school.slug === "evergreen-global"
                ? "Leadership with a wider perspective."
                : "People with a purpose."}
          </h2>
        </div>
        <p>
          Meet the fictional Chairman and Principal behind this school concept.
          All names, portraits and messages are illustrative.
        </p>
      </div>
      <div className="school-leadership-grid">
        {school.leadership.map((person, i) => (
          <article key={person.name}>
            <figure>
              <Image
                unoptimized
                width={600}
                height={800}
                src={person.image}
                alt={`${person.name}, generated fictional ${person.role.toLowerCase()} portrait`}
                loading="lazy"
              />
              <figcaption>Fictional demo profile</figcaption>
            </figure>
            <div>
              <span className="school-eyebrow">
                {person.role}’s {i === 0 ? "vision" : "message"}
              </span>
              <h3>{person.name}</h3>
              <blockquote>{person.message}</blockquote>
              {full ? (
                <p>{person.bio}</p>
              ) : (
                <Link
                  className="school-text-link"
                  href={`/education-schools/${school.slug}/leadership`}
                >
                  Meet our leadership ↗
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
export function Facilities({ school }: { school: School }) {
  return (
    <section className="school-facilities school-wrap">
      <div className="school-section-heading">
        <div>
          <span className="school-eyebrow">Spaces that open possibilities</span>
          <h2>
            Room to discover
            <br />
            what comes next.
          </h2>
        </div>
        <p>
          Learning continues beyond a classroom. Explore the places designed for
          collaboration, quiet focus and trying something new.
        </p>
      </div>
      <div className="school-facility-grid">
        {school.facilities.map((f, i) => (
          <article key={f.id} id={f.id}>
            <Image
              unoptimized
              width={800}
              height={600}
              src={f.image}
              alt={`${f.name} fictional school facility`}
              loading="lazy"
            />
            <div>
              <span className="school-facility-symbol" aria-hidden="true">
                {["✧", "▦", "▤", "↗", "◎", "♧"][i]}
              </span>
              <h3>{f.name}</h3>
              <p>{f.description}</p>
              <details>
                <summary>Explore the space</summary>
                <p>
                  {f.name} supports guided exploration, independent practice and
                  a thoughtful school routine.{" "}
                  {school.slug === "little-sprouts"
                    ? "Illustrative safety features include supervised play, clear arrival routines and family communication."
                    : "The example design includes accessibility-minded pathways, clear guidance and supervised use of specialist resources."}
                </p>
              </details>
            </div>
          </article>
        ))}
      </div>
      <div className="school-safety-note">
        <h3>Care is part of the design.</h3>
        <p>
          The concept includes supervised spaces, an illustrative arrival and
          dismissal process, accessibility planning and family communication. A
          real school must publish its approved safeguarding, transport,
          emergency and accessibility policies.
        </p>
      </div>
    </section>
  );
}
export function SchoolFAQ({
  school,
  preview = false,
}: {
  school: School;
  preview?: boolean;
}) {
  return (
    <section className="school-faq school-wrap">
      <span className="school-eyebrow">A little clarity before hello</span>
      <h2>Questions, welcome.</h2>
      {school.faqs.slice(0, preview ? 3 : undefined).map((f) => (
        <details key={f.q}>
          <summary>
            {f.q}
            <span>+</span>
          </summary>
          <p>{f.a}</p>
        </details>
      ))}
      {preview && (
        <Link
          className="school-text-link"
          href={`/education-schools/${school.slug}/faq`}
        >
          All your questions ↗
        </Link>
      )}
    </section>
  );
}
export function SchoolGuidance({ school }: { school: School }) {
  return (
    <section className="school-guidance school-wrap">
      <div>
        <span className="school-eyebrow">A thoughtful next chapter</span>
        <h2>
          Prepare with purpose.
          <br />
          Choose with confidence.
        </h2>
        <p>
          University and career preparation is a conversation about interests,
          strengths and possible pathways. This fictional program supports
          exploration; it promises no admission, score or placement outcome.
        </p>
      </div>
      <div>
        {[
          "Career conversations",
          "Entrance preparation",
          "Academic mentoring",
          "Application guidance",
          "Skills workshops",
        ].map((name, i) => (
          <details key={name} open={i === 0}>
            <summary>
              {name}
              <span>+</span>
            </summary>
            <p>
              {
                [
                  "Explore possible fields through guided reflection, research and a discussion of personal interests.",
                  "Build thoughtful study routines and understand the types of preparation a chosen pathway may need.",
                  "Review subject choices, learning goals and a practical plan for the next academic step.",
                  "Understand the components of an application and the importance of a genuine, reflective personal story.",
                  "Practise communication, research, collaboration and the skills that help a learner navigate change.",
                ][i]
              }
            </p>
          </details>
        ))}
      </div>
      <Link
        className="school-text-link"
        href={`/education-schools/${school.slug}/admissions`}
      >
        Explore a senior school enquiry ↗
      </Link>
    </section>
  );
}
