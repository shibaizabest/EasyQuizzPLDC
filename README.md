# Easy Quiz

Easy Quiz là web trắc nghiệm tối giản dùng để ôn tập môn học. Dự án chạy hoàn toàn ở phía trình duyệt bằng HTML, CSS và JavaScript thuần; không cần đăng nhập, backend, cơ sở dữ liệu, thư viện ngoài hay bước build.

## Cấu trúc dự án

```txt
.
├─ index.html
├─ style.css
├─ app.js
├─ README.md
└─ data/
   ├─ index.json
   ├─ logic.quiz
   └─ graph.quiz
```

## Chạy local

Do trình duyệt không cho `fetch()` file cục bộ qua giao thức `file://`, hãy chạy dự án bằng một web server đơn giản.

### Dùng VS Code Live Server

1. Mở thư mục dự án trong VS Code.
2. Cài extension **Live Server** nếu chưa có.
3. Nhấp phải vào `index.html`, chọn **Open with Live Server**.

### Dùng Python

```bash
python -m http.server 8000
```

Sau đó mở `http://localhost:8000`.

## Thêm quiz mới

1. Tạo file mới trong thư mục `data`, ví dụ `set.quiz`.
2. Viết câu hỏi theo format bên dưới.
3. Thêm quiz vào `data/index.json`:

```json
{
  "id": "set",
  "title": "Chương 3: Lý thuyết tập hợp",
  "description": "Ôn tập các phép toán trên tập hợp.",
  "file": "set.quiz",
  "count": 10
}
```

`id` nên ngắn gọn, không trùng nhau. Trường `description` và `count` có thể bỏ qua. Nếu có `count`, hãy cập nhật nó khi thay đổi số câu hỏi.

## Format file `.quiz`

```txt
# Quiz: Chương 1 - Logic mệnh đề

Q: Mệnh đề nào sau đây là hằng đúng?
A. p ∧ ¬p
B. p ∨ ¬p
C. p → ¬p
D. ¬p ∧ p
ANSWER: B
EXPLAIN: p ∨ ¬p luôn đúng vì một mệnh đề hoặc đúng hoặc sai.

---

Q: Phủ định của "Mọi sinh viên đều chăm học" là gì?
A. Mọi sinh viên đều không chăm học
B. Có ít nhất một sinh viên không chăm học
C. Không có sinh viên nào chăm học
D. Có ít nhất một sinh viên chăm học
ANSWER: B
```

Quy ước:

- File có một dòng tiêu đề bắt đầu bằng `# Quiz:`.
- Mỗi câu bắt đầu bằng `Q:` và có đủ bốn đáp án `A.`, `B.`, `C.`, `D.`.
- `ANSWER:` nhận một trong bốn giá trị `A`, `B`, `C`, `D`.
- `EXPLAIN:` là tùy chọn. Nếu thiếu, web hiển thị “Chưa có giải thích.”
- Phân tách các câu bằng một dòng `---`.
- Nội dung của mỗi trường nên nằm trên cùng một dòng.
- Parser hỗ trợ cả newline Windows (`CRLF`) và Unix (`LF`), đồng thời bỏ qua dòng trống thừa.

Nếu dữ liệu sai format, giao diện sẽ hiển thị số thứ tự câu và phần bị thiếu hoặc không hợp lệ.

## Deploy lên Cloudflare Pages

Dự án không có bước build nên có thể deploy trực tiếp.

### Kết nối Git

1. Đẩy thư mục dự án lên GitHub hoặc GitLab.
2. Trong Cloudflare Dashboard, vào **Workers & Pages** → **Create** → **Pages** → kết nối repository.
3. Chọn repository và cấu hình:
   - **Framework preset:** None
   - **Build command:** để trống
   - **Build output directory:** `.` (hoặc thư mục chứa `index.html` nếu dự án nằm trong thư mục con)
4. Chọn **Save and Deploy**.

### Upload trực tiếp

Trong Cloudflare Pages, chọn Direct Upload rồi tải lên toàn bộ thư mục dự án. Cần giữ nguyên thư mục `data` và các file `.quiz`.

Hash route (`#/quiz/logic`) hoạt động ngay trên hosting tĩnh và vẫn tải đúng quiz sau khi reload, không cần cấu hình rewrite.

## Lưu ý

- Điểm gần nhất và điểm cao nhất được lưu bằng `localStorage` trên từng trình duyệt, không đồng bộ giữa thiết bị.
- Đây là web tĩnh nên người dùng có thể xem đáp án trong các file `.quiz`. Dự án phù hợp để ôn tập, không phù hợp để tổ chức thi thật hoặc bảo mật đáp án.
- Link ủng hộ Shopee trong `app.js` được đánh dấu là liên kết được tài trợ bằng `rel="sponsored"`.
- Khi sử dụng liên kết tiếp thị liên kết hoặc quảng cáo, cần mô tả minh bạch, tuân thủ chính sách của nền tảng và ưu tiên trải nghiệm người học.
