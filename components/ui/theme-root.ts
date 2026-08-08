'use client';

import { useEffect, useState } from 'react';

/**
 * Radix portals content straight to document.body by default, which escapes
 * any DOM subtree that sets the --tenant-* theme CSS variables (see
 * app/(admin)/layout.tsx and the public /{slug}/apply page). Auto-detecting
 * the themed wrapper (#tenant-theme-root) and portaling into *that* instead
 * keeps every dialog/popover correctly themed, with zero per-caller wiring.
 * Contexts with no such element (e.g. the fixed Aetarix /super console) find
 * nothing and fall back to Radix's normal document.body behavior, unaffected.
 */
export function useThemeRootContainer() {
  const [container, setContainer] = useState<HTMLElement | undefined>(undefined);
  useEffect(() => {
    setContainer(document.getElementById('tenant-theme-root') ?? undefined);
  }, []);
  return container;
}
