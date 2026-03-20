# AI Service - One Slide Overview
**Petties Veterinary Platform**

```mermaid
flowchart TB
    %% === SYSTEM CONTEXT ===
    subgraph SYS[Hệ Thống Tổng Thể]
        direction TB
        FE[Frontend<br/>(Web/Mobile)] -->|HTTP/WS| GW[API Gateway<br/>(NGINX)]
        GW -->|REST| BE[Backend<br/>(Spring Boot)]
        BE -->|REST| GW
    end

    %% === AI SERVICE ===
    subgraph AI[AI Service<br/>(FastAPI/Python 3.12 - Cổng 8000)]
        direction TB
        
        %% API Layer
        subgraph API[API Layer]
            direction LR
            API_Routes[Routes<br/>(/chat, /feedback, /config)]
            API_WS[WebSocket<br/>(/ws/chat/{id})]
            API_Middleware[Middleware<br/>(Auth, Logging)]
            API_Schemas[Schemas<br/>(Pydantic)]
            API_Routes --> API_WS
            API_Routes --> API_Middleware
            API_Routes --> API_Schemas
        end

        %% Core Logic
        subgraph CORE[Core Logic]
            direction TB
            %% Agent Orchestrator (ReAct)
            subgraph ORCH[AgentOrchestrator<br/>(LangGraph ReAct)]
                direction LR
                Think[Think Node<br/>(LLM Reasoning)]
                Act[Act Node<br/>(Tool Execution)]
                Observe[Observe Node<br/>(Result Processing)]
                Think --> Act --> Observe --> Think
            end
            
            %% Tool Executor
            subgraph TOOL[ToolExecutor<br/>(FastMCP @mcp.tool)]
                direction LR
                Tool_Exec[Execute Tool<br/>(Validate + Run)]
                Tool_Registry[Tool Registry<br/>(pet_knowledge_search, web_search, etc.)]
                Tool_Exec --> Tool_Registry
            end
            
            %% Hybrid RAG Engine
            subgraph RAG[HybridRAGEngine]
                direction LR
                RAG_Engine[LlamaIndex RAG]
                KG_Service[Knowledge Graph Service]
                Case_Memory[Case Memory Service<br/>(Qdrant petties_case_memory_v2)]
                Query_Expander[Query Expander]
                RAG_Engine --> Hybrid_Merge[Merge & Re-Rank]
                KG_Service --> Hybrid_Merge
                Case_Memory --> Hybrid_Merge
                Query_Expander --> RAG_Engine
            end
            
            %% Embedding Service
            subgraph EMB[EmbeddingService]
                direction LR
                Cohere_Embed[Cohere<br/>(embed-multilingual-v3)]
                Jina_Embed[Jina CLIP v2<br/>(Image Embeddings)]
                Cohere_Embed --> Text_Vector[Text Vector<br/>(1024-dim)]
                Jina_Embed --> Image_Vector[Image Vector<br/>(1024-dim)]
            end
            
            %% Config Service
            subgraph CONFIG[ConfigService]
                direction LR
                Config_Load[Load Config<br/>(PostgreSQL - Hot Reload)]
                Config_Get[Get Agent/Tool Config]
                Config_Set[Update System Setting]
            end
            
            %% Feedback Service
            subgraph FEED[FeedbackService]
                direction LR
                Feedback_Save[Save Feedback<br/>(MongoDB chat_feedback)]
                Feedback_Process[Process Positive Feedback]
                Feedback_Extract[Extract Case<br/>(Medical/Booking/Clinic_Ops)]
                Feedback_Embed[Embed Case<br/>(→ Case Memory Service)]
                Feedback_Save --> Feedback_Process --> Feedback_Extract --> Feedback_Embed
            end
        end
        
        %% Connections within AI Service
        API_Routes --> ORCH
        API_WS --> ORCH
        ORCH --> TOOL
        ORCH --> RAG
        ORCH --> EMB
        ORCH --> CONFIG
        ORCH --> FEED
        TOOL --> CONFIG
        RAG --> CONFIG
        RAG --> EMB
        EMB --> CONFIG
        FEED --> RAG
        FEED --> EMB
    end

    %% === DATA STORES ===
    subgraph STORES[Kho Lưu Trữ Dữ Liệu]
        direction TB
        PG[PostgreSQL<br/>(AI Config Schema)] -->|Read/Write| AI
        MG[MongoDB<br/>(ai_chat_sessions,<br/>chat_feedback)] -->|Read/Write| AI
        QD[Qdrant Cloud<br/>(petties_knowledge,<br/>petties_case_memory)] -->|Read/Write| AI
        RD[Redis Cloud<br/>(Cache)] -->|Read/Write| AI
    end

    %% Bổ sung luồng gọi Tool từ AI sang Spring Boot API
    TOOL -->|Call Backend APIs<br/>(FastMCP)| BE

    %% === EXTERNAL APIS ===
    subgraph EXT[APIs Bên Ngoài]
        direction TB
        OR[OpenRouter API<br/>(LLM Provider)] -->|HTTPS| AI
        CO[Cohere API<br/>(Embeddings Provider)] -->|HTTPS| AI
        JINA[Jina AI API<br/>(Image Embeddings)] -->|HTTPS| AI
        WEB[Web Search API<br/>(Tavily)] -->|HTTPS| AI
    end

    %% === DATA FLOWS ===
    %% User → System → AI
    FE -->|User Message| GW
    GW -->|Forward Request| BE
    BE -->|Session Mgmt| GW
    GW -->|WS Message| AI
    
    %% AI → Internal Processing
    AI -->|Load Config| PG
    AI -->|Vector Search| QD
    AI -->|Save Chat Trace| MG
    AI -->|LLM Request| OR
    AI -->|Text Embedding| CO
    AI -->|Image Embedding| JINA
    AI -->|Web Search| WEB
    AI -->|Feedback Save| MG
    AI -->|Case Embedding| QD
    
    %% Internal → User
    AI -->|WS Stream Tokens| GW
    GW -->|Forward Tokens| FE
    FE -->|Display Response| USER((User))
    
    %% Styling
    classDef system fill:#f9f9f9,stroke:#333,stroke-width:1px;
    classDef ai fill:#e3f2fd,stroke:#1976d2,stroke-width:2px;
    classDef stores fill:#fff3e0,stroke:#f57c00,stroke-width:1px;
    classDef ext fill:#f3e5f5,stroke:#7b1fa2,stroke-width:1px;
    classDef layer fill:#ffffff,stroke:#9e9e9e,stroke-width:1px,stroke-dasharray: 2 2;
    
    class SYS,SYS system;
    class AI ai;
    class STORES,STORES stores;
    class EXT,EXT ext;
    class API,CORE,TOOL,RAG,EMB,CONFIG,FEED layer;
```

