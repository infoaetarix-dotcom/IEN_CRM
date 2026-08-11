export interface ApplicationDocument {
  id: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}
