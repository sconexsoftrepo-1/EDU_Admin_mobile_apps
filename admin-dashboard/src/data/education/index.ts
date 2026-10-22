export const schoolSlugs = [
  "little-sprouts",
  "sunrise-international",
  "maplewood-high",
  "evergreen-global",
] as const;
export type SchoolSlug = (typeof schoolSlugs)[number];
export type SchoolProgram = {
  slug: string;
  name: string;
  ages: string;
  description: string;
  goals: string[];
  activities: string[];
  subjects: string[];
};
export type SchoolPerson = {
  name: string;
  role: string;
  department: string;
  image: string;
  bio: string;
  message: string;
};
export type School = {
  slug: SchoolSlug;
  number: string;
  name: string;
  level: string;
  tagline: string;
  headline: string;
  description: string;
  vision: string;
  story: string[];
  colors: {
    bg: string;
    ink: string;
    accent: string;
    soft: string;
    secondary: string;
  };
  logo: string;
  hero: string;
  mobile: string;
  model: string;
  programs: SchoolProgram[];
  leadership: SchoolPerson[];
  faculty: SchoolPerson[];
  facilities: {
    id: string;
    name: string;
    description: string;
    image: string;
    position: [number, number, number];
  }[];
  clubs: { name: string; category: string; description: string }[];
  achievements: { title: string; category: string; description: string }[];
  faqs: { q: string; a: string }[];
  initialDuration: number;
  refreshDuration: number;
  closing: string;
  grades: string[];
};
const definitions = [
  {
    slug: "little-sprouts",
    number: "11",
    name: "Little Sprouts Academy",
    level: "Preschool & Kindergarten",
    tagline: "Play. Learn. Grow.",
    headline: "A Brighter Tomorrow Begins with a Happier Today.",
    description:
      "A joyful, nurturing world for little ones to explore, learn and grow.",
    vision: "Every big dream begins with a small discovery.",
    story: [
      "A storybook campus built around curiosity, kindness and the joy of trying something new. Our fictional academy gives children the time, space and encouragement to find their own way of learning.",
      "From a first friendship to a much-loved story, the everyday moments matter. We imagine a school where learning grows through play, guided discovery and warm relationships with families.",
    ],
    colors: {
      bg: "#fff9ed",
      ink: "#423347",
      accent: "#cf3153",
      soft: "#f9e8df",
      secondary: "#ffd25c",
    },
    programNames: ["Play Group", "Nursery", "LKG", "UKG"],
    ages: ["2–3 years", "3–4 years", "4–5 years", "5–6 years"],
    grades: ["Play Group", "Nursery", "LKG", "UKG"],
    people: ["Arun Mehta", "Maya Rao", "Nila Shah", "Rohan Sen"],
    roles: [
      "Chairman",
      "Principal",
      "Early Years Educator",
      "Creative Learning Guide",
    ],
    facilities: [
      "Play Area",
      "Classrooms",
      "Activity Room",
      "Library Corner",
      "Outdoor Garden",
      "Safety Zone",
    ],
    clubNames: [
      "Story circle",
      "Little artists",
      "Garden explorers",
      "Music & movement",
      "Kindness club",
      "Building together",
    ],
    closing: "Every Big Dream Starts Small.",
    initialDuration: 3.5,
    refreshDuration: 1.1,
  },
  {
    slug: "sunrise-international",
    number: "12",
    name: "Sunrise International",
    level: "Primary & Junior School",
    tagline: "Curiosity. Creativity. Character.",
    headline: "Discover. Explore. Excel.",
    description:
      "A strong foundation for a brighter future through thoughtful learning, discovery and values.",
    vision: "A school day filled with possibilities.",
    story: [
      "Sunrise is a fictional learning community designed around the excitement of discovery. Bright classrooms, open gardens and spaces to collaborate connect the academic day with the world beyond a textbook.",
      "Our approach brings strong foundations together with creative inquiry. Children read widely, build confidently and learn to ask better questions, supported by teachers who make room for different strengths.",
    ],
    colors: {
      bg: "#ffffff",
      ink: "#173566",
      accent: "#1554bd",
      soft: "#ecf7ff",
      secondary: "#ffc94c",
    },
    programNames: [
      "Primary Foundation",
      "Primary Discovery",
      "Junior Explorers",
      "Junior Leadership",
    ],
    ages: ["Grades 1–2", "Grades 3–4", "Grades 5–6", "Grades 7–8"],
    grades: [
      "Grade 1",
      "Grade 2",
      "Grade 3",
      "Grade 4",
      "Grade 5",
      "Grade 6",
      "Grade 7",
      "Grade 8",
    ],
    people: ["Dev Malhotra", "Anika Menon", "Sara Iyer", "Kabir Das"],
    roles: ["Chairman", "Principal", "STEM Educator", "Language Educator"],
    facilities: [
      "Primary Block",
      "Junior Block",
      "Library",
      "Sports Ground",
      "Computer Lab",
      "Auditorium",
    ],
    clubNames: [
      "Robotics studio",
      "Readers’ circle",
      "Sports & fitness",
      "Young artists",
      "Nature society",
      "School theatre",
    ],
    closing: "A brighter day starts with a curious mind.",
    initialDuration: 3,
    refreshDuration: 1.2,
  },
  {
    slug: "maplewood-high",
    number: "13",
    name: "Maplewood High School",
    level: "High School · Grades 6–10",
    tagline: "Building Today’s Learners, Tomorrow’s Leaders.",
    headline: "Knowledge. Character. Leadership.",
    description:
      "A dynamic learning environment connecting knowledge, practical skills and the confidence to lead.",
    vision: "Learn with purpose. Lead with character.",
    story: [
      "Maplewood is a fictional high school with a clear purpose: help young people connect what they learn with who they want to become. Its daylight campus brings academic focus, experimentation and meaningful collaboration together.",
      "A strong subject foundation is paired with laboratories, sports, creative practice and opportunities to lead. Feedback is a conversation about growth, helping every learner recognise the next step they can take.",
    ],
    colors: {
      bg: "#ffffff",
      ink: "#102d56",
      accent: "#185bb6",
      soft: "#eef5fb",
      secondary: "#247959",
    },
    programNames: [
      "Middle School",
      "Foundation Years",
      "Secondary Learning",
      "Grade 10 Pathways",
    ],
    ages: ["Grade 6", "Grades 7–8", "Grade 9", "Grade 10"],
    grades: ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10"],
    people: ["Vikram Kapoor", "Leena Nair", "Isha Thomas", "Arjun Bose"],
    roles: ["Chairman", "Principal", "Science Educator", "Computing Educator"],
    facilities: [
      "Main Entrance",
      "Academic Block",
      "Science Labs",
      "Sports Ground",
      "Library",
      "Computer & AI Lab",
    ],
    clubNames: [
      "Science club",
      "Debate society",
      "Coding lab",
      "Student council",
      "Creative arts",
      "Community service",
    ],
    closing: "Your next chapter starts with a question.",
    initialDuration: 2.8,
    refreshDuration: 1,
  },
  {
    slug: "evergreen-global",
    number: "14",
    name: "Evergreen Global School",
    level: "Senior Secondary · Grades 11–12",
    tagline: "Dream. Prepare. Achieve.",
    headline: "Global Education for a Greater Tomorrow.",
    description:
      "Academic depth, a wider perspective and thoughtful preparation for life beyond school.",
    vision: "A deeper understanding. A wider horizon.",
    story: [
      "Evergreen is a fictional senior school where academic ambition meets thoughtful preparation for the wider world. An elegant campus provides the setting for discussion, research and the deliberate work of finding your own direction.",
      "Science, commerce and humanities are connected through inquiry, mentoring and shared projects. Career guidance helps students explore possibilities and make informed choices; no university place or examination outcome is promised.",
    ],
    colors: {
      bg: "#f7f6ed",
      ink: "#143f32",
      accent: "#174f3e",
      soft: "#e6e9df",
      secondary: "#b2904c",
    },
    programNames: ["Science", "Commerce", "Humanities"],
    ages: ["Grades 11–12", "Grades 11–12", "Grades 11–12"],
    grades: [
      "Grade 11 · Science",
      "Grade 11 · Commerce",
      "Grade 11 · Humanities",
      "Grade 12 · Science",
      "Grade 12 · Commerce",
      "Grade 12 · Humanities",
    ],
    people: ["Aditya Varma", "Meera Sethi", "Asha Verma", "Neel Raman"],
    roles: ["Chairman", "Principal", "Research Mentor", "Humanities Educator"],
    facilities: [
      "Academic Block",
      "Research Labs",
      "Library",
      "Auditorium",
      "Sports Complex",
      "Career Guidance Centre",
    ],
    clubNames: [
      "Research collective",
      "Enterprise studio",
      "Global dialogue",
      "Creative writing",
      "Community leadership",
      "Model assembly",
    ],
    closing: "Prepare for a world of possibilities.",
    initialDuration: 3.2,
    refreshDuration: 1.3,
  },
];
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");
export const schools: School[] = definitions.map((d, index) => {
  const root = `/assets/education-schools/${d.slug}`;
  const people = d.people.map((name, i) => ({
    name,
    role: d.roles[i],
    department:
      i < 2
        ? "Leadership"
        : index === 0
          ? i === 2
            ? "Early Years"
            : "Creative Play"
          : index === 1
            ? i === 2
              ? "STEM & Discovery"
              : "Languages"
            : index === 2
              ? i === 2
                ? "Science"
                : "Computing & AI"
              : i === 2
                ? "Research & Innovation"
                : "Humanities",
    image: `${root}/leadership/person-${i + 1}.webp`,
    bio: `${name} is a fictional ${d.roles[i].toLowerCase()} profile created for this school website demonstration. Their approach focuses on curiosity, care and helping learners find a thoughtful next step. No real qualifications or credentials are claimed.`,
    message:
      i === 0
        ? `Our vision for ${d.name} begins with a simple belief: every learner deserves a place to belong and a reason to be curious. We imagine an environment where strong foundations and a caring community grow together.`
        : `The most meaningful learning happens when a question becomes a conversation. We want students to try, reflect and build confidence, with clear guidance and thoughtful feedback along the way.`,
  }));
  const programs = d.programNames.map((name, i) => ({
    slug: slugify(name),
    name,
    ages: d.ages[i],
    description:
      index === 0
        ? [
            "Gentle first steps into group play, language and daily routines.",
            "Exploring stories, movement, sensory play and new friendships.",
            "Building early language, number sense and creative confidence.",
            "Growing independence and school readiness through purposeful play.",
          ][i]
        : index === 3
          ? [
              "Explore scientific questions through physics, chemistry, biology and mathematical reasoning.",
              "Connect economics, business studies and accounting with real-world questions and ethical decisions.",
              "Study people, societies, literature and ideas through discussion, research and creative expression.",
            ][i]
          : `A considered ${d.ages[i].toLowerCase()} program connecting subject knowledge, practical inquiry and independent learning.`,
    goals:
      index === 0
        ? [
            "Communication and listening",
            "Confidence and friendship",
            "Curiosity and creativity",
          ]
        : [
            "Clear subject understanding",
            "Thoughtful problem solving",
            "Collaboration and self-reflection",
          ],
    activities:
      index === 0
        ? ["Story time", "Creative play", "Outdoor discovery"]
        : [
            "Collaborative projects",
            "Practical investigations",
            "Reading and discussion",
          ],
    subjects:
      index === 3
        ? i === 0
          ? ["Physics", "Chemistry", "Biology", "Mathematics"]
          : i === 1
            ? ["Economics", "Business studies", "Accounting", "Mathematics"]
            : [
                "History",
                "Literature",
                "Political studies",
                "Creative expression",
              ]
        : index === 0
          ? [
              "Language",
              "Numbers",
              "Creative expression",
              "Personal development",
            ]
          : [
              "Language & Literature",
              "Mathematics",
              "Science",
              "Social studies",
              "Digital learning",
            ],
  }));
  return {
    ...d,
    slug: d.slug as SchoolSlug,
    logo: `${root}/logos/mark.svg`,
    hero: `${root}/hero/desktop.webp`,
    mobile: `${root}/hero/mobile.webp`,
    model: `${root}/models/campus.glb`,
    programs,
    leadership: people.slice(0, 2),
    faculty: people.slice(2),
    facilities: d.facilities.map((name, i) => ({
      id: slugify(name),
      name,
      description: [
        `A welcoming place to begin the day, with room for guided discovery and a sense of belonging.`,
        `Bright shared spaces for discussion, creative work and independent learning.`,
        `An environment for exploring ideas through books, experiments and conversation.`,
        `Space for movement, teamwork and building confidence at your own pace.`,
        `Purposeful resources for practical inquiry, digital skills and learning by doing.`,
        `A thoughtfully planned space supporting the wider learning community.`,
      ][i],
      image:
        (index === 2 && i < 2) || (index === 3 && (i === 0 || i === 3))
          ? `${root}/hero/desktop.webp`
          : `${root}/facilities/${(index === 0 ? ["sports", "classroom", "lab", "library", "sports", "classroom"] : index === 1 ? ["classroom", "classroom", "library", "sports", "lab", "classroom"] : index === 2 ? ["classroom", "classroom", "lab", "sports", "library", "lab"] : ["classroom", "lab", "library", "classroom", "sports", "classroom"])[i]}.webp`,
      position: [
        [-1.8, 0.8, 0.4],
        [1.5, 0.8, 0.3],
        [0.4, 0.9, -1.5],
        [0, 0.5, 2],
        [2, 0.8, -1],
        [-2, 0.8, -1.2],
      ][i] as [number, number, number],
    })),
    clubs: d.clubNames.map((name, i) => ({
      name,
      category: [
        "Discovery",
        "Reading",
        "Sport",
        "Arts",
        "Community",
        "Leadership",
      ][i],
      description: `A sample ${name.toLowerCase()} activity where learners explore an interest, work together and reflect on what they discover.`,
    })),
    achievements: [
      {
        title: "A question worth exploring",
        category: "Learning",
        description:
          "Demo project: a student-led investigation shared at a fictional school discovery showcase.",
      },
      {
        title: "Teamwork in action",
        category: "Sport",
        description:
          "Demo milestone: a collaborative sports challenge celebrating participation and fair play.",
      },
      {
        title: "Ideas made visible",
        category: "Arts",
        description:
          "Demo exhibition: creative projects, performance and reflective student portfolios.",
      },
      {
        title: "Making a small difference",
        category: "Community",
        description:
          "Demo initiative: an illustrated community garden project developed through teamwork.",
      },
    ],
    faqs: [
      {
        q: "Is this a real school?",
        a: "This is a fictional school website template. Campus imagery, staff profiles, metrics and activities are demonstration content.",
      },
      {
        q: "How does the admissions demo work?",
        a: "Choose a grade and preferred campus visit date, then complete the local enquiry form. Nothing is stored or sent to a school.",
      },
      {
        q: "Which documents are shown in the sample process?",
        a: "The example journey lists an age or prior-school record, guardian contact information and relevant transfer documents. A real school must define its own approved requirements.",
      },
      {
        q: "Can I explore without 3D?",
        a: "Yes. Every campus hotspot has an ordinary keyboard-accessible feature button and description. Core information remains available in still-image mode.",
      },
      {
        q: "Are the results, partnerships and teacher credentials verified?",
        a: "No real accreditation, examination ranking, university placement, partnership or qualification is claimed. Staff portraits are generated illustrations of fictional adults.",
      },
    ],
  };
});
export const schoolBySlug = (slug: string) =>
  schools.find((s) => s.slug === slug);
export const schoolFromPath = (path: string) =>
  schoolBySlug(path.match(/^\/education-schools\/([^/]+)/)?.[1] || "");
export const schoolRoutes = [
  "",
  "about",
  "leadership",
  "academics",
  "campus",
  "facilities",
  "faculty",
  "student-life",
  "achievements",
  "gallery",
  "admissions",
  "contact",
  "faq",
];
export function validSchoolPath(s: School, parts: string[]) {
  return (
    parts.length === 0 ||
    (parts.length === 1 && schoolRoutes.includes(parts[0])) ||
    (parts.length === 2 &&
      parts[0] === "academics" &&
      s.programs.some((p) => p.slug === parts[1]))
  );
}
