import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { initialsFrom } from '@/lib/branding';

/** Initials (or a group icon) with an optional green "online" dot. */
export function Avatar({
  name,
  group = false,
  online = false,
  size = 'md',
}: {
  name: string;
  group?: boolean;
  online?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <span className={cn('relative flex flex-none', size === 'md' ? 'h-11 w-11' : 'h-8 w-8')}>
      <span
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full font-semibold',
          group ? 'bg-tenant-ink/10 text-tenant-ink' : 'bg-tenant-accent/15 text-tenant-accent',
          size === 'md' ? 'text-sm' : 'text-xs',
        )}
      >
        {group ? <Users className={size === 'md' ? 'h-5 w-5' : 'h-4 w-4'} /> : initialsFrom(name)}
      </span>
      {online && (
        <span
          aria-label="Online"
          className={cn(
            'absolute bottom-0 right-0 rounded-full bg-emerald-500 ring-2 ring-white',
            size === 'md' ? 'h-3 w-3' : 'h-2.5 w-2.5',
          )}
        />
      )}
    </span>
  );
}
