---
name: lokacia-api-module
description: How to add or extend a NestJS module in apps/api for lokacia.ge (controllers, Zod validation, auth/org guards, RLS transactions, notifications, queues, integration tests). Use whenever writing backend endpoints or jobs in this repo.
---

# Adding API functionality (apps/api)

## Layout
- One folder per module: `apps/api/src/modules/<name>/{<name>.module.ts,<name>.controller.ts,<name>.service.ts}`. Modules are already registered in `src/app.module.ts` (placeholders exist) — fill them in, do not re-register.
- Shared request schemas live in `packages/contracts/src/*.ts` (Zod). Put new schemas in a domain file, export from `src/index.ts`, then `pnpm --filter @lokacia/contracts build`.
- DB schema: `packages/db/src/schema/*.ts`. After changing it: `pnpm --filter @lokacia/db generate` (runs the geography-quote fix), `pnpm db:migrate`, rebuild `@lokacia/db`.

## Controller conventions
```ts
@ApiTags('offers')
@Controller('v1/offers')            // routes under /v1, kebab-case
export class OffersController {
  @Post()
  @ApiZodBody(offerSchema)           // OpenAPI from the same Zod schema
  create(@CurrentUser() user: AuthUser, @ZBody(offerSchema) body: z.infer<typeof offerSchema>) {}
}
```
- Auth is **required by default** (global `AuthGuard`). Opt out with `@Public()`; user is still attached if logged in.
- Platform roles: `@Roles('moderator')` (admin always passes).
- Org (CRM) endpoints: `@OrgScoped()` or `@OrgScoped('manager')` → reads `x-org-id` header, verifies membership; get it with `@Org()` / `@OrgId()`.
- Errors: `throw problems.notFound('...')`, `problems.forbidden()`, `problems.conflict(detail)`, or `new ProblemException(status, slug, titleKa, detail)`. Zod errors become 422 automatically. Titles are Georgian.
- Mutations are audited automatically (`AuditInterceptor`); add `@SkipAudit()` for noisy/non-business writes.
- Query params: `@ZQuery(schema)` (use `z.coerce` for numbers/booleans).
- PATCH with partial schemas: Zod `.partial()` still applies defaults — keep only keys present in `req.body` (see listings controller).

## Data access
- `DbService.db` for public/platform tables.
- **Org-owned tables (crm_*, presentations, documents, competitor_*, owner_reports, co_broker_shares) are protected by Postgres RLS.** Always query them inside `this.dbs.org(orgId, tx => ...)`. Jobs/admin/token links use `this.dbs.system(tx => ...)`. A plain `db.select()` on those tables returns 0 rows — that is the RLS working.
- Money is integer tetri (`priceMinor`), area `numeric` returned as number, IDs uuid v7 (defaulted), soft delete via `deletedAt`.
- Listing → API shapes: reuse `ListingReadService.cards(ids)` / `.detail(row)`; permission check `canManage(listing, user)`.
- Search: `SearchService.search(query)`; saved-search replay: `search.engine.matches(listingId, query)`. After changing listings call `search.listingChanged(id)`.

## Side effects
- Notifications: `NotificationsService.notify({ userId, template, vars, link, channels? })`. Templates in `modules/notifications/templates.ts` (Georgian). Channels are adapters with mocks (`integrations/`).
- Background work (> request scope, scheduled, external calls): `queue.register('name', handler)` in `onModuleInit`, `queue.add('name', data)`, schedules `queue.every('name', ms)`. Tests run the inline driver — call `await ctx.queue.drain()` or `ctx.queue.runNow('name')`.
- External services: interface + mock in `src/integrations/<name>/`, provided in `IntegrationsModule`. Add env vars to `src/config/env.ts` and `.env.example`, and a line in `docs/HUMAN_TODO.md`.
- Settings/prices: `SettingsService.get(key)`; launch promo: `settings.promoActive()`.
- AI: inject `AI` token (`AiClient` from `@lokacia/ai`); always have a deterministic fallback.

## Tests (required for each feature's acceptance criteria)
- `apps/api/test/*.test.ts`, real Postgres test DB reseeded once per run (`test/global-setup.ts`, 160 listings).
- `const ctx = await createApp()`, `const owner = await loginAs(ctx.app, PHONES.owner)` → supertest agent with cookies.
- Demo phones: `test/helpers.ts` `PHONES` (admin, moderator, owner, agencyManager (city-spaces), agent, tenant, developer, provider, assistant, agency2Manager (business-lokacia)).
- Run: `cd apps/api && npx vitest run test/<file>.test.ts`. If running in parallel with other agents, set `TEST_DATABASE_URL` to your own database (create it with the `extensions` schema like `lokacia_test`).
- `npx tsc --noEmit` must pass.
