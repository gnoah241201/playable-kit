# Playable Kit (web)

Công cụ chạy hoàn toàn trên trình duyệt: mở một playable ads, đổi tên game và link store, thay asset, xem trước kèm SDK giả lập, rồi xuất file cho **AppLovin / MRAID** và **Mintegral**.

> Chỉ dùng với playable bạn sở hữu hoặc được cấp quyền chỉnh sửa. Repo không chứa playable nào; mở file của bạn khi chạy app.

## Chạy
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # xuất bản tĩnh vào dist/
```

## Tính năng
| | |
|---|---|
| **Mở file** | `.html` (AppLovin/MRAID, Luna) hoặc `.zip` (Mintegral). Không upload đi đâu. |
| **Kiểm tra** | Nhận diện engine và mạng gốc, link store gốc, analytics có bật hay không, URL lạ. |
| **Store & tên game** | Thay mọi chỗ link store gốc xuất hiện trong file. |
| **Thay asset** | Ảnh, âm thanh và từng khung spritesheet (TexturePacker). Ảnh mới được tự co vừa kích thước gốc. Spritesheet chỉ đóng gói lại khi có khung bị thay, các phần khác giữ nguyên từng byte. |
| **Xem trước** | Chế độ AppLovin/MRAID và Mintegral với SDK giả lập. Thanh dưới cùng ghi lại `gameReady`, `gameStart`, `gameEnd`, `install` / `mraid.open`. |
| **Xuất file** | `.html` (MRAID), `_mintegral.zip` (index.html + bridge gameReady/gameStart/gameClose/gameEnd/install), `_applovin.js` (al_renderHtml), loader test. Kèm checklist kiểm tra (dung lượng 5 MB, URL ngoài, analytics, hàm SDK). |

Thay asset và xuất Mintegral hỗ trợ playable **PixiJS + webpack** nhúng asset base64. Với build Luna chỉ đổi được tên game và link store.

## Cấu trúc
```
src/kit/        lõi xử lý (không phụ thuộc React)
  webpack.ts      tìm asset module nhúng base64
  spritesheet.ts  tách / đóng gói lại spritesheet TexturePacker
  networks.ts     nhận diện engine/mạng, link store, chuyển sang Mintegral
  project.ts      PlayableProject: nạp, thay asset, build, validate
  preview.ts      SDK giả lập cho iframe xem trước (không nằm trong file xuất)
src/components/ UploadZone, ConfigModal, AssetsModal, DownloadModal
```
Bản CLI/Python cho AI agent và CI: https://github.com/gnoah241201/playable-asset. Hai bản dùng cùng logic, và file xuất ra từ app này đã được kiểm tra bằng `validate` và `smoke` của bản CLI.
