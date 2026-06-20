import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { TemplateEditor } from '@/components/dashboard/template-editor';

export const metadata = { title: 'Email templates — IEN CRM' };

export default async function TemplatesPage() {
  await requireRole('admin');
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from('email_templates')
    .select('key, name, subject, body, is_auto')
    .order('is_auto', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <p className="label-eyebrow">Email</p>
        <h1 className="font-serif text-2xl">Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit the messages staff send to leads. The “welcome” template sends
          automatically on every new application.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {(templates ?? []).map((t) => (
          <TemplateEditor key={t.key} template={t} />
        ))}
      </div>
    </div>
  );
}
