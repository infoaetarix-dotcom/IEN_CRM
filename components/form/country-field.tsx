'use client';

import { useMemo, useState } from 'react';
import { getCountries } from 'react-phone-number-input';
import labels from 'react-phone-number-input/locale/en.json';
import flags from 'react-phone-number-input/flags';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

type Country = { code: string; name: string };

/**
 * Searchable country dropdown with SVG flags (renders on every OS, unlike emoji
 * flags). Stores the chosen country NAME in a hidden input for the form action.
 */
export function CountryField({
  error,
  name = 'target_country',
  placeholder = 'Select a country',
}: {
  error?: string;
  name?: string;
  placeholder?: string;
}) {
  const countries = useMemo<Country[]>(
    () =>
      getCountries()
        .map((code) => ({
          code,
          name: (labels as Record<string, string>)[code] ?? code,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Country | null>(null);

  const Flag = selected
    ? (flags as Record<string, React.ComponentType<{ title?: string }>>)[
        selected.code
      ]
    : null;

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-controls="country-options"
            aria-expanded={open}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              !selected && 'text-muted-foreground',
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {Flag && (
                <span className="h-3.5 w-5 overflow-hidden rounded-sm">
                  <Flag title={selected!.name} />
                </span>
              )}
              {selected ? selected.name : placeholder}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search country…" />
            <CommandList id="country-options">
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {countries.map((c) => {
                  const ItemFlag = (
                    flags as Record<
                      string,
                      React.ComponentType<{ title?: string }>
                    >
                  )[c.code];
                  return (
                    <CommandItem
                      key={c.code}
                      value={c.name}
                      onSelect={() => {
                        setSelected(c);
                        setOpen(false);
                      }}
                    >
                      {ItemFlag && (
                        <span className="h-3.5 w-5 shrink-0 overflow-hidden rounded-sm">
                          <ItemFlag title={c.name} />
                        </span>
                      )}
                      <span className="truncate">{c.name}</span>
                      {selected?.code === c.code && (
                        <Check className="ml-auto h-4 w-4 text-accent" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={selected?.name ?? ''} />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
