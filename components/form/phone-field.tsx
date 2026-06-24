'use client';

import { useState } from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import 'react-phone-number-input/style.css';

/**
 * International phone input: searchable country dropdown with flags + per-country
 * digit-length validation via libphonenumber. Stores the value in E.164 format
 * (e.g. +447700900123) in a hidden input the form action reads.
 */
export function PhoneField({
  error,
  defaultCountry = 'PK',
}: {
  error?: string;
  defaultCountry?: string;
}) {
  const [value, setValue] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);

  const invalid = touched && !!value && !isValidPhoneNumber(value);
  const showError = invalid ? 'Enter a valid phone number for the selected country.' : error;

  return (
    <div>
      <PhoneInput
        international
        flags={flags}
        countryCallingCodeEditable={false}
        defaultCountry={defaultCountry as never}
        value={value}
        onChange={setValue}
        onBlur={() => setTouched(true)}
        className="ien-phone"
        numberInputProps={{ className: 'ien-phone-number' }}
      />
      <input type="hidden" name="phone" value={value ?? ''} />
      {showError && <p className="mt-1 text-xs text-destructive">{showError}</p>}
    </div>
  );
}
