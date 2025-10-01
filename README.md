# Sortify – Sắp xếp playlist Spotify đa tiêu chí

Ứng dụng React + Vite xây dựng giao diện tối giản nhưng tinh tế giúp bạn đăng nhập Spotify, chọn playlist, sắp xếp theo nhiều tiêu chí và tạo playlist mới từ kết quả đã sắp xếp. Giao diện được thiết kế bằng Tailwind CSS 4.1 với bố cục sạch, điểm nhấn màu thương hiệu và hỗ trợ PKCE để đăng nhập an toàn.

## 📦 Tính năng chính

- 🔐 **Đăng nhập Spotify** bằng Authorization Code + PKCE, không cần server riêng.
- 📚 **Tự động lấy playlist** của tài khoản và dán liên kết playlist bất kỳ mà bạn có quyền truy cập.
- 🧮 **Sắp xếp nhiều tiêu chí cùng lúc** (tên bài hát, nghệ sĩ, album, ngày thêm, độ phổ biến, thời lượng, BPM, Happy/Valence, Camelot, Key) với thứ tự ưu tiên linh hoạt.
- 🆕 **Tạo playlist mới** từ danh sách đã sắp xếp, tùy chỉnh tên, mô tả và quyền công khai.
- 🎨 **Giao diện Tailwind CSS 4.1**: khoảng trắng hài hòa, điểm nhấn gradient, hỗ trợ theme tối.

## 🚀 Bắt đầu nhanh

```powershell
npm install
npm run dev
```

Ứng dụng mặc định chạy tại `http://localhost:5173`.

## 🔑 Cấu hình biến môi trường

Tạo file `.env` (tham khảo `.env.example`) và thêm các biến sau:

```env
VITE_SPOTIFY_CLIENT_ID=<Client ID từ Spotify Developer Dashboard>
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback
VITE_SPOTIFY_SCOPES=playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public user-read-email
```

> Lưu ý: URI callback phải khớp với giá trị đăng ký trong Spotify Dashboard.

## 🧭 Quy trình sử dụng

1. Đăng nhập Spotify và chấp nhận các quyền truy cập.
2. Chọn một playlist trong danh sách hoặc dán đường dẫn/URI Spotify của playlist cần xử lý.
3. Thêm/điều chỉnh các tiêu chí sắp xếp và quan sát bảng bài hát cập nhật thời gian thực.
4. Mở phần “Tạo playlist mới”, đặt tên/mô tả, chọn công khai hay không, sau đó bấm **Tạo playlist mới**.

## 🛠️ Công nghệ

- React 19 + TypeScript
- Vite 7 (Rolldown)
- Tailwind CSS 4.1 + Forms plugin
- React Router DOM

## 📚 Ghi chú & mở rộng

- Spotify API giới hạn 100 bài hát mỗi lần thêm; ứng dụng đã xử lý tự động theo lô.
- Khi refresh token hết hạn, ứng dụng sẽ yêu cầu đăng nhập lại.
- Bạn có thể tuỳ biến thêm tiêu chí sắp xếp hoặc mở rộng ra export CSV, chế độ sáng, v.v.

## 🧪 Lệnh hữu ích

```powershell
# Phân phối sản phẩm
npm run build

# Kiểm tra lint
npm run lint
```

Chúc bạn sắp xếp playlist thật nhanh chóng và truyền cảm hứng! 🎧
