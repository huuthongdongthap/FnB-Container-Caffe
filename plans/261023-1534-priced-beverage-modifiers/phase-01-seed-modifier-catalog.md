# Phase 1 — Modifier Admin UI + Seed via API

**Status:** ✅ UI complete — seeding pending commercial numbers
**Depends on:** nothing
**Blocks:** phases 3, 4

---

## Context — plan corrected during execution

This phase was originally written as "raw SQL seeding". Scouting disproved that
premise and changed the deliverable:

- `packages/domain/catalog/commands/menu-modifiers.ts` exposes a **complete CRUD
  API** at `/api/menu-modifiers` — groups, choices, and product links, with all
  writes guarded by `staffAuth` (`:33`, `:58`, `:78`, `:137`) and reads open
  (`:25`, `:69`, `:124`). Mounted at `worker/src/routes/features-router.ts:125`.
- `grep -rln 'menu-modifiers' src/` returns **nothing** — there is no UI.
- An existing test (`worker/src/__tests__/tree/menu-modifiers/menu-modifiers.test.ts`)
  already exercises all of it against a scripted D1 mock.

So the tables are not "unseedable" — they have an admin API with no front door.
Writing `worker/seed-modifiers.sql` would build a **second, unauthenticated path**
to the same data, bypassing `staffAuth`. That is the technical debt this
execution is meant to avoid.

**Decision (user, 2026-10-23):** build the admin UI, then seed through it. The
commercial numbers remain a business decision — the UI makes them creatable by
staff without a deploy, which is the right home for them.

## Requirements

- New tab in the menu admin page, following the existing category-manager pattern
- Manage groups: create, list, delete; `type` single/multiple, `sort_order`
- Manage choices per group: create with `name` + `price_delta`, toggle availability
- Link/unlink a group to a product
- Writes go through `apiFetch` (which attaches the staff auth), never direct D1

## Files to create/modify

| File | Action |
|---|---|
| `src/pages/admin/types.ts` | Add `ModifierGroup`, `ModifierChoice`, form types, `Tab` union member |
| `src/pages/admin/use-modifier-manager.ts` | Hook — query + mutations, mirrors `use-category-manager.ts` (131 lines) |
| `src/pages/admin/modifier-group-list.tsx` | List + add/edit affordances, mirrors `category-list.tsx` (99 lines) |
| `src/pages/admin/modifier-group-modal.tsx` | Group create/edit, mirrors `category-modal.tsx` (69 lines) |
| `src/pages/admin/modifier-choice-modal.tsx` | Choice create with price delta |
| `src/pages/admin/ManageMenu.tsx` | Add the third tab + wire the manager |
| `src/pages/admin/__tests__/` | Tests — see phase 4 |

Pattern source: `use-category-manager.ts` (`apiFetch` + react-query +
`slugify`), `category-modal.tsx` (form + validation + save/close).

## API surface to consume

```
GET    /api/menu-modifiers/groups
POST   /api/menu-modifiers/groups                  {name, type, required, sort_order, is_active}
DELETE /api/menu-modifiers/groups/:id
GET    /api/menu-modifiers/groups/:groupId/choices
POST   /api/menu-modifiers/groups/:groupId/choices {name, price_delta, sort_order, is_available}
GET    /api/menu-modifiers/products/:productId/groups
POST   /api/menu-modifiers/products/:productId/groups {group_id}
DELETE /api/menu-modifiers/products/:productId/groups/:groupId
```

## Implementation steps

1. Types in `types.ts` — keep `Tab` as `'products' | 'categories' | 'modifiers'`.
2. `use-modifier-manager.ts` — queries per group for choices and per product for
   links; mutations invalidate the relevant keys.
3. Group list + modal; choice modal with an integer VND field.
4. Product-link editor — the existing product list/tab is the natural host; show
   which groups a product already has and add/remove.
5. Wire the tab in `ManageMenu.tsx` (currently 139 lines; if it exceeds 200,
   extract the tab bar first).
