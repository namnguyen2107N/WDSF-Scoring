# WDSF Scoring — Hệ thống chấm điểm giải khiêu vũ thể thao

Ứng dụng chấm điểm và xếp hạng giải khiêu vũ thể thao theo Skating System (WDSF), chạy hoàn toàn trong trình duyệt, không cần backend hay internet sau khi cài đặt. Giao diện tiếng Việt, tối ưu cho tablet/điện thoại, dữ liệu lưu bằng `localStorage`.

Công nghệ: **React 19 + TypeScript + Vite + Tailwind CSS 3**, xuất Excel bằng **SheetJS**, kiểm thử bằng **Vitest**.

---

## 1. Giả định về những chỗ luật chưa thật rõ

Các giả định dưới đây được cố định trong mã nguồn. Nếu ban tổ chức dùng một bản diễn giải WDSF khác, chỉ cần sửa module `src/lib/skating.ts`, `src/lib/semifinal.ts` hoặc `src/lib/group.ts`; phần giao diện không phụ thuộc vào chi tiết thuật toán.

1. **Bán kết**: mỗi giám khảo chọn đúng **6 VĐV** và xếp hạng 1–6 cho mỗi điệu. Tổng hợp bằng số lượt được chọn giảm dần, bằng nhau thì tổng hạng nhỏ hơn. Top 6 vào chung kết.
2. **Hòa ở vị trí thứ 6 của bán kết**: hệ thống không tự chọn. Chủ tịch hội đồng chọn một trong hai cách:
   - đưa **tất cả** VĐV đồng hạng vào chung kết (chung kết có thể nhiều hơn 6 VĐV);
   - chọn thủ công **đúng 6 VĐV**.
3. **Rule 9/10 (một điệu)**:
   - Đa số = `floor(N/2) + 1`.
   - Xét hạng 1, 2, 3…; tại mỗi ngưỡng `p`, đếm số phiếu có hạng `<= p`. VĐV đạt đa số sẽ được nhận **hạng hiện tại đang cần xếp** (không phải ngưỡng `p`). Nếu chưa ai đạt đa số, tăng ngưỡng lên `p+1` và thử lại.
   - Khi nhiều VĐV cùng đạt: nhiều phiếu hơn thắng → tổng hạng (tổng các hạng giám khảo) nhỏ hơn thắng → xét tiếp số phiếu cộng dồn ở các ngưỡng kế tiếp (Rule 10).
   - Nếu vẫn bằng nhau, ghi nhận **hòa thực sự**; không tự ý phân định.
4. **Khi có hòa chưa xử lý**: các VĐV được tạm xếp các hạng liên tiếp theo thứ tự đăng ký để bảng điểm vẫn hiển thị được. Giao diện đánh dấu `*`, tô vàng và yêu cầu Chủ tịch hội đồng phân định. Quyết định được lưu và ghi lịch sử.
5. **Rule 11 (nhiều điệu)**: cộng hạng của từng điệu; tổng nhỏ hơn xếp trên. Nếu hòa tổng:
   - so số điệu đạt hạng 1, rồi hạng 2, hạng 3… (nhiều hơn thắng);
   - sau đó so tổng hạng thô của tất cả giám khảo (nhỏ hơn thắng);
   - còn bằng nhau thì ghi nhận hòa để Chủ tịch hội đồng xử lý.
6. **Đồng diễn**: tổng điểm đội = tổng điểm 5 tiêu chí của tất cả giám khảo. Tùy chọn “bỏ điểm cao nhất và thấp nhất” bỏ **1 tổng điểm giám khảo cao nhất** và **1 tổng điểm giám khảo thấp nhất**, chỉ áp dụng khi có từ 3 giám khảo trở lên. Điểm hòa được cảnh báo và Chủ tịch hội đồng phân định.
7. **Vai trò Chủ tịch hội đồng** ở phiên bản này chỉ là vai trò nghiệp vụ, không có mật khẩu/đăng nhập. Người giữ thiết bị có thể mở khóa và phân định; ban tổ chức cần kiểm soát thiết bị khi chấm chính thức.
8. **Danh mục sự kiện mặc định** gồm 41 sự kiện theo yêu cầu. Có thể thêm/sửa/xóa và chọn lại điệu. Sự kiện Đồng diễn mặc định dùng 5 tiêu chí toàn cục nhưng có thể cấu hình 2–8 tiêu chí.
9. **Dữ liệu** nằm trong `localStorage` của đúng trình duyệt/profile đang dùng. Không đồng bộ giữa các máy. Hãy sao lưu JSON trước khi xóa dữ liệu trình duyệt hoặc đổi máy.
10. **In A4** dùng CSS print của trình duyệt. Nên tắt header/footer của trình duyệt trong hộp thoại in và bật “Background graphics” nếu muốn giữ màu huy chương.

