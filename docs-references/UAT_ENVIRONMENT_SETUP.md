# Setup UAT Environment: uat.petties.world - Complete Guide

## Tổng quan

Hướng dẫn setup môi trường **UAT (User Acceptance Testing)** trên EC2 (cùng instance với production, nhưng ports và config khác).

## Phân biệt môi trường

| Môi trường | Docker Compose | Backend URL | AI Service URL | Ports | Mục đích |
|------------|----------------|-------------|----------------|-------|----------|
| **Local** | `docker-compose.dev.yml` | `localhost:8080` | `localhost:8000` | 8080, 8000 | Development |
| **UAT** | `docker-compose.uat.yml` | `uat-api.petties.world` | `uat-ai.petties.world` | 8082, 8002 | User Acceptance Testing |
| **Production** | `docker-compose.prod.yml` | `api.petties.world` | `ai.petties.world` | 8080, 8000 | Live production |

## Kiến trúc

```
┌─────────────────────────────────────────────┐
│  EC2 Instance (15.134.219.97)               │
│                                              │
│  ┌────────────────────────────────────┐     │
│  │  Production (Ports 8080, 8000)     │     │
│  │  - api.petties.world               │     │
│  │  - ai.petties.world                │     │
│  └────────────────────────────────────┘     │
│                                              │
│  ┌────────────────────────────────────┐     │
│  │  UAT Environment (Ports 8082, 8002)│     │
│  │  - uat-api.petties.world          │     │
│  │  - uat-ai.petties.world           │     │
│  └────────────────────────────────────┘     │
│                                              │
│  ┌────────────────────────────────────┐     │
│  │  Nginx Reverse Proxy               │     │
│  └────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

## Bước 1: DNS Configuration

### Trên Namecheap

1. Vào **Advanced DNS** của domain `petties.world`
2. Thêm các A records:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | `uat-api` | `15.134.219.97` | Automatic |
| A | `uat-ai` | `15.134.219.97` | Automatic |

3. **Save All Changes**
4. **Đợi DNS propagate** (5-30 phút)
5. **Kiểm tra DNS:**
   ```bash
   nslookup uat-api.petties.world
   nslookup uat-ai.petties.world
   ```
   Kết quả mong đợi: `15.134.219.97`

## Bước 2: Tạo Environment File cho UAT

Trên EC2, tạo file `.env.uat`:

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
nano .env.uat
```

**Nội dung file (có thể dùng cùng database với production hoặc database riêng):**

```bash
# ============================================
# UAT ENVIRONMENT CONFIGURATION
# ============================================

# Database (có thể dùng cùng với production hoặc database riêng)
DB_HOST_UAT=ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech
DB_PORT_UAT=5432
DB_NAME_UAT=petties_db
DB_USERNAME_UAT=neondb_owner
DB_PASSWORD_UAT=your_password

# MongoDB (có thể dùng cùng)
MONGO_URI_UAT=mongodb+srv://user:pass@cluster.mongodb.net/petties_nosql?retryWrites=true&w=majority

# Database URL cho AI Service
DATABASE_URL_UAT=postgresql://neondb_owner:password@ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech:5432/petties_db?sslmode=require

# Qdrant (có thể dùng cùng hoặc riêng)
QDRANT_URL_UAT=https://your-cluster.qdrant.io
QDRANT_API_KEY_UAT=your-api-key

# Ollama
OLLAMA_API_KEY_UAT=your-ollama-key
OLLAMA_MODEL_UAT=kimi-k2:1t-cloud

# JWT (UAT secret, khác production)
JWT_SECRET_UAT=UATSecretKeyForUserAcceptanceTesting123456789012345678901234

# CORS - QUAN TRỌNG: Phải có UAT domains
CORS_ORIGINS_UAT=https://uat-api.petties.world,https://uat-ai.petties.world,http://localhost:5173,http://localhost:3000
```

## Bước 3: Nginx Configuration

### 3.1. Config cho uat-api.petties.world

```bash
sudo nano /etc/nginx/sites-available/uat-api.petties.world
```

**Nội dung:**

```nginx
server {
    listen 80;
    server_name uat-api.petties.world;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name uat-api.petties.world;

    ssl_certificate /etc/letsencrypt/live/uat-api.petties.world/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/uat-api.petties.world/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 15M;

    location / {
        proxy_pass http://127.0.0.1:8082;  # UAT port
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

    location /ws/ {
        proxy_pass http://127.0.0.1:8082;
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

    location /api/actuator/health {
        proxy_pass http://127.0.0.1:8082;
        access_log off;
    }
}
```

### 3.2. Config cho uat-ai.petties.world

```bash
sudo nano /etc/nginx/sites-available/uat-ai.petties.world
```

**Nội dung:**

```nginx
server {
    listen 80;
    server_name uat-ai.petties.world;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name uat-ai.petties.world;

    ssl_certificate /etc/letsencrypt/live/uat-ai.petties.world/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/uat-ai.petties.world/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 15M;

    location / {
        proxy_pass http://127.0.0.1:8002;  # UAT port
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

    location /ws/ {
        proxy_pass http://127.0.0.1:8002;
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

    location /health {
        proxy_pass http://127.0.0.1:8002;
        access_log off;
    }
}
```

### 3.3. Enable sites và reload

