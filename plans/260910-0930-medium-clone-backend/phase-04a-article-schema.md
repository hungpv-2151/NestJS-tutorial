# Phase 04A — Article, Tag, Favorite Foundation

## Context Links

- [Phase 04 roadmap](./phase-04-articles-search-pagination.md) · [OpenAPI article schemas](../../spec/api/openapi.yml) · [articles Hurl](../../spec/api/hurl/articles.hurl) · [favorites Hurl](../../spec/api/hurl/favorites.hurl) · [tags Hurl](../../spec/api/hurl/tags.hurl)
- Current patterns: `src/database/data-source.ts`, `src/database/database.module.ts`, `src/users/user.entity.ts`, `src/profiles/user-follow.entity.ts`, `src/profiles/profile.serializer.ts`, `src/database/migrations/1710000003000-create-attachments.ts`.

## Overview

- Priority: P1 · Status: Pending · Base: Phase 03 PR 3G / #46 · Public API change: **none**.
- One foundation PR creates the article/tag/favorite persistence contract and pure serializers consumed by PRs 4B–4K. No controller, route, DTO, Swagger operation, or HTTP behavior ships here.
- Dependency: merge-ready Phase 03 schema and branch #46. Verify the live stack and rebase on #46 before edits; leave every later article API for its own PR.

## Key Insights and Requirements

- `Article` has `slug`, `title`, `description`, `body`, `tagList`, ISO timestamps, `favorited`, `favoritesCount`, and `author` profile. Detail includes `body`; list and feed omit it, matching their separate OpenAPI list-item schema ([Hurl assertions](../../spec/api/hurl/articles.hurl), [OpenAPI schemas](../../spec/api/openapi.yml)).
- Hurl asserts input tag order in the create response. Persist per-article order rather than relying on join retrieval order. An omitted `tagList` on update preserves links; an explicit empty list removes them. The update behavior belongs to 4D, while 4A must permit both states.
- Duplicate article titles are allowed and produce distinct slugs. Slug uniqueness is database-enforced. A favorite by the same user on the same article is unique so later 4I/4J can be idempotent.
- `author` uses the existing profile shape (`username`, `bio`, `image`, `following`), with no private user fields. `favorited` depends on the current viewer; `favoritesCount` is an integer aggregate.

## Architecture and Data Flow

`Article entity (author_id → users) → article_tags (article_id, tag_id, position) → tags`; independently, `article_favorites (article_id, user_id)`. Later query code loads article rows plus ordered tags, per-article favorite aggregates, and author/following state, then passes them to pure serializers. Serializers make no database calls.

| Table / entity                          | Fields and constraints                                                                                                                                                                                                                                                                                            | Indexes for later APIs                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `articles` / `Article`                  | `id uuid PK DEFAULT gen_random_uuid()`, `slug text NOT NULL UNIQUE`, `title text NOT NULL`, `description text NOT NULL`, `body text NOT NULL`, `author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()` | `(created_at DESC, id DESC)` for deterministic global/feed page; `(author_id, created_at DESC, id DESC)` for author/feed selection. Unique slug index comes from constraint. |
| `tags` / `Tag`                          | `id uuid PK DEFAULT gen_random_uuid()`, `name text NOT NULL UNIQUE`                                                                                                                                                                                                                                               | Unique name supports creation and `GET /api/tags`.                                                                                                                           |
| `article_tags` / `ArticleTag`           | `article_id uuid REFERENCES articles(id) ON DELETE CASCADE`, `tag_id uuid REFERENCES tags(id) ON DELETE CASCADE`, `position integer NOT NULL CHECK(position >= 0)`, composite PK `(article_id, tag_id)`, unique `(article_id, position)`                                                                          | `(tag_id, article_id)` for tag filter; PK supports ordered article tag lookup with `position` sorting.                                                                       |
| `article_favorites` / `ArticleFavorite` | `article_id uuid REFERENCES articles(id) ON DELETE CASCADE`, `user_id uuid REFERENCES users(id) ON DELETE CASCADE`, composite PK `(article_id, user_id)`                                                                                                                                                          | `(user_id, article_id)` for favorited-user filter; PK supports count and viewer membership.                                                                                  |

Use explicit SQL migration `1710000004000-create-articles-tags-favorites.ts` matching the TypeORM mappings. `up`: create `articles` and `tags`, then `article_tags` and `article_favorites`, then indexes. `down`: drop `article_favorites` and `article_tags` first, then `tags` and `articles`; existing `users`, follows, and attachments remain untouched. PostgreSQL transaction behavior follows the existing migration runner. `down` destroys only 4A data and must be demonstrated before later APIs hold production data.

## Serializer Contract

