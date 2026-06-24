'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * Date-of-birth picker: click the field → calendar popover with month/year
 * dropdowns (so users can jump back decades quickly). Writes YYYY-MM-DD into a
 * hidden input the form action reads.
 */
export function DobField({ error }: { error?: string }) {
  const [date, setDate] = useState<Date | undefined>();
  const [open, setOpen] = useState(false);

  const now = new Date();
  const value = date ? format(date, 'yyyy-MM-dd') : '';

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-left text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              !date && 'text-muted-foreground',
            )}
          >
            {date ? format(date, 'd MMMM yyyy') : 'Select your date of birth'}
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            captionLayout="dropdown-buttons"
            fromYear={1925}
            toYear={now.getFullYear()}
            defaultMonth={new Date(2000, 0)}
            selected={date}
            onSelect={(d) => {
              setDate(d);
              setOpen(false);
            }}
            disabled={{ after: now }}
          />
        </PopoverContent>
      </Popover>
      <input type="hidden" name="date_of_birth" value={value} />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
