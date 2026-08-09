# Custom domains — a consultancy's own form and portal domains

Goal: give each consultancy a dedicated domain for their public application
form (`form.theirdomain.com`) and/or their whole staff CRM
(`portal.theirdomain.com`), fully isolated from every other tenant and from
the Aetarix platform console. One Vercel deployment serves all of it —
middleware decides what each incoming Host header may see, based on the
`organizations.form_domain` / `organizations.portal_domain` columns
(migration `0018_org_domains.sql`).

**All configuration rights live in Super Admin.** A tenant cannot set or
change their own domain — only Aetarix, from `/super/orgs/{id}` → Domains.

## How it works

- `lib/routing/domain-lookup.ts` resolves the request's Host header to an
  org's `form_domain` or `portal_domain` via the service role (there's no
  session yet at this point), cached in-memory for up to 60s.
- `lib/routing/domain-routing.ts` holds the actual routing rules as pure,
  unit-tested functions (`formDomainDecision`, `portalDomainDecision`);
  `middleware.ts` just applies whichever one matches.
- **Host matches an org's `form_domain`:** only that org's own
  `/{slug}/apply` and `/thank-you` are served. Every other path — including
  another org's slug, the marketing root, and `/super` — redirects to that
  org's apply page. The CRM is unreachable there.
- **Host matches an org's `portal_domain`:** the full CRM is served, but
  scoped to that one org. `/super` and `/` redirect to `/login`. A session
  belonging to a *different* org (or a super admin) is signed out and
  redirected to the base app domain (`NEXT_PUBLIC_APP_URL`) to sign in with
  the right account — so a tenant's portal domain can never show another
  tenant's (or the platform's) data, even from a stale/borrowed session.
- **Host matches neither (the base app domain):** unchanged — full CRM with
  auth, `/super`, and the marketing page all behave exactly as before.
- `/login` and `/forgot-password` read the resolved org from the
  `x-tenant-slug` request header middleware sets whenever a domain matched,
  so a consultancy's own domain shows their branding immediately — even on a
  visitor's very first visit, before any "last org" cookie exists.

## Setting one up (Super Admin does this per consultancy)

1. In `/super/orgs/{id}` → **Domains**, enter the domain (e.g.
   `form.theirdomain.com`) and save. Must be a bare hostname — letters,
   digits, hyphens, at least one dot — **no scheme, path, port, or
   underscores** (`form.theirdomain.com`, not
   `https://form.theirdomain.com/apply` or `form_theirdomain.com`).
2. **Add it in Vercel:** project → Settings → Domains → add the domain →
   follow the DNS record it shows (a `CNAME` to `cname.vercel-dns.com` on the
   consultancy's DNS, which they'll need to add). Wait for it to verify.
3. That's it — no redeploy needed. The next request that arrives on that host
   is resolved against step 1's saved value (cache is at most 60s stale).

Saving the domain in Super Admin *before* it's added in Vercel is harmless —
it just won't route anywhere until DNS + Vercel are both in place. Likewise,
adding it in Vercel without saving it in Super Admin leaves it 404ing (no org
claims that host yet).

## Notes

- A domain can only belong to one org at a time (enforced by a unique
  constraint on each column, plus a same-org distinctness check and an
  application-level cross-column check in `setOrgDomains`).
- The default link — `{NEXT_PUBLIC_APP_URL}/{slug}/apply` — always keeps
  working even after a custom form domain is set, and needs no DNS/Vercel
  setup. Staff see both (when configured) on the **Form** tab in their CRM
  sidebar, with copy buttons.
- Security still comes from auth + RLS; the domain split is defense-in-depth
  and a clean, branded surface for each tenant — not the primary lock.
- Local/dev testing: there's no real DNS to point at localhost, so this is
  verified by (a) unit tests on the pure decision functions
  (`tests/unit/domain-routing.test.ts`) and (b) manually overriding the
  `Host` request header against a local server, which middleware reads the
  same way a real edge request would.
