# Multi-Tenant Architecture — how the SaaS version works

Plain-English design for turning the single-consultancy CRM into a product you sell to many consultancies from one deployment.

---

## 1. The core idea (the apartment-building analogy)

Think of it as **one building, many private apartments**:
- **The building** = one app + one database, deployed once.
- **Each apartment** = one consultancy ("tenant" / "organization"). They have their own leads, staff, templates — fully private.
- **The building manager** = the **super admin** (you). Has a master key: can create apartments, decide what each one gets (packages/modules), and step in if something breaks.
- **Apartment residents** = each consultancy's own admins and agents. They see *only their apartment*, never anyone else's.

The golden rule: **a consultancy can NEVER see another consultancy's data.** This is enforced at the database level, not just the UI.

---

## 2. How isolation works: `organization_id` + Row-Level Security

We use the standard, proven SaaS pattern — **shared database, row-level isolation**:

- Every piece of data gets stamped with an `organization_id` (which consultancy it belongs to).
- The database's Row-Level Security (RLS) automatically filters: *"you can only touch rows where organization_id = your organization."*
- This is the same mechanism already protecting agent/lead access today — we're extending it one level up.

We do **not** use a separate database per consultancy (overkill, expensive, hard to manage at this scale). One database, cleanly partitioned by `organization_id`.

---

## 3. New pieces added to the system

**New tables:**
| Table | Purpose |
|---|---|
| `organizations` | One row per consultancy: name, slug, status (active/suspended), plan |
| `modules` | Catalog of features you can sell: e.g. `leads`, `analytics`, `email`, `whatsapp`, `chatbot`, `bulk_messaging` |
| `organization_modules` | Which modules each consultancy has turned on → **this is the "packages" mechanism** |

**Changes to existing tables:**
- `profiles` (staff) gets an `organization_id` (which consultancy they belong to)
- `leads`, `lead_notes`, `lead_status_history`, `messages`, `email_templates`, `audit_log` all get an `organization_id`

---

## 4. Roles (three levels now)

| Role | Scope | Can do |
|---|---|---|
| **super_admin** (you) | The whole platform | Create consultancies, assign modules/packages, suspend/reactivate, support any account, see platform-wide data |
| **admin** (consultancy owner) | Their own organization | Everything inside their consultancy: staff, leads, templates, settings |
| **agent** (consultancy staff) | Their assigned leads, within their org | Work their leads only |

Super admin is special: **not tied to any organization** — their master key bypasses the org filter (audited every time).

---

## 5. Packages / modules (how you sell tiers)

- You define modules once (the `modules` catalog).
- For each consultancy, you flip modules on/off in `organization_modules`.
- The app checks this to decide what that consultancy can see and use — in the **menu**, on the **routes** (server-guarded), so a disabled module is truly off, not just hidden.
- Example packages: **Starter** = leads + email · **Pro** = + analytics + templates · **Enterprise** = + WhatsApp + chatbot.

---

## 6. The public lead form, per consultancy

Each consultancy needs **their own form link** so submissions land in the right apartment. Approach:
- Path-based slug: `yourdomain.com/{consultancy-slug}/apply` (e.g. `/ien/apply`, `/acme/apply`).
- The form resolves the slug → stamps the submission with that consultancy's `organization_id`.
- (Subdomains like `ien.yourdomain.com` are possible later; slugs are simpler to launch.)

---

## 7. Onboarding a new consultancy (super-admin flow)

1. Super admin creates an **organization** (name, slug, chosen package).
2. Super admin creates that org's **first admin** account (scoped to the org).
3. That admin logs in, adds their own agents, and starts working — inside their private space.

---

## 8. Security (the non-negotiable part)

- **Cross-tenant isolation** is the #1 invariant: every table's RLS enforces `organization_id = your org` (or super-admin). A UI bug can't leak another consultancy's data because the database itself refuses.
- **Defense in depth**: app-level org checks + database RLS + module gating, all independent.
- **Super-admin actions are fully audited** (who touched which org, when).
- **The public form** (service-role insert) validates the slug and stamps the correct org — it can't be tricked into writing to the wrong consultancy.

---

## 9. Build phases (foundation first)

| Phase | What | Ships |
|---|---|---|
| **A. Data model** | `organizations`, `modules`, `organization_modules`; add `organization_id` everywhere; `super_admin` role; rewrite RLS with org scoping; migrate existing data into a default org | migration `0003` |
| **B. Super-admin area** | Create/suspend orgs, create org admins, toggle modules per org, platform audit | `/super` dashboard |
| **C. Org scoping in-app** | Resolve "current org", scope all reads/writes, module-gated nav + routes | app-wide |
| **D. Per-org public form** | `/{slug}/apply` resolves org and attributes leads | public form |

We build A first (the bones). Everything you already have keeps working — it just moves into a default "IEN" organization during the migration, so nothing is lost.

---

*This expands the original single-consultancy MVP (spec §17 always earmarked multi-tenant as the "full CRM" step). Doing it now, while the schema is small and there's no live customer data, is the cheapest and safest moment.*
