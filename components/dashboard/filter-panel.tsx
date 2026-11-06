'use client';

import { useEffect, useRef, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * The list search box. The page HTML (and this input) is on screen before
 * React has hydrated it, so anything typed in that gap (slow phones) never
 * fired onChange. On hydrate we pick up whatever is already in the box and
 * search for it.
 */
export function FilterSearch({
  value,
  onSearch,
  label,
  placeholder,
}: {
  value: string;
  onSearch: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const typed = ref.current?.value ?? '';
    if (typed !== value) onSearch(typed);
    // Mount only: afterwards onChange takes over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        defaultValue={value}
        placeholder={placeholder}
        aria-label={label}
        className="pl-9"
        onChange={(e) => onSearch(e.target.value)}
      />
    </>
  );
}

/**
 * Responsive shell for a list page's filters (leads, applications).
 *
 * Phones: the search box plus a "Filters (n)" button; tapping it opens the
 * filters as a two-column grid of equal-width controls. Tablet and up: the
 * filter group dissolves (`sm:contents`) into one wrapping row with the
 * search box, as before. Controls inside should use `w-full sm:w-[…]` so
 * they fill a grid cell on phones; anything that should span both columns
 * (dates, "Clear filters") adds `col-span-2`.
 */
export function FilterPanel({
  search,
  activeCount,
  children,
}: {
  search: React.ReactNode;
  activeCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-2 sm:gap-3">
      <div className="relative min-w-0 flex-1 sm:min-w-[220px]">{search}</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="list-filters"
        className={cn(
          'inline-flex h-10 flex-none items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors sm:hidden',
          open || activeCount
            ? 'border-tenant-accent bg-tenant-accent/10 text-tenant-accent'
            : 'border-input bg-white text-tenant-ink',
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters{activeCount ? ` (${activeCount})` : ''}
      </button>
      <div
        id="list-filters"
        className={cn('w-full grid-cols-2 gap-2 sm:contents', open ? 'grid' : 'hidden')}
      >
        {children}
      </div>
    </div>
  );
}
