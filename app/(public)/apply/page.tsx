import { redirect } from 'next/navigation';

// The bare, non-slugged /apply is retired now that every consultancy has its
// own /{slug}/apply (see app/(public)/[slug]/apply) — there's no more
// single "default" org for it to guess at, so it sends visitors to the
// marketing site instead of silently showing whichever org used to be
// hardcoded here.
export default function LegacyApplyRedirect() {
  redirect('/');
}
