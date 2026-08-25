'use client';

import { useState } from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEGREE_OPTIONS } from '@/lib/form-options';

/** Reverse the "{degree} in {field}" composition below, for editing an existing value. */
export function splitProgram(value: string): { degree: string; field: string } {
  if (!value) return { degree: '', field: '' };
  const idx = value.indexOf(' in ');
  if (idx > -1) {
    const maybeDegree = value.slice(0, idx);
    if ((DEGREE_OPTIONS as readonly string[]).includes(maybeDegree)) {
      return { degree: maybeDegree, field: value.slice(idx + 4) };
    }
  }
  if ((DEGREE_OPTIONS as readonly string[]).includes(value)) {
    return { degree: value, field: '' };
  }
  // Doesn't match the composed shape (e.g. older freeform data) — keep it
  // fully visible and editable rather than silently dropping it.
  return { degree: '', field: value };
}

/**
 * Program = qualification type (degree) + field of study. The two are combined
 * into a single readable string (e.g. "MSc in Computer Science") — written to
 * a hidden input for a plain form submission (create query), or reported via
 * `onChange` for a controlled parent (the lead editor) that holds its own
 * `program` state instead of submitting a native form.
 */
export function ProgramField({
  error,
  defaultDegree = '',
  defaultField = '',
  onChange,
}: {
  error?: string;
  defaultDegree?: string;
  defaultField?: string;
  onChange?: (combined: string) => void;
}) {
  const [degree, setDegree] = useState(defaultDegree);
  const [field, setField] = useState(defaultField);

  const combine = (d: string, f: string) => (d && f ? `${d} in ${f}` : d || f || '');
  const combined = combine(degree, field);

  // Report the freshly-combined value synchronously within the same handler
  // that updates local state, rather than via a useEffect watching
  // `combined` — that introduced a one-render-cycle lag between typing and
  // the parent's state actually updating, which a save fired quickly enough
  // after the last keystroke could race ahead of.
  function handleDegreeChange(v: string) {
    setDegree(v);
    onChange?.(combine(v, field));
  }
  function handleFieldChange(v: string) {
    setField(v);
    onChange?.(combine(degree, v));
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
        <div>
          <Label htmlFor="program_degree" className="sr-only">
            Qualification type
          </Label>
          <Select
            id="program_degree"
            value={degree}
            onChange={(e) => handleDegreeChange(e.target.value)}
          >
            <option value="">Qualification</option>
            {DEGREE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="program_field" className="sr-only">
            Field of study
          </Label>
          <Input
            id="program_field"
            value={field}
            onChange={(e) => handleFieldChange(e.target.value)}
            placeholder="e.g. Computer Science"
          />
        </div>
      </div>
      <input type="hidden" name="program" value={combined} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
