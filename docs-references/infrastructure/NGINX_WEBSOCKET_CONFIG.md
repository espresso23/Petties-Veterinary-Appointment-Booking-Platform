# Nginx WebSocket & SSE Configuration Guide

## ⚠️ QUAN TRỌNG

**Cấu hình này dành cho EC2 (Production/Test), KHÔNG phải máy local!**

- **Development (Local)**: Không cần Nginx, chạy services trực tiếp
- **Production/Test (EC2)**: Cần Nginx reverse proxy + SSL

## Tổng quan

Hệ thống Petties sử dụng các real-time connections:

### WebSocket
1. **Backend API** (`api.petties.world`): STOMP WebSocket tại `/api/ws/`
2. **AI Service** (`ai.petties.world`): WebSocket chat endpoint tại `/ws/chat/{session_id}`

### SSE (Server-Sent Events)
1. **Backend API** (`api.petties.world`): Notifications tại `/api/sse/subscribe`
2. **AI Service** (`ai.petties.world`): AI Reasoning/Thinking Stream (nếu có)

---

## Cấu hình Nginx cho Production (`api.petties.world`)

File: `/etc/nginx/sites-available/api.petties.world`

```nginx
server {
    listen 80;
    server_name api.petties.world;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.petties.world;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.petties.world/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.petties.world/privkey.pem;
    
    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 15M;

    # ============================================
    # SSE (Server-Sent Events) - Notifications & AI Streaming
    # PHẢI ĐẶT TRƯỚC location / vì Nginx match location theo thứ tự
    # ============================================
    location /api/sse/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        
        # SSE specific headers - QUAN TRỌNG
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cache-Control 'no-cache';
        proxy_set_header X-Accel-Buffering 'no';
        
        # SSE timeout dài (24 giờ) - connection cần giữ mở lâu
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 75s;
        
        # QUAN TRỌNG: Disable buffering cho streaming
        proxy_buffering off;
        proxy_cache off;
        
        # Chunked encoding cho SSE
        chunked_transfer_encoding on;
    }

    # ============================================
    # WebSocket endpoint (STOMP)
    # ============================================
    location /api/ws/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        
        # WebSocket specific headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts (longer for persistent connections)
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 75s;
        
        # Disable buffering for WebSocket
        proxy_buffering off;
    }

    # ============================================
    # HTTP API endpoints (REST)
    # ============================================
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        
        # Standard proxy headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check endpoint
    location /api/actuator/health {
        proxy_pass http://127.0.0.1:8080;
        access_log off;
    }
}
```

---

## Cấu hình Nginx cho Test (`api-test.petties.world`)

File: `/etc/nginx/sites-available/api-test.petties.world`

```nginx
server {
    listen 80;
    server_name api-test.petties.world;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api-test.petties.world;

    ssl_certificate /etc/letsencrypt/live/api-test.petties.world/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-test.petties.world/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 15M;

    # SSE endpoint - Notifications & AI Streaming (TEST uses port 8081)
    location /api/sse/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cache-Control 'no-cache';
        proxy_set_header X-Accel-Buffering 'no';
        
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 75s;
        
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
    }

    # WebSocket endpoint (TEST uses port 8081)
    location /api/ws/ {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 75s;
        
        proxy_buffering off;
    }

    # HTTP API endpoints (TEST uses port 8081)
    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    location /api/actuator/health {
        proxy_pass http://127.0.0.1:8081;
        access_log off;
    }
}
```

### 2. Cấu hình cho AI Service (`ai.petties.world`)

File: `/etc/nginx/sites-available/ai.petties.world`

```nginx
server {
    listen 80;
    server_name ai.petties.world;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ai.petties.world;

    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/ai.petties.world/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ai.petties.world/privkey.pem;
    
    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 15M;

    # HTTP API endpoints
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        
        # Standard proxy headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket endpoint for chat
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        
        # WebSocket specific headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts (longer for persistent connections)
        # Chat sessions can be long-running
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 75s;
        
        # Disable buffering for WebSocket
        proxy_buffering off;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:8000;
        access_log off;
    }
}
```

## Các điểm quan trọng

### 1. WebSocket Headers
- `Upgrade: websocket` - Nâng cấp kết nối HTTP thành WebSocket
- `Connection: upgrade` - Yêu cầu nâng cấp protocol

### 2. Timeouts
- **HTTP**: `proxy_read_timeout 300s` (5 phút)
- **WebSocket**: `proxy_read_timeout 3600s` (1 giờ) - Chat sessions có thể kéo dài

### 3. Disable Buffering
- `proxy_buffering off` - Quan trọng cho WebSocket real-time streaming

### 4. SSL/TLS
- WebSocket qua HTTPS sử dụng `wss://` protocol
- Certbot/Let's Encrypt tự động xử lý SSL certificates

## Kiểm tra WebSocket hoạt động

### Test từ browser console:

```javascript
// Test AI Service WebSocket
const ws = new WebSocket('wss://ai.petties.world/ws/chat/test-session-123')
ws.onopen = () => console.log('✅ WebSocket connected')
ws.onmessage = (event) => console.log('📨 Message:', event.data)
ws.onerror = (error) => console.error('❌ Error:', error)
ws.onclose = () => console.log('🔌 WebSocket closed')

// Send test message
ws.send(JSON.stringify({ message: 'Hello', agent_id: 1 }))
```

### Test từ terminal:

```bash
# Install wscat if needed
npm install -g wscat

# Test WebSocket connection
wscat -c wss://ai.petties.world/ws/chat/test-session-123
```

## Troubleshooting

### Lỗi: "Connection closed" ngay sau khi connect
- **Nguyên nhân**: Nginx chưa config WebSocket headers
- **Giải pháp**: Đảm bảo có `Upgrade` và `Connection` headers

### Lỗi: "Connection timeout"
- **Nguyên nhân**: Timeout quá ngắn
- **Giải pháp**: Tăng `proxy_read_timeout` và `proxy_send_timeout`

### Lỗi: "502 Bad Gateway"
- **Nguyên nhân**: Backend service không chạy hoặc không accessible
- **Giải pháp**: 
  ```bash
  # Kiểm tra containers
  docker-compose -f docker-compose.prod.yml ps
  
  # Kiểm tra logs
  docker-compose -f docker-compose.prod.yml logs ai-service
  ```

## Sau khi cập nhật Nginx config

```bash
# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Hoặc restart
sudo systemctl restart nginx
```

## Production URLs

- **API WebSocket**: `wss://api.petties.world/ws/...` (nếu backend có WebSocket)
- **AI Service WebSocket**: `wss://ai.petties.world/ws/chat/{session_id}`

## Development URLs

- **API WebSocket**: `ws://localhost:8080/ws/...`
- **AI Service WebSocket**: `ws://localhost:8000/ws/chat/{session_id}`

