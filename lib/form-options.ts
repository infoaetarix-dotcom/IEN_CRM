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
  { value: 'cgpa_5', label: 'CGPA (out of 5.0)' },
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'other', label: 'Other' },
] as const;

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
export const GRADING_VALUES = GRADING_SYSTEMS.map((g) => g.value);
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
    ...ENGLISH_TESTS,
    ...INTAKE_SEASONS,
    ...FUNDING_SOURCES,
  ].map((o) => [o.value, o.label]),
);
