# AuthModule Prisma DI failure — investigation

## Executive Summary
- **Issue:** after DTO module loading succeeds, E2E compilation cannot construct `AuthService`.
- **Impact:** both E2E tests fail in `beforeEach`; the application never initializes.
- **Root cause:** `PrismaService` is registered only in `AppModule`. Nest providers flow from imported modules to their importer, not from an importing root module down to its imported `AuthModule`; `AuthModule` neither provides nor imports/receives an exported `PrismaService`.
- **Status:** confirmed. No code or production dependency was changed.
- **Smallest sound repair:** create an exported, non-global `DatabaseModule` owning `PrismaService`; import it into every module that injects `PrismaService` (`AppModule`, `AuthModule`, `UsersModule`, `ProfilesModule`) and remove the direct root provider.

## Timeline
- 16:59:51 +07 — reproduced with `pnpm test:e2e -- --reporter=verbose`.
- 16:59:51 +07 — Nest reports `AuthService` argument index 2 (`PrismaService`) unavailable in `AuthModule`.
- 17:00 +07 — read module graph and every `PrismaService` consumer; confirmed the root-only registration also leaves users and profiles vulnerable after Auth is repaired.

## Technical Analysis

### Reproduction evidence
```text
Error: Nest can't resolve dependencies of the AuthService
(JwtService, ConfigService, ?). Please make sure that the argument PrismaService
at index [2] is available in the AuthModule module.

Test Files  1 failed (1)
Tests  2 failed (2)
```

`test/app.e2e-spec.ts` imports `AppModule`, then calls `overrideProvider(PrismaService)` before `.compile()`. The test override does not make a root-module provider visible to another module: Nest must first be able to resolve the token within the module graph.

### Module visibility proof

```text
AppModule
  providers: [AppService, PrismaService]
  imports: [ConfigModule, AuthModule, UsersModule, ProfilesModule]

AuthModule
  imports: [JwtModule.register({})]
  providers: [AuthService, ...]

AuthService constructor(JwtService, ConfigService, PrismaService)
```

`JwtModule` supplies `JwtService`. `ConfigModule` is `@Global()` and wraps `NestConfigModule.forRoot({ isGlobal: true })`, so the resolved error specifically skips index 0 and index 1 and names the missing index 2. `PrismaService` is neither an AuthModule provider nor exported from a module AuthModule imports.

Importing a module does not expose the importing module's providers to the imported module. Therefore `AppModule.providers: [PrismaService]` cannot satisfy `AuthService`.

### Wider dependency scan
Three feature services inject the same token:

| Consumer | Owning module today | Has a visible Prisma provider? |
|---|---|---|
| `AuthService` | `AuthModule` | No |
| `UsersService` | `UsersModule` | No |
| `ProfilesService` | `ProfilesModule` | No |
| `AppService` | `AppModule` | Yes, only because root declares it directly |

Fixing only `AuthModule` would expose the same module-boundary defect in `UsersModule` or `ProfilesModule` on the next compilation pass.

### Rival hypotheses tested

| Hypothesis | Result | Evidence |
|---|---|---|
| Root-only Prisma provider violates Nest module visibility | **Confirmed** | exact Nest token/module error; module declarations and constructor injection match it exactly. |
| Missing `JwtService` or `ConfigService` registration | Eliminated | Nest identifies only index 2. `JwtModule.register({})` is imported by AuthModule; ConfigModule is global. |
| E2E Prisma override is missing or production DB configuration fails | Eliminated | failure occurs during dependency graph compilation, before app creation, `PrismaService.onModuleInit`, a DB connection, or an HTTP request. The override exists but cannot repair invalid module visibility. |

## Recommended Repair

### Immediate (P0; low risk, small scoped change)
1. Add `src/database/database.module.ts`:
   ```ts
   @Module({ providers: [PrismaService], exports: [PrismaService] })
   export class DatabaseModule {}
   ```
2. Import `DatabaseModule` in `AppModule`, `AuthModule`, `UsersModule`, and `ProfilesModule` — exactly the modules whose providers inject `PrismaService`.
3. Remove `PrismaService` from `AppModule.providers`; the database module becomes its single production owner.
4. Keep the E2E `overrideProvider(PrismaService)` test override. It replaces the real exported provider in the valid graph; it does not become a production mock.
5. Run `pnpm test:e2e`. Expected next evidence: Nest reaches application initialization and no Prisma DI error occurs.

Use explicit imports rather than marking database global. A global database provider is fewer changed import declarations but hides data-store dependencies and makes isolated feature-module tests less honest. There is no need to alter `AuthService` constructor or mock any production provider.

### Recurrence prevention (P1)
- Keep each injectable infrastructure service owned by one module and exported from that module.
- Add a module-compilation test or retain the current AppModule E2E bootstrap test; it catches inaccessible providers before endpoint assertions.
- Review module boundaries whenever a service injects an infrastructure token: add/import its exporting module at the consumer boundary.

## Supporting Checks
- `src/database/prisma.service.ts` is injectable but has no module declaring/exporting it.
- `src/users/users.module.ts` and `src/profiles/profiles.module.ts` import only `AuthModule`, although their services inject Prisma.
- This diagnosis did not inspect or print environment files or values.

## Unresolved Questions
- None for the DI failure. Full E2E behavior after the module repair may reveal unrelated endpoint/test issues, but those are outside this diagnosis.
