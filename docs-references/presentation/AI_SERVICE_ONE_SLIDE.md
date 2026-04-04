# AI Service Overview - 1 Slide Presentation

## Diagram (Copy this into your drawing tool)
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │  API Gateway     │    │   Backend       │
│  (Web/Mobile)   │◄──►│  (NGINX)         │◄──►│ (Spring Boot)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                   │
                                   ▼
                        ┌──────────────────┐
                        │    AI SERVICE    │    ←─ PORT 8000 (Independent)
                        │  (FastAPI/Python)│
                        └──────────┬───────┘
                                   │
                   ┌───────────────┼───────────────┐
                   ▼               ▼               ▼
          ┌─────────────┐  ┌──────────────┐  ┌───────────────┐
          │ API Layer   │  │ Core Logic   │  │ Data Stores   │
          │─────────────│  │──────────────│  │───────────────│
          │ • Routes    │  │ • Agent      │  │ • PostgreSQL  │
          │ • WebSocket │  │   Orchestrator│  │   (Config, Keys)│
          │ • Middleware│  │ • Tool       │  │ • MongoDB     │
          │ • Schemas   │  │   Executor   │  │   (Chat History)│
          └─────────────┘  │ • Hybrid RAG │  │ • Qdrant      │
                           │   Engine     │  │   (Vectors)   │
                           │ • Embedding  │  │ • Redis       │
                           │   Service    │  │   (Cache)     │
                           │ • Feedback   │  └───────────────┘
                           │   Service    │
                           └──────────────┘
                                   │
                                   ▼
                        ┌──────────────────┐
                        │ External APIs    │
                        │──────────────────│
                        │ • OpenRouter (LLM)│
                        │ • Cohere (Embed)  │
                        │ • Jina (Image)    │
                        │ • Tavily (Web)    │
                        └──────────────────┘
```

## Presentation Script (60-90 seconds)

**[0:00-0:15] Setup**
"Chuyển sang AI Service - bộ não của hệ thống Petties. Đây là một microservice độc lập chạy trên cổng 8000, tách ra khỏi backend Spring Boot."

**[0:15-0:45] Diagram Walkthrough (left to right)**
"Nhìn sơ đồ từ trái sang phải:
1. **Hệ thống bên ngoài**: Frontend (web/mobile) ↔ API Gateway (NGINX) ↔ Backend Spring Boot
2. **AI Service độc lập**: Chạy trên cổng 8000, bao gồm 5 lớp nội bộ:
   - **API Layer**: Xử lý request/response và WebSocket streaming
   - **Core Logic**: Tim của hệ thống với 4 thành phần chính:
     * Agent Orchestrator: Triển khai vòng lặp ReAct (Think→Act→Observe) bằng LangGraph
     * Tool Executor: Chạy các @mcp.tool như pet_knowledge_search, create_booking_for_user
     * Hybrid RAG Engine: Kết hợp RAG + Knowledge Graph + Case Memory
     * Embedding Service: Xử lý vector văn bản (Cohere) và hình ảnh (Jina CLIP v2)
   - **Data Stores**: Truy cập trực tiếp vào:
     * PostgreSQL: Lưu cấu hình, API keys được mã hóa
     * MongoDB: Lưu lịch sử chat đầy đủ kèm dấu vết ReAct (suy nghĩ/hành động/quan sát)
     * Qdrant: Lưu trữ vector embeddings cho knowledge base và case memory
     * Redis: Cache OTP và session
3. **External APIs**: Kết nối với OpenRouter (LLM), Cohere (embeddings), Jina (image embeddings), và Tavily (web search)"

**[0:45-1:15] Luồng làm việc (tùy chọn nếu còn thời gian)**
"Khi người dùng gửi tin nhắn:
1. Frontend → API Gateway → Backend (phân phiên) → Gateway → AI Service (WS)
2. AI Service: Tải cấu hình → Tìm kiếm hibrid (RAG+KG+CM) → Mở rộng truy vấn nếu cần
3. Chạy vòng lặp ReAct: LLM suy nghĩ → gọi công cụ → xử lý kết quả → lặp lại nếu cần
4. Tạo phản hồi, stream token-by-token về qua WebSocket
5. Lưu cuộc trò chuyện vào MongoDB
6. Nếu có feedback: lưu vào MongoDB để analytics/audit; Case Memory được đồng bộ riêng từ EMR confirmed"

**[1:15-1:30] Lợi ích kiến trúc**
"Kiến trúc này zapewnia: 1) Cô lập lỗi, 2) Khả năng mở rộng độc lập, 3) Dữ liệu đầy đủ để phân tích sau này, 4) Mở rộng dễ dàng qua @mcp.tool mới."

**Tổng thời gian: ~90 giây**
