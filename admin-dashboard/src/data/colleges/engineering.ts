/** Fictional, editable engineering curricula; no affiliation or approval is implied. */
export type EngineeringProgram = {
  slug: string;
  name: string;
  department: string;
  duration: string;
  fee: number;
  type: "Diploma" | "B.Tech" | "M.Tech";
  years: number;
  semesters: number;
  branch: string;
  specialization: string;
  lateralEntry: boolean;
};
const branches = [
  ["computer-science", "Computer Science & Engineering", "CSE"],
  ["ai-ml", "Artificial Intelligence & Machine Learning", "AI & ML"],
  ["data-science", "Data Science", "Data Science"],
  ["electronics", "Electronics & Communication Engineering", "ECE"],
  ["electrical", "Electrical & Electronics Engineering", "EEE"],
  ["mechanical", "Mechanical Engineering", "Mechanical"],
  ["civil", "Civil Engineering", "Civil"],
  ["information-technology", "Information Technology", "IT"],
] as const;
const graduate = [
  "Computer Science & Engineering",
  "Artificial Intelligence & Machine Learning",
  "Data Science",
  "VLSI Design",
  "Embedded Systems",
  "Power Systems",
  "Structural Engineering",
  "Thermal Engineering",
  "CAD/CAM",
  "Cyber Security",
];
export const engineeringPrograms: EngineeringProgram[] = [
  ...branches.map(([slug, branch, department]) => ({
    slug,
    name: `B.Tech. ${branch}`,
    department,
    branch,
    specialization: branch,
    type: "B.Tech" as const,
    duration: "4 years",
    years: 4,
    semesters: 8,
    fee: 12500000,
    lateralEntry: true,
  })),
  ...branches
    .filter((_, i) => [0, 3, 4, 5, 6].includes(i))
    .map(([slug, branch, department]) => ({
      slug: `diploma-${slug}`,
      name: `Diploma in ${branch}`,
      department,
      branch,
      specialization: branch,
      type: "Diploma" as const,
      duration: "3 years",
      years: 3,
      semesters: 6,
      fee: 6500000,
      lateralEntry: false,
    })),
  ...graduate.map((branch, i) => ({
    slug: `mtech-${i + 1}`,
    name: `M.Tech. ${branch}`,
    department: [
      "CSE",
      "AI & ML",
      "Data Science",
      "ECE",
      "ECE",
      "EEE",
      "Civil",
      "Mechanical",
      "Mechanical",
      "IT",
    ][i],
    branch,
    specialization: branch,
    type: "M.Tech" as const,
    duration: "2 years",
    years: 2,
    semesters: 4,
    fee: 15000000,
    lateralEntry: false,
  })),
];
export type CourseOffering = {
  id: string;
  program: string;
  semester: number;
  name: string;
  code: string;
  kind: "Class" | "Lab";
  credits: number;
  weeklyHours: number;
  units: string[];
  experiments: string[];
};
const curricula: Record<string, string[]> = {
  CSE: [
    "Programming Fundamentals",
    "Object-Oriented Programming",
    "Data Structures",
    "Database Management Systems",
    "Computer Networks",
    "Operating Systems",
    "Software Engineering",
    "Design and Analysis of Algorithms",
    "Web Technologies",
    "Computer Organization",
    "Discrete Mathematics",
    "Mathematics for Computer Science",
    "Python Programming",
    "Java Programming",
  ],
  "AI & ML": [
    "Python for AI",
    "Mathematics for AI",
    "Artificial Intelligence",
    "Machine Learning",
    "Data Engineering",
    "Neural Networks",
    "Deep Learning",
    "Natural Language Processing",
    "Computer Vision",
  ],
  "Data Science": [
    "Statistics for Data Science",
    "Data Structures",
    "Database Systems",
    "Data Analytics",
    "Data Visualization",
    "Data Mining",
    "Big Data Technologies",
    "Machine Learning",
  ],
  ECE: [
    "Digital Electronics",
    "Analog Circuits",
    "Signals and Systems",
    "Communication Systems",
    "Microprocessors",
    "Embedded Systems",
    "VLSI",
    "Digital Signal Processing",
  ],
  EEE: [
    "Circuit Theory",
    "Electrical Measurements",
    "Electrical Machines",
    "Control Systems",
    "Power Systems",
    "Power Electronics",
    "Renewable Energy Systems",
  ],
  Mechanical: [
    "Engineering Mechanics",
    "Materials Engineering",
    "Thermodynamics",
    "Fluid Mechanics",
    "Manufacturing Processes",
    "Machine Design",
    "CAD/CAM",
    "Heat Transfer",
  ],
  Civil: [
    "Surveying",
    "Concrete Technology",
    "Structural Analysis",
    "Geotechnical Engineering",
    "Transportation Engineering",
    "Environmental Engineering",
    "Construction Management",
  ],
  IT: [
    "Programming",
    "Database Systems",
    "Computer Networks",
    "Web Development",
    "Cloud Computing",
    "Cyber Security",
    "DevOps",
    "Software Testing",
  ],
};
export function engineeringCourses(
  programName: string,
  semester: number,
): CourseOffering[] {
  const p = engineeringPrograms.find((p) => p.name === programName);
  if (!p) return [];
  const pool = curricula[p.department] || curricula.CSE;
  const prefix =
    p.type === "Diploma" ? "DIP" : p.type === "M.Tech" ? "MTE" : "BTE";
  const names = Array.from(
    { length: 4 },
    (_, i) => pool[((semester - 1) * 2 + i) % pool.length],
  );
  if (p.type === "M.Tech") names[0] = `${p.specialization}: advanced methods`;
  return [...names, `${names[0]} Laboratory`].map((name, i) => ({
    id: `${p.slug}-${semester}-${i}`,
    program: p.name,
    semester,
    name,
    code: `${prefix}-${p.department.replace(/\W/g, "").slice(0, 3).toUpperCase()}${semester}${i + 1}0`,
    kind: i === 4 ? "Lab" : "Class",
    credits: i === 4 ? 2 : 3,
    weeklyHours: i === 4 ? 3 : 3,
    units: [
      "Foundations and terminology",
      "Methods and applications",
      "Case studies",
      "Design and implementation",
      "Review and assessment",
    ].map((u) => `${name}: ${u}`),
    experiments:
      i === 4
        ? [
            "Safety and equipment orientation",
            "Guided implementation",
            "Measurement and verification",
            "Independent design task",
          ]
        : [],
  }));
}
/** Small text resources shared by admin and all three mobile roles. */
export function engineeringResources() {
  return engineeringPrograms.flatMap((p) =>
    Array.from({ length: p.semesters }, (_, i) => ({
      id: `skyline-resource-${p.slug}-${i + 1}`,
      name: `${p.name} · Semester ${i + 1} learning guide`,
      status: "Published",
      date: "2026-07-13",
      program: p.name,
      semester: String(i + 1),
      description: `Fictional curriculum. ${engineeringCourses(p.name, i + 1)
        .map(
          (c) =>
            `${c.code} — ${c.name}: ${c.credits} credits; ${c.weeklyHours} weekly hours. ${c.units.join(". ")}. ${c.experiments.join(". ")}`,
        )
        .join("\n\n")}`,
    })),
  );
}
