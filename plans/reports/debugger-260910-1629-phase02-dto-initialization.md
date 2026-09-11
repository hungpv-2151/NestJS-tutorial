# DTO module initialization failure — investigation

## Executive Summary
- **Issue:** `pnpm test:e2e` cannot load `AppModule`; Vitest reports `ReferenceError: Cannot access 'LoginCredentialsDto' before initialization` before any test runs.
- **Impact:** all Nest E2E initialization is blocked (1 suite failed, 0 tests collected).
- **Root cause:** `src/users/user.dto.ts` decorates properties typed as classes declared later in the same ESM module while `emitDecoratorMetadata` is on. Generated decorator metadata reads those lexical bindings before their class initialization.
- **Status:** confirmed, no files changed by this investigation.
- **Minimal repair:** declare `LoginCredentialsDto` before `LoginUserDto`, and `UpdateFieldsDto` before `UpdateUserDto`.

## Timeline
- 16:52:05 +07 — `src/users/user.dto.ts` modification time; it contains the two forward references.
- 16:56:32 +07 — reproduced with `pnpm test:e2e -- --reporter=verbose`.
- 16:56:32 +07 — Vitest failed while importing `user.dto.ts` through `users.controller.ts` → `users.module.ts`; no test executed.
- 16:57 +07 — compiler-transpile and AST scans confirmed the emitted direct TDZ reads and found the second latent occurrence.

## Evidence and Technical Analysis

### Reproduction
```text
$ pnpm test:e2e -- --reporter=verbose
FAIL  test/app.e2e-spec.ts [ test/app.e2e-spec.ts ]
ReferenceError: Cannot access 'LoginCredentialsDto' before initialization
 ❯ src/users/user.dto.ts:51:27
 ❯ src/users/users.controller.ts:7:1
 ❯ src/users/users.module.ts:3:1

Test Files  1 failed (1)
Tests  no tests
```

The E2E test imports `AppModule`; `AppModule` imports `UsersModule`; that imports `UsersController`; the controller imports the DTO module. Thus failure is module evaluation, before Nest construction, the Prisma override, or an HTTP request.

### Root-cause proof
`tsconfig.json` enables both `experimentalDecorators` and `emitDecoratorMetadata`, with native ESM (`module`/`moduleResolution: nodenext`) and `package.json` declares `"type": "module"`.

Source order in `src/users/user.dto.ts`:
```ts
// line 9: target binding is declared on line 10
export class LoginUserDto { @ValidateNested() @Type(() => LoginCredentialsDto) user!: LoginCredentialsDto; }
class LoginCredentialsDto { /* ... */ }

// line 11: target binding is declared on line 12
export class UpdateUserDto { @ValidateNested() @Type(() => UpdateFieldsDto) user!: UpdateFieldsDto; }
class UpdateFieldsDto { /* ... */ }
```

Fresh TypeScript `transpileModule` output, using those project decorator settings, contains the eagerly evaluated expressions:
```js
Type(() => LoginCredentialsDto),
__metadata("design:type", LoginCredentialsDto) // before `class LoginCredentialsDto`
...
Type(() => UpdateFieldsDto),
__metadata("design:type", UpdateFieldsDto) // before `class UpdateFieldsDto`
```

The `Type` callback is deferred; `__metadata("design:type", LoginCredentialsDto)` is not. Evaluating it in an ESM temporal-dead-zone raises the exact observed `ReferenceError`. After repairing login ordering, `UpdateUserDto` will fail the same way unless fixed together.

### Rival hypotheses tested
| Hypothesis | Result | Evidence |
|---|---|---|
| Forward class reference plus emitted metadata | **Confirmed** | exact runtime error; emitted direct read precedes target class; two AST matches at lines 9→10 and 11→12. |
| Circular imports among controller/service/DTO modules | Eliminated | DTO module imports only `class-transformer` and `class-validator`; controller is the importer. `UpdateFields` is type-only usage and does not create the observed DTO→controller cycle. |
| Vitest/Vite transform defect or test setup/Prisma fault | Eliminated | TypeScript's own fresh emitted JS contains the illegal ordering. The suite fails before tests, Nest initialization, Prisma override, or request handling. |

### Scope scan
The source-wide TypeScript AST scan of decorated property type references found only these two forward class references:

```text
src/users/user.dto.ts:9: LoginUserDto.user -> later class LoginCredentialsDto at line 10
src/users/user.dto.ts:11: UpdateUserDto.user -> later class UpdateFieldsDto at line 12
```

`RegisterUserDto` is safe: `CredentialsDto` is declared first. `PaginationQueryDto` has no nested DTO class reference. No other DTO has this pattern in `src/`.

### Surroundings
- `user.dto.ts` and `users.controller.ts` are untracked working-tree files; no Git history exists for the introducing edit.
- Current package/config changes are unrelated to the language semantics. `pnpm exec tsc -p tsconfig.build.json --noEmit` succeeds: TypeScript accepts the program, because this is a runtime decorator metadata ordering fault, not a static type error.
- Root-level `pnpm exec tsc --noEmit` has unrelated pre-existing errors under `spec/e2e` (missing `@playwright/test` and ESM extensions) and test typing; it is not evidence against this root cause.

## Recommendations

### Immediate (P0, low risk/effort)
- [ ] In `src/users/user.dto.ts`, move `LoginCredentialsDto` above `LoginUserDto` and move `UpdateFieldsDto` above `UpdateUserDto`. Preserve decorators, fields, exported wrapper DTO names, and `UpdateFields` alias unchanged.
- [ ] Run `pnpm test:e2e`. Expected: app module loads and the two readiness tests execute; no `before initialization` error.

### Short-term (P1, low effort)
- [ ] Keep an E2E bootstrap test importing `AppModule`; the existing `test/app.e2e-spec.ts` already serves this regression purpose once it reaches its assertions.
- [ ] Format DTO classes one declaration per block. This makes declaration order and future forward references reviewable.

### Long-term (P2, low-medium effort)
- [ ] Add a lightweight lint/CI rule or review checklist: a property with runtime decorators must not use a same-module class declared later when decorator metadata is emitted. Report this before runtime.
- [ ] Keep `emitDecoratorMetadata` enabled only where Nest/class-validator requires it; disabling it globally is not a safe repair because it changes reflection behavior beyond this fault.

## Recurrence / Monitoring Gap
No module-load smoke gate currently catches a DTO import failure before E2E execution. The existing E2E test becomes that gate after the source-order repair. A static forward-decorated-type check prevents the same defect during review, rather than waiting for runtime initialization.

## Unresolved Questions
- None for this failure. Full repository typecheck remains separately blocked by unrelated Playwright/spec configuration errors.
