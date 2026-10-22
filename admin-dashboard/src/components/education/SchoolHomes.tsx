import Link from "next/link";
import type { School } from "@/data/education";
import SchoolHeroArt from "./SchoolHeroArt";
import {
  SchoolVision,
  Leadership,
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
function HeroActions({ school }: { school: School }) {
  return (
    <div className="school-hero-actions">
      <Link
        className="school-button"
        href={`/education-schools/${school.slug}/admissions`}
      >
        {school.slug === "little-sprouts"
          ? "Begin a little adventure"
          : "Explore admissions"}{" "}
        ↗
      </Link>
      <a
        className="school-button school-button-secondary"
        href="#campus-explorer"
      >
        Take a virtual tour ↓
      </a>
    </div>
  );
}
function Chapters() {
  return (
    <nav className="school-chapters" aria-label="Homepage chapters">
      <a href="#vision">Our vision</a>
      <a href="#leadership">Leadership</a>
      <a href="#programs">Learning</a>
      <a href="#campus-explorer">Campus</a>
      <a href="#admissions-form">Admissions</a>
    </nav>
  );
}
export function LittleSproutsHome({ school }: { school: School }) {
  return (
    <>
      <section className="school-hero sprouts-hero">
        <div className="school-hero-copy">
          <span className="school-eyebrow">{school.tagline}</span>
          <h1>
            A brighter tomorrow
            <br />
            begins with a<br />
            happier today.
          </h1>
          <p>{school.description}</p>
          <HeroActions school={school} />
          <span className="sprouts-hero-note">
            ✿ Little discoveries. Big possibilities.
          </span>
        </div>
        <SchoolHeroArt school={school} />
      </section>
      <Chapters />
      <SchoolVision school={school} />
      <AcademicExplorer school={school} />
      <Leadership school={school} />
      <SchoolWorld school={school} kind="learning" />
      <SchoolWorld school={school} />
      <DiscoveryTabs school={school} />
      <Faculty school={school} />
      <LearningDashboard school={school} parent />
      <StudentLife school={school} />
      <Admissions school={school} />
      <SchoolGallery school={school} />
      <SchoolFAQ school={school} preview />
    </>
  );
}
export function SunriseHome({ school }: { school: School }) {
  return (
    <>
      <section className="school-hero sunrise-hero">
        <SchoolHeroArt school={school} />
        <div className="school-hero-copy">
          <span className="school-eyebrow">
            A bright beginning for a curious mind
          </span>
          <h1>
            Discover.
            <br />
            Explore.
            <br />
            Excel.
          </h1>
          <p>{school.description}</p>
          <HeroActions school={school} />
        </div>
        <div className="sunrise-hero-ribbon">
          <span>Strong foundations</span>
          <span>Creative thinking</span>
          <span>A caring community</span>
          <span>A world to explore</span>
        </div>
      </section>
      <Chapters />
      <SchoolVision school={school} />
      <SchoolWorld school={school} />
      <Leadership school={school} />
      <AcademicExplorer school={school} />
      <DiscoveryTabs school={school} />
      <SchoolWorld school={school} kind="learning" />
      <DiscoveryTabs school={school} variant="sports" />
      <DiscoveryTabs school={school} variant="reading" />
      <Faculty school={school} />
      <StudentLife school={school} />
      <Admissions school={school} />
      <SchoolGallery school={school} />
      <SchoolFAQ school={school} preview />
    </>
  );
}
export function MaplewoodHome({ school }: { school: School }) {
  return (
    <>
      <section className="school-hero maplewood-hero">
        <div className="school-hero-copy">
          <span className="school-eyebrow">{school.tagline}</span>
          <h1>
            Knowledge.
            <br />
            Character.
            <br />
            Leadership.
          </h1>
          <p>{school.description}</p>
          <HeroActions school={school} />
          <div className="maplewood-hero-qualities">
            <span>Academic curiosity</span>
            <span>Leadership in action</span>
            <span>Personal growth</span>
          </div>
        </div>
        <SchoolHeroArt school={school} />
      </section>
      <Chapters />
      <SchoolVision school={school} />
      <SchoolWorld school={school} />
      <Leadership school={school} />
      <SchoolWorld school={school} kind="learning" />
      <AcademicExplorer school={school} />
      <DiscoveryTabs school={school} />
      <LearningDashboard school={school} />
      <DiscoveryTabs school={school} variant="sports" />
      <Faculty school={school} />
      <StudentLife school={school} />
      <Admissions school={school} />
      <SchoolGallery school={school} />
      <SchoolFAQ school={school} preview />
    </>
  );
}
export function EvergreenHome({ school }: { school: School }) {
  return (
    <>
      <section className="school-hero evergreen-hero">
        <div className="evergreen-hero-heading">
          <span className="school-eyebrow">{school.tagline}</span>
          <h1>
            Global education for
            <br />a greater tomorrow.
          </h1>
          <p>{school.description}</p>
          <HeroActions school={school} />
        </div>
        <SchoolHeroArt school={school} />
        <span className="evergreen-hero-caption">
          A deeper understanding. A wider horizon.
        </span>
      </section>
      <Chapters />
      <SchoolVision school={school} />
      <Leadership school={school} />
      <SchoolWorld school={school} />
      <AcademicExplorer school={school} />
      <SchoolWorld school={school} kind="learning" />
      <DiscoveryTabs school={school} />
      <Faculty school={school} />
      <SchoolGuidance school={school} />
      <SchoolWorld school={school} kind="globe" />
      <StudentLife school={school} />
      <Admissions school={school} />
      <SchoolGallery school={school} />
      <SchoolFAQ school={school} preview />
    </>
  );
}