---

## 2. Chức năng chính

- **Thiết lập**:
  - thông tin giải, địa điểm, ngày, Chủ tịch hội đồng, Ban thư ký;
  - giám khảo có mã A, B, C…;
  - VĐV/đội: SBD, tên, giới tính/đôi nam nữ, đội + đơn vị, nhóm tuổi;
  - nhập nhanh từ Excel (dán trực tiếp) hoặc CSV;
  - cấu hình tên và thang điểm 5 tiêu chí đồng diễn;
  - lịch sử thay đổi.
- **Sự kiện**:
  - 41 sự kiện mặc định;
  - thêm/sửa/xóa sự kiện, chọn điệu Latin/Standard;
  - đăng ký VĐV theo đúng loại nội dung;
  - bắt đầu thi: `<= 6` VĐV thi thẳng chung kết; `>= 7` VĐV tự tạo bán kết;
  - trạng thái: Chưa thi / Đang bán kết / Đang chung kết / Hoàn tất;
  - tự chuyển sang chung kết, tự hoàn tất và khóa khi đủ điểm;
  - Chủ tịch hội đồng mở khóa để sửa, có xác nhận và ghi lịch sử.
- **Chấm điểm**:
  - bảng hàng = VĐV, cột = hạng; ô lớn 48px, phù hợp tablet;
  - chế độ “Xếp theo thứ tự” để bấm VĐV lần lượt vào hạng trống;
  - mỗi giám khảo một phiếu, mỗi điệu một tab;
  - kiểm tra thiếu hạng, trùng hạng, ô trống, điểm ngoài thang;
  - dấu tick xanh khi giám khảo nhập đủ;
  - tổng hợp bán kết trực tiếp và xử lý hòa tại chỗ;
  - bảng đồng diễn theo từng giám khảo, tự tính tổng và điểm xếp hạng.
- **Xếp hạng**:
  - huy chương vàng/bạc/đồng, top 6 và toàn bộ chung kết;
  - tab kết quả, chi tiết giám khảo, bảng Skating đầy đủ;
  - bảng tổng hợp toàn giải theo nội dung;
  - xử lý hòa bằng Chủ tịch hội đồng, lưu quyết định;
  - in A4.
- **Xuất**:
  - Excel nhiều sheet;
  - sao lưu/khôi phục JSON toàn giải;
  - bản in tổng hợp toàn giải;
  - nạp lại dữ liệu mẫu hoặc xóa toàn bộ.

---

## 3. Cài đặt và chạy

Yêu cầu Node.js 20.19+ (khuyến nghị 22 hoặc 24).

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`. Vite được cấu hình lắng nghe `0.0.0.0`, nên có thể mở từ tablet/điện thoại trong cùng mạng LAN bằng địa chỉ IP của máy chạy (ví dụ `http://192.168.1.20:5173`).

Muốn chạy trực tiếp không cần máy chủ web, mở `dist/index.html` hoặc `docs/index.html`. Bản build là một file HTML duy nhất, đã nhúng toàn bộ mã ứng dụng, thư viện và CSS, hoạt động hoàn toàn offline trên mọi trình duyệt mà không cần cài đặt. File `index.html` ở thư mục gốc có tích hợp sẵn bộ chuyển hướng thông minh tự động mở bản build khi mở offline.

Build bản production hoặc cập nhật bản HTML độc lập:

