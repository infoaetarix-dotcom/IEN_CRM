'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

/** Searchable university combobox — same pattern as LeadPicker, sourced from Settings > Universities. */
export function UniversityPicker({
  universities,
  value,
  onChange,
  placeholder = 'Select a university…',
}: {
  universities: { id: string; name: string; country: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = universities.find((u) => u.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-controls="university-picker-options"
          aria-expanded={open}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="truncate">
            {selected ? `${selected.name} (${selected.country})` : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search universities…" />
          <CommandList id="university-picker-options">
            <CommandEmpty>No university found.</CommandEmpty>
            <CommandGroup>
              {universities.map((u) => (
                <CommandItem
                  key={u.id}
                  value={`${u.name} ${u.country}`}
                  onSelect={() => {
                    onChange(u.id);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">
                    {u.name} <span className="text-muted-foreground">({u.country})</span>
                  </span>
                  {value === u.id && <Check className="ml-auto h-4 w-4 text-tenant-accent" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
