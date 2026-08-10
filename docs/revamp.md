You are working on an existing multi-tenant CRM system.

## EXISTING STACK

* Frontend: Next.js
* Backend: Node.js
* Existing architecture: multi-tenant
* Existing tenant isolation: Organization / Company Tenant ID
* Do NOT replace the existing tenant isolation mechanism.
* We are performing a controlled migration of the authorization and organizational hierarchy.

## IMPORTANT IMPLEMENTATION RULE

DO NOT implement the entire migration at once.

Work strictly in phases.

For every phase:

1. Inspect the existing codebase first.
2. Explain what currently exists.
3. Identify the exact files, models, APIs, middleware and UI affected.
4. Implement ONLY that phase.
5. Run/build/type-check/lint/tests where applicable.
6. Test the phase thoroughly.
7. Report:

   * What changed
   * What files changed
   * Database/schema changes
   * APIs changed
   * Tests performed
   * Test results
   * Any remaining risks
8. STOP and wait for approval before moving to the next phase.

Never silently modify unrelated functionality.

Do not remove existing functionality unless it conflicts directly with the new authorization model.

---

# BUSINESS REQUIREMENT

The system has a Super Admin who registers consultancy companies.

Each consultancy company is an independent organization/tenant.

The company owner can create multiple city-based admins.

Example:

Company:
ABC Consultancy

Cities:

Lahore

* Lahore Admin
* Agent 1
* Agent 2
* Agent 3
* Agent 4
* Agent 5

Peshawar

* Peshawar Admin
* Agent 1
* Agent 2

The city is mandatory for every city admin.

A city admin can create agents ONLY for their own city.

Example:

Peshawar Admin:

* Can create Peshawar agents.
* Cannot create Lahore agents.
* Cannot assign an agent to Lahore.
* Cannot view Lahore leads.

Lahore Admin:

* Can create Lahore agents.
* Cannot create Peshawar agents.
* Cannot assign an agent to Peshawar.
* Cannot view Peshawar leads.

Agents belong to a city and therefore inherit that city's data boundary.

---

# REQUIRED HIERARCHY

The final authorization hierarchy should be:

Super Admin
↓
Organization / Consultancy Company
↓
City
↓
City Admin
↓
City Agents
↓
Leads

The existing Organization/Tenant ID remains the primary tenant boundary.

City becomes the second-level data boundary inside the organization.

---

# ROLES

The system should support at minimum:

SUPER_ADMIN
OWNER
CITY_ADMIN
AGENT

Do not assume these exact enum/string names exist.

First inspect the existing role implementation and adapt the existing architecture where possible.

Do not create duplicate role systems.

---

# ROLE PERMISSIONS

## SUPER ADMIN

Super Admin is global.

Can:

* Create consultancy companies.
* View all companies.
* View all company owners.
* View all cities.
* View all admins.
* View all agents.
* View all leads.
* View all company data.
* Manage organizations/tenants.

Super Admin is NOT restricted by organization or city.

---

## OWNER

Owner belongs to exactly one organization/company.

Owner can:

* View their organization.
* Manage their organization's cities.
* Create city admins.
* View all admins belonging to their organization.
* View all agents belonging to their organization.
* View all leads belonging to their organization.
* View data from every city within their organization.

Owner cannot:

* Access another organization's data.
* Create users in another organization.
* Modify another organization's city/admin/agent data.

---

## CITY ADMIN

City Admin belongs to:

* One organization
* One city

City Admin can:

* View their city.
* Manage agents belonging to their city.
* Create agents for their city.
* View leads belonging to their city.
* View leads entered by other users in the same city.
* View agents belonging to their city.

City Admin cannot:

* Create agents for another city.
* Assign an agent to another city.
* View another city's leads.
* View another city's agents.
* Modify another city's admin.
* Access another organization.

---

## AGENT

Agent belongs to:

* One organization
* One city

Agent can:

* Create leads for their city.
* View leads belonging to their city.
* View leads entered by other agents in the same city.

Agent cannot:

* View another city's leads.
* Create leads for another city.
* Change their organization.
* Change their city.
* Access another organization's data.
* Create city admins.
* Create agents unless explicitly allowed by the existing business rules.

---

# LEAD VISIBILITY

This is extremely important.

Leads are NOT private to the user who created them.

All users within the same city can see that city's leads.

Example:

Lahore:

Lahore Admin
Agent A
Agent B
Agent C

