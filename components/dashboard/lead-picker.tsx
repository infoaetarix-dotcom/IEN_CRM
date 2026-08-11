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

/** Searchable lead combobox — optional-link (Finance) or required-selection (Applications). */
export function LeadPicker({
  leads,
  value,
  onChange,
  placeholder = 'Not linked to a lead (optional)',
  allowClear = true,
}: {
  leads: { id: string; full_name: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = leads.find((l) => l.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-controls="lead-picker-options"
          aria-expanded={open}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{selected ? selected.full_name : placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search leads…" />
          <CommandList id="lead-picker-options">
            <CommandEmpty>No lead found.</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">Not linked</span>
                  {!value && <Check className="ml-auto h-4 w-4 text-tenant-accent" />}
                </CommandItem>
              )}
              {leads.map((l) => (
                <CommandItem
                  key={l.id}
                  value={l.full_name}
                  onSelect={() => {
                    onChange(l.id);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{l.full_name}</span>
                  {value === l.id && <Check className="ml-auto h-4 w-4 text-tenant-accent" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
