'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';

export interface TemplateResult {
  ok: boolean;
  error?: string;
}

const schema = z.object({
  key: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
});

/** Update an email template (admin only; RLS templates_write is the backstop). */
export async function updateTemplate(
  _prev: TemplateResult,
  formData: FormData,
): Promise<TemplateResult> {
  const admin = await requireRole('admin');
  const parsed = schema.safeParse({
    key: formData.get('key'),
    name: formData.get('name'),
    subject: formData.get('subject'),
    body: formData.get('body'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('email_templates')
    .update({
      name: parsed.data.name,
      subject: parsed.data.subject,
      body: parsed.data.body,
      updated_at: new Date().toISOString(),
    })
    .eq('key', parsed.data.key);
  if (error) return { ok: false, error: 'Could not save template.' };

  await writeAuditLog({
    actorId: admin.id,
    action: 'profile_change',
    entity: 'profile',
    entityId: null,
    metadata: { template: parsed.data.key, updated: true },
  });

  revalidatePath('/templates');
  return { ok: true };
}
