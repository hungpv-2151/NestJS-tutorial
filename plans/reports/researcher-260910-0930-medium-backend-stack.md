# Nghiên cứu: backend RealWorld tối giản, production-sane

**Ngày:** 2026-09-10 · **Phạm vi:** NestJS 12, TypeScript ESM, pnpm; chỉ API trong `spec/api`.

## Kết luận

Chọn **PostgreSQL + Prisma ORM + Prisma Migrate + JWT access token HS256 + Argon2id + DTO `class-validator`/`class-transformer` + Vitest/Supertest và Hurl**. Đây là đường ít rủi ro nhất cho API có nhiều quan hệ, unique constraint, aggregate và transaction: user, article, comment, follow, favorite, tag. Không dùng SQLite/in-memory cho production; không thêm refresh token, RBAC hay Redis vì spec không cần.

Prisma có client type-safe, migration được review trong git, transaction cho các thao tác đa-bảng. PostgreSQL có FK, unique/composite index và truy vấn aggregate phù hợp feed/favorite/tag; index chỉ thêm theo truy vấn vì mỗi index làm chậm ghi. Nest khuyến nghị tách auth/users và bảo vệ route bằng JWT guard. [Nest auth](https://docs.nestjs.com/security/authentication), [Prisma transactions](https://www.prisma.io/docs/orm/reference/transactions-and-runtime), [PostgreSQL indexes](https://www.postgresql.org/docs/current/indexes.html).

## Bằng chứng từ contract

- Header bắt buộc là `Authorization: Token <jwt>`, không phải Bearer; public: article/profile/tags, private: `/user`, follow, feed, ghi article/comment/favorite.
- Hurl buộc `401` token thiếu, `403` khi không phải chủ article/comment, `404` theo resource, `409` username/email trùng và body `errors.{field}: string[]` cho `422`.
- Article list/feed có `limit`/`offset`, newest-first, `articlesCount`; list không lộ `body`. `tagList` giữ thứ tự, bỏ hẳn field khi update thì giữ tag, `[]` xóa tag, `null` là `422`. Slug phải unique dù title trùng.
- Password tối thiểu 8, nhận ít nhất 64 ký tự, không composition rule; bio rỗng chuẩn hóa `null`. User đổi username/email nhận token mới.

Nguồn contract: [OpenAPI](../../spec/api/openapi.yml), [auth/error Hurl](../../spec/api/hurl/errors_auth.hurl), [authorization Hurl](../../spec/api/hurl/errors_authorization.hurl), [article Hurl](../../spec/api/hurl/articles.hurl).

## Ma trận lựa chọn

| Lựa chọn | Độ khớp relation/query | Complexity | Migration/maintenance | Rủi ro nhận nuôi | Xếp hạng |
|---|---:|---:|---:|---|---:|
| PostgreSQL + Prisma | cao | thấp-vừa | mạnh, type-safe | Prisma 8 mới: chốt version/cách generate trước build | 1 |
| PostgreSQL + Drizzle | cao | vừa-cao; SQL lộ nhiều | SQL migration tốt | docs hiện có nhánh RC, team phải tự viết query/mapper nhiều hơn | 2 |
| PostgreSQL + TypeORM | cao | vừa | migration/transaction đủ | decorator/entity lifecycle, mapping DTO dễ phình | 3 |
| SQLite hoặc MongoDB | thấp-vừa | thấp lúc đầu | không hợp aggregate/quan hệ feed | concurrency, query/constraint lệch production | loại |

Prisma hỗ trợ PostgreSQL, transaction và index/constraint; Drizzle cũng có transaction/migration nhưng thiên SQL hơn; TypeORM hỗ trợ transaction/migration. [Prisma database features](https://www.prisma.io/docs/orm/v7/reference/database-features), [Drizzle migrations](https://orm.drizzle.team/docs/migrations), [TypeORM transactions](https://typeorm.io/docs/transactions/).

## Thiết kế persistence/migration

- Bảng: `users`, `articles`, `comments`, `tags`, join `article_tags` (có `position` để giữ thứ tự), `follows`, `favorites`; PK nội bộ, `created_at`/`updated_at`; FK cascade chỉ cho dữ liệu phụ thuộc article/user sau khi chốt chính sách xóa user.
- Unique: `users.email`, `users.username`, `articles.slug`, `(follower_id, following_id)`, `(user_id, article_id)`, `(article_id, tag_id)`. Tạo favorite/follow/tag replacement trong transaction; duplicate từ DB map đúng `409` hoặc idempotent follow/favorite theo Hurl.
- Index tối thiểu: `articles(slug)`, `articles(author_id, created_at DESC)`, `articles(created_at DESC)`, `comments(article_id, created_at)`, `article_tags(tag_id, article_id)`, `favorites(article_id, user_id)`, `follows(follower_id, following_id)`. Chỉ thêm index `favorites(user_id, article_id)` nếu EXPLAIN cho filter `favorited` cho thấy cần. PostgreSQL nhắc index tăng tốc đọc nhưng tăng overhead ghi. [PostgreSQL indexes](https://www.postgresql.org/docs/current/indexes.html).
- Commit migration sinh ra và SQL review; production chỉ chạy deploy migration, tuyệt đối không schema push tự do. Đặt `DATABASE_URL`, JWT secret trong runtime secret store/env, không commit.

## Auth, validation, authorization

- Package categories: ORM client/CLI + PostgreSQL driver; Nest JWT integration; Passport JWT strategy/typings (hoặc một guard JWT mỏng, không cần Passport local); `class-validator`, `class-transformer`; Argon2 package; config/env validation; Hurl CLI dev dependency. Giữ Vitest/Supertest đã có.
- JWT payload tối thiểu `sub` (user id), `iat`, `exp`; verify algorithm cố định HS256, issuer/audience nếu có deploy config. Một global optional-auth guard parse đúng `Token `; protected guard trả `401`, service ownership check sau resource lookup trả `403`. Không tin username/email trong token để quyết định ownership; tải resource bằng id/slug và so `authorId`/`userId`.
- Hash password bằng Argon2id (salt tự sinh); calibrate theo máy deploy, không log password/hash/token. OWASP khuyến nghị Argon2id và thông số tối thiểu memory-hard; NIST yêu cầu protected channel và timeout session rõ ràng. [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html), [Nest JWT](https://docs.nestjs.com/security/authentication).
- Global `ValidationPipe`: whitelist + forbid non-whitelisted, transform query integer; custom exception filter chuyển lỗi sang contract `{ errors: { field: [message] } }`. DTO phải model wrapper `user`/`article`/`comment`, distinction absent vs `null` vs `[]`.

## Test strategy

1. Vitest unit: slug collision, DTO/error mapper, token parser, ownership predicates, serializers (đặc biệt list thiếu `body`). Mock repository ở unit test; không mock DB trong integration.
2. Vitest + Supertest e2e: app thật + PostgreSQL test DB đã migrate; reset/truncate giữa test hoặc một schema/database riêng mỗi worker. Vitest lifecycle hỗ trợ setup/teardown; file khác có thể chạy song song nên isolation phải chủ động. [Vitest lifecycle](https://vitest.dev/guide/lifecycle), [Vitest setup/teardown](https://vitest.dev/guide/learn/setup-teardown).
3. Hurl: chạy nguyên bộ `spec/api/hurl/*.hurl` lên process đã start với `host`/unique `uid`; đây là acceptance contract ngoài process. Run tuần tự hoặc database/schema tách riêng, không dựa cleanup cuối file. Hurl không thay Vitest: nó xác nhận HTTP wire contract, Vitest giữ unit + Nest e2e nhanh.

## Rủi ro cần khóa trong plan

- **Authorization:** check ownership ở service transaction, không chỉ controller; cập nhật/xóa bằng scoped predicate (`id AND authorId`) để chặn TOCTOU.
- **Race:** unique DB là nguồn chân lý; catch constraint conflict. Slug generate + insert retry giới hạn; favorite/follow unique composite để concurrent request không double count.
- **N+1/aggregate:** profile `following`, article `favorited`/count phải batch/join/aggregate; không query từng article. Chạy `EXPLAIN ANALYZE` khi fixture lớn trước thêm index.
- **JWT revoke:** access-only JWT không thu hồi tức thì. Với scope RealWorld, expiry ngắn-vừa và token phát lại sau update là đủ; refresh/revocation chỉ thêm khi yêu cầu logout-all/compromise xuất hiện.

## Nguồn và giới hạn

Đã đối chiếu 9 nguồn độc lập: OpenAPI/Hurl (contract), Nest, Prisma, Drizzle, TypeORM, PostgreSQL, OWASP, NIST, Vitest. Ưu tiên docs chính thức; không dựa tutorial. Chưa benchmark workload hay biết môi trường PostgreSQL managed/self-hosted; vì vậy pool size, Argon2 cost và index phụ chỉ chốt bằng đo đạc deploy. Không có quyết định nào đang chặn kế hoạch: dùng PostgreSQL test/prod và secret env là assumption hợp lý cần ghi rõ trong plan.