```bash
npm run build
npm run preview
```

Chạy kiểm thử:

```bash
npm test
```

Chạy test ở chế độ watch:

```bash
npm run test:watch
```

Sau lần cài đặt đầu tiên, ứng dụng không cần internet. Không có font, ảnh hay API bên ngoài.

---

## 4. Hướng dẫn sử dụng nhanh

### Bước 1 — Thiết lập giải

1. Vào **Thiết lập → Thông tin giải**, nhập tên giải, địa điểm, ngày, Chủ tịch hội đồng, Ban thư ký. Bấm **Lưu thông tin**.
2. Vào **Giám khảo**, thêm các mã A, B, C… hoặc dùng **Nhập nhanh** (mỗi dòng `Mã, Họ tên`).
3. Vào **Vận động viên**:
   - thêm từng VĐV/đội, hoặc
   - bấm **Nhập Excel / CSV**, dán trực tiếp vùng dữ liệu từ Excel hoặc chọn tệp CSV. Nên giữ hàng tiêu đề:
     `SBD, Loại, Tên, Nam, Nữ, Đội, Đơn vị, Nhóm tuổi`.
4. Vào **Tiêu chí đồng diễn** nếu muốn đổi tên/ thang điểm.

### Bước 2 — Chuẩn bị sự kiện

1. Vào **Sự kiện**, chọn sự kiện (trên tablet dùng ô “Chọn sự kiện”).
2. Bấm **Quản lý đăng ký**, chọn các VĐV/đội phù hợp. Chỉ đăng ký được khi sự kiện đang “Chưa thi”.
3. Bấm **Bắt đầu chấm**:
   - sự kiện có 7 VĐV trở lên tự tạo bán kết;
   - sự kiện có 2–6 VĐV thi trực tiếp chung kết;
   - Đồng diễn chấm trực tiếp một vòng.

### Bước 3 — Chấm điểm

1. Vào **Chấm điểm**, chọn sự kiện.
2. Chọn giám khảo, chọn điệu (nếu có nhiều điệu).
3. Chấm bằng bảng:
   - bấm ô giao giữa hàng VĐV và cột hạng để xếp;
   - ô xanh là VĐV đang ở hạng đó;
   - ô vàng là hạng đang do VĐV khác giữ – bấm để thay thế;
   - bấm lại ô xanh của chính VĐV để bỏ.
4. Hoặc chọn **Xếp theo thứ tự**, bấm lần lượt VĐV để đưa vào hạng trống tiếp theo.
5. Bán kết:
   - mỗi giám khảo chọn 6 VĐV, hạng 1–6;
   - khi tất cả giám khảo và tất cả điệu đủ điểm, hệ thống tự tạo chung kết nếu không hòa ở vị trí thứ 6;
   - nếu hòa, màn hình tổng hợp bán kết hiện cảnh báo vàng để Chủ tịch hội đồng quyết định.
6. Chung kết:
   - mỗi giám khảo xếp hạng toàn bộ VĐV chung kết;
   - đủ điểm toàn bộ thì hệ thống tự hoàn tất và khóa kết quả;
   - Chủ tịch hội đồng có thể mở khóa để sửa, mọi thay đổi được ghi lịch sử.
7. Đồng diễn:
   - chọn giám khảo, nhập 5 tiêu chí cho từng đội;
   - ô trống/ngoài thang bị cảnh báo;
   - bảng tổng hợp bên dưới cập nhật ngay.

### Bước 4 — Xếp hạng và công bố

1. Vào **Xếp hạng**, chọn sự kiện:
   - tab **Kết quả**: huy chương, bảng hạng, điểm/hạng;
   - tab **Chi tiết giám khảo**: phiếu của từng giám khảo;
   - tab **Bảng Skating**: điểm từng giám khảo, số phiếu cộng dồn, tổng hạng, hạng cuối;
   - tab **Bán kết**: danh sách top 6 và danh sách chung kết đã chốt.
