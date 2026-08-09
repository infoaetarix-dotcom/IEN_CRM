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
          onDark ? 'text-tenant-offwhite/70' : 'text-muted-foreground',
        )}
      >
        Powered by
      </span>
      {/* The wordmark is dark blue, so it disappears on navy — on dark surfaces
          the name is set in type instead of forcing an unreadable image. */}
      {onDark ? (
        <span className="font-serif text-sm text-tenant-offwhite/85">{AETARIX.name}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={AETARIX.wordmark}
          alt={AETARIX.name}
          className="h-5 w-auto object-contain"
        />
      )}
    </a>
  );
}
