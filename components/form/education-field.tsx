'use client';

import { useState } from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { EDUCATION_OPTIONS } from '@/lib/form-options';

/**
 * Highest education select. Choosing "Other" reveals a free-text box; the final
 * value (selected label or the typed text) goes into the hidden input.
 */
export function EducationField({ error }: { error?: string }) {
  const [choice, setChoice] = useState('');
  const [custom, setCustom] = useState('');

  const isOther = choice === 'Other';
  const value = isOther ? custom : choice;

  return (
    <div className="space-y-2">
      <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
        <option value="">Select a level</option>
        {EDUCATION_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
      {isOther && (
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Please specify your highest education"
          aria-label="Specify highest education"
        />
      )}
      <input type="hidden" name="highest_education" value={value} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
