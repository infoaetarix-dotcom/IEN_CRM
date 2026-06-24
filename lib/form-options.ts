// Shared option lists for the public form's structured fields.

export const EDUCATION_OPTIONS = [
  'High school',
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