2. Nếu có hòa, bấm **Chủ tịch phân định**, sắp xếp thứ tự bằng nút lên/xuống và lưu. Quyết định được áp dụng ngay và ghi lịch sử.
3. Bấm **In A4**. Chọn khổ A4, tắt header/footer của trình duyệt, bật Background graphics nếu cần.
4. Chuyển **Tổng hợp toàn giải** để xem top 3 của mọi nội dung.

### Bước 5 — Xuất và sao lưu

1. Vào **Xuất**:
   - **Xuất file Excel**: toàn giải hoặc một sự kiện;
   - **Tải bản sao lưu**: tạo tệp JSON toàn bộ dữ liệu;
   - **Khôi phục từ tệp JSON**: thay thế dữ liệu hiện tại sau khi xác nhận;
   - **Bản in tổng hợp**: xem trước và in A4 toàn giải;
   - **Nạp lại dữ liệu mẫu** hoặc **Xóa toàn bộ**.
2. Nên sao lưu JSON sau mỗi buổi chấm và trước khi xóa dữ liệu trình duyệt.

---

## 5. Dữ liệu mẫu

Khi mở lần đầu (hoặc sau khi nạp dữ liệu mẫu), ứng dụng tạo:

- **7 giám khảo** mã A–G;
- **24 VĐV/đội**: 12 solo, 8 couple, 4 đội đồng diễn;
- **41 sự kiện** theo danh mục yêu cầu;
- 7 sự kiện có dữ liệu minh họa:
  - **Solo Latin – 5 điệu**: 9 VĐV, có bán kết + chung kết, đã hoàn tất;
  - **Couple Latin – 3 điệu**: 8 VĐV, có bán kết + chung kết, đã hoàn tất;
  - **Newbie Couple – Cha cha cha**: 5 VĐV, chung kết trực tiếp, đã hoàn tất;
  - **Đồng diễn**: 4 đội, đã hoàn tất, bật bỏ điểm cao nhất/thấp nhất;
  - **Solo Standard – Tango**: 7 VĐV, đang bán kết (4/7 giám khảo đã nhập);
  - **Solo Standard – Slow Waltz**: 5 VĐV, đang chung kết (3/7 giám khảo đã nhập);
  - **Solo Latin – Samba**: 7 VĐV, chưa thi.

Các sự kiện còn lại đang trống để ban tổ chức tự đăng ký.

---

## 6. Cấu trúc thư mục

```text
.
├─ index.html
├─ package.json
├─ vite.config.ts
├─ vitest.config.ts
├─ tailwind.config.js
├─ postcss.config.js
├─ tsconfig.json
├─ public/
│  └─ robots.txt
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ index.css
   ├─ types.ts
   ├─ components/
   │  ├─ Layout.tsx
   │  ├─ ui.tsx                  # Button, Modal, Badge, Callout, Field…
   │  ├─ icons.tsx
   │  ├─ JudgingMatrix.tsx       # Bảng chấm hàng × hạng + chế độ xếp nhanh
   │  ├─ SemifinalSummary.tsx    # Tổng hợp và chốt bán kết
   │  ├─ GroupJudging.tsx        # Chấm đồng diễn
   │  ├─ SkatingTables.tsx       # Bảng Skating + modal phân định hòa
   │  └─ ImportAthletesModal.tsx
   ├─ lib/
   │  ├─ constants.ts            # Điệu, nội dung, 41 sự kiện mặc định
   │  ├─ skating.ts              # Rule 9/10/11, hòa, áp dụng quyết định
   │  ├─ skating.test.ts
   │  ├─ semifinal.ts            # Tổng hợp bán kết + kiểm tra dữ liệu
   │  ├─ semifinal.test.ts
   │  ├─ group.ts                # Điểm đồng diễn, bỏ high/low
   │  ├─ group.test.ts
   │  ├─ results.ts              # Ghép dữ liệu sự kiện → kết quả
   │  ├─ eventFlow.ts            # Tự chuyển bán kết → chung kết → hoàn tất
   │  ├─ eventFlow.test.ts
   │  ├─ rounds.ts               # Khởi tạo cấu trúc điểm
   │  ├─ csv.ts                  # Dán Excel / CSV
   │  ├─ csv.test.ts
   │  ├─ report.ts               # Tổng hợp kết quả cho Excel/in
   │  ├─ xlsx.ts                 # Xuất Excel bằng SheetJS
   │  └─ utils.ts
   ├─ pages/
   │  ├─ SetupPage.tsx
   │  ├─ EventsPage.tsx
   │  ├─ JudgingPage.tsx
   │  ├─ RankingPage.tsx
   │  └─ ExportPage.tsx
   └─ store/
      ├─ AppStore.tsx            # Context + localStorage + actions
      └─ seed.ts                 # Dữ liệu mẫu
```