- `serializeArticleDetail(article, context)` returns `{ article: { slug, title, description, body, tagList, createdAt, updatedAt, favorited, favoritesCount, author } }`.
- `serializeArticleList(articlesWithContext, articlesCount)` returns `{ articles: [...] , articlesCount }`; each item is the detail shape **without `body`**. Reuse one internal field mapper so the two outputs cannot drift.
- Context is explicit: ordered tag names, viewer-favorited boolean (false for guests), nonnegative favorite count, and profile following boolean (false for guests). Reuse `serializeProfile(...).profile` for author fields; do not expose `email`, `passwordHash`, IDs, or token.
- Emit timestamps with `Date#toISOString()` and preserve tag order from `position`; serializer must not issue per-item queries. Count is total after filters and before pagination, supplied by later query code.
- Test empty tags/favorites, guest and signed-in contexts, detail/list body distinction, tag order, date shape, and author redaction with fixture entities. The serializer can exist before any route calls it.

## Related Code Files and Ownership

- Create: `src/articles/article.entity.ts`, `src/articles/article-tag.entity.ts`, `src/articles/article-favorite.entity.ts`, `src/articles/article.serializer.ts`, `src/tags/tag.entity.ts`, `src/database/migrations/1710000004000-create-articles-tags-favorites.ts`.
- Modify `src/database/data-source.ts` for CLI entity/migration registration. Runtime entity registration belongs to the first Article API module in 4B; do not add an empty module or route to this schema-only PR.
- Tests: focused migration apply/revert/apply and metadata checks, serializer unit tests, and `src/database/data-source.spec.ts` registration expectations. Later PRs own endpoint tests and controllers.
- No deletion. One PR owns these files; later PRs may extend the entities/serializers only to serve their single API.

## Implementation Steps and Todo

1. [ ] Refresh remote, verify #46 is the immediate base, branch 4A from its current head, and audit base diff. Check `git status` first.
2. [ ] Write the migration and matching entities with named constraints/indexes. Register them in the CLI data source and Nest runtime without exposing routes; keep `synchronize: false`.
3. [ ] Write pure detail/list serializers and tests for the contract above. Keep files below 200 lines; production code delta target ≤300 lines, hard cap ≤400 (migration/tests/docs excluded per roadmap).
4. [ ] Run build immediately after code edits; run focused unit/integration tests, then `pnpm lint` and the relevant suite. Apply → revert → apply on an isolated test DB; verify join tables vanish before parent tables on revert and prior tables survive.
5. [ ] Review diff for one foundation scope and security; record command, exit code, SHA, migration screenshot/result, warnings, and PR-comment URL in [Phase 04](./phase-04-articles-search-pagination.md). Create a PR stacked directly on #46 with `Public API change: none`.

## Test Matrix and Observable Done

| Layer                  | Proof                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                   | Detail/list envelope, body inclusion, ordered/empty tags, viewer state, ISO dates, profile redaction.                                                                                              |
| Metadata               | Registered entities/migration, FK names/types and indexes match migration; `synchronize=false`.                                                                                                    |
| PostgreSQL integration | Fresh `up` creates all four tables and uniqueness/FK/position rules; duplicate slug, duplicate favorite and duplicate tag position reject; cascade and reverse-order `down`; second `up` succeeds. |
| HTTP/e2e               | No article/tag routes are introduced in 4A; all existing tests remain green. Hurl article scenarios begin with 4B.                                                                                 |

Success: 4A diff has zero public API changes, DB round trip passes, serializer fixtures match Hurl, build/tests/lint have zero errors, production delta ≤400 lines, and the PR points at #46.

## Risks, Compatibility, Rollback

- **High impact: order lost in many-to-many joins.** Use `position`, unique per article, and explicit `ORDER BY position` in later readers; test that the create-input order survives serializing.
- **High impact: duplicate favorites or slugs under concurrency.** Database unique constraints are the arbiter; later services map conflicts to their endpoint contracts.
- **Medium impact: duplicate article rows/count from joins.** Keep tag/favorite aggregates outside paged root rows; later 4F owns distinct/count query tests.
- Additive schema only; existing users and APIs continue to work. Reverting 4A drops its dependent join tables before parents. If any later PR has deployed, revert those PRs first because they depend on these tables.

## Open Decisions for Later API PRs

- The specs do not define slug algorithm or maximum lengths for title, tag name, and slug. 4B must define validation and collision handling; 4A stores text and enforces uniqueness without inventing a size limit.
- The specs do not say whether unused tags are deleted after an article removes them. Keep tag rows in 4A; decide cleanup in the relevant later API PR before changing that behavior.
- OpenAPI uses a separate list-item schema without `body`, consistent with Hurl. Keep the detail and list serializer outputs aligned with their respective schemas.
