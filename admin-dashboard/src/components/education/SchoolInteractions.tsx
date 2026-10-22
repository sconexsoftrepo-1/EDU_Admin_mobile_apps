"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { School } from "@/data/education";
export function AcademicExplorer({ school }: { school: School }) {
  const [active, setActive] = useState(0);
  const program = school.programs[active];
  return (
    <section className="school-programs school-wrap" id="programs">
      <div className="school-section-heading">
        <div>
          <span className="school-eyebrow">Learning that grows with you</span>
          <h2>
            {school.slug === "little-sprouts"
              ? "Small steps. Wonderful discoveries."
              : school.slug === "evergreen-global"
                ? "Find your field of possibility."
                : "A foundation for a lifetime of learning."}
          </h2>
        </div>
        <p>
          Explore a stage of learning to see its goals, activities and subjects.
        </p>
      </div>
      <div
        className="school-program-grid"
        role="group"
        aria-label="Explore academic programs"
      >
        {school.programs.map((p, i) => (
          <button
            key={p.slug}
            aria-pressed={active === i}
            onClick={() => setActive(i)}
          >
            <span className="school-program-symbol" aria-hidden="true">
              {["✿", "☀", "✧", "♧"][i]}
            </span>
            <small>{p.ages}</small>
            <h3>{p.name}</h3>
            <p>{p.description}</p>
            <span>Explore this stage ↗</span>
          </button>
        ))}
      </div>
      <div className="school-program-detail" aria-live="polite">
        <div>
          <span className="school-eyebrow">{program.ages}</span>
          <h3>{program.name}</h3>
          <p>{program.description}</p>
          <Link
            className="school-text-link"
            href={`/education-schools/${school.slug}/academics/${program.slug}`}
          >
            View the complete program ↗
          </Link>
        </div>
        <div>
          <h4>Learning goals</h4>
          <ul>
            {program.goals.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <h4>Learning in action</h4>
          <p>{program.activities.join(" · ")}</p>
        </div>
      </div>
    </section>
  );
}
export function Faculty({ school }: { school: School }) {
  const [department, setDepartment] = useState("All");
  const departments = [
    "All",
    ...new Set(school.faculty.map((p) => p.department)),
  ];
  return (
    <section className="school-faculty school-wrap">
      <div className="school-section-heading">
        <div>
          <span className="school-eyebrow">
            People who make room for possibility
          </span>
          <h2>
            {school.slug === "little-sprouts"
              ? "Teachers who care."
              : "A thoughtful guide at every step."}
          </h2>
        </div>
        <p>
          Illustrative staff profiles. Generated portraits represent fictional
          educators; no real credentials are claimed.
        </p>
      </div>
      <div
        className="school-tabs"
        role="group"
        aria-label="Faculty departments"
      >
        {departments.map((d) => (
          <button
            key={d}
            aria-pressed={department === d}
            onClick={() => setDepartment(d)}
          >
            {d}
          </button>
        ))}
      </div>
      <div className="school-faculty-grid">
        {school.faculty
          .filter((p) => department === "All" || p.department === department)
          .map((p) => (
            <article key={p.name}>
              <Image
                unoptimized
                width={600}
                height={800}
                src={p.image}
                alt={`${p.name}, fictional ${p.role.toLowerCase()} portrait`}
                loading="lazy"
              />
              <div>
                <span>{p.department}</span>
                <h3>{p.name}</h3>
                <p>{p.role}</p>
                <details>
                  <summary>Teaching philosophy</summary>
                  <p>{p.bio}</p>
                  <p>
                    Our sample professional-development approach includes peer
                    reflection, shared lesson design and mentoring.
                  </p>
                </details>
                <small>Fictional demo profile</small>
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}
export function LearningDashboard({
  school,
  parent = false,
}: {
  school: School;
  parent?: boolean;
}) {
  const [tab, setTab] = useState("Progress"),
    [subject, setSubject] = useState(0);
  const subjects = parent
    ? ["Stories & language", "Creative play", "Personal growth"]
    : ["Mathematics", "Science", "Languages"];
  const values = [72, 84, 66];
  return (
    <section className="school-dashboard school-wrap">
      <div>
        <span className="school-eyebrow">
          {parent ? "A window into their day" : "A clearer picture of learning"}
        </span>
        <h2>
          {parent
            ? "Connected families. Confident little learners."
            : "Feedback that points forward."}
        </h2>
        <p>
          {parent
            ? "An illustrative parent portal brings learning updates, activity notes and gentle next steps together."
            : "A sample assessment view connects subject progress with skills, feedback and a learner’s next goal."}
        </p>
        <small>
          UI demonstration · Fictional example data · No student records are
          connected.
        </small>
      </div>
      <div className="school-dashboard-panel">
        <div className="school-dashboard-head">
          <strong>{parent ? "Family connection" : "Learning compass"}</strong>
          <span>Sample learner</span>
        </div>
        <div className="school-tabs" role="group" aria-label="Dashboard views">
          {["Progress", "Updates", "Goals"].map((t) => (
            <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        {tab === "Progress" ? (
          <>
            <label className="school-dashboard-subject">
              Learning area
              <select
                value={subject}
                onChange={(e) => setSubject(Number(e.target.value))}
              >
                {subjects.map((s, i) => (
                  <option value={i} key={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <div
              className="school-progress-ring"
              style={
                {
                  "--school-progress": `${values[subject]}%`,
                } as React.CSSProperties
              }
              role="progressbar"
              aria-label={`${subjects[subject]} sample progress`}
              aria-valuenow={values[subject]}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <strong>
                {values[subject]}%<small>Illustrative progress</small>
              </strong>
            </div>
            <p aria-live="polite">
              {subjects[subject]}:{" "}
              {
                [
                  "Building confidence with guided practice.",
                  "Connecting ideas with growing independence.",
                  "Exploring a new challenge with thoughtful support.",
                ][subject]
              }
            </p>
            <div className="school-assessment-timeline">
              <span>Discover</span>
              <span>Practise</span>
              <span>Reflect</span>
              <span>Next step</span>
            </div>
          </>
        ) : tab === "Updates" ? (
          <div className="school-dashboard-updates">
            <article>
              <small>Sample update / Monday</small>
              <h3>
                {parent
                  ? "A story shared together"
                  : "A question, investigated"}
              </h3>
              <p>
                {parent
                  ? "Today’s illustrated learning note celebrates listening, taking turns and choosing a favourite story."
                  : "The sample science journal connects a learner’s question, observations and reflection."}
              </p>
            </article>
            <article>
              <small>Sample activity / Wednesday</small>
              <h3>Learning with others</h3>
              <p>
                A collaborative project made room for different ideas and a
                shared explanation.
              </p>
            </article>
            <p>
              Attendance example: 4 of 5 sample learning days. Fictional data
              only.
            </p>
          </div>
        ) : (
          <div className="school-dashboard-updates">
            <h3>A small next step</h3>
            <p>
              Explain one new idea in your own words. Ask a question. Try a
              different approach.
            </p>
            <h4>Teacher feedback example</h4>
            <p>
              “You noticed a useful pattern. Next time, tell us what made you
              think that.”
            </p>
            <h4>Skills in focus</h4>
            <p>Communication · Collaboration · Self-reflection</p>
          </div>
        )}
      </div>
    </section>
  );
}
export function DiscoveryTabs({
  school,
  variant = "learning",
}: {
  school: School;
  variant?: "learning" | "sports" | "reading";
}) {
  const entries =
    variant === "sports"
      ? [
          [
            "Team games",
            "Practice teamwork, coordination and fair play through supervised group activities.",
          ],
          [
            "Athletics",
            "Explore movement, personal goals and a healthy relationship with physical activity.",
          ],
          [
            "Wellbeing",
            "Build routines around gentle movement, balance and looking after one another.",
          ],
        ]
      : variant === "reading"
        ? [
            [
              "Read together",
              "Shared reading brings a story to life through questions, new words and different perspectives.",
            ],
            [
              "Explore a subject",
              "Find a new question in fiction, reference books and carefully guided research.",
            ],
            [
              "Make a story",
              "Turn reading into a creative response through writing, illustration and discussion.",
            ],
          ]
        : [
            [
              "Smart classroom",
              "A shared display, practical materials and conversation connect a lesson with different ways of learning.",
            ],
            [
              "STEM & robotics",
              "Explore a challenge by building, testing and reflecting. Thoughtful questions matter as much as a working model.",
            ],
            [
              "Creative inquiry",
              "Connect art, language and observation to express an idea in a way someone else can understand.",
            ],
          ];
  const [active, setActive] = useState(0);
  return (
    <section className={`school-discovery school-wrap discovery-${variant}`}>
      <figure>
        <Image
          unoptimized
          width={1000}
          height={750}
          src={`/assets/education-schools/${school.slug}/facilities/${variant === "sports" ? "sports" : variant === "reading" ? "library" : active === 1 ? "lab" : "classroom"}.webp`}
          alt={`${school.name} ${entries[active][0].toLowerCase()} illustration`}
          loading="lazy"
        />
      </figure>
      <div>
        <span className="school-eyebrow">
          {variant === "sports"
            ? "Move. Play. Belong."
            : variant === "reading"
              ? "A world between the pages"
              : "The classroom, reimagined"}
        </span>
        <h2>
          {variant === "sports"
            ? "A healthy mind loves to move."
            : variant === "reading"
              ? "Where the next question begins."
              : "More than a lesson. A way of thinking."}
        </h2>
        <div
          className="school-tabs"
          role="group"
          aria-label={`${variant} topics`}
        >
          {entries.map(([name], i) => (
            <button
              key={name}
              aria-pressed={i === active}
              onClick={() => setActive(i)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="school-discovery-detail" aria-live="polite">
          <h3>{entries[active][0]}</h3>
          <p>{entries[active][1]}</p>
        </div>
        <Link
          className="school-text-link"
          href={`/education-schools/${school.slug}/facilities`}
        >
          Explore learning spaces ↗
        </Link>
      </div>
    </section>
  );
}
export function StudentLife({ school }: { school: School }) {
  const rail = useRef<HTMLDivElement>(null);
  const chooseClub = (index: number) => {
    const next = (index + school.clubs.length) % school.clubs.length;
    setActive(next);
    const button = rail.current?.children[next] as HTMLElement | undefined;
    if (button && rail.current)
      rail.current.scrollTo({
        left: button.offsetLeft - rail.current.offsetLeft,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  };
  const [active, setActive] = useState(0),
    [filter, setFilter] = useState("All");
  return (
    <section className="school-life school-wrap">
      <div className="school-section-heading">
        <div>
          <span className="school-eyebrow">
            A little more life in every school day
          </span>
          <h2>
            Find an interest.
            <br />
            Find your people.
          </h2>
        </div>
        <p>
          Clubs, arts, movement and community: a fictional activity collection
          that makes room for different strengths.
        </p>
      </div>
      <div
        ref={rail}
        className="school-club-rail"
        role="region"
        aria-label="Student activity carousel"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            chooseClub(active + (e.key === "ArrowRight" ? 1 : -1));
          }
        }}
      >
        {school.clubs.map((c, i) => (
          <button
            key={c.name}
            aria-pressed={active === i}
            onClick={() => chooseClub(i)}
          >
            <span>{["⚘", "✧", "↗", "✿", "◎", "♧"][i]}</span>
            <small>{c.category}</small>
            <h3>{c.name}</h3>
            <p>{c.description}</p>
          </button>
        ))}
      </div>
      <div className="school-club-caption" aria-live="polite">
        <strong>{school.clubs[active].name}</strong>
        <p>{school.clubs[active].description}</p>
        <div>
          <button
            aria-label="Previous student activity"
            onClick={() => chooseClub(active - 1)}
          >
            ←
          </button>
          <button
            aria-label="Next student activity"
            onClick={() => chooseClub(active + 1)}
          >
            →
          </button>
        </div>
      </div>
      <div className="school-achievements" id="achievements">
        <span className="school-eyebrow">Ideas. Effort. Growth.</span>
        <h2>Every kind of progress matters.</h2>
        <p>
          Fictional demonstration achievements. These are sample projects, not
          real examination results, awards or rankings.
        </p>
        <div
          className="school-tabs"
          role="group"
          aria-label="Achievement categories"
        >
          {["All", "Learning", "Sport", "Arts", "Community"].map((f) => (
            <button
              key={f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div>
          {school.achievements
            .filter((a) => filter === "All" || a.category === filter)
            .map((a) => (
              <article key={a.title}>
                <span aria-hidden="true">✧</span>
                <small>{a.category} / Demo achievement</small>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}
export function SchoolGallery({ school }: { school: School }) {
  const items = [
    { category: "Campus", label: "Our learning world", src: school.hero },
    ...["classroom", "lab", "library", "sports"].map((f, i) => ({
      category: ["Classrooms", "Labs", "Library", "Sports"][i],
      label: [
        "Spaces for shared discovery",
        "Ideas in action",
        "A reading invitation",
        "Room to move",
      ][i],
      src: `/assets/education-schools/${school.slug}/facilities/${f}.webp`,
    })),
    { category: "Events", label: "A community day concept", src: school.hero },
  ];
  const [filter, setFilter] = useState("All"),
    [active, setActive] = useState(0);
  const selected = items.filter(
    (i) => filter === "All" || i.category === filter,
  );
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement | null>(null),
    start = useRef(0);
  useEffect(() => {
    const el = dialog.current;
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setActive((v) => (v + 1) % selected.length);
      if (e.key === "ArrowLeft")
        setActive((v) => (v - 1 + selected.length) % selected.length);
    };
    el?.addEventListener("keydown", key);
    return () => el?.removeEventListener("keydown", key);
  }, [selected.length]);
  return (
    <section className="school-gallery school-wrap">
      <div className="school-section-heading">
        <div>
          <span className="school-eyebrow">A closer look</span>
          <h2>A world worth exploring.</h2>
        </div>
        <p>
          Generated imagery of a fictional school. Select a photograph to open
          the gallery.
        </p>
      </div>
      <div className="school-tabs" role="group" aria-label="Gallery categories">
        {[
          "All",
          "Campus",
          "Classrooms",
          "Labs",
          "Library",
          "Sports",
          "Events",
        ].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setActive(0);
            }}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="school-gallery-grid">
        {selected.map((item, i) => (
          <button
            key={item.category}
            aria-label={`View ${item.label}`}
            onClick={(e) => {
              trigger.current = e.currentTarget;
              setActive(i);
              dialog.current?.showModal();
            }}
          >
            <Image
              unoptimized
              width={1000}
              height={750}
              src={item.src}
              alt={item.label}
              loading="lazy"
            />
            <span>{item.category} ↗</span>
          </button>
        ))}
      </div>
      <dialog
        ref={dialog}
        className="school-gallery-dialog"
        aria-label="School image gallery"
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <button
          className="school-dialog-close"
          aria-label="Close school gallery"
          onClick={() => dialog.current?.close()}
        >
          Close ×
        </button>
        <Image
          unoptimized
          width={1200}
          height={800}
          src={selected[active].src}
          alt={selected[active].label}
          onTouchStart={(e) => {
            start.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            const delta = e.changedTouches[0].clientX - start.current;
            if (Math.abs(delta) > 40)
              setActive(
                (v) =>
                  (v + (delta > 0 ? -1 : 1) + selected.length) %
                  selected.length,
              );
          }}
        />
        <div>
          <button
            aria-label="Previous school photo"
            onClick={() =>
              setActive((v) => (v - 1 + selected.length) % selected.length)
            }
          >
            ←
          </button>
          <p>
            {active + 1} / {selected.length} — {selected[active].label}
          </p>
          <button
            aria-label="Next school photo"
            onClick={() => setActive((v) => (v + 1) % selected.length)}
          >
            →
          </button>
        </div>
      </dialog>
    </section>
  );
}