---

## 7. Thuật toán và kiểm thử

Module lõi nằm ở:

- `src/lib/skating.ts` — xếp hạng một điệu và nhiều điệu;
- `src/lib/semifinal.ts` — bán kết và kiểm tra điểm;
- `src/lib/group.ts` — đồng diễn;
- `src/lib/eventFlow.ts` — tự động chuyển vòng;
- `src/lib/results.ts` — tổng hợp cho giao diện.

Các nhóm test hiện có (**50 test**):

- đa số đúng với 1, 4, 5, 7 giám khảo;
- xếp hạng rõ ràng, ít hơn 6 VĐV;
- không ai đạt đa số ở hạng 1 và phải nới ngưỡng;
- hòa số phiếu, xét tổng hạng;
- bước phân định tiếp theo của Rule 10;
- hòa thực sự và hòa có phân bố hạng khác nhau nhưng cùng số phiếu cộng dồn;
- áp dụng quyết định phân định của Chủ tịch hội đồng;
- Rule 11: tổng hạng, số điệu hạng 1, tổng hạng thô, hòa tổng;
- bán kết: cộng lượt chọn, nhiều điệu, hòa vị trí thứ 6;
- đồng diễn: tổng điểm, bỏ cao nhất/thấp nhất, hòa, thiếu điểm;
- tự chuyển vòng bán kết → chung kết, không chuyển khi hòa, chung kết → hoàn tất;
- nhập CSV/Excel và nhập giám khảo;
- dữ liệu mẫu hợp lệ.

Chạy `npm test` để xem toàn bộ.

---

## 8. Xuất Excel và in

### Excel

Tệp `.xlsx` có các sheet:

- **Thông tin giải**;
- **Tổng hợp sự kiện**;
- **Kết quả chung kết**;
- **Đồng diễn**;
- **Bán kết**;
- **Chi tiết giám khảo** (từng vòng/điệu/giám khảo);
- **Điểm đồng diễn** (từng tiêu chí);
- **Giám khảo**;
- **Vận động viên**;
- **Đăng ký**.

Có thể chọn xuất toàn giải hoặc một sự kiện. Thư viện SheetJS được tải theo nhu cầu (lazy chunk) để giảm dung lượng tải ban đầu.

### In

- Khổ A4 portrait, lề 12mm.
- Header/footer/nav của ứng dụng được ẩn khi in.
- Bảng xếp hạng sự kiện có tiêu đề giải, hội đồng giám khảo, huy chương, bảng kết quả, và ô ký.
- Bảng Skating tự ngắt trang theo từng điệu; cột giám khảo, số phiếu cộng dồn và tổng hạng được giữ đầy đủ.
- Bản tổng hợp toàn giải in theo từng nội dung.

Lưu ý: header/footer trình duyệt (ngày giờ, URL) do trình duyệt chèn, không do ứng dụng. Tắt trong hộp thoại in nếu không muốn.

---

## 9. Lưu trữ, sao lưu và giới hạn

- Khóa lưu: `wdsf-dance-scoring-v1` trong `localStorage`.
- Tự động lưu sau mỗi thay đổi (debounce 150ms), lưu thêm khi đóng tab.
- Tệp JSON chứa toàn bộ `settings`, `judges`, `athletes`, `events`, `history`.
- Khôi phục sẽ **thay thế** toàn bộ dữ liệu hiện tại.
- Không có backend, không đồng bộ đa thiết bị, không đăng nhập.
- Dữ liệu có thể mất nếu xóa dữ liệu trình duyệt, dùng chế độ ẩn danh hoặc đổi profile. Hãy sao lưu JSON thường xuyên.
- Dung lượng dữ liệu mẫu rất nhỏ (khoảng vài chục KB), nhưng lịch sử thay đổi có thể tăng dần; lịch sử được giới hạn 1.500 mục gần nhất.

