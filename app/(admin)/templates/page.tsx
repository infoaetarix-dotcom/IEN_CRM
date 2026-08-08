import { Mail } from 'lucide-react';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { TemplateEditor } from '@/components/dashboard/template-editor';

export const metadata = { title: 'Email templates — CRM' };

export default async function TemplatesPage() {
  await requireRole('admin');
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from('email_templates')
    .select('key, name, subject, body, is_auto')
    .order('is_auto', { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Mail}
        title="Templates"
        subtitle={'Edit the messages staff send to leads. The “welcome” template sends automatically on every new application.'}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {(templates ?? []).map((t) => (
          <TemplateEditor key={t.key} template={t} />
        ))}
      </div>
    </div>
  );
}
