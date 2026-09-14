# Phase 04 — PR4: Articles, search/filter/pagination

## Context Links

- [Article contract](../../spec/api/hurl/articles.hurl) · [feed](../../spec/api/hurl/feed.hurl) · [favorites](../../spec/api/hurl/favorites.hurl) · [pagination](../../spec/api/hurl/pagination.hurl)

## Overview

- Priority: P1 · Status: Pending · Effort: 18h · Blocked by: PR3
- Implement article CRUD/list/feed/favorite, REST semantics, serializers, search/filter và pagination có giới hạn.

## Key Insights

- List serializer không có `body`; detail serializer có. Một query builder/service phải dùng chung cho global list và feed.
- Offset pagination cần total order `createdAt DESC, id DESC`; count tính sau filter, trước limit/offset.

## Requirements

- APIs: Create/List/Feed/Get/Update/Delete Article; Favorite/Unfavorite; `GET /api/tags` để giữ RealWorld contract.
- Query DTO: `search`, `tag`, `author`, `favorited`, `limit`, `offset`; default limit 20, max 100, offset >= 0.
- `search` case-insensitive trên title/description, trim và max 100 ký tự; filters kết hợp AND, query parameter lạ bị validation policy chung xử lý.
- Author-only update/delete; favorite/unfavorite idempotent; composite unique chống race.
- Slug unique dù title trùng; `tagList` absent giữ nguyên, `[]` xóa, `null` 422; mutation đa bảng trong transaction.
- Feed chỉ article của user đang follow, bắt buộc auth; public read có optional principal cho `favorited/following`.

## Architecture

`query DTO → ArticleQueryService → TypeORM QueryBuilder → count + page → ArticleListSerializer`.
`mutation → ArticleService transaction → slug/tags → ArticleDetailSerializer`.
Favorite relation là source of truth; `favoritesCount` dùng aggregate, không read-modify-write.

## Related Code Files

- Modify: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/app.module.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/profiles/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/package.json`.
- Create: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/articles/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/tags/*`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/database/migrations/*-create-articles-tags-favorites.ts`.
- Create/modify tests: `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/articles/*.spec.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/src/tags/*.spec.ts`, `/home/pham.van.hung@sun-asterisk.com/projects/demo/nestjs-tutorial/test/articles.e2e-spec.ts`.
- Delete: none.

## Implementation Steps

1. Viết/review migration article/tag/article-tag/favorite, FK/unique/index và `up/down`; apply/revert/apply.
2. Tạo nested create/update/query DTO; giới hạn field/tag/search/pagination; map errors chuẩn.
3. Implement slug collision retry hữu hạn và transactional ordered tag replacement.
4. Implement create/get/update/delete với scoped ownership predicate để tránh TOCTOU; route `/feed` khai báo trước `/:slug`.
5. Implement query builder chung cho search/filter/feed, stable order, cap 100, count trước page; batch author/favorite relations, không N+1.
6. Implement favorite/unfavorite idempotent và tags read; tách list/detail serializers.
7. Swagger hóa toàn bộ query/security/schema; unit/E2E cover CRUD, filter combinations, paging edges, duplicate title và authorization.

## Todo List

- [ ] Migration reversible; indexes khớp filter/order và composite relations.
- [ ] Toàn bộ article/favorite/feed/tag endpoints đúng contract.
- [ ] Search/filter/pagination deterministic, max 100, không N+1/body leak.
- [ ] Build, lint, unit, targeted E2E/Hurl article/feed/favorite/tags green.

## Success Criteria

- CRUD full flow persist đúng; non-owner mutation không đổi dữ liệu.
- Hai page liên tiếp không duplicate/skip khi timestamp bằng nhau; `articlesCount` không bị limit/offset làm sai.

## Risk Assessment

- Query join làm duplicate/count sai — Likelihood: Medium · Impact: High → distinct ids/subquery và integration fixtures nhiều tags/favorites.
- Concurrent slug/favorite — Likelihood: Medium · Impact: High → DB unique + bounded retry/idempotent conflict handling.

## Security Considerations

- QueryBuilder luôn bind params; body/query caps chống resource abuse; auth identity lấy từ JWT, không từ payload.

## Rollback

- Revert code + migration PR4 bằng `db:migration:revert`; migration down xóa join trước parent tables và không chạm users/attachments.

## Next Steps

- PR5 dùng Article lookup, auth, transaction và author serializer hiện có.