## Script Trình Bày (1-2 Phút)

**[Slide Mở Đầu]**
"Chuyển sang phần AI Service - đây là bộ não của hệ thống Petties, chạy dưới dạng microservice riêng biệt trên cổng 8000, có thể mở rộng độc lập khỏi backend Spring Boot."

**[Diagram Explanation - 60-90 giây]**
"Nhìn sơ đồ này từ trái sang phải:
1. **Hệ thống tổng thể**: Frontend (web/mobile) ↔ API Gateway ↔ Backend Spring Boot
2. **AI Service độc lập**: Chạy trên cổng 8000, có 5 lớp nội bộ:
   - API Layer: Xử lý request/response và WebSocket streaming
   - Core Logic: Là tim của hệ thống bao gồm:
     * AgentOrchestrator: Triển khai vòng lặp ReAct (Think→Act→Observe) bằng LangGraph
     * ToolExecutor: Chạy các @mcp.tool như pet_knowledge_search, create_booking_for_user
     * HybridRAGEngine: Kết hợp RAG + Knowledge Graph + Case Memory để tìm kiếm bối cảnh
     * EmbeddingService: Xử lý vector văn bản (Cohere) và hình ảnh (Jina CLIP v2)
     * ConfigService: Tải cấu hình động từ PostgreSQL (hot-reload)
     * FeedbackService: Xử lý phản hồi người dùng và cập nhật bộ nhớ trường hợp
3. **Kho lưu trữ dữ liệu**: AI Service có truy cập trực tiếp đến:
   - PostgreSQL: Lưu cấu hình, API keys được mã hóa
   - MongoDB: Lưu lịch sử chat đầy đủ kèm dấu vết ReAct (thought/action/observation)
   - Qdrant: Lưu trữ vector embeddings cho knowledge base và case memory (với named vectors text+image)
   - Redis: Cache OTP và session
4. **APIs bên ngoài**: Kết nối với OpenRouter (LLM), Cohere (embeddings), Jina (image embeddings), và Tavily (web search)

**[Luồng làm việc - 30 giây]**
"Khi người dùng gửi tin nhắn:
1. Frontend → API Gateway → Backend (phân phiên) → API Gateway → AI Service (WS)
2. AI Service tải cấu hình từ PostgreSQL
3. Thực hiện tìm kiếm Hybrid: RAG (Qdrant) + Knowledge Graph + Case Memory
4. Nếu cần, mở rộng truy vấn bằng LLM hoặc tìm kiếm web
5. Chạy vòng lặp ReAct: LLM suy nghĩ → gọi công cụ → xử lý kết quả → lặp lại nếu cần
6. Tạo phản hồi cuối cùng, stream token-by-token về qua WebSocket
7. Lưu cuộc trò chuyện vào MongoDB
8. Nếu có phản hồi positive, trích xuất trường hợp và nhúng vào Case Memory trong Qdrant

**[Kết thúc - 15 giây]**
"Kiến trúc này đảm bảo: 1) Cô lập lỗi, 2) Khả năng mở rộng độc lập, 3) Dữ liệu đầy đủ để phân tích sau này, 4) Mở rộng dễ dàng qua @mcp.tool mới."

**Tổng thời gian: ~2 phút**