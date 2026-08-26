import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { EmailSignature } from '@/lib/email/types';

const SIGNATURE_COLUMNS = 'id, organization_id, profile_id, title, body_html, is_default, created_by, created_at, updated_at';

/** Everything a sender may pick from: their own personal signatures + every shared/"Common" signature in the org. */
export async function getSignaturesForSender(
  organizationId: string,
  profileId: string,
): Promise<EmailSignature[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('email_signatures')
    .select(SIGNATURE_COLUMNS)
    .eq('organization_id', organizationId)
    .or(`profile_id.eq.${profileId},profile_id.is.null`)
    .order('title');
  return data ?? [];
}

/**
 * The org's default shared signature — used for automated emails (the
 * welcome auto-confirmation isn't sent by any specific staff member) and as
 * SendEmailDialog's fallback when the sender has no personal default of
 * their own. Uses the service-role client since this is also called from
 * contexts that already run on it (createQuery, the public apply wizard).
 */
export async function getDefaultSharedSignature(organizationId: string): Promise<EmailSignature | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('email_signatures')
    .select(SIGNATURE_COLUMNS)
    .eq('organization_id', organizationId)
    .is('profile_id', null)
    .eq('is_default', true)
    .maybeSingle();
  return data ?? null;
}

/**
 * Re-resolves a client-supplied signatureId server-side, scoped to exactly
 * what that sender is allowed to use. The security boundary for signatures:
 * a send action never trusts raw HTML from the client, only an id it looks
 * up itself — the worst a tampered request can do is pick an already-saved,
 * already-vetted signature, never inject fresh markup into an outgoing email.
 */
export async function getSignatureForSend(
  organizationId: string,
  profileId: string,
  signatureId: string,
): Promise<EmailSignature | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('email_signatures')
    .select(SIGNATURE_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('id', signatureId)
    .or(`profile_id.eq.${profileId},profile_id.is.null`)
    .maybeSingle();
  return data ?? null;
}

const ALLOWED_TAGS = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'span', 'div']);
const ALLOWED_ATTRS = new Set(['href', 'style', 'target', 'rel']);
const UNSAFE_HREF = /^\s*(javascript|data):/i;

/**
 * Defense-in-depth, not the primary safeguard — the rich text editor's own
 * constrained TipTap extension set already can't produce markup outside
 * this tag/attribute set. This is a backstop against a future extension
 * being added without re-auditing that assumption, or any write path that
 * doesn't go through the editor UI at all. Matches this codebase's
 * dependency-light convention (bare fetch instead of SDKs) rather than
 * pulling in a sanitizer package for a tightly-scoped tag set this small.
 */
export function sanitizeSignatureHtml(html: string): string {
  return html.replace(/<\/?([a-zA-Z0-9]+)((?:\s+[^<>]*)?)>/g, (match, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    const closing = match.startsWith('</');
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (closing) return `</${tag}>`;

    const attrs: string[] = [];
    const attrRe = /([a-zA-Z-]+)\s*=\s*"([^"]*)"/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRe.exec(rawAttrs))) {
      const name = attrMatch[1]!.toLowerCase();
      const value = attrMatch[2]!;
      if (!ALLOWED_ATTRS.has(name)) continue;
      if (name === 'href' && UNSAFE_HREF.test(value)) continue;
      attrs.push(`${name}="${value}"`);
    }
    return attrs.length ? `<${tag} ${attrs.join(' ')}>` : `<${tag}>`;
  });
}
