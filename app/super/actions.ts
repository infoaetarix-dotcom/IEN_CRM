'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';
import { sendTransactionalEmail } from '@/lib/email/brevo';
import { DEFAULT_TEMPLATES } from '@/lib/org/defaults';
import { DEFAULT_THEME_KEY, THEME_LIST, type ThemeKey } from '@/lib/branding/themes';
import { brandFromOrg } from '@/lib/branding';

export interface SuperResult {
  ok: boolean;
  error?: string;
}

const THEME_KEYS = THEME_LIST.map((t) => t.key) as [ThemeKey, ...ThemeKey[]];

const createSchema = z.object({
  name: z.string().trim().min(2, 'Organisation name is required').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, 'Slug: 2–40 lowercase letters, numbers or hyphens'),
  admin_name: z.string().trim().min(2, "Admin's name is required").max(120),
  admin_email: z.string().trim().toLowerCase().email('Valid admin email required'),
  admin_password: z.string().min(8, 'Password must be at least 8 characters'),
  theme_key: z.enum(THEME_KEYS).default(DEFAULT_THEME_KEY),
});

/**
 * Provision a new consultancy: org + enabled modules + seeded templates + its
 * first admin. Super-admin only. All writes via service role after the guard.
 */
export async function createOrganization(
  _prev: SuperResult,
  formData: FormData,
): Promise<SuperResult> {
  const superAdmin = await requireSuperAdmin();

  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    admin_name: formData.get('admin_name'),
    admin_email: formData.get('admin_email'),
    admin_password: formData.get('admin_password'),
    theme_key: formData.get('theme_key') || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }
  const d = parsed.data;
  const modules = formData.getAll('modules').map(String).filter(Boolean);

  const service = createServiceClient();

  // Slug must be unique.
  const { data: existing } = await service
    .from('organizations')
    .select('id')
    .eq('slug', d.slug)
    .maybeSingle();
  if (existing) return { ok: false, error: `Slug "${d.slug}" is already taken.` };

  // 1. Organization
  const { data: org, error: orgErr } = await service
    .from('organizations')
    .insert({ name: d.name, slug: d.slug, theme_key: d.theme_key })
    .select('id')
    .single();
  if (orgErr || !org) {
    return { ok: false, error: orgErr?.message ?? 'Could not create organisation.' };
  }
  const orgId = org.id as string;

  // 2. Modules (package)
  if (modules.length) {
    await service.from('organization_modules').insert(
      modules.map((m) => ({ organization_id: orgId, module_key: m })),
    );
  }

  // 3. Seed email templates for this org
  await service.from('email_templates').insert(
    DEFAULT_TEMPLATES.map((t) => ({ ...t, organization_id: orgId })),
  );

  // 4. First admin
  const { data: user, error: userErr } = await service.auth.admin.createUser({
    email: d.admin_email,
    password: d.admin_password,
    email_confirm: true,
    user_metadata: { full_name: d.admin_name },
  });
  if (userErr || !user.user) {
    // Roll back the org so we don't leave a half-created tenant.
    await service.from('organizations').delete().eq('id', orgId);
    return { ok: false, error: userErr?.message ?? 'Could not create the admin user.' };
  }
  await service
    .from('profiles')
    .update({ role: 'admin', full_name: d.admin_name, organization_id: orgId })
    .eq('id', user.user.id);

  await writeAuditLog({
    actorId: superAdmin.id,
    organizationId: orgId,
    action: 'org_change',
    entity: 'organization',
    entityId: orgId,
    metadata: { created: true, slug: d.slug, modules },
  });

  revalidatePath('/super');
  return { ok: true };
}

/** Suspend or reactivate a consultancy. */
export async function setOrgStatus(
  orgId: string,
  status: 'active' | 'suspended',
): Promise<SuperResult> {
  const superAdmin = await requireSuperAdmin();
  const service = createServiceClient();
  const { error } = await service
    .from('organizations')
    .update({ status })
    .eq('id', orgId);
  if (error) return { ok: false, error: 'Could not update status.' };

  await writeAuditLog({
    actorId: superAdmin.id,
    organizationId: orgId,
    action: 'org_change',
    entity: 'organization',
    entityId: orgId,
    metadata: { status },
  });
  revalidatePath('/super');
  revalidatePath(`/super/orgs/${orgId}`);
  return { ok: true };
}

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const LOGO_MAX_BYTES = 1024 * 1024; // 1 MB — logos are small; caps abuse.

/**
 * Upload a consultancy's logo to the public `org-logos` bucket and point the
 * org row at it. Super-admin only (Aetarix onboards each client), so uploads
 * run through the service role and a tenant can never touch another's asset.
 */
