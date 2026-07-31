# Form subdomain — split the public form onto its own domain

Goal: give end users (students) a form-only domain that **cannot reach the
CRM**, while staff use the CRM on the main domain. Both are served by the same
Vercel deployment; the middleware decides what each host may serve.

## How it works

- `lib/routing/form-host.ts` + `middleware.ts` gate requests by the `Host`
  header, driven by one env var: **`FORM_HOST`**.
- On the host equal to `FORM_HOST`: only `/`, `/apply`, `/thank-you` (and their
  assets) are served; **every other path — the whole CRM, including `/login` —
  redirects to `/apply`.** The CRM is unreachable there.
- On any other host (the CRM domain): unchanged — full CRM with auth.
- **`FORM_HOST` unset = no-op.** That's the current production state, so nothing
  changes until you deliberately turn it on.

## Turning it on (the only remaining step — do this when ready)

1. **Pick the subdomain.** Must be a valid hostname: letters, digits, hyphens —
   **no underscores.** e.g. `apply.yourdomain.com` or
   `ien-education-form.yourdomain.com` (NOT `ien_education_form`).
2. **Add it in Vercel:** project `ien-crm` → Settings → Domains → add the
   subdomain → follow the DNS record it shows (a `CNAME` to `cname.vercel-dns.com`
   on your domain's DNS). Wait for it to verify.
3. **Set the env var:** Vercel → project `ien-crm` → Settings → Environment
   Variables → add `FORM_HOST` = the exact subdomain (e.g. `apply.yourdomain.com`),
   scope **Production**.
4. **Redeploy** (or push any commit) so the new env var is picked up.

That's it. The form is now live on the subdomain with the CRM hidden; staff keep
using the CRM on `ien-crm.vercel.app` (or whatever the main domain becomes).

## Notes

- Give students the **form subdomain**; give staff the **CRM domain**. The
  security still comes from auth + RLS — this split is defense-in-depth +
  clean separation, not the primary lock.
- To also move the CRM onto a branded domain later (e.g. `app.yourdomain.com`),
  add that domain in Vercel too; no code change needed — only `FORM_HOST` is
  special-cased.
- Verified behaviour (local, `FORM_HOST=apply.test.local`): form host serves
  `/apply`,`/thank-you`,`/` and redirects `/login`,`/dashboard`,`/leads`,`/super`
  to `/apply`; CRM host unchanged.
