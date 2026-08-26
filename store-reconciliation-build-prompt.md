# Prompt: Store Reconciliation Module — Build Inside Our Existing Approval System

Use this with Claude Code, pointed at your existing project's repo, to kick off the build.
Fill in the bracketed `[ ]` items with your specifics before running it.

---

## PROMPT START

You are helping me add a **Store Reconciliation module** to an existing Django + React project.
This is NOT a new system — it plugs into a project that already has:
- A working admin dashboard
- Site management (an existing `Site` model — confirm exact app/model name: [app.ModelName])
- User/staff management (an existing `User`/`Staff` model — confirm exact app/model name:
  [app.ModelName])
- An approval workflow with its own states and admin views (confirm the app name and how
  "approvable" objects currently plug into it: [describe, or ask me to walk you through it
  by reading the existing approval app's code first])
- Database: Neon (serverless Postgres)

Before writing any code, **read the existing project structure** — the site/user models, the
approval app's models and how other objects submit into it, and the existing admin/React
patterns — and tell me what you find, so the new module follows the same conventions instead
of introducing a second style.

Do not start scaffolding until I've confirmed your read of the existing project and the plan
below.

### 1. Core reconciliation logic the new module must support

- For materials tied to a formula/output ratio (e.g. concrete: production × design-mix ratio
  per grade), support a **norm-based** variance model:
  - Actual consumption = Opening stock + Receipts − Closing stock (MT)
  - Theoretical consumption = Σ(Output quantity × mix/BOQ ratio for that output), summed to MT
  - Variance = Actual − Theoretical, valued at the material's rate
- For general store items with no formula (steel, fuel, spares, consumables, etc.), support a
  **direct-count** variance model: ERP book stock vs. physical count entered by the store
  person, variance = count − book stock, valued at the item's rate
- Rates and mix/BOQ ratios follow a **three-tier inheritance**: a company-wide default,
  overridable per site, overridable again for a single month — with a clear "locked to this
  site" state once a site's own figures are saved, so later changes to the company default
  don't silently move sites that already have their own numbers confirmed
- Automatic data-quality flags on entry: negative consumption (usually a unit mix-up), a
  material consumed with no matching production/BOQ, missing mix/rate setup for an active item
- Status indicators (within-tolerance / watch / over-tolerance) driven by a configurable
  tolerance percentage
- Print-ready statement per site, and a combined multi-site pack, formatted for audit handoff

### 2. Integration requirements (this is the part that makes it a module, not a rebuild)

- Every reconciliation record must reference the **existing** `Site` and `User`/`Staff` models
  via foreign key — do not create new site or user tables
- Reuse the **existing admin dashboard's** navigation, styling, and auth/permissions system —
  the new screens should look and behave like they belong to the same product
- When a site's monthly reconciliation is ready for review, it should enter the **existing**
  approval workflow the same way other approvable objects in the system do — reuse that
  pattern (whatever object/status/notification mechanism it already uses), don't build a
  parallel approval flow
- Role-based access should map onto whatever roles already exist in the system: [list them —
  e.g. store user, site engineer, site head, approver, admin]. A store user should never be
  able to edit an approved design mix or a confirmed rate.
- Item master covering **all store categories**, not just aggregates: [list your categories —
  e.g. cement, steel, shuttering material, diesel/fuel, spares, consumables]. Each item carries
  its own reconciliation type (`norm_based` or `direct_count`) so new categories are added as
  data, never as a code change.

### 3. Reporting

- Site-wise and item-wise reporting, with drill-down from a company-wide total down to a
  single site's single material
- Responsive dashboard with a real charting library (not static/print-only images) — usable on
  tablet and mobile for store staff, not just desktop
- Audit trail on every entry and every rate/mix change: who, what, when

### 4. External integration (later phase, plan for it now)

- ERP for book stock: [describe your ERP — name/system, whether it exposes an API, export
  files, or needs manual upload for now]

### 5. Non-negotiables

- Follow the existing project's Django app conventions (app layout, DRF viewset style,
  migrations, testing setup) rather than introducing a new pattern
- No item category should require a code deployment to add — items, categories, and
  reconciliation rules must be data-driven
- The three-tier rate/mix inheritance model described above must be implemented from the
  start, not bolted on later
- Mobile-usable data entry screen for store staff, with tolerance for poor site connectivity
  (queue-and-sync rather than fail on submit)
- Proper concurrency handling for simultaneous entry across sites

### 6. What I want from you right now

1. **Read the existing project** — site/user models, approval app, admin dashboard patterns,
   React project structure — and summarize what you find.
2. **Confirm scope ambiguities** — ask me anything you need (exact model names, exact approval
   flow mechanics, item categories for Phase 1, ERP API availability).
3. **Propose a phased roadmap** (Phase 1 → production), each phase with: goal, concrete
   deliverables, and a rough time estimate.
4. **Propose the new app's structure** — Django app layout (models, migrations, admin,
   serializers, viewsets) and where the React screens live within the existing frontend
   structure — as a tree, referencing the existing project's actual folder names.
5. **Propose the core data model** for the new app (Item, ItemStandard, SiteItemConfig,
   ReconciliationPeriod, ReconciliationEntry, ReconciliationFlag) showing the FK relationships
   into the existing Site/User/Approval models. Use an ERD if helpful.
6. Wait for my sign-off on 2–5 before scaffolding any code.

### 7. Working style for the build itself (once approved)

- Build and verify one phase at a time; don't silently expand scope into later phases
- Every phase should end in something demoable, not just backend plumbing
- Flag any point where a decision I made in this prompt turns out to be wrong once you're
  actually building — don't quietly work around it
- If something about the existing project contradicts an assumption in this prompt (e.g. the
  approval flow doesn't work the way I described), stop and tell me rather than guessing

## PROMPT END

---

### Notes for you before you send this

- Fill in the exact model/app names for your Site, User/Staff, and Approval apps if you know
  them — this saves the agent a discovery pass and reduces the chance it gets the integration
  wrong on the first attempt.
- If you're not 100% sure how your approval workflow currently takes in new "approvable"
  objects, that's fine — step 1 of the prompt has the agent read and report that back to you
  before it assumes anything.
- Send this in a fresh Claude Code session with the existing repo open, so it can actually read
  the code it needs to match conventions with.