export async function uploadOrgLogo(
  orgId: string,
  formData: FormData,
): Promise<SuperResult> {
  const superAdmin = await requireSuperAdmin();

  const file = formData.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a logo file to upload.' };
  }
  if (!LOGO_TYPES.includes(file.type)) {
    return { ok: false, error: 'Use a PNG, JPEG, WEBP or SVG image.' };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: 'Logo must be under 1 MB.' };
  }

  const service = createServiceClient();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  // Unique path per upload so a CDN can't keep serving the previous logo.
  const path = `${orgId}/${Date.now()}.${ext}`;

  const { error: upErr } = await service.storage
    .from('org-logos')
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) {
    // Surface the real Supabase error (e.g. "Bucket not found" means
    // migration 0007_org_branding.sql — which creates the org-logos bucket —
    // hasn't been run against this project yet) instead of a generic message.
    return { ok: false, error: `Upload failed: ${upErr.message}` };
  }

  const {
    data: { publicUrl },
  } = service.storage.from('org-logos').getPublicUrl(path);

  const { error } = await service
    .from('organizations')
    .update({ logo_url: publicUrl })
    .eq('id', orgId);
  if (error) return { ok: false, error: 'Could not save the logo.' };

  await writeAuditLog({
    actorId: superAdmin.id,
    organizationId: orgId,
    action: 'org_change',
    entity: 'organization',
    entityId: orgId,
    metadata: { logo_uploaded: path },
  });

  revalidatePath(`/super/orgs/${orgId}`);
  revalidatePath('/super');
  return { ok: true };
}

/** Change a consultancy's color theme (admin panel, login, password pages). */
export async function setOrgTheme(
  orgId: string,
  themeKey: string,
): Promise<SuperResult> {
  const superAdmin = await requireSuperAdmin();
  const parsed = z.enum(THEME_KEYS).safeParse(themeKey);
  if (!parsed.success) return { ok: false, error: 'Unknown theme.' };

  const service = createServiceClient();
  const { error } = await service
    .from('organizations')
    .update({ theme_key: parsed.data })
    .eq('id', orgId);
  if (error) return { ok: false, error: 'Could not save the theme.' };

  await writeAuditLog({
    actorId: superAdmin.id,
    organizationId: orgId,
    action: 'org_change',
    entity: 'organization',
    entityId: orgId,
    metadata: { theme_key: parsed.data },
  });

  revalidatePath(`/super/orgs/${orgId}`);
  return { ok: true };
}

/** Set a consultancy's full public-facing name (consent text, emails). */
export async function updateOrgLegalName(
  orgId: string,
  legalName: string,
): Promise<SuperResult> {
  const superAdmin = await requireSuperAdmin();
  const parsed = z.string().trim().min(2).max(160).safeParse(legalName);
  if (!parsed.success) return { ok: false, error: 'Enter a valid name.' };

  const service = createServiceClient();
  const { error } = await service
    .from('organizations')
    .update({ legal_name: parsed.data })
    .eq('id', orgId);
  if (error) return { ok: false, error: 'Could not save the name.' };

  await writeAuditLog({
    actorId: superAdmin.id,
    organizationId: orgId,
    action: 'org_change',
    entity: 'organization',
    entityId: orgId,
    metadata: { legal_name: parsed.data },
  });
  revalidatePath(`/super/orgs/${orgId}`);
  return { ok: true };
}

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(255)
  .refine(
    (v) =>
      v === '' ||
      /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(v),
    { message: 'Enter a valid domain, e.g. form.yourdomain.com' },
  );

/** Does any *other* org already claim this domain, on either field? */
async function domainClaimedByAnotherOrg(
  service: ReturnType<typeof createServiceClient>,
  domain: string,
  excludeOrgId: string,
): Promise<boolean> {
  const [{ data: a }, { data: b }] = await Promise.all([
    service.from('organizations').select('id').eq('form_domain', domain).neq('id', excludeOrgId).maybeSingle(),
    service.from('organizations').select('id').eq('portal_domain', domain).neq('id', excludeOrgId).maybeSingle(),
  ]);
  return !!a || !!b;
}

/**
 * Set a consultancy's dedicated form and/or portal domain. Super-admin only
 * — the domain itself must also be added to the Vercel project (Settings →
 * Domains) with its DNS CNAME pointed at Vercel, or requests to it will
 * never reach this app; see docs/FORM_SUBDOMAIN.md. Pass '' to clear either.
 */