```bash
# Enable UAT sites
sudo ln -s /etc/nginx/sites-available/uat-api.petties.world /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/uat-ai.petties.world /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Bước 4: SSL Certificates (Let's Encrypt)

```bash
# Get SSL certificates
sudo certbot --nginx -d uat-api.petties.world
sudo certbot --nginx -d uat-ai.petties.world
```

## Bước 5: Build và Start UAT Containers

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform

# Build and start UAT containers
docker-compose -f docker-compose.uat.yml --env-file .env.uat up -d --build

# Check status
docker-compose -f docker-compose.uat.yml ps

# View logs
docker-compose -f docker-compose.uat.yml logs -f
```

## Bước 6: Kiểm tra

### 6.1. Test Backend API

```bash
# Test health endpoint
curl https://uat-api.petties.world/api/actuator/health

# Hoặc từ browser
# https://uat-api.petties.world/api/actuator/health
```

### 6.2. Test AI Service

```bash
# Test health endpoint
curl https://uat-ai.petties.world/health

# Hoặc từ browser
# https://uat-ai.petties.world/health
```

### 6.3. Test WebSocket

```javascript
// Test AI Service WebSocket
const ws = new WebSocket('wss://uat-ai.petties.world/ws/chat/test-session-123')
ws.onopen = () => console.log('✅ UAT WebSocket connected')
ws.onmessage = (event) => console.log('📨 Message:', event.data)
ws.onerror = (error) => console.error('❌ Error:', error)
```

## Frontend Configuration

### Tự động detect environment

Frontend đã được cấu hình tự động detect:
- **Local**: `localhost` → `http://localhost:8080/api`
- **UAT**: `uat-*` domains → `https://uat-api.petties.world/api`
- **Production**: Other domains → `https://api.petties.world/api`

### Test từ local với UAT URLs

Nếu muốn test từ local nhưng dùng UAT backend, tạo file `petties-web/.env.local`:

```bash
VITE_API_BASE_URL=https://uat-api.petties.world/api
VITE_WS_URL=wss://uat-api.petties.world/ws
VITE_AGENT_SERVICE_URL=https://uat-ai.petties.world
```

### Vercel Preview Environment

Nếu frontend deploy trên Vercel với branch khác `main`, có thể set environment variables cho Preview environment:

| Key | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `https://uat-api.petties.world/api` |
| `VITE_WS_URL` | `wss://uat-api.petties.world/ws` |
| `VITE_AGENT_SERVICE_URL` | `https://uat-ai.petties.world` |

## Quản lý Containers

### Start UAT Environment

```bash
docker-compose -f docker-compose.uat.yml --env-file .env.uat up -d
```

### Stop UAT Environment

```bash
docker-compose -f docker-compose.uat.yml down
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.uat.yml logs -f

# Specific service
docker-compose -f docker-compose.uat.yml logs -f backend-uat
docker-compose -f docker-compose.uat.yml logs -f ai-service-uat
```

### Restart Service

```bash
docker-compose -f docker-compose.uat.yml restart backend-uat
docker-compose -f docker-compose.uat.yml restart ai-service-uat
```

## Update Code

Để update code lên UAT environment:

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
git pull origin main  # hoặc branch uat
docker-compose -f docker-compose.uat.yml --env-file .env.uat up -d --build
```

## Troubleshooting

### Lỗi: Port already in use

```bash
# Kiểm tra ports
sudo netstat -tlnp | grep -E '8082|8002'

# Nếu có process khác, kill nó hoặc đổi port trong docker-compose
```

### Lỗi: SSL certificate not found

```bash
# Kiểm tra certificates
sudo certbot certificates

# Renew certificates
sudo certbot renew
```

### Lỗi: Container không start

```bash
# Check logs
docker-compose -f docker-compose.uat.yml logs backend-uat
docker-compose -f docker-compose.uat.yml logs ai-service-uat

# Check .env.uat file có đúng không
cat .env.uat
```

### Lỗi: CORS error

Đảm bảo `CORS_ORIGINS_UAT` trong `.env.uat` có domain frontend của bạn:

```bash
CORS_ORIGINS_UAT=https://uat-api.petties.world,https://uat-ai.petties.world,http://localhost:5173,http://localhost:3000
```

Sau đó restart containers:

```bash
docker-compose -f docker-compose.uat.yml restart backend-uat
docker-compose -f docker-compose.uat.yml restart ai-service-uat
```

## Tổng kết

Sau khi setup xong, bạn sẽ có:

| Environment | Backend URL | AI Service URL | Ports | Mục đích |
|-------------|-------------|----------------|-------|----------|
| **Local** | `http://localhost:8080/api` | `http://localhost:8000` | 8080, 8000 | Development |
| **UAT** | `https://uat-api.petties.world/api` | `https://uat-ai.petties.world` | 8082, 8002 | User Acceptance Testing |
| **Production** | `https://api.petties.world/api` | `https://ai.petties.world` | 8080, 8000 | Live production |

Bạn có thể:
- ✅ Develop locally với `localhost`
- ✅ Test UAT với `uat-api.petties.world` và `uat-ai.petties.world`
- ✅ Deploy production với `api.petties.world` và `ai.petties.world`
- ✅ Frontend tự động detect và gọi đúng URL

