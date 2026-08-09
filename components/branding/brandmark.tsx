import Image from 'next/image';
import { cn } from '@/lib/utils';
import { AETARIX } from '@/lib/branding';
import type { OrgBrand } from '@/lib/branding';

/**
 * A tenant's logo, or the Aetarix wordmark when none is uploaded yet —
 * matches the same fallback already used in the admin panel header and the
 * login/password pages, so a brand-new consultancy with no logo looks
 * consistent everywhere rather than showing initials in some places and
 * Aetarix in others.
 *
 * Tenant logos arrive in unpredictable aspect ratios, so the image is
 * constrained by height with `object-contain` and a max width — a wide
 * wordmark and a square mark both sit correctly without distortion.
 *
 * Uses a plain <img> for the tenant logo on purpose: sources are arbitrary
 * per-tenant Storage URLs, and next/image would require editing
 * remotePatterns every time branding moves.
 */
export function Brandmark({
  brand,
  className,
  /** Tailwind height class for the logo image, e.g. 'h-8'. */
  size = 'h-8',
}: {
  brand: OrgBrand;
  className?: string;
  size?: string;
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
    <Image
      src={AETARIX.wordmark}
      alt={AETARIX.name}
      width={295}
      height={96}
      className={cn(size, 'w-auto max-w-[220px] object-contain object-left', className)}
    />
  );
}
