'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';

// Same shape Zod enforces server-side: something@something.tld
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email input with inline validation on blur — flags a missing "@" or malformed
 * address before submit, mirroring the phone field's UX. The server re-validates.
 */
export function EmailField({ error }: { error?: string }) {
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);

  const invalid = touched && value.length > 0 && !EMAIL_RE.test(value);
  const showError = invalid
    ? 'Enter a valid email address (e.g. you@example.com)'
    : error;

  return (
    <div>
      <Input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        placeholder="you@example.com"
        autoComplete="email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={invalid || undefined}
        required
      />
      {showError && <p className="mt-1 text-xs text-destructive">{showError}</p>}
    </div>
  );
}
