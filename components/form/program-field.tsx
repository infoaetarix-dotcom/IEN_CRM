'use client';

import { useState } from 'react';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DEGREE_OPTIONS } from '@/lib/form-options';

/**
 * Program = qualification type (degree) + field of study. The two are combined
 * into a single readable string (e.g. "MSc in Computer Science") in a hidden
 * input the form action reads, so no DB change is needed.
 */
export function ProgramField({ error }: { error?: string }) {
  const [degree, setDegree] = useState('');
  const [field, setField] = useState('');

  const combined =
    degree && field
      ? `${degree} in ${field}`
      : degree || field || '';

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
            onChange={(e) => setDegree(e.target.value)}
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
            onChange={(e) => setField(e.target.value)}
            placeholder="Field of study, e.g. Computer Science"
          />
        </div>
      </div>
      <input type="hidden" name="program" value={combined} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
