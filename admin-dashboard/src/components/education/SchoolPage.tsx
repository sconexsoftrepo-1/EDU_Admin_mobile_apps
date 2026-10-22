import Image from "next/image";
import Link from "next/link";
import type { School } from "@/data/education";
import {
  SchoolVision,
  Leadership,
  Facilities,
  SchoolFAQ,
  SchoolGuidance,
} from "./SchoolSections";
import {
  AcademicExplorer,
  Faculty,
  LearningDashboard,
  DiscoveryTabs,
  StudentLife,
  SchoolGallery,
} from "./SchoolInteractions";
import SchoolWorld from "./SchoolWorld";
import Admissions from "./Admissions";
const titles: Record<string, [string, string]> = {
  about: ["Our story", "A place to belong. Room to become."],
  leadership: ["A shared purpose", "Leadership, with learning at heart."],
  academics: ["A thoughtful foundation", "Find your next discovery."],
  campus: ["A new perspective", "A world of learning, explored."],
  facilities: ["Spaces for possibility", "More room for curious minds."],
  faculty: [
    "People who guide and inspire",
    "A thoughtful teacher makes a difference.",
  ],
  "student-life": ["Beyond the timetable", "A school day full of possibility."],
  achievements: [
    "Celebrate the journey",
    "Effort. Ideas. A little more confidence.",
  ],
  gallery: ["Through a different lens", "Picture a day of discovery."],
  admissions: ["A friendly first step", "A new chapter starts with hello."],
  contact: ["Your questions, welcome", "Let’s start a conversation."],
  faq: ["A little more clarity", "Before your next step."],
};
export default function SchoolPage({
  school,
  parts,
}: {
  school: School;
  parts: string[];
}) {
  const [page, detail] = parts,
    program =
      page === "academics"
        ? school.programs.find((p) => p.slug === detail)
        : undefined,
    base = `/education-schools/${school.slug}`;
  return (
    <>
      <section className="school-page-heading school-wrap">
        <nav aria-label="Breadcrumb">
          <Link href="/education-schools">Education & Schools</Link>
          <span>/</span>
          <Link href={base}>{school.name}</Link>
          <span>/</span>
          <span>{program?.name || page.replaceAll("-", " ")}</span>
        </nav>
        <span className="school-eyebrow">
          {program?.ages || titles[page][0]}
        </span>
        <h1>{program?.name || titles[page][1]}</h1>
        <p>{program?.description || school.description}</p>
      </section>
      {program ? (
        <>
          <section className="school-program-page school-wrap">
            <figure>
              <Image
                unoptimized
                width={1000}
                height={750}
                src={`/assets/education-schools/${school.slug}/facilities/classroom.webp`}
                alt={`${program.name} learning environment`}
                priority
              />
            </figure>
            <div>
              <h2>A foundation for what comes next.</h2>
              <p>{program.description}</p>
              <h3>Learning goals</h3>
              <ul>
                {program.goals.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              <h3>Subjects & learning areas</h3>
              <ul>
                {program.subjects.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <h3>Learning in action</h3>
              <p>{program.activities.join(", ")}.</p>
              <h3>A thoughtful way to assess growth</h3>
              <p>
                {school.slug === "little-sprouts"
                  ? "Observation, shared play and gentle family conversations help illustrate a child’s interests and growing confidence."
                  : "Guided practice, projects, discussion and reflective feedback build a useful picture of learning. The sample approach supports progress rather than promising examination outcomes."}
              </p>
              <Link className="school-button" href={`${base}/admissions`}>
                Enquire about {program.name} ↗
              </Link>
            </div>
          </section>
          <DiscoveryTabs school={school} />
        </>
      ) : (
        <>
          {page === "about" && (
            <>
              <SchoolVision school={school} />
              <section className="school-about-story school-wrap">
                <figure>
                  <Image
                    unoptimized
                    width={1200}
                    height={800}
                    src={school.hero}
                    alt={`${school.name} campus concept`}
                    loading="lazy"
                  />
                </figure>
                <div>
                  <span className="school-eyebrow">Fictional beginnings</span>
                  <h2>A shared belief in a brighter school day.</h2>
                  <p>{school.story[1]}</p>
                  <h3>Our mission</h3>
                  <p>
                    Create room for curiosity, strong foundations and the
                    confidence to contribute.
                  </p>
                  <h3>Our vision</h3>
                  <p>{school.vision}</p>
                  <h3>Our values</h3>
                  <p>
                    Care, curiosity, integrity, collaboration and thoughtful
                    effort shape this school concept.
                  </p>
                </div>
              </section>
              <Leadership school={school} />
            </>
          )}
          {page === "leadership" && <Leadership school={school} full />}
          {page === "academics" && (
            <>
              <AcademicExplorer school={school} />
              <DiscoveryTabs school={school} />
              <LearningDashboard
                school={school}
                parent={school.slug === "little-sprouts"}
              />
              {school.slug === "evergreen-global" && (
                <SchoolGuidance school={school} />
              )}
            </>
          )}
          {page === "campus" && (
            <>
              <SchoolWorld school={school} />
              <Facilities school={school} />
            </>
          )}
          {page === "facilities" && (
            <>
              <Facilities school={school} />
              <SchoolWorld school={school} kind="learning" />
              <DiscoveryTabs school={school} variant="reading" />
            </>
          )}
          {page === "faculty" && <Faculty school={school} />}
          {(page === "student-life" || page === "achievements") && (
            <>
              <StudentLife school={school} />
              {page === "student-life" && (
                <DiscoveryTabs school={school} variant="sports" />
              )}
            </>
          )}
          {page === "gallery" && <SchoolGallery school={school} />}
          {page === "admissions" && <Admissions school={school} />}
          {page === "contact" && (
            <>
              <section className="school-contact-location school-wrap">
                <div className="school-location-illustration">
                  <svg
                    viewBox="0 0 500 300"
                    role="img"
                    aria-label="Illustrative fictional campus plan, not a real address or navigation map"
                  >
                    <rect
                      x="35"
                      y="25"
                      width="430"
                      height="250"
                      rx="35"
                      fill="currentColor"
                      opacity=".07"
                    />
                    <path
                      d="M0 240Q150 200 250 150T500 80M50 0Q100 130 200 180T420 300"
                      fill="none"
                      stroke="currentColor"
                      opacity=".2"
                      strokeWidth="18"
                    />
                    <rect
                      x="180"
                      y="80"
                      width="140"
                      height="90"
                      rx="5"
                      fill="currentColor"
                      opacity=".4"
                    />
                    <path
                      d="M170 85L250 40L330 85"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                    />
                    <circle
                      cx="120"
                      cy="90"
                      r="25"
                      fill="currentColor"
                      opacity=".2"
                    />
                    <circle
                      cx="370"
                      cy="200"
                      r="35"
                      fill="currentColor"
                      opacity=".2"
                    />
                    <text
                      x="250"
                      y="230"
                      textAnchor="middle"
                      fill="currentColor"
                      fontSize="14"
                    >
                      Fictional campus illustration
                    </text>
                  </svg>
                </div>
                <div>
                  <h2>A place imagined for learning.</h2>
                  <p>
                    This is a fictional school concept. There is no real campus
                    address, operational school phone number or live map.
                  </p>
                  <p>
                    Try a local school enquiry below, or discuss the website
                    with Chaitanya through its clearly labeled WhatsApp link. No
                    enquiry is sent to a real school.
                  </p>
                  <Link className="school-text-link" href={`${base}/campus`}>
                    Explore the campus concept ↗
                  </Link>
                </div>
              </section>
              <Admissions school={school} />
            </>
          )}
          {page === "faq" && <SchoolFAQ school={school} />}
        </>
      )}
    </>
  );
}
