# Coder thích chơi đàn

Blog và nhật ký cá nhân của @coderthichchoidan: một ứng dụng Next.js duy nhất chạy cùng PostgreSQL, code theo
tài liệu *“Coder thích chơi đàn: Thiết kế backend”* và canvas thiết kế giao diện (Home, Blogs, Projects, About,
Admin: Dashboard, Posts, Editor, Manage).

- Trang public được prerender và cache ở CDN; admin và editor chạy động, chỉ cho chủ blog.
- 5 chế độ hiển thị: Public, Unlisted, Members, Shared, Private. Quyền đọc đi qua một hàm duy nhất `canRead()`
  và được PostgreSQL Row-Level Security chặn thêm một lớp.
- Editor kiểu Notion (Tiptap 3): khối, lệnh `/`, Markdown hai chiều, LaTeX, code, bảng, ảnh, YouTube;
  autosave 1 giây sau khi ngừng gõ, lưu tạm trên máy (IndexedDB), chống ghi đè giữa hai thiết bị, lịch sử phiên bản.
- Email bài mới (đăng ký 2 bước), tìm kiếm không dấu và gõ sai vẫn ra, thanh lệnh `:` kiểu vim.

## Chạy ở máy

Cần Node 22 và Docker.

```bash
cp .env.example .env.local
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Mở http://localhost:3000. Đăng nhập admin tại `/sign-in?next=/admin` bằng email trong `OWNER_EMAIL`: khi chưa có
`RESEND_API_KEY`, mọi email (link đăng nhập, xác nhận đăng ký, email bài mới) được in ra log của `npm run dev`.
Sau lần đăng nhập đầu, vào *Manage › Settings › Add a passkey* để lần sau đăng nhập bằng vân tay / Face ID.

Việc chạy nền (gửi email theo lô, đăng bài hẹn giờ, dọn revision, gom lượt xem) dùng Inngest. Ở máy, không có
Inngest thì việc được chạy ngay trong tiến trình (không retry). Muốn chạy đúng như production:

```bash
npx inngest-cli@latest dev
```

rồi đặt `INNGEST_DEV=1` trong `.env.local`.

### Lệnh hay dùng

| Lệnh | Việc |
| --- | --- |
| `npm run typecheck` / `npm run lint` | TypeScript strict, ESLint |
| `npm test` | Vitest: `canRead`, renderer, Markdown, token, webhook. Đặt `TEST_DATABASE_URL` để chạy thêm test DB (RLS, autosave conflict, tìm kiếm) |
| `npm run test:e2e` | Playwright: đọc bài, chặn bài riêng tư, thanh lệnh, đăng ký email, viết rồi publish, mở link Shared (cần `npm run build` và DB đã seed) |
| `npm run check:js` | Ngân sách JavaScript trang đọc bài (server phải đang chạy) |
| `npm run db:generate` | Tạo migration sau khi sửa `lib/db/schema.ts` |

## Cấu trúc

```text
app/
  (site)/            Home, Blogs, Blogs/[slug], Projects, About, /u/[token], /read/[id], sign-in
  (admin)/admin/     dashboard, posts, editor/[id], manage
  api/               auth, search, subscribe (+confirm), unsubscribe, webhooks/email, health, inngest, media, views
  og/[slug]          ảnh OG; rss.xml; sitemap.ts; robots.ts
components/
  ds/                component từ design system (Ctcd.*) + tokens.css, ds.css
  site/              header, thanh lệnh, globe + player, terminal, danh sách bài
  editor/            Tiptap, ribbon, menu "/", panel, autosave
  admin/             sidebar, bảng bài viết, trang Manage
lib/
  access-rules.ts    canRead() và các quy tắc thuần (không DB)
  access.ts          getViewer(), requireOwner()
  db/                schema.ts, client.ts (withScope cho RLS), queries/
  content/           JSON -> HTML (whitelist), KaTeX, Shiki, Markdown <-> JSON
  drafts.ts          autosave với khóa lạc quan (draft_version)
  publish.ts         đường publish duy nhất (nút Publish và job hẹn giờ đều gọi)
  jobs/              Inngest: gửi campaign, đăng hẹn giờ, dọn revision, gom lượt xem
  email/, storage.ts, search.ts, rate-limit.ts, cache-tags.ts, log.ts