If Agent A creates Lead #100:

Agent A → can see it
Agent B → can see it
Agent C → can see it
Lahore Admin → can see it
Owner → can see it
Super Admin → can see it

Peshawar users:

Peshawar Admin → CANNOT see Lead #100
Peshawar Agent → CANNOT see Lead #100

The lead table must therefore contain an identifiable creator/owner field such as:

createdByUserId

and/or existing equivalent.

The UI should display the creator's email in the lead table.

Example:

| Lead | Name  | Email                                     | City   | Created By                                  |
| ---- | ----- | ----------------------------------------- | ------ | ------------------------------------------- |
| 1001 | Ali   | [ali@email.com](mailto:ali@email.com)     | Lahore | [agent1@email.com](mailto:agent1@email.com) |
| 1002 | Ahmed | [ahmed@email.com](mailto:ahmed@email.com) | Lahore | [agent2@email.com](mailto:agent2@email.com) |

Use the existing user relation if one already exists.

Do NOT duplicate user information unnecessarily.

---

# SECURITY MODEL

Do NOT rely on frontend filtering for authorization.

This is critical.

The backend/API/database layer must enforce:

organizationId
+
cityId
+
role

The frontend may hide unauthorized options for UX, but backend authorization must independently reject unauthorized requests.

Never trust:

* organizationId from the request body
* cityId from the request body
* role from the frontend
* user-provided ownership fields

Derive authorization context from the authenticated user/session/token whenever possible.

---

# DATA ISOLATION

Every relevant entity should be evaluated for:

organizationId
cityId
createdByUserId

Do not blindly add all three fields to every table.

First inspect the existing schema and determine the correct relational design.

For example, a lead may have:

Lead
├── organizationId
├── cityId
└── createdByUserId

A user may have:

User
├── organizationId
├── cityId
└── role

A city may have:

City
└── organizationId

Use foreign keys/relations where supported.

Avoid storing redundant city names or organization names inside records if IDs/relations already exist.

---

# CITY REQUIREMENT

City must be mandatory for CITY_ADMIN.

City must also be mandatory for AGENT.

OWNER does not need a city because Owner operates across the entire organization.

SUPER_ADMIN does not need a city.

When creating a CITY_ADMIN:

Required:

* Name
* Email
* Password/invitation mechanism according to existing authentication
* Role
* Organization
* City

The city must belong to the selected organization.

When creating an AGENT:

Required:

* Name
* Email
* Password/invitation mechanism according to existing authentication
* Role
* Organization
* City

For CITY_ADMIN-created agents:

organizationId and cityId must come from the authenticated City Admin's context.

Do NOT allow the City Admin to submit an arbitrary organizationId or cityId and gain access to another location.

---

# CITY ADMIN AGENT CREATION

When a Peshawar Admin creates an agent:

Backend should effectively determine:

organizationId = authenticatedAdmin.organizationId
cityId = authenticatedAdmin.cityId

The request should NOT be trusted to define these values.

The server must verify the authenticated user is CITY_ADMIN.

Then create the agent inside the admin's organization and city.

If a malicious request attempts:

cityId = Lahore

the backend must reject it.

---

# OWNER ADMIN CREATION

When an Owner creates a city admin:

The Owner may select a city belonging to their organization.

The backend must verify:

selectedCity.organizationId === authenticatedOwner.organizationId

If not, reject the operation.

The Owner cannot create an admin belonging to another organization.

---

# PHASED MIGRATION

## PHASE 1 — CODEBASE AUDIT ONLY

DO NOT change functionality yet.

Inspect:

* Authentication
* Authorization
* User model
* Organization/tenant model
* Existing roles
* Lead model
* Lead APIs
* User creation APIs
* Organization APIs
* Middleware
* Session/token implementation
* Database schema
* Existing tenant filtering
* Existing frontend role checks

Create a written architecture report.

Identify:

1. Current organization/tenant structure
2. Current roles
3. Current user relationships
4. Current lead relationships
5. Existing authorization middleware
6. Existing API authorization
7. Existing frontend authorization
8. Exact changes needed for city-based isolation
9. Potential breaking points

DO NOT implement changes.

STOP after the audit.

---

# PHASE 2 — DATABASE / DOMAIN MODEL

After approval:

Implement the minimum database changes required for:

* City
* User → organization relationship
* User → city relationship
* City → organization relationship
* Lead → organization relationship
* Lead → city relationship
* Lead → creator relationship

