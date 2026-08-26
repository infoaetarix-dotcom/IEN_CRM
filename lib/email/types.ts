export interface EmailSignature {
  id: string;
  organization_id: string;
  /** null = shared/"Common" signature, usable by anyone in the org. */
  profile_id: string | null;
  title: string;
  body_html: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