6. i18n keys under `adminMenu.*` matching the existing convention.

## Money format

`price_delta` is integer VND (validation requires integers, no floats). UI shows
a VND-suffixed input, stores a `number`. Same convention as
`ProductFormData.price` being a `string` in the form and parsed on save — follow
that, don't introduce a second pattern.

## Success criteria

- Tab renders; groups list from the API
- Create a group, create a choice with a delta, link it to a product — all 201
- A second staff session sees the same data (i.e. it really persisted, not local state)
- `tsc --noEmit` clean; new files each under 200 lines
- No direct D1 access added to `src/`

## Risks

| Risk | Mitigation |
|---|---|
| Duplicating the CRUD instead of consuming it | Steps 2-4 use `apiFetch` only; grep to confirm no `AURA_DB` in `src/` |
| `ManageMenu.tsx` crossing 200 lines | Extract tab bar first if needed |
| Choices deleted but still linked | Cascade is on the DB side (`ON DELETE CASCADE`, `schema.sql:759`) — verify behavior, don't re-implement |

## Next steps

Once the UI works, staff (or the user) can create the groups and prices without a
deploy. That unblocks phases 3 and 4 for the test matrix.

---

## Implementation log — 2026-10-23

Delivered (all new files under 200 lines, `tsc --noEmit` clean, project lint 0 errors):

| File | Lines | Role |
|---|---|---|
| `src/pages/admin/use-modifier-manager.ts` | 195 | Query + mutations via `apiFetch` |
| `src/pages/admin/modifier-group-list.tsx` | 107 | Group table, skeleton, empty, error+retry |
| `src/pages/admin/modifier-group-modal.tsx` | 73 | Create group (name, type, sort) |
| `src/pages/admin/modifier-choice-modal.tsx` | 82 | List choices + create one with a VND delta |
| `src/pages/admin/modifier-format.ts` | 16 | Signed VND delta formatting |
| `src/pages/admin/manage-menu-tab-bar.tsx` | 41 | Tab strip extracted from `ManageMenu.tsx` |
| `src/pages/admin/__tests__/ModifierGroupsAdmin.test.tsx` | — | 4 tests, all pass |

Modified: `src/pages/admin/types.ts` (modifier types + `Tab` union),
`ManageMenu.tsx` (third tab + wiring), `src/locales/{vi,en}.json` (+18 keys each,
no existing key dropped or changed).

### Deliberately NOT built — API gaps, not oversights

- **Choice edit/delete.** `menu-modifiers.ts:69-122` exposes only GET and POST on
  `/groups/:groupId/choices`. There is no PATCH or DELETE. A mis-priced choice can
  only be fixed in the DB today. Needs an endpoint before the UI can offer it.
- **Product↔group linking.** `POST`/`DELETE /api/menu-modifiers/products/:pid/groups`
  (`:137`, `:151`) exist and work, but no surface renders them, so the mutations were
  removed from the hook rather than shipped unreachable (YAGNI). A link editor in the
  product tab is the natural next piece.
- **`product_modifier_groups` linking is the real blocker for charging.** A modifier
  is rejected unless linked to the product (`modifier-validation.ts`), so the linking
  UI is required before any price can actually be charged — build it next.

### Deviation from the original plan

The plan said "raw SQL seeding". Rejected: the CRUD API already exists and is
`staffAuth`-guarded, so a SQL seed would add a second, unauthenticated write path
to the same tables. Seeding now happens through the API in the UI, which also
means prices are staff-editable without a deploy.

### Known duplication (pre-existing, not introduced here)

`public/locales/{vi,en}/translation.json` are byte-identical copies of
`src/locales/{vi,en}.json` but are **never loaded** — `src/lib/i18n.ts:4-5` imports
`src/locales/` only, and nothing references `public/locales/`. New keys were added
to the live pair only. Recommend deleting the stale copies.

### Seeding status

Not done — no groups, choices, or links exist in the catalog yet. Creating them
needs the commercial numbers (see `plan.md` → Open commercial questions).

