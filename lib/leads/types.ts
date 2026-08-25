/** Mirrors ApplicationDocument (lib/applications/types.ts) for the parallel lead_documents table. */
export interface LeadDocument {
  id: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_by_lead: boolean;
  created_at: string;
}
