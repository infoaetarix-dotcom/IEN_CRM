'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateTemplate, type TemplateResult } from '@/app/(admin)/templates/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const initial: TemplateResult = { ok: false };

interface Template {
  key: string;
  name: string;
  subject: string;
  body: string;
  is_auto: boolean;
}

export function TemplateEditor({ template }: { template: Template }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateTemplate, initial);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      router.refresh();
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state.ok, router]);

  return (
    <form
      action={action}
      className="space-y-3 rounded-lg border border-line bg-white p-5"
    >
      <input type="hidden" name="key" value={template.key} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-lg">{template.name}</h3>
          {template.is_auto && <Badge variant="accent">Auto-send</Badge>}
        </div>
        <code className="text-xs text-muted-foreground">{template.key}</code>
      </div>

      <div>
        <Label htmlFor={`name-${template.key}`}>Template name</Label>
        <Input
          id={`name-${template.key}`}
          name="name"
          defaultValue={template.name}
          required
        />
      </div>
      <div>
        <Label htmlFor={`subject-${template.key}`}>Subject</Label>
        <Input
          id={`subject-${template.key}`}
          name="subject"
          defaultValue={template.subject}
          required
        />
      </div>
      <div>
        <Label htmlFor={`body-${template.key}`}>Body</Label>
        <Textarea
          id={`body-${template.key}`}
          name="body"
          defaultValue={template.body}
          rows={5}
          required
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Allowed variables: {'{{full_name}}'}, {'{{program}}'},{' '}
        {'{{target_country}}'}, {'{{institution}}'}
      </p>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        {saved && <span className="text-xs text-emerald-700">Saved.</span>}
      </div>
    </form>
  );
}
