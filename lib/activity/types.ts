export interface ActivityEntry {
  id: string;
  category: string;
  title: string;
  description: string | null;
  activity_date: string;
  created_at: string;
}

/** Common presets shown in the category picker — the field also accepts free text. */
export const ACTIVITY_CATEGORIES = [
  'Instagram',
  'Facebook',
  'LinkedIn',
  'Ad Campaign',
  'SEO / Blog',
  'Website Update',
  'Design',
  'Other',
] as const;
