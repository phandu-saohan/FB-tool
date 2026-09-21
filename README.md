# Facebook Automation Engine (browser-use, Playwright & FastAPI)

Hệ thống tự động hóa tìm kiếm Facebook Group/Page, quản lý profile đăng nhập bền vững (Persistent Browser Context), sáng tạo nội dung bài đăng thông minh với AI Studio (Google Gemini, OpenAI, OpenRouter) và hỗ trợ hàng đợi đăng bài tuần tự, an toàn, tuân thủ giới hạn nền tảng.

---

## 🌟 Tính năng Nổi bật

1. **Persistent Browser Context**:
   - Lưu trữ Cookies, LocalStorage, Session Facebook và trạng thái đăng nhập vào thư mục `./profiles/facebook`.
   - Người dùng chỉ cần đăng nhập tài khoản Facebook thủ công duy nhất ở lần đầu tiên.
   - Các lần chạy tiếp theo tự động tái sử dụng phiên, không cần đăng nhập lại.
   - Tuyệt đối không lưu tài khoản hay mật khẩu Facebook trong mã nguồn hay database.

2. **Cơ chế Checkpoint Guard (An toàn tuyệt đối)**:
   - Tự động nhận diện URL và nội dung trang khi Facebook kích hoạt Checkpoint, CAPTCHA, xác minh danh tính 2 bước hoặc khóa tài khoản tạm thời.
   - Khi phát hiện: Lập tức **DỪNG TỰ ĐỘNG HÓA**, chuyển trạng thái `ACTION_REQUIRED`, ghi log cảnh báo và thông báo người dùng thao tác trực tiếp trên cửa sổ trình duyệt.
   - **Không cố tình bypass CAPTCHA hoặc Checkpoint**, tuân thủ nguyên tắc an toàn.

3. **Tìm kiếm Groups & Pages**:
   - Tự động tìm kiếm theo từ khóa (Ví dụ: *phẫu thuật thẩm mỹ*, *bác sĩ thẩm mỹ*, *spa Việt Nam*...).
   - Bóc tách: Tên, đường dẫn URL, số lượng thành viên/người theo dõi, quyền riêng tư (Public/Private), danh mục.
   - Cơ chế chống trùng lặp (Deduplication) tự động dựa trên URL và Facebook ID.

4. **AI Content Studio**:
   - Tích hợp lớp trừu tượng AI hỗ trợ **Google Gemini**, **OpenAI (GPT-4o)** hoặc **OpenRouter**.
   - Tự động sinh tiêu đề (Headline), nội dung Facebook hấp dẫn, lời kêu gọi hành động (CTA) và danh sách hashtag thịnh hành.
   - Người dùng luôn có bước xem trước (Preview) và phê duyệt trước khi đăng bài.

5. **Hàng đợi đăng bài an toàn (Automation Queue & Rate Limiter)**:
   - Đăng bài tuần tự từng mục tiêu, không mở hàng chục tab cùng lúc.
   - Giãn cách ngẫu nhiên từ `POST_DELAY_MIN` (60s) đến `POST_DELAY_MAX` (180s) giữa các bài.
   - Giới hạn tối đa `MAX_POSTS_PER_RUN` (10 bài/phiên).
   - Hỗ trợ Tạm dừng (Pause), Tiếp tục (Resume) và Hủy (Cancel).
   - Nếu một nhóm bị lỗi, hệ thống ghi nhận lỗi trên nhóm đó và tiếp tục các nhóm còn lại mà không làm crash hàng đợi.

6. **Giao diện Dashboard Hiện đại**:
   - Xây dựng bằng React, Vite, Tailwind CSS và Lucide Icons.
   - Bảng điều khiển tổng quan, quản lý nhóm/trang, tìm kiếm real-time, soạn bài đăng với AI, theo dõi tiến độ hàng đợi và xem log trực tiếp.

7. **Tự động Đồng bộ Nhóm Đã Tham gia & Tham gia Nhóm Mới**:
   - **Đồng bộ nhóm đã tham gia**: Tự động mở danh sách nhóm của tài khoản (`facebook.com/groups/joins/`), lưu toàn bộ vào database với trạng thái `JOINED`.
   - **Tự động tham gia nhóm mới**: Tham gia từng nhóm hoặc tham gia hàng loạt các nhóm đã chọn, tự động xác nhận hộp thoại quy tắc nhóm/câu hỏi thành viên nếu có, áp dụng giãn cách an toàn 15s-40s chống chặn tính năng.

---

## 🛠 Yêu cầu Hệ thống (Windows)

