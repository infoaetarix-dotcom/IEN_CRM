import { describe, it, expect } from 'vitest';
import { renderTemplate } from '@/lib/email/brevo';

describe('renderTemplate (allow-list interpolation)', () => {
  it('fills allowed variables', () => {
    const out = renderTemplate('Hi {{full_name}}, studying in {{target_country}}?', {
      full_name: 'Asha',
      target_country: 'Canada',
    });
    expect(out).toBe('Hi Asha, studying in Canada?');
  });

  it('treats missing allowed vars as empty', () => {
    expect(renderTemplate('Hi {{full_name}}', {})).toBe('Hi ');
  });

  it('leaves unknown/unsafe placeholders untouched', () => {
    // A variable NOT on the allow-list must not be interpolated.
    const out = renderTemplate('{{password}} {{full_name}}', {
      full_name: 'Asha',
    });
    expect(out).toBe('{{password}} Asha');
  });

  it('handles whitespace inside braces', () => {
    expect(renderTemplate('Hi {{ full_name }}', { full_name: 'Bo' })).toBe('Hi Bo');
  });
});
