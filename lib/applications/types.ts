export interface ApplicationDocument {
  id: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_by_student: boolean;
  created_at: string;
}

/** How long a freshly generated/regenerated student upload link stays valid. */
export const UPLOAD_LINK_TTL_DAYS = 30;

export interface ApplicationFormValues {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  city: string;
  district: string;
  target_country: string;
  /** Which university (Settings > Universities) this application is for — required. */
  university_id: string;
  program: string;
  intake_season: string;
  intake_year: string;
  highest_education: string;
  last_qualification: string;
  prior_institution: string;
  passing_year: string;
  grading_system: string;
  grade_value: string;
  work_experience_years: string;
  work_experience_detail: string;
  english_test: string;
  english_score: string;
  funding_source: string;
  prior_rejection: boolean;
  prior_rejection_detail: string;
  passport_number: string;
  status: string;
}

const str = (v: unknown) => (v == null ? '' : String(v));

/** Maps a raw `leads` row onto application form defaults — shared by the
 *  /applications/new page and the create-application dialog's lead-picker step. */
export function leadToApplicationDefaults(lead: Record<string, unknown>): ApplicationFormValues {
  return {
    full_name: str(lead.full_name),
    email: str(lead.email),
    phone: str(lead.phone),
    date_of_birth: lead.date_of_birth ? str(lead.date_of_birth).slice(0, 10) : '',
    city: str(lead.city),
    district: str(lead.district),
    target_country: str(lead.target_country),
    // Leads have no university concept — that's specific to a formal
    // application, always chosen fresh when one is created.
    university_id: '',
    program: str(lead.program),
    intake_season: str(lead.intake_season),
    intake_year: str(lead.intake_year),
    highest_education: str(lead.highest_education),
    last_qualification: str(lead.last_qualification),
    prior_institution: str(lead.prior_institution),
    passing_year: str(lead.passing_year),
    grading_system: str(lead.grading_system),
    grade_value: str(lead.grade_value),
    work_experience_years: str(lead.work_experience_years),
    work_experience_detail: str(lead.work_experience_detail),
    english_test: str(lead.english_test),
    english_score: str(lead.english_score),
    funding_source: str(lead.funding_source),
    prior_rejection: lead.prior_rejection === true,
    prior_rejection_detail: str(lead.prior_rejection_detail),
    passport_number: '',
    status: 'new',
  };
}