- Hệ điều hành: **Windows 10 / 11**
- Python: **3.12+**
- Node.js: **v18+** (Khuyên dùng v20 hoặc v22)
- Trình duyệt: Google Chrome hoặc Playwright Chromium
- Cơ sở dữ liệu: **MySQL 8** (Hệ thống có sẵn cơ chế tự động Fallback sang **SQLite** cục bộ nếu chưa thiết lập MySQL)

---

## 🚀 Hướng dẫn Cài đặt & Chạy Chi tiết trên Windows

### Bước 1: Mở PowerShell và di chuyển vào thư mục dự án
```powershell
cd c:\Users\design1saohan\Downloads\toot-fb
```

### Bước 2: Tạo môi trường ảo Python (Virtualenv)
```powershell
# Sử dụng uv (nếu có uv cài sẵn, nhanh hơn)
uv venv .venv --python 3.12

# Hoặc sử dụng lệnh python chuẩn của Windows:
python -m venv .venv
```

### Bước 3: Kích hoạt môi trường ảo
```powershell
.venv\Scripts\activate
```
*(Nếu gặp lỗi UnauthorizedAccess trong PowerShell, chạy lệnh: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*

### Bước 4: Cài đặt các thư viện Python
```powershell
pip install -r requirements.txt
```

### Bước 5: Cài đặt Playwright Chromium
```powershell
playwright install chromium
```

### Bước 6: Cấu hình biến môi trường (.env)
Sao chép file `.env.example` thành `.env`:
```powershell
copy .env.example .env
```

Mở file `.env` bằng Notepad hoặc VS Code để cấu hình:
```ini
# Cấu hình MySQL 8 (Nếu dùng MySQL):
DATABASE_URL=mysql+pymysql://root:matkhau@localhost:3306/facebook_automation
FALLBACK_TO_SQLITE=true

# Chọn AI Provider: gemini | openai | openrouter
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Đường dẫn Persistent Profile Facebook
FACEBOOK_PROFILE_PATH=./profiles/facebook
BROWSER_HEADLESS=false

# Cấu hình giãn cách an toàn (giây)
POST_DELAY_MIN=60
POST_DELAY_MAX=180
MAX_POSTS_PER_RUN=10
```

> **Ghi chú**: Nếu bạn chưa cài đặt MySQL Server, giữ nguyên `DATABASE_URL=sqlite:///./data/facebook_automation.db` hoặc để `FALLBACK_TO_SQLITE=true`. Hệ thống sẽ tự động khởi tạo cơ sở dữ liệu SQLite trong thư mục `data/` để bạn có thể sử dụng ngay lập tức!

### Bước 7: Khởi chạy Backend Server
```powershell
# Chạy trực tiếp qua launcher:
python run.py

# Hoặc dùng uvicorn:
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- API Docs: [http://127.0.0.1:8080/docs](http://127.0.0.1:8080/docs)
- Frontend tích hợp: [http://127.0.0.1:8080/](http://127.0.0.1:8080/)

### Bước 8: Khởi chạy Frontend Development Server (Tùy chọn)
Nếu bạn muốn phát triển hoặc thay đổi giao diện frontend với Hot-Reloading:
Mở một cửa sổ PowerShell mới:
```powershell
cd frontend
npm install
npm run dev
```
Truy cập giao diện: [http://localhost:5173/](http://localhost:5173/)

---

## 🔑 Hướng dẫn Đăng nhập Facebook Lần Đầu Tiên

1. Trên giao diện Dashboard ([http://localhost:8080](http://localhost:8080) hoặc `http://localhost:5173`), nhìn lên thanh menu trên cùng.
2. Bấm nút **"Mở Facebook đăng nhập"**.
3. Cửa sổ trình duyệt Chromium sẽ tự động mở trang chủ `https://www.facebook.com/`.
4. Người dùng tự tay đăng nhập tài khoản Facebook của mình trên trình duyệt (nhập email/sđt, mật khẩu và mã 2FA nếu có).
5. Sau khi đăng nhập thành công vào Bảng tin Facebook:
   - Bấm nút **"Kiểm tra"** trên Dashboard.
   - Trạng thái sẽ chuyển thành: `[ĐÃ ĐĂNG NHẬP FACEBOOK]` màu xanh lá.
   - Toàn bộ Cookies và Session đã được lưu vĩnh viễn vào `./profiles/facebook`.
6. Từ những lần sau trở đi, bạn không cần phải đăng nhập lại nữa!

---

## 📂 Cấu trúc Thư mục Dự án

```
facebook-automation/
├── app/
│   ├── main.py                     # FastAPI entrypoint, CORS, static routes
│   ├── config.py                   # Pydantic Settings từ .env
│   ├── api/
│   │   ├── groups.py               # REST API quản lý Groups
│   │   ├── pages.py                # REST API quản lý Pages
│   │   ├── posts.py                # REST API soạn bài, upload ảnh, AI generate
│   │   ├── browser.py              # REST API điều khiển browser & login check
│   │   ├── settings.py             # REST API cấu hình hệ thống & an toàn
│   │   ├── automation.py           # REST API hàng đợi Queue (pause/resume/cancel)
│   │   └── logs.py                 # REST API xem live logs
│   ├── automation/
│   │   ├── browser_manager.py      # FacebookBrowserManager (Persistent Context, Lock)
│   │   ├── checkpoint_detector.py  # Checkpoint & CAPTCHA detector
│   │   ├── facebook_login.py       # Kiểm tra và điều phối luồng đăng nhập
│   │   ├── facebook_search.py      # Bộ điều phối tìm kiếm
│   │   ├── facebook_group.py       # Tìm kiếm Groups, bóc tách và chống trùng
│   │   ├── facebook_page.py        # Tìm kiếm Pages, bóc tách và chống trùng
│   │   ├── facebook_post.py        # Tự động hóa đăng bài viết lên Group/Page
│   │   └── agent.py                # Tích hợp browser-use Agent
│   ├── ai/
│   │   ├── provider.py             # BaseAIProvider interface
│   │   ├── gemini.py               # Tích hợp Google Gemini API (google-genai SDK)
│   │   ├── openai.py               # Tích hợp OpenAI & OpenRouter
│   │   └── content_generator.py    # Service tạo nội dung bài đăng chuẩn Facebook
│   ├── database/
│   │   ├── database.py             # SQLAlchemy engine & SQLite fallback
│   │   └── models.py               # ORM Models (Groups, Pages, Posts, Targets, Logs, Comment Assistant)
│   ├── schemas/
│   │   ├── schemas.py              # Pydantic Schemas
│   │   └── comment_schemas.py      # Pydantic Schemas cho Comment Assistant
│   ├── services/
│   │   ├── group_service.py        # Nghiệp vụ Groups
│   │   ├── page_service.py         # Nghiệp vụ Pages
│   │   ├── post_service.py         # Nghiệp vụ Posts
│   │   ├── queue_service.py        # Hàng đợi đăng bài nền tảng
│   │   └── comment_assistant/      # MODULE COMMENT ASSISTANT
│   │       ├── providers/
│   │       │   ├── discovery_provider.py   # PostDiscoveryProvider (Mock & Meta)
│   │       │   └── publishing_provider.py  # CommentPublishingProvider (Mock & Meta)
│   │       ├── relevance_engine.py         # Chấm điểm 0-100 & Skip Conditions
│   │       ├── comment_generator.py        # Sinh 3-5 biến thể bình luận chuẩn mực
│   │       ├── similarity_service.py       # Chống trùng lặp nội dung
│   │       ├── scheduler_service.py        # Lên lịch, Smart Cooldown & Emergency Stop
│   │       └── audit_logger.py             # Nhật ký kiểm toán 9 loại sự kiện
│   └── utils/
│       ├── exceptions.py           # Định nghĩa các Exception chuyên biệt
│       ├── logger.py               # Hệ thống ghi log console, file và DB
│       └── rate_limiter.py         # SafeRateLimiter & Human Delays
├── frontend/                       # React 19 + Vite + Tailwind CSS Dashboard
├── prisma/schema.prisma            # Prisma Schema hỗ trợ dự án tích hợp Prisma
├── profiles/facebook/              # Nơi lưu trữ Chromium User Data Profile
├── data/                           # Cơ sở dữ liệu SQLite fallback & data/uploads ảnh
├── logs/                           # logs/automation.log
├── tests/
│   ├── test_system.py              # Bộ test tích hợp Facebook Posting
│   └── test_comment_assistant.py   # 13 tests nghiệm thu cho Comment Assistant
├── .env.example                    # File mẫu biến môi trường
├── requirements.txt                # Danh sách thư viện Python
├── run.py                          # Script khởi động 1 lệnh cho toàn bộ hệ thống
└── README.md                       # Tài liệu hướng dẫn sử dụng
```

---

## 💬 Module Mở Rộng: Comment Assistant (Trợ lý bình luận)

Module **Comment Assistant** được thiết kế chuyên biệt để hỗ trợ truyền thông hội nghị/hội thảo khoa học (Aesthetic Conference Hub) thông qua việc phát hiện bài viết liên quan trong các cộng đồng được quản lý, phân tích mức độ phù hợp bằng AI và sinh đề xuất bình luận lịch sự, chuẩn mực cho người dùng duyệt.

> [!IMPORTANT]
> **Cam kết Đạo đức & Chống Spam (Anti-Spam Outreach)**:
> - **KHÔNG** sử dụng Selenium, Playwright, Puppeteer, cookie scraping, session hijacking hay CAPTCHA bypass để cào dữ liệu cá nhân hay tự động comment.
> - Sử dụng kiến trúc Provider trừu tượng: `PostDiscoveryProvider` và `CommentPublishingProvider`.
> - Tất cả đề xuất mặc định ở trạng thái **PENDING REVIEW** (Bắt buộc người dùng phê duyệt trước khi đăng).

### 1. Luồng hoạt động (Workflow)
```text
DISCOVER POSTS → FILTER RELEVANT POSTS → AI ANALYZE → GENERATE COMMENT → HUMAN REVIEW → APPROVE → SCHEDULE → PUBLISH THROUGH ALLOWED PROVIDER → AUDIT LOG
```

### 2. Kiến trúc Provider (Mock vs Meta)
- **`MockPostDiscoveryProvider` & `MockCommentPublishingProvider`**: Cung cấp dữ liệu mô phỏng thực tế về ngành thẩm mỹ (RF, Exosome, trẻ hóa da, spa, clinic, hội nghị y khoa CME). Giúp toàn bộ hệ thống chạy mượt mà ngay trong **DEMO MODE** mà không cần liên kết tài khoản thật.
- **`MetaPostDiscoveryProvider` & `MetaCommentPublishingProvider`**: Chỉ tích hợp với Meta Graph API chính thức khi ứng dụng được Meta cấp quyền hợp lệ (`pages_manage_posts`, `publish_to_groups`). Nếu thiếu quyền, hệ thống trả về `FEATURE_NOT_AVAILABLE` an toàn tuyệt đối, không tìm cách vượt rào.

### 3. Bộ lọc liên quan & Điều kiện bỏ qua (Skip Conditions)
`CommentRelevanceEngine` chấm điểm bài viết từ 0 – 100 và bắt buộc trả về **SKIP** nếu:
- Bài viết không liên quan đến thẩm mỹ, da liễu, hội nghị.
- Bài viết có nội dung tranh cãi, bóc phốt, drama.
- Bài viết yêu cầu tư vấn, chẩn đoán hay kê đơn điều trị y khoa cá nhân khẩn cấp.
- Không đủ ngữ cảnh để phản hồi có giá trị.

### 4. Đề xuất bình luận & Minh bạch (Transparency)
- Sinh 3–5 biến thể bình luận (Professional, Educational, Friendly, Short, Invitation).
- Không cam kết y khoa sai lệch, không mạo danh bác sĩ hay người dùng độc lập.
- Nhãn minh bạch (Disclosure): *"Thông tin chương trình do BTC cung cấp."* (OFF / OPTIONAL / REQUIRED).

### 5. Kiểm soát tần suất, Trùng lặp & Dừng khẩn cấp
- **`CommentSimilarityService`**: Tính toán độ tương đồng câu từ và URL. Chặn đăng nếu độ tương đồng > 80% so với bình luận gần đây.
- **`Smart Cooldown`**: Giới hạn tối đa 30 comment/ngày, 5 comment/giờ và giãn cách 24 giờ đối với cùng một nhóm.
- **Dừng khẩn cấp (Emergency Stop)**: Nút bấm màu đỏ trên Dashboard lập tức hủy toàn bộ lịch bình luận đang chờ, vô hiệu hóa tự động hóa và lưu vết kiểm toán `EMERGENCY_STOP`.

---

## 🧪 Kiểm thử Hệ thống (Automated Tests)

Chạy toàn bộ 22 bài kiểm thử tự động:
```powershell
.venv\Scripts\python -m unittest discover tests
```
- `tests/test_system.py`: 9 tests cho Browser Manager, Checkpoint Detector, Rate Limiter, Queue, Group/Page APIs.
- `tests/test_comment_assistant.py`: 13 tests nghiệm thu toàn diện 15 tiêu chí (Rule creation, Discovery, Relevance scoring, Skip conditions, Variant generation, Edit/Approve/Reject flow, Scheduling, Mock publishing, Duplicate detection, Rate limiting, Meta safety check, Emergency stop, Analytics & Audit logs).
- **Kết quả: 22/22 tests PASSED 100%**.

