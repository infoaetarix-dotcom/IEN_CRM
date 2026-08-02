import { AETARIX } from '@/lib/branding';
import { cn } from '@/lib/utils';

/**
 * Platform attribution. Deliberately quiet: the consultancy's own brand leads
 * their CRM, and Aetarix signs it — the client's staff should always know whose
 * product they're using without it competing with their logo.
 */
export function PoweredByAetarix({
  onDark = false,
  className,
}: {
  onDark?: boolean;
  className?: string;
}) {
  return (
    <a
      href={AETARIX.url}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        'group inline-flex items-center gap-2 transition-opacity hover:opacity-100',
        onDark ? 'opacity-60' : 'opacity-70',
        className,
      )}
    >
      <span
        className={cn(
          'text-[10px] uppercase tracking-[0.16em]',
          onDark ? 'text-paper/70' : 'text-muted-foreground',
        )}
      >
        Powered by
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={onDark ? AETARIX.mark : AETARIX.wordmark}
        alt={AETARIX.name}
        className={cn('w-auto object-contain', onDark ? 'h-5' : 'h-4')}
      />
    </a>
  );
}
