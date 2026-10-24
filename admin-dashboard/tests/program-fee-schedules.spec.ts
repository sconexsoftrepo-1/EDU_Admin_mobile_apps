import { expect, test } from "@playwright/test";
import {
  programFeeSchedules,
  semesterAmounts,
} from "../src/lib/colleges/program-fee-schedules";
import { feeComponents, feeTotals } from "../src/lib/colleges/fees";
import { loadTemplateState } from "../src/lib/colleges/template-api";
import { api } from "../src/services/api";

const programs = [{ code: "MPC", name: "Inter MPC" }];
const heads = [
  { code: "TUITION", name: "Tuition" },
  { code: "ADMISSION", name: "Admission" },
  { code: "LIBRARY", name: "Library" },
];
const years = [{ code: "AY26", name: "2026–27" }];
const base = {
  program_code: "MPC",
  academic_year_code: "AY26",
  semester_number: 1,
  installment_number: 1,
  billing_frequency: "annual",
  currency: "INR",
};
const records = [
  { ...base, code: "FEE-T", fee_head_code: "TUITION", amount: "3500.00" },
  { ...base, code: "FEE-A", fee_head_code: "ADMISSION", amount: "500.00" },
  { ...base, code: "FEE-L", fee_head_code: "LIBRARY", amount: "100.00" },
];

test("saved heads stay together under the course name with their exact amounts", () => {
  const schedules = programFeeSchedules(records, programs, heads, years);
  expect(schedules).toHaveLength(1);
  expect(schedules[0].name).toBe("Inter MPC");
  expect(
    feeComponents(schedules[0]).map((line) => [line.name, line.amount]),
  ).toEqual([
    ["Tuition", 350000],
    ["Admission", 50000],
    ["Library", 10000],
  ]);
  expect(feeTotals(feeComponents(schedules[0]), "not-configured").total).toBe(
    410000,
  );
  expect(schedules[0].feeSchedule?.academicYear).toBe("2026–27");
  expect(schedules[0].feeSchedule?.sourceIds).toEqual([
    "FEE-T",
    "FEE-A",
    "FEE-L",
  ]);
  expect(
    feeComponents(schedules[0]).some((line) => line.name === "University"),
  ).toBe(false);
});

test("different academic years, study years, installments and billing schedules never merge", () => {
  const variants = [
    {},
    { academic_year_code: "AY27" },
    { semester_number: 2 },
    { installment_number: 2 },
    { billing_frequency: "monthly" },
    { program_code: "OTHER" },
  ].map((value, i) => ({ ...records[0], ...value, code: `FEE-${i}` }));
  expect(programFeeSchedules(variants, programs, heads, years)).toHaveLength(6);
});

test("a single recorded amount is not split into hypothetical fee heads", () => {
  const [schedule] = programFeeSchedules([records[0]], programs, heads, years);
  expect(feeComponents(schedule)).toEqual([
    { id: "FEE-T", name: "Tuition", amount: 350000, gstRate: 0 },
  ]);
});

test("decimal and zero amounts remain intact and input rows are not changed", () => {
  const input = [
    { ...records[0], amount: "1234.56" },
    { ...records[1], amount: "0" },
  ];
  const copy = JSON.stringify(input);
  const [schedule] = programFeeSchedules(input, programs, heads, years);
  expect(schedule.components?.map((line) => line.amount)).toEqual([123456, 0]);
  expect(schedule.amount).toBe(123456);
  expect(JSON.stringify(input)).toBe(copy);
});

test("the fee screen resolves missing course/year labels and groups the API rows", async () => {
  const original = {
    screen: api.workspace.screen,
    list: api.workspace.list,
    lookup: api.workspace.lookup,
  };
  api.workspace.screen = async (key) => ({
    key,
    title: "Fees",
    resources: [
      {
        name: "fee_structures",
        title: "Structures",
        path: "/fee_structures",
        fields: [],
        actions: ["view"],
      },
      {
        name: "fee_heads",
        title: "Heads",
        path: "/fee_heads",
        fields: [],
        actions: ["view"],
      },
    ],
  });
  api.workspace.list = async (path) => ({
    items: path === "/fee_heads" ? heads : records,
    total: path === "/fee_heads" ? heads.length : records.length,
    offset: 0,
    limit: 100,
  });
  api.workspace.lookup = async (table) =>
    (table === "programs" ? programs : years).map((row) => ({
      value: row.code,
      label: row.name,
    }));
  try {
    const { state, errors } = await loadTemplateState(
      "edunexa-college",
      [
        {
          key: "fee-structures",
          title: "Fees",
          resources: ["fee_structures", "fee_heads"],
        },
      ],
      "fee-structures",
    );
    expect(errors).toEqual([]);
    expect(state.structures).toHaveLength(1);
    expect(state.structures[0].name).toBe("Inter MPC");
    expect(state.structures[0].amount).toBe(410000);
  } finally {
    Object.assign(api.workspace, original);
  }
});

test("full course keeps its basis and divides saved heads with exact paise", () => {
  const rows = records.map((row) => ({
    ...row,
    fee_basis: "full_course",
    term_count: 4,
    term_due_dates: [null, null, null, null],
  }));
  const [schedule] = programFeeSchedules(rows, programs, heads, years);
  expect(schedule.feeSchedule?.basis).toBe("full_course");
  expect(schedule.feeSchedule?.termCount).toBe(4);
  expect(
    semesterAmounts(
      [2000000, 500000, 350000, 250000, 100000, 200000, 1500000, 1800000],
      4,
    ),
  ).toEqual([1675000, 1675000, 1675000, 1675000]);
  expect(semesterAmounts([101, 101], 4)).toEqual([52, 50, 50, 50]);
});
