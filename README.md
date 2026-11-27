# SPACE-X VOD — Cabin Entertainment & Hybrid Movie Recommendation Platform

Ứng dụng Video-on-Demand & Gợi ý Phim ảnh lấy cảm hứng từ giao diện **Space-X Video on Demand Application** (Mike Holman, Behance) với hệ thống gợi ý Hybrid (Content-Based + Item-Based Collaborative Filtering), lưu trữ **PostgreSQL**, dữ liệu chuẩn **MovieLens Latest Small**, và phát phim trực tiếp qua **VidLink Pro**.

## Tech Stack

- **Frontend:** Vite + React + TypeScript + **TanStack Router** + **TanStack Query** + **Axios** + **Redux Toolkit** (auth & preferences) + **Zustand** (cabin UI state) + **React Hook Form + Zod** + **Tailwind CSS v4** + **shadcn/ui** (Radix UI + CVA) + **Lucide React** + **Motion (Framer Motion)**
- **Backend:** Node.js + Express + TypeScript (`tsx`) + **JWT Auth** (`scrypt` + `jsonwebtoken` + `zod`)
- **Demo Account:** `claude@spacex.vod` / `SpaceX@2026` (hoặc đăng ký tài khoản mới tại `/register`)
- **Database:** PostgreSQL 16 (`pg` driver + SQL schema + automatic `InMemoryFallbackStore` nếu PostgreSQL chưa khởi chạy)
- **Streaming:** VidLink Pro (`https://vidlink.pro/movie/{tmdbId}` & `/tv/{tmdbId}/{season}/{episode}`) + `postMessage` Continue Watching listener

## Quick Start

### 1. Cài đặt dependencies
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 2. Khởi chạy PostgreSQL (Khuyến nghị)
Nếu đã cài Docker Desktop:
```bash
npm run db:up
npm run db:migrate
```
*(Nếu chưa bật PostgreSQL/Docker, backend sẽ tự động chuyển sang `InMemoryFallbackStore` với đầy đủ dữ liệu mẫu & thuật toán Hybrid Recommendation để bạn chạy thử ngay lập tức.)*

### 3. Import dataset MovieLens Latest Small (`ml-latest-small`)
Chạy script sau để tự động tải `ml-latest-small.zip` và import toàn bộ **~9,700+ phim** & **100,836 ratings** vào PostgreSQL:
```bash
npm run db:seed:movielens
```

### 4. (Tùy chọn) TMDB Global Search & Metadata Enrichment
Thêm `TMDB_API_KEY` (hoặc `TMDB_ACCESS_TOKEN`) vào `server/.env` để bật tìm kiếm trực tiếp toàn bộ kho phim/series của **TMDB** song song với PostgreSQL MovieLens và tự động lấy backdrop HD + trailer.

### 5. Chạy ứng dụng (Backend + Frontend)
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5050` (PostgreSQL Docker chạy ở cổng `5433` để tránh xung đột cổng `5432` mặc định)

## Kiến trúc Backend OOP + SOLID & Recommendation Engine

Backend (`server/src/`) và Frontend (`client/src/`) được thiết kế theo kiến trúc **OOP phân tầng** tuân thủ nghiêm ngặt **5 nguyên lý SOLID**:

| Nguyên lý | Áp dụng thực tế trong codebase |
|---|---|
| **S — Single Responsibility** | Tách `DatabaseConnection` (quản lý pool) khỏi `DatabaseSeeder` (DDL & seed); tách `HybridRecommendationService` thành `RecommendationIndexStore`, `MatchReasonExplainer`, `RecommendationFeedAssembler`; Frontend tách `useVodFeed` & `useDpadNavigation` khỏi `App.tsx`. |
| **O — Open/Closed** | `HybridRecommendationService` không hardcode tên strategy hay mood boost; mọi chiến lược (`ContentBasedStrategy`, `CollaborativeStrategy`, `PopularityPriorStrategy`, `MoodBoostStrategy`) cài đặt `IScoringStrategy` trả về cả `score` và `reason`. |
| **L — Liskov Substitution** | `MovieEntity` / `SeriesEntity` (kế thừa `MediaEntity`) và `PostgresMediaRepository` / `InMemoryMediaRepository` thay thế nhau hoàn toàn; bất biến dữ liệu chuẩn hóa qua Value Objects `RatingValue` & `WatchProgressValue`. |
| **I — Interface Segregation** | Tách config thành `IServerConfig`, `IDatabaseConfig`, `ITmdbConfig`; tách repository thành 6 interface nhỏ (`IStorageStatusProvider`, `IMediaCatalogRepository`, `IRatingRepository`, `IWatchlistRepository`, `IWatchHistoryRepository`, `IUserProfileRepository`). |
| **D — Dependency Inversion** | Controllers & Services chỉ phụ thuộc vào interface (`ICatalogService`, `IRecommendationService`, `IUserActivityService`, `IExternalMediaProvider`, `IRecommendationCacheInvalidator`). Chỉ `ServerApplication` (Composition Root) khởi tạo concrete class. |

### Luồng Recommendation & VidLink Feedback Loop

1. **Content-Based Filtering (45%):** Xây dựng vector đặc trưng từ `genres`, `tags`, `moods`, kết hợp vector sở thích người dùng (từ ratings, watchlist, tiến độ xem) bằng **Cosine Similarity**.
2. **Item-Based Collaborative Filtering (45%):** Tính ma trận tương đồng giữa các phim từ bảng `ratings` cộng đồng để dự đoán điểm cá nhân hóa.
3. **Bayesian Weighted Prior (10%):** Làm mượt cold-start theo công thức MovieLens `(v/(v+m))*R + (m/(v+m))*C`.
4. **VidLink `postMessage` Implicit Feedback:** Khi người dùng xem phim trên trình phát VidLink, ứng dụng lắng nghe sự kiện `message` từ `https://vidlink.pro`, lưu tiến độ vào bảng `watch_history` và cập nhật lại xếp hạng gợi ý theo thời gian thực.
