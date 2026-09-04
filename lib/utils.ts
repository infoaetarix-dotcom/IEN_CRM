import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * True when rich-text HTML (from RichTextEditor) has no real content — a
 * cleared editor still emits "<p></p>", not "", so a plain .trim() check
 * never sees it as empty.
 */
export function isBlankHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim().length === 0;
}

/** Compute integer age from an ISO date-of-birth string (YYYY-MM-DD). */
export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}