export async function setOrgDomains(
  orgId: string,
  formDomain: string,
  portalDomain: string,
): Promise<SuperResult> {
  const superAdmin = await requireSuperAdmin();

  const fParsed = domainSchema.safeParse(formDomain);
  if (!fParsed.success) return { ok: false, error: `Form domain: ${fParsed.error.issues[0]!.message}` };
  const pParsed = domainSchema.safeParse(portalDomain);
  if (!pParsed.success) return { ok: false, error: `Portal domain: ${pParsed.error.issues[0]!.message}` };

  const form_domain = fParsed.data || null;
  const portal_domain = pParsed.data || null;
  if (form_domain && form_domain === portal_domain) {
    return { ok: false, error: 'Form and portal domains must be different.' };
  }

  const service = createServiceClient();

  if (form_domain && (await domainClaimedByAnotherOrg(service, form_domain, orgId))) {
    return { ok: false, error: `"${form_domain}" is already in use by another consultancy.` };
  }
  if (portal_domain && (await domainClaimedByAnotherOrg(service, portal_domain, orgId))) {
    return { ok: false, error: `"${portal_domain}" is already in use by another consultancy.` };
  }

  const { error } = await service
    .from('organizations')
    .update({ form_domain, portal_domain })
    .eq('id', orgId);
  if (error) return { ok: false, error: 'Could not save the domains.' };

  await writeAuditLog({
    actorId: superAdmin.id,
    organizationId: orgId,
    action: 'org_change',
    entity: 'organization',
    entityId: orgId,
    metadata: { form_domain, portal_domain },
  });

  revalidatePath(`/super/orgs/${orgId}`);
  return { ok: true };
}

/** Enable or disable a module for a consultancy (packaging). */
export async function toggleModule(
  orgId: string,
  moduleKey: string,
  enabled: boolean,
): Promise<SuperResult> {
  const superAdmin = await requireSuperAdmin();
  const service = createServiceClient();
  const { error } = await service.from('organization_modules').upsert(
    { organization_id: orgId, module_key: moduleKey, enabled },
    { onConflict: 'organization_id,module_key' },
  );
  if (error) return { ok: false, error: 'Could not update module.' };

  await writeAuditLog({
    actorId: superAdmin.id,
    organizationId: orgId,
    action: 'module_change',
    entity: 'organization',
    entityId: orgId,
    metadata: { module: moduleKey, enabled },
  });
  revalidatePath(`/super/orgs/${orgId}`);
  return { ok: true };
}

/**
 * Send a staff member a password-reset link. Super-admin only — staff no
 * longer have self-service "forgot password" (README-noted security
 * decision), so this is the sole way anyone regains access. Reuses the same
 * mechanism the old self-service flow used: a link minted with the admin API
 * and delivered through our own Brevo transport, landing on /auth/confirm →
 * /update-password.
 */
export async function sendPasswordReset(
  userId: string,
  orgId: string,
): Promise<SuperResult> {
  const superAdmin = await requireSuperAdmin();
  const service = createServiceClient();

  const { data: userRes, error: userErr } = await service.auth.admin.getUserById(userId);
  if (userErr || !userRes.user?.email) {
    return { ok: false, error: 'Could not find that user.' };
  }
  const email = userRes.user.email;
  const name = (userRes.user.user_metadata?.full_name as string | undefined) ?? '';

  // The requesting org's own name — this email must never look like it came
  // from a different (or default) tenant.
  const { data: orgRow } = await service
    .from('organizations')
    .select('name, legal_name')
    .eq('id', orgId)
    .single();
  const orgName = orgRow ? brandFromOrg(orgRow).legalName : 'your organization';

  const { data, error } = await service.auth.admin.generateLink({
    type: 'recovery',
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    return { ok: false, error: 'Could not generate a reset link.' };
  }

  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${h.get('host')}`;
  const link = `${origin}/auth/confirm?token_hash=${encodeURIComponent(
    tokenHash,
  )}&type=recovery&next=${encodeURIComponent('/update-password')}`;

  try {
    await sendTransactionalEmail({
      to: email,
      toName: name || undefined,
      subject: `Reset your ${orgName} CRM password`,
      senderName: orgRow ? orgName : undefined,
      body: `${name ? `Hi ${name.split(' ')[0]},` : 'Hello,'}

An administrator has started a password reset for your ${orgName} CRM account.

Open this link to choose a new password:
${link}

This link can only be used once and expires shortly. If you weren't expecting this, contact your administrator before using it.`,
    });
  } catch {
    return { ok: false, error: 'Could not send the email.' };
  }

  await writeAuditLog({
    actorId: superAdmin.id,
    organizationId: orgId,
    action: 'password_reset_sent',
    entity: 'profile',
    entityId: userId,
    metadata: { email },
  });

  return { ok: true };
}
