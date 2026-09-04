// Shared option lists for the public form's structured fields.
// Categorical fields use {value,label}: `value` is the standardized code stored
// in the DB (and CHECK-constrained), `label` is what the applicant sees.

export const EDUCATION_OPTIONS = [
  'Matric / O-Levels',
  'Intermediate / A-Levels',
  'Diploma',
  "Bachelor's degree",
  "Master's degree",
  'Doctorate (PhD)',
  'Other',
] as const;

// Common qualification types students recognise. "Field of study" is free text.
export const DEGREE_OPTIONS = [
  'Foundation',
  'Diploma',
  'BSc',
  'BA',
  'BEng',
  'BBA',
  'LLB',
  'MSc',
  'MA',
  'MBA',
  'MEng',
  'LLM',
  'PhD',
  'Other',
] as const;

export const GRADING_SYSTEMS = [
  { value: 'cgpa_4', label: 'CGPA (out of 4.0)' },
  { value: 'grade', label: 'Grade' },
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'other', label: 'Other' },
] as const;

// Retired from the dropdown (replaced by 'grade' above) but must stay a
// recognized, labelable value — existing leads may still have it stored.
const LEGACY_GRADING_SYSTEM = { value: 'cgpa_5', label: 'CGPA (out of 5.0)' } as const;

/**
 * Which result field a grading system needs, and how to render it — shared
 * by the public form, Create Query, and the lead editor so the "Result" box
 * swaps to match what was picked (a number for CGPA/Percentage, free text
 * for Grade/Other) instead of one static box for everything. Returns null
 * when nothing's selected yet, so no result field shows at all.
 */
export type GradeResultConfig =
  | { kind: 'number'; name: 'grade_value'; label: string; min: number; max?: number; step: string; placeholder: string }
  | { kind: 'text'; name: 'grade_letter'; label: string; placeholder: string };

// Systems whose result is free text, stored in grade_letter rather than the
// numeric grade_value — shared with the requiredness/clear-on-switch logic
// that needs the same distinction elsewhere.
export const GRADE_LETTER_SYSTEMS = ['grade', 'other'] as const;

export function gradeResultConfig(gradingSystem: string | undefined | null): GradeResultConfig | null {
  switch (gradingSystem) {
    case 'cgpa_4':
      return { kind: 'number', name: 'grade_value', label: 'CGPA', min: 0, max: 4, step: '0.01', placeholder: 'e.g. 3.5' };
    case 'cgpa_5': // legacy — no longer selectable, but an existing lead may still carry it
      return { kind: 'number', name: 'grade_value', label: 'CGPA (out of 5.0)', min: 0, max: 5, step: '0.01', placeholder: 'e.g. 4.2' };
    case 'percentage':
      return { kind: 'number', name: 'grade_value', label: 'Percentage', min: 0, max: 100, step: '0.01', placeholder: 'e.g. 85' };
    case 'grade':
      return { kind: 'text', name: 'grade_letter', label: 'Grade', placeholder: 'e.g. A, A-, B+, First Division' };
    case 'other':
      return { kind: 'text', name: 'grade_letter', label: 'Result', placeholder: 'e.g. Pass, Merit, 3rd year standing' };
    default:
      return null;
  }
}

export const ENGLISH_TESTS = [
  { value: 'ielts', label: 'IELTS' },
  { value: 'toefl', label: 'TOEFL' },
  { value: 'pte', label: 'PTE' },
  { value: 'duolingo', label: 'Duolingo English Test' },
  { value: 'planned', label: 'Planned / booked' },
  { value: 'none', label: 'Not taken yet' },
] as const;

export const INTAKE_SEASONS = [
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'fall', label: 'Fall' },
  { value: 'winter', label: 'Winter' },
] as const;

export const FUNDING_SOURCES = [
  { value: 'self', label: 'Self-funded' },
  { value: 'family', label: 'Family' },
  { value: 'loan', label: 'Bank loan' },
  { value: 'scholarship', label: 'Scholarship' },
  { value: 'employer', label: 'Employer-sponsored' },
  { value: 'other', label: 'Other' },
] as const;

// Value lists for validation (must match the DB CHECK constraints).
// Includes the retired 'cgpa_5' so an existing lead that still has it stays
// valid to save (just not offered as a new choice via GRADING_SYSTEMS).
export const GRADING_VALUES = [...GRADING_SYSTEMS.map((g) => g.value), LEGACY_GRADING_SYSTEM.value];
export const ENGLISH_VALUES = ENGLISH_TESTS.map((t) => t.value);
export const INTAKE_SEASON_VALUES = INTAKE_SEASONS.map((s) => s.value);
export const FUNDING_VALUES = FUNDING_SOURCES.map((f) => f.value);

const CURRENT_YEAR = new Date().getFullYear();
export const PASSING_YEARS = Array.from(
  { length: CURRENT_YEAR + 1 - 1980 + 1 },
  (_, i) => CURRENT_YEAR + 1 - i, // newest first
);
export const INTAKE_YEARS = Array.from(
  { length: 2035 - CURRENT_YEAR + 1 },
  (_, i) => CURRENT_YEAR + i,
);

// Labels for displaying stored codes back in the dashboard.
export const CODE_LABELS: Record<string, string> = Object.fromEntries(
  [
    ...GRADING_SYSTEMS,
    LEGACY_GRADING_SYSTEM,
    ...ENGLISH_TESTS,
    ...INTAKE_SEASONS,
    ...FUNDING_SOURCES,
  ].map((o) => [o.value, o.label]),
);