Preserve existing data.

Do NOT destroy production data.

Create a safe migration strategy.

If existing leads/users do not have city information, determine a safe migration/backfill strategy.

Do not arbitrarily assign cities.

Run:

* migration validation
* schema validation
* type checking
* existing tests

STOP after testing.

---

# PHASE 3 — CITY MANAGEMENT

Implement city management for the Owner.

Owner can:

* Create city
* View cities
* Edit city
* Disable/archive city if appropriate

Every city must belong to exactly one organization.

Security tests:

* Owner A cannot access Company B's cities.
* Owner cannot assign a city to another organization.
* City Admin cannot create/edit organization-level cities unless explicitly permitted.

STOP after testing.

---

# PHASE 4 — CITY ADMIN CREATION

Modify admin creation.

Owner can create:

Lahore Admin
Peshawar Admin
Islamabad Admin
etc.

City is mandatory.

Validate:

* City belongs to Owner's organization.
* Admin belongs to Owner's organization.
* Admin has exactly one city.
* Invalid cross-organization city assignment is rejected.

Test:

1. Create Lahore Admin.
2. Create Peshawar Admin.
3. Verify both belong to the same organization.
4. Verify they have different city IDs.
5. Attempt invalid cross-organization assignment.
6. Verify backend rejects it.

STOP after testing.

---

# PHASE 5 — AGENT CREATION

Implement city-restricted agent creation.

A City Admin can create agents only in their own city.

Test:

Peshawar Admin:

* Create Peshawar Agent → SUCCESS
* Create Lahore Agent → REJECTED
* Modify cityId to Lahore in API request → REJECTED

Lahore Admin:

* Create Lahore Agent → SUCCESS
* Create Peshawar Agent → REJECTED

Verify agents inherit the correct organization and city.

STOP after testing.

---

# PHASE 6 — LEAD DATA MIGRATION

Modify leads so every lead can be securely associated with:

organizationId
cityId
createdByUserId

When a user creates a lead:

organizationId must come from authenticated user context.

cityId must come from authenticated user context.

createdByUserId must come from authenticated user context.

Do NOT trust these values from the frontend.

Test lead creation for:

* Owner
* City Admin
* Agent

depending on existing lead creation permissions.

STOP after testing.

---

# PHASE 7 — LEAD VISIBILITY

Implement backend lead filtering.

SUPER_ADMIN:

Can see all leads.

OWNER:

Can see all leads where:

lead.organizationId === owner.organizationId

CITY_ADMIN:

Can see:

lead.organizationId === admin.organizationId
AND
lead.cityId === admin.cityId

AGENT:

Can see:

lead.organizationId === agent.organizationId
AND
lead.cityId === agent.cityId

Agents must NOT be filtered by createdByUserId.

They should see all leads within their city.

Test with:

Organization A:

* Lahore
* Peshawar

Create:

Lahore Lead 1
Lahore Lead 2
Peshawar Lead 1
Peshawar Lead 2

Verify:

Lahore Admin → only Lahore leads
Lahore Agent → only Lahore leads
Peshawar Admin → only Peshawar leads
Peshawar Agent → only Peshawar leads
Owner → all four
Super Admin → all four

STOP after testing.

---

# PHASE 8 — LEAD TABLE UI

Update the lead table.

Add:

City

Created By / Email

The creator email must come from the backend relationship.

Example:

| Name | Email                                     | City   | Created By                                      |
| ---- | ----------------------------------------- | ------ | ----------------------------------------------- |
| Ali  | [ali@example.com](mailto:ali@example.com) | Lahore | [agent1@example.com](mailto:agent1@example.com) |

Do not allow frontend users to manipulate creator information.

Verify pagination, search, sorting and filtering still respect authorization.

For example, if Lahore Admin searches "Peshawar", the backend must not return Peshawar records.

Do not fetch all leads and filter them in React.

Filtering must happen server-side.

STOP after testing.

---

# PHASE 9 — DASHBOARDS

Update dashboards according to role.

SUPER_ADMIN:
Global organization/company statistics.

OWNER:
Organization-wide statistics.

CITY_ADMIN:
Only their city's statistics.

AGENT:
Only their city's statistics according to permitted metrics.

Ensure dashboard APIs use the same authorization rules as lead APIs.

Do not rely on frontend filtering.

STOP after testing.

---

