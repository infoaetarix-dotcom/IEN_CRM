import { cn } from '@/lib/utils';
import type { OrgBrand } from '@/lib/branding';

/**
 * A tenant's logo, or an initials monogram when none is uploaded.
 *
 * Tenant logos arrive in unpredictable aspect ratios, so the image is
 * constrained by height with `object-contain` and a max width — a wide
 * wordmark and a square mark both sit correctly without distortion.
 *
 * Uses a plain <img> rather than next/image on purpose: sources are arbitrary
 * per-tenant Storage URLs, and next/image would require editing
 * remotePatterns every time branding moves.
 */
export function Brandmark({
  brand,
  className,
  /** Tailwind height class for the logo image, e.g. 'h-8'. */
  size = 'h-8',
  onDark = false,
}: {
  brand: OrgBrand;
  className?: string;
  size?: string;
  onDark?: boolean;
}) {
  if (brand.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logoUrl}
        alt={brand.name}
        className={cn(size, 'w-auto max-w-[180px] object-contain object-left', className)}
      />
    );
  }

  return (
    <span
      aria-label={brand.name}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-serif text-sm font-medium tracking-wide',
        size,
        'aspect-square',
        onDark
          ? 'bg-accent/20 text-accent'
          : 'bg-navy/10 text-navy',
        className,
      )}
    >
      {brand.initials}
    </span>
  );
}
