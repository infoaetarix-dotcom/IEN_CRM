import { describe, it, expect } from 'vitest';
import { isBlankHtml } from '@/lib/utils';

describe('isBlankHtml', () => {
  it('treats an empty string as blank', () => {
    expect(isBlankHtml('')).toBe(true);
  });

  it("treats TipTap's empty-editor output as blank", () => {
    expect(isBlankHtml('<p></p>')).toBe(true);
  });

  it('treats whitespace-only content as blank', () => {
    expect(isBlankHtml('<p>   </p>')).toBe(true);
  });

  it('is not blank once there is real text', () => {
    expect(isBlankHtml('<p>Hello</p>')).toBe(false);
  });

  it('is not blank for a list with only tags around real content', () => {
    expect(isBlankHtml('<ul><li>Item one</li></ul>')).toBe(false);
  });
});
