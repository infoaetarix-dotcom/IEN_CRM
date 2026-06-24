'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DayPicker,
  useNavigation,
  type CaptionProps,
} from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/select';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const FROM_YEAR = 1925;
const TO_YEAR = new Date().getFullYear();
const YEARS = Array.from(
  { length: TO_YEAR - FROM_YEAR + 1 },
  (_, i) => TO_YEAR - i, // newest first — DOB users scroll down a little
);

/** Custom caption: clean month + year dropdowns with prev/next arrows. */
function CalendarCaption({ displayMonth }: CaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useNavigation();
  const month = displayMonth.getMonth();
  const year = displayMonth.getFullYear();

  return (
    <div className="flex items-center gap-1.5 px-1 pb-3">
      <button
        type="button"
        aria-label="Previous month"
        disabled={!previousMonth}
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted-foreground hover:bg-secondary disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <Select
        aria-label="Month"
        value={month}
        onChange={(e) => goToMonth(new Date(year, Number(e.target.value)))}
        className="h-8 flex-1"
      >
        {MONTHS.map((m, i) => (
          <option key={m} value={i}>
            {m}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Year"
        value={year}
        onChange={(e) => goToMonth(new Date(Number(e.target.value), month))}
        className="h-8 w-[88px]"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>

      <button
        type="button"
        aria-label="Next month"
        disabled={!nextMonth}
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted-foreground hover:bg-secondary disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col',
        month: 'flex flex-col gap-1',
        table: 'w-full border-collapse',
        head_row: 'flex',
        head_cell:
          'text-muted-foreground rounded-md w-9 font-normal text-[0.75rem]',
        row: 'flex w-full mt-1',
        cell: 'h-9 w-9 text-center text-sm p-0 relative',
        day: 'inline-flex h-9 w-9 items-center justify-center rounded-md p-0 text-sm font-normal hover:bg-secondary aria-selected:opacity-100',
        day_selected:
          'bg-accent text-white hover:bg-accent hover:text-white focus:bg-accent focus:text-white',
        day_today: 'border border-accent/60 text-accent',
        day_outside: 'text-muted-foreground/50',
        day_disabled: 'text-muted-foreground/40 hover:bg-transparent cursor-not-allowed',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{ Caption: CalendarCaption }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
