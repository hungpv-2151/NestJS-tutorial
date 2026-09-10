# Rủi ro hợp đồng API — RealWorld backend

## Kết luận cho plan

Hurl là nguồn hành vi ưu tiên (README dòng 17–25). OpenAPI định nghĩa khung, nhưng thiếu nhiều quy tắc quan sát được. Plan phải chốt các điểm dưới đây trước khi chia module.

1. **Prefix và wrapper là hợp đồng cứng.** Mọi route Hurl dùng `/api/...` (vd. `auth.hurl:2`, `articles.hurl:15`). Request luôn bọc `user`/`article`/`comment` (OpenAPI 822–893); response cũng bọc tương ứng, list là `{ articles, articlesCount }`, `{ comments }`, tags là `{ tags }` (649–767). DTO không được bind thẳng body phẳng; thiếu wrapper phải ra lỗi chuẩn `422`, không phải lỗi Nest mặc định.

2. **Cần một exception filter duy nhất.** Body lỗi phải đúng `{ errors: { field: [message] } }` (OpenAPI 637–647), với key theo tài nguyên: `token/is missing`, `credentials/invalid`, `article|comment|profile/not found|forbidden` (các Hurl `errors_*.hurl`; ví dụ `errors_authorization.hurl:42–58,73–77`). Map rõ: validation `422`, duplicate username/email `409`, credential sai hoặc thiếu token `401`, đúng token nhưng không sở hữu `403`, không tồn tại `404`; `DELETE` thành công là `204` không body (OpenAPI 284–309, 360–392).

3. **Auth có ba chế độ, không chỉ guard on/off.** Protected endpoint yêu cầu header chính xác `Authorization: Token <JWT>` (OpenAPI 912–922). GET profile, article, comments và article list cho anonymous, nhưng nếu token hợp lệ thì phải serialize `following`/`favorited` theo viewer (`profiles.hurl:25–42`, `comments.hurl:46–69`, `articles.hurl:81–117`). Plan cần quyết định invalid/malformed token trên optional route; test hiện chưa khóa hành vi này, nên không được vô tình biến absence thành `401`.

4. **Serializer phải tách read-model, không trả entity.** User/Profile bắt buộc gửi `bio` và `image` bằng `null`, không được omitted (`auth.hurl:12–17`, `profiles.hurl:28–32`; OpenAPI 481–539). Single article có `body`; article trong list *phải không có* `body` (`articles.hurl:45–61`, `favorites.hurl:60–76`, OpenAPI 697–745). Token chỉ xuất hiện trong User response; never profile/article author. `createdAt`/`updatedAt` là ISO string; update giữ `createdAt`, đổi `updatedAt` (`articles.hurl:168–181`).

5. **PATCH-semantics nằm trên PUT.** `PUT /user` và `PUT /articles/:slug` chỉ thay field hiện diện. `tagList` absent giữ nguyên, `[]` xóa toàn bộ, `null` bị `422` (`articles.hurl:202–245`). `bio`/`image`: `""` normalize thành `null`; `null` hợp lệ và phải persist (`auth.hurl:81–129,167–214`). Nhưng `username`/`email`/`password` null hoặc empty bị `422`; password tối thiểu 8, 64 ký tự được nhận (`errors_auth.hurl:132–224`). Dùng kiểm tra `undefined` thay vì truthiness, nếu không sẽ làm sai `[]`, `null`, empty string.

6. **Thứ tự route và slug uniqueness là observable.** Khai báo `/articles/feed` trước `/articles/:slug`, nếu không Nest có thể coi `feed` là slug; spec đã tách feed ở OpenAPI 161–180 trước article-id 234–309. Title trùng được phép, nhưng slug phải khác (`errors_articles.hurl:110–137`): cần cơ chế retry/sequence trong unique constraint, không cấm duplicate title. Không đổi slug khi update title trừ khi plan cố ý mở rộng contract (test hiện không yêu cầu).

7. **Quan hệ follow/favorite phải idempotent ở tầng DB.** Hurl kiểm tra state sau một lần follow/favorite rồi unfollow/unfavorite (`profiles.hurl:44–71`, `favorites.hurl:28–127`), chưa gọi lặp. Plan cần unique composite `(followerId, followingId)` và `(userId, articleId)`, delete-if-exists; đây là cách tránh `favoritesCount` tăng đôi hoặc race condition. Quyết định response gọi lặp chưa có trong test; chọn idempotent `200` để giữ PUT-like state operation đơn giản và an toàn.

8. **Authorization phải kiểm tra sau khi tìm đúng resource và trước mutation.** User B update/delete article của A trả `403`, comment của A cũng `403`, dữ liệu sống sau delete thất bại (`errors_authorization.hurl:41–84`). Comment delete phải phân biệt article slug không tồn tại (`errors_comments.hurl:74–79`) và comment id không tồn tại trong article tồn tại (`82–86`). Đừng chỉ delete by comment id; phải scope theo article trước rồi owner check.

9. **Pagination cần order tổng quát và count trước limit/offset.** `offset >= 0`, `limit >= 1`, default 20 (OpenAPI 895–911). Article list mới nhất trước, kiểm thử bắt slug2 trước slug1 và offset 1 trả slug1 (`pagination.hurl:45–59`); thêm tie-breaker ổn định (`createdAt DESC, id DESC`) vì hai insert có thể cùng timestamp. `articlesCount` là tổng sau filter, trước page (`pagination.hurl:49–59`, `feed.hurl:90–115`). Feed chỉ gồm authors đang follow, empty trước follow (`feed.hurl:27–33`), và ảnh tác giả trong feed phải show `following: true` (`feed.hurl:90–107`).

10. **Data isolation/test ordering là yêu cầu vận hành.** Mỗi `.hurl` là scenario tuần tự, capture token/slug/id rồi verify persistence và cleanup (vd. `comments.hurl:1–124`, `auth.hurl:52–245`). Runner ép `--jobs 1`, dùng cùng `uid` cho toàn bộ files (`run-hurl-tests.sh:6–19`); mặc dù prefix loại va chạm giữa scenario, một run lỗi trước cleanup để lại dữ liệu. Plan phải có DB test reset/migration rõ ràng, unique username/email và foreign-key cascade (article delete sau comments). Không chuyển collection sang parallel nếu chưa đổi `uid` per file và xác nhận DB isolation.

## Bất nhất/giới hạn cần ghi nhận

- OpenAPI liệt kê `401` cho một số GET optional (profile/article/comment/list), nhưng Hurl xác nhận anonymous `200`; Hurl thắng cho hành vi absence-token. Invalid token optional chưa có test.
- OpenAPI chỉ nói UpdateUser "at least one field" (846–857), nhưng Hurl chưa test `{ "user": {} }`, wrapper thiếu, field lạ, `limit=0/-1/string`, token hết hạn/sai prefix, follow/favorite lặp, hoặc thứ tự comments/tags. Cần chốt rồi thêm test trước implementation nếu phạm vi yêu cầu strict contract.
- Starter chỉ có `/` Hello World, chưa prefix `/api`, global validation, auth, persistence hay error filter (`src/main.ts:1–9`, `src/app.controller.ts:1–13`, `src/app.module.ts:1–20`). Đây không phải incremental route work; plan phải dựng contract infrastructure trước feature modules.