# PHASE 10 — USER MANAGEMENT UI

Update user management.

Owner should see:

Organization users
Cities
City admins
Agents

City Admin should see:

Only users belonging to their city.

Agents should not see administrative user management unless already permitted.

When displaying users, show:

Name
Email
Role
City
Status

Ensure API responses themselves are authorized.

STOP after testing.

---

# PHASE 11 — FRONTEND ROUTE PROTECTION

Update Next.js route/page protection.

Frontend should provide correct UX based on role.

However:

Frontend protection is NOT considered security.

Every protected API must independently validate authorization.

Test direct URL access.

Example:

A Lahore Admin manually visits a Peshawar route.

The application must not expose Peshawar data.

If the route is unauthorized:

* redirect appropriately
  OR
* show a proper unauthorized page

according to the existing application architecture.

STOP after testing.

---

# PHASE 12 — COMPLETE SECURITY TEST

Perform a full authorization matrix.

Create:

Organization A

* Lahore

  * Lahore Admin
  * Lahore Agent 1
  * Lahore Agent 2
* Peshawar

  * Peshawar Admin
  * Peshawar Agent 1

Organization B

* Lahore

  * Lahore Admin B
  * Lahore Agent B

Test every combination.

Minimum matrix:

| User             | Org A Lahore | Org A Peshawar | Org B |
| ---------------- | ------------ | -------------- | ----- |
| Super Admin      | ALLOW        | ALLOW          | ALLOW |
| Owner A          | ALLOW        | ALLOW          | DENY  |
| Lahore Admin A   | ALLOW        | DENY           | DENY  |
| Lahore Agent A   | ALLOW        | DENY           | DENY  |
| Peshawar Admin A | DENY         | ALLOW          | DENY  |
| Peshawar Agent A | DENY         | ALLOW          | DENY  |
| Owner B          | DENY         | DENY           | ALLOW |

Test:

* GET
* POST
* PUT/PATCH
* DELETE
* Search
* Filtering
* Pagination
* Export endpoints
* Dashboard endpoints
* User endpoints
* Lead endpoints
* City endpoints

Look specifically for IDOR/security vulnerabilities where a user changes an ID in the request.

Example:

GET /leads/123

A Lahore user must not be able to retrieve a Peshawar lead simply because they know its ID.

---

# PHASE 13 — REGRESSION TEST

Verify all existing functionality still works.

Do not consider the migration complete until:

* Authentication works.
* Organization creation works.
* Owner login works.
* Admin login works.
* Agent login works.
* Existing leads remain accessible according to the new rules.
* Lead creation works.
* Lead editing works.
* Lead deletion works according to existing permissions.
* Search works.
* Pagination works.
* Dashboards work.
* Existing tenant isolation still works.
* Organization A cannot access Organization B.
* City isolation works inside an organization.

---

# IMPORTANT DEVELOPMENT RULES

1. Do not rewrite the entire application.
2. Reuse existing architecture wherever possible.
3. Do not create duplicate authentication systems.
4. Do not create duplicate tenant systems.
5. Preserve existing organization/tenant IDs.
6. Use database relations instead of duplicated strings where possible.
7. Do not trust organizationId/cityId/role supplied by clients.
8. Enforce authorization on the backend.
9. Do not implement security by frontend filtering.
10. Do not fetch unauthorized records and hide them in React.
11. Preserve existing APIs where possible.
12. If an API must change, explain why before changing it.
13. Do not perform destructive database migrations.
14. Do not delete existing data.
15. Create migrations/backfills that are reversible where practical.
16. Keep backward compatibility during migration where necessary.
17. After every phase, test before continuing.
18. Never proceed automatically to the next phase.
19. If something in the existing architecture conflicts with this design, STOP and explain the conflict instead of making assumptions.

---

# FINAL SUCCESS CRITERIA

The migration is successful only when this hierarchy is enforced:

SUPER ADMIN
→ sees everything

OWNER
→ sees everything inside their organization

CITY ADMIN
→ sees everything inside their assigned city

AGENT
→ sees everything inside their assigned city

LEAD
→ belongs to one organization + one city + has a creator

Users in the same city share the city's leads.

Users in different cities cannot see each other's leads.

Users in different organizations cannot see each other's data.

The backend enforces all of these rules independently of the frontend.

Start with PHASE 1 ONLY.

Do not modify the code yet.

Inspect the codebase and provide the architecture audit first.