---

## 10. Ghi chú triển khai

- Số báo danh được kiểm tra trùng trên toàn giải; đăng ký sự kiện chỉ nhận đúng loại VĐV (Solo / Couple / Đội).
- Xóa giám khảo hoặc VĐV đang có dữ liệu sẽ bị chặn để bảo toàn kết quả.
- Sự kiện đã bắt đầu không thể sửa danh sách đăng ký; dùng “Đưa về chưa thi” nếu cần làm lại.
- Sự kiện hoàn tất sẽ tự khóa. Chủ tịch hội đồng mở khóa; mỗi lần sửa điểm khi mở khóa được ghi lịch sử với tên Chủ tịch hội đồng.
- Nút xóa, đưa về chưa thi, mở khóa, khôi phục JSON và xóa toàn bộ đều có hộp xác nhận.
- Giao diện dùng font hệ thống, không tải font ngoài; chữ số có `tabular-nums`; nút và ô chấm tối thiểu 44–48px.
- Màu trạng thái: xám = chưa thi, xanh dương = đang thi, xanh lá = hoàn tất, vàng = cảnh báo hòa/cần xử lý.

---

## 11. Các lệnh hữu ích

```bash
npm run dev        # chạy development, truy cập từ LAN
npm run build      # kiểm tra type + build production
npm run preview    # chạy bản build production
npm test           # chạy toàn bộ test
npm run test:watch # test watch mode
```

---

## 12. Hướng phát triển tiếp

- Thêm backend/đồng bộ nhiều thiết bị và phân quyền thật cho giám khảo/Chủ tịch.
- Xuất PDF trực tiếp thay vì phụ thuộc hộp thoại in.
- Nhập trực tiếp tệp `.xlsx` (hiện hỗ trợ dán từ Excel và CSV).
- Khóa dữ liệu theo giải/phiên và lưu nhiều giải song song.
- Tùy chọn in bảng Skating khổ A4 landscape.

---

## 13. Đẩy code lên GitHub

Repository: `https://github.com/namnguyen2107N/WDSF-Scoring`

Nhánh `master` đã được thiết lập theo dõi `origin/master`. Có hai cách đẩy code:

```bash
# Cách thường dùng
git add -A
git commit -m "feat: mo ta thay doi"
git push
```

Hoặc dùng script có sẵn (tự add, commit nếu có thay đổi, rồi push; tự đặt upstream nếu cần):

```bash
npm run push:github
```

Có thể truyền commit message trực tiếp:

```bash
npm run push:github -- "fix: sua loi cham diem"
```

Lưu ý:

- Không commit `node_modules/`, `dist/` hoặc tệp `.env`; các mục này đã nằm trong `.gitignore`.
- Nếu GitHub yêu cầu đăng nhập, dùng Git Credential Manager hoặc Personal Access Token. Không lưu mật khẩu GitHub dạng plaintext trong Git config.
- Nếu push bị từ chối vì lịch sử khác nhau, chạy `git pull --rebase origin master` rồi push lại; không dùng `--force` trừ khi hiểu rõ hậu quả.

---

## 14. GitHub Pages

Website công khai: `https://namnguyen2107N.github.io/WDSF-Scoring/`

Repo đã có workflow `.github/workflows/deploy.yml`:

- chạy khi push lên nhánh `master` hoặc chạy tay bằng `workflow_dispatch`;
- cài dependency bằng `npm ci`;
- chạy `npm test`;
- build bằng `npm run build`;
- deploy thư mục `dist` lên GitHub Pages.

Pages của repo được đặt ở chế độ **GitHub Actions** (không phải “Deploy from a branch”). Vì vậy không cần commit thư mục `dist`. Sau mỗi lần push, vào tab **Actions** của repo để theo dõi lượt deploy.

