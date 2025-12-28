```markdown
# Quiz-site (No admin modal)

Phiên bản này đã loại bỏ cửa sổ admin/login để bạn có thể dùng ngay.

Các file:
- index.html: giao diện chính (không có admin modal)
- styles.css: phong cách
- app.js: logic (load từ questions.csv, shuffle, timer, submit result)
- questions.csv: mẫu câu hỏi

Cách dùng nhanh:
1. Chỉnh sửa `questions.csv` (format: id,question,A,B,C,D,answer)
2. Nếu muốn gửi kết quả lên Google Sheets, triển khai Google Apps Script như hướng dẫn trước và cập nhật `GAS_ENDPOINT` trong `app.js`.
3. Push repo lên GitHub và bật GitHub Pages (Settings → Pages → chọn branch main / root).
4. Mở site, nhập Số câu & Thời gian → Bắt đầu làm bài.

Lưu ý:
- Hiện parser CSV hỗ trợ trường có dấu phẩy nếu được quote (").
- Đây là trang tĩnh => mọi logic chạy trên client. Nếu cần chấm điểm an toàn hơn, lưu đáp án đúng và chấm ở server (GAS).
```