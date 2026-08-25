export type NotificationType =
  | 'new_lead'
  | 'document_uploaded'
  | 'lead_document_uploaded'
  | 'note_added';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
