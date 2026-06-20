import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Native checkbox styled with the accent color. Used for the consent gate;
 * uncontrolled so it posts naturally with the form.
 */
const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type'>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'h-4 w-4 shrink-0 rounded border-input text-accent accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
Checkbox.displayName = 'Checkbox';

export { Checkbox };