emails/              template React Email
drizzle/             migration SQL (0002 = RLS, hàm tìm kiếm, locked_post_stubs)
tests/               unit/, integration/, e2e/
content/             nội dung trang About và "Now working on" (sửa file rồi deploy)
```

Quy tắc: component trong `app/` không gọi database trực tiếp mà đi qua `lib/db/queries`, và mọi truy vấn có thể trả
bài không công khai đều nhận viewer làm tham số.

## Quyền đọc và bảo mật

- `canRead(viewer, post)` trong `lib/access-rules.ts` là nơi duy nhất quyết định ai đọc được gì (có test đủ 5 chế độ).
- RLS: app kết nối bằng role `ctcd_app` (không sở hữu bảng). Mỗi truy vấn chạy trong `withScope()`, gắn
  `app.role`, `app.email`… vào transaction; policy trong `drizzle/0002_rls_search.sql` chặn lại nếu code có lỗi.
- Thẻ bài bị khóa chỉ nhận ngày, collection và chế độ (hàm `locked_post_stubs()`); tiêu đề và nội dung không bao giờ
  được gửi xuống trình duyệt của người không có quyền. Thẻ khóa trỏ tới `/read/<id>`, không lộ slug.
- Cache dùng chung chỉ chứa bài Public và Unlisted. Đổi chế độ hay publish gọi `revalidateTag(..., { expire: 0 })`
  nên bài vừa chuyển sang Private không bao giờ còn được phục vụ từ cache.
- Nội dung bài lưu dạng JSON của Tiptap, render ra HTML bằng renderer whitelist; link chỉ `http(s)`/`mailto`,
  ảnh chỉ từ R2 của mình, embed chỉ `youtube-nocookie.com`, KaTeX chạy `trust: false`.
- `/admin` có CSP dùng nonce theo từng request (`proxy.ts`); trang public dùng CSP tĩnh (xem phần "Khác với tài liệu").
- Ảnh nhật ký nằm ở bucket R2 private, chỉ trả URL ký 5 phút sau khi kiểm tra quyền; trình duyệt xóa EXIF (GPS)
  trước khi upload.

## Triển khai

1. **Database**: Postgres 17 vùng Tokyo (Neon hoặc Supabase). Tạo role `ctcd_app` theo `scripts/db/init-roles.sql`.
   `MIGRATION_DATABASE_URL` là role sở hữu schema, `DATABASE_URL` là `ctcd_app` (qua pooler).
2. **Vercel**: nối repo, function region `hnd1` (đã đặt trong `vercel.json`). Build chạy `npm run vercel-build`
   = `drizzle-kit migrate && next build`, nên migration luôn chạy trước khi deploy. Migration theo kiểu chỉ thêm
   (thêm cột, backfill, xóa cột cũ ở lần deploy sau). Preview: bật Neon integration để mỗi PR có một branch DB.
3. **Biến môi trường**: xem `.env.example` (Resend, Inngest, Upstash, R2, Turnstile, Sentry).
4. **Email**: dùng miền phụ riêng (vd. `mail.coderthichchoidan.dev`) với SPF, DKIM, DMARC; webhook Resend trỏ về
   `/api/webhooks/email`.
5. **R2**: hai bucket (public, private) + CORS cho phép `PUT` từ domain của site; bật versioning cho bucket ảnh.
6. **Giám sát**: Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`), uptime check 1 phút/lần vào `/` và `/api/health`.
7. **Sao lưu**: workflow `backup.yml` dump Postgres mỗi đêm lên R2 (giữ 30 ngày bằng lifecycle rule);
   `restore-drill.yml` mỗi tháng khôi phục bản mới nhất vào DB tạm để chắc chắn bản sao lưu dùng được.

CI (`.github/workflows/ci.yml`) chạy mỗi PR: typecheck, lint, migrate trên DB trống + `drizzle-kit check`,
Vitest (kèm test DB), build, Playwright, ngân sách JS và Lighthouse CI.

## Khác với tài liệu thiết kế

- **CSP**: tài liệu ghi CSP dùng nonce. Nonce cần render theo từng request, không dùng được cho trang đã prerender ở
  CDN (Next.js ghi rõ PPR không tương thích nonce). Vì vậy nonce chỉ áp cho `/admin`; trang public dùng CSP tĩnh có
  `'unsafe-inline'` cho script (ngoài ra vẫn chặn frame, object, nguồn ảnh…). SRI thử nghiệm của Next.js bị tắt vì
  nó làm Next bỏ nonce trên script của admin.
- **Ngân sách JS 70 KB**: riêng runtime React + Next.js đã khoảng 170 KB gzip trên mọi trang, không thể giảm.
  `npm run check:js` đo phần JS của chính ứng dụng trên runtime đó (hiện khoảng 11 KB ở trang đọc bài).
- **Sentry phía trình duyệt** chỉ tải SDK khi có lỗi xảy ra, để không thêm ~75 KB cho người đọc.
- **Ảnh OG** được tạo theo yêu cầu và cache; job publish gọi trước một lần cho nóng cache.
- Danh sách bài (Home, Blogs) luôn là bản dành cho khách để giữ được cache CDN; người được chia sẻ bấm thẻ khóa
  sẽ được kiểm tra quyền và chuyển tới bài.

## Việc còn chờ quyết định

Theo mục "Việc cần bạn quyết trước khi code" trong tài liệu: host (đang cấu hình sẵn cho Vercel), tên miền và miền
gửi email, Resend hay SES, analytics, bình luận (chưa làm), và ngôn ngữ của nhật ký/blog (tìm kiếm đang dùng cấu
hình `simple` + bỏ dấu, chưa có cột `lang`). Các giá trị trong ngoặc vuông ở `content/about.ts` và `content/now.ts`
là chỗ để điền thông tin thật.
