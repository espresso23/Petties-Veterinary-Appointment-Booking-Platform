# 🚀 EC2 Production Deployment Guide

Hướng dẫn chi tiết deploy Backend và AI Service lên AWS EC2.

## 📋 Tổng quan

Hệ thống sẽ được deploy trên EC2 với cấu trúc:
- **Backend API**: `https://api.petties.world/api` (Port 8080, bind to 127.0.0.1)
- **AI Service**: `https://ai.petties.world` (Port 8000, bind to 127.0.0.1)
- **Frontend**: Deploy trên Vercel tại `https://petties.world`
- **Reverse Proxy**: Nginx với SSL (Let's Encrypt)
- **CI/CD**: GitHub Actions tự động deploy khi push vào `main` branch

## 📦 Prerequisites

### Trên máy local:
- **AWS Account** với EC2 access
- **SSH key pair** (.pem file)
- **Domain name** đã mua (ví dụ: `petties.world`)
- **DNS Provider** (ví dụ: Namecheap)

### Services cần có:
- **Neon PostgreSQL** database (hoặc Supabase)
- **MongoDB Atlas** (hoặc MongoDB local)
- **Qdrant Cloud** (vector database)
- **Ollama API Key** (hoặc local Ollama)

## 🎯 Bước 1: Tạo EC2 Instance

### 1.1. Launch EC2 Instance

1. Vào **AWS Console** → **EC2** → **Launch Instance**
2. **AMI**: Ubuntu 22.04 LTS
3. **Instance Type**: `t3.small` (2 vCPU, 2GB RAM) hoặc cao hơn
4. **Key Pair**: Chọn hoặc tạo mới key pair (download .pem file)
5. **Network Settings**: 
   - Allow SSH (port 22) từ IP của bạn
   - Allow HTTP (port 80) từ anywhere
   - Allow HTTPS (port 443) từ anywhere
6. **Storage**: 20GB (tùy chọn)
7. **Launch Instance**

### 1.2. Lưu thông tin

- **EC2 Public IP**: `15.134.219.97` (ví dụ)
- **EC2 Host**: `ec2-15-134-219-97.ap-southeast-1.compute.amazonaws.com`
- **SSH Key**: `petties-key.pem`

## 🔐 Bước 2: Setup SSH Key Permissions (Windows)

### 2.1. Fix SSH Key Permissions

```powershell
# Navigate to key location
cd D:\SEP490\petties

# Remove inheritance
icacls petties-key.pem /inheritance:r

# Remove unwanted permissions
icacls petties-key.pem /remove "Authenticated Users" "BUILTIN\Users" "Everyone"

# Grant read permission only to current user
icacls petties-key.pem /grant:r "$env:USERNAME:R"
```

**Lưu ý**: Nếu username có ký tự đặc biệt (như `\t`), dùng single quotes:
```powershell
icacls .\petties-key.pem /grant:r 'laptop-ganufne9\tan':R
```

### 2.2. Test SSH Connection

```bash
ssh -i petties-key.pem ubuntu@15.134.219.97
```

Nếu kết nối thành công, bạn sẽ thấy prompt `ubuntu@ip-172-31-xx-xx:~$`

## 📡 Bước 3: Cấu hình DNS trên Namecheap

### 3.1. Thêm DNS Records

Vào **Namecheap** → **Domain List** → **Manage** → **Advanced DNS**

Thêm các records:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | `api` | `15.134.219.97` | Automatic |
| A Record | `ai` | `15.134.219.97` | Automatic |

**Lưu ý**: Đợi 5-30 phút để DNS propagate. Kiểm tra bằng:
```bash
nslookup api.petties.world
nslookup ai.petties.world
```

## 🐳 Bước 4: Setup EC2 Instance

### 4.1. Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 4.2. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version

# Logout and login again to apply docker group changes
exit
# SSH lại vào EC2
```

### 4.3. Install Nginx

```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 4.4. Install Certbot (for SSL)

```bash
sudo apt install certbot python3-certbot-nginx -y
```

## 📂 Bước 5: Clone Repository trên EC2

### 5.1. Tạo thư mục và clone

```bash
# Tạo thư mục
mkdir -p ~/petties-backend
cd ~/petties-backend

# Clone repository
git clone https://github.com/your-username/Petties-Veterinary-Appointment-Booking-Platform.git

# Hoặc nếu dùng SSH key
# git clone git@github.com:your-username/Petties-Veterinary-Appointment-Booking-Platform.git

cd Petties-Veterinary-Appointment-Booking-Platform
```

### 5.2. Copy docker-compose.prod.yml

```bash
# Nếu file chưa có trong repo, copy từ local
# Hoặc tạo file mới với nội dung từ repo
```

**Lưu ý**: Đảm bảo `docker-compose.prod.yml` nằm trong thư mục `Petties-Veterinary-Appointment-Booking-Platform`

## ⚙️ Bước 6: Tạo File .env trên EC2

### 6.1. Tạo file .env

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
nano .env
```

### 6.2. Nội dung file .env

```bash
# ============================================
# SPRING BOOT BACKEND CONFIGURATION
# ============================================
SPRING_PROFILES_ACTIVE=prod

# Database - Neon PostgreSQL
DB_HOST=ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech
DB_PORT=5432
DB_NAME=petties_db
DB_USERNAME=neondb_owner
DB_PASSWORD=your_actual_password_here

# MongoDB Atlas
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/petties_nosql?retryWrites=true&w=majority

# AI Service (internal docker network)
AI_SERVICE_URL=http://ai-service:8000

# JWT Secret (minimum 64 characters)
JWT_SECRET=YourProductionSecretKeyMinimum64CharactersLongForSecurityPurposesChangeThisToRandomString1234567890

# CORS - Production domains
CORS_ORIGINS=https://petties.world,https://www.petties.world

# ============================================
# REDIS CLOUD CONFIGURATION
# ============================================
# Redis Cloud (Upstash/Redis Labs)
# Format: redis://default:password@host:port/0 (0 for Production)
REDIS_URL=
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
REDIS_SSL=false

# ============================================
# AI SERVICE CONFIGURATION
# ============================================
ENVIRONMENT=production
APP_DEBUG=false

# Database URL for AI Service
DATABASE_URL=postgresql://neondb_owner:password@ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech:5432/petties_db?sslmode=require

# Qdrant Cloud
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# Ollama Cloud
LLM_PROVIDER=ollama
OLLAMA_API_KEY=sk-your-ollama-api-key
OLLAMA_BASE_URL=https://ollama.com
OLLAMA_MODEL=kimi-k2:1t-cloud
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# CORS - Production domains
CORS_ORIGINS=https://petties.world,https://www.petties.world
```

**Lưu ý**: Thay thế các giá trị `your_actual_password_here`, `your-qdrant-api-key`, v.v. bằng giá trị thực tế.

### 6.3. Set permissions

```bash
chmod 600 .env
```

## 🌐 Bước 7: Cấu hình Nginx

### 7.1. Tạo Nginx config cho Backend API

```bash
sudo nano /etc/nginx/sites-available/api.petties.world
```

**Nội dung:**

```nginx
server {
    listen 443 ssl;
    server_name api.petties.world;
    
    # SSL - managed by Certbot
    ssl_certificate /etc/letsencrypt/live/api.petties.world/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.petties.world/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 15M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Origin $http_origin;

        # KHÔNG thêm CORS headers ở đây - để Backend xử lý
        
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket cho API (nếu có)
    location /ws/ {
        proxy_pass http://127.0.0.1:8080/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }

    location /api/actuator/health {
        proxy_pass http://127.0.0.1:8080/api/actuator/health;
        access_log off;
    }
}

server {
    listen 80;
    server_name api.petties.world;
    
    if ($host = api.petties.world) {
        return 301 https://$host$request_uri;
    }
    
    return 404;
}
```

### 7.2. Tạo Nginx config cho AI Service

```bash
sudo nano /etc/nginx/sites-available/ai.petties.world
```

**Nội dung:**

```nginx
server {
    listen 80;
    server_name ai.petties.world;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ai.petties.world;

    ssl_certificate /etc/letsencrypt/live/ai.petties.world/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ai.petties.world/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    client_max_body_size 15M;

    # AI Service API
    location / {
        proxy_pass http://127.0.0.1:8000;
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

    # WebSocket support for chat
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
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

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000;
        access_log off;
    }
}
```

### 7.3. Enable sites

```bash
# Enable sites
sudo ln -s /etc/nginx/sites-available/api.petties.world /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/ai.petties.world /etc/nginx/sites-enabled/

# Test Nginx config
sudo nginx -t

# Nếu có lỗi về SSL certificate, đừng lo, chúng ta sẽ tạo sau
# Tạm thời comment SSL config nếu cần:
# # ssl_certificate ...
# # ssl_certificate_key ...
```

**Lưu ý**: Nếu test config lỗi vì chưa có SSL certificate, tạm thời comment các dòng SSL trong 2 file config, sau khi có SSL sẽ uncomment lại.

### 7.4. Reload Nginx

```bash
sudo systemctl reload nginx
```

## 🔒 Bước 8: Tạo SSL Certificates

### 8.1. Tạo SSL cho Backend API

```bash
sudo certbot --nginx -d api.petties.world
```

Khi được hỏi:
- **Email**: Nhập email của bạn
- **Agree to terms**: Y
- **Share email**: N (tùy chọn)
- **Redirect HTTP to HTTPS**: 2 (Redirect)

### 8.2. Tạo SSL cho AI Service

```bash
sudo certbot --nginx -d ai.petties.world
```

Lặp lại các bước tương tự.

### 8.3. Uncomment SSL config (nếu đã comment)

Nếu trước đó bạn đã comment SSL config, bây giờ uncomment lại vì Certbot đã tự động thêm.

### 8.4. Auto-renewal

Certbot tự động setup cron job để renew certificates. Kiểm tra:

```bash
sudo certbot renew --dry-run
```

## 🚀 Bước 9: Deploy Containers

### 9.1. Build and Start

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform

# Build and start containers
docker-compose -f docker-compose.prod.yml --env-file .env up -d --build

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 9.2. Kiểm tra containers

```bash
# Check running containers
docker ps

# Check backend logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Check AI service logs
docker-compose -f docker-compose.prod.yml logs -f ai-service
```

### 9.3. Test endpoints

```bash
# Test backend health
curl http://127.0.0.1:8080/api/actuator/health

# Test AI service health
curl http://127.0.0.1:8000/health

# Test through Nginx (sau khi có SSL)
curl https://api.petties.world/api/actuator/health
curl https://ai.petties.world/health
```

## 🔄 Bước 10: Setup CI/CD với GitHub Actions

### 10.1. Tạo GitHub Secrets

Vào **GitHub Repository** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Thêm 2 secrets:

| Name | Value |
|------|-------|
| `EC2_HOST` | `15.134.219.97` (hoặc EC2 IP của bạn) |
| `EC2_SSH_KEY` | Nội dung file `.pem` (copy toàn bộ từ `-----BEGIN RSA PRIVATE KEY-----` đến `-----END RSA PRIVATE KEY-----`) |

### 10.2. GitHub Actions Workflow

File `.github/workflows/deploy-ec2.yml` đã có sẵn trong repo. Kiểm tra:

```yaml
name: Deploy to EC2

on:
  push:
    branches:
      - main
    paths-ignore:
      - '**.md'
      - '.gitignore'
      - 'README.md'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Deploy to EC2
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
            echo "🚀 Deploying PRODUCTION environment..."
            echo "Pulling latest code from main branch..."
            git pull origin main
            echo "Stopping production containers..."
            docker-compose -f docker-compose.prod.yml --env-file .env down
            echo "Building and starting production containers..."
            docker-compose -f docker-compose.prod.yml --env-file .env up -d --build
            echo "Waiting for services to start..."
            sleep 10
            echo "Checking production backend health..."
            curl -f http://127.0.0.1:8080/api/actuator/health || echo "⚠️ Backend health check failed"
            echo "Checking production AI service health..."
            curl -f http://127.0.0.1:8000/health || echo "⚠️ AI service health check failed"
            echo "Showing recent logs..."
            docker-compose -f docker-compose.prod.yml logs --tail=50
            echo "✅ Production Deployment complete!"
```

### 10.3. Test CI/CD

```bash
# Push commit lên main branch
git add .
git commit -m "Test deployment"
git push origin main

# Kiểm tra GitHub Actions tab để xem deployment status
```

## ✅ Bước 11: Verification

### 11.1. Test Backend API

```bash
# Health check
curl https://api.petties.world/api/actuator/health

# Hoặc từ browser
# https://api.petties.world/api/actuator/health
```

### 11.2. Test AI Service

```bash
# Health check
curl https://ai.petties.world/health

# Hoặc từ browser
# https://ai.petties.world/health
```

### 11.3. Test WebSocket

**Backend WebSocket:**
```javascript
const ws = new WebSocket('wss://api.petties.world/ws')
ws.onopen = () => console.log('✅ Backend WS connected')
```

**AI Service WebSocket:**
```javascript
const ws = new WebSocket('wss://ai.petties.world/ws/chat/test-session-123')
ws.onopen = () => console.log('✅ AI Service WS connected')
```

## 🔧 Troubleshooting

### Lỗi: 502 Bad Gateway

**Nguyên nhân**: Nginx không kết nối được backend.

**Giải pháp**:
```bash
# Kiểm tra containers
docker-compose -f docker-compose.prod.yml ps

# Kiểm tra logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Test direct connection
curl http://127.0.0.1:8080/api/actuator/health
```

### Lỗi: Database Connection Failed

**Nguyên nhân**: Database credentials sai hoặc network issue.

**Giải pháp**:
```bash
# Kiểm tra database connection từ EC2
nc -vz ep-quiet-rice-a1qxog6z-pooler.ap-southeast-1.aws.neon.tech 5432

# Kiểm tra .env file
cat .env | grep DB_

# Kiểm tra backend logs
docker-compose -f docker-compose.prod.yml logs backend | grep -i "database\|connection"
```

### Lỗi: Out of Memory

**Nguyên nhân**: EC2 instance quá nhỏ hoặc containers dùng quá nhiều RAM.

**Giải pháp**:
- Upgrade EC2 instance (t3.small → t3.medium)
- Hoặc giảm memory limits trong `docker-compose.prod.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 512M  # Giảm từ 768M
    reservations:
      memory: 256M  # Giảm từ 384M
```

### Lỗi: SSL Certificate không được tạo

**Nguyên nhân**: DNS chưa propagate hoặc domain chưa trỏ đúng.

**Giải pháp**:
```bash
# Kiểm tra DNS
nslookup api.petties.world
nslookup ai.petties.world

# Đợi 5-30 phút sau khi thêm DNS records
# Thử lại certbot
sudo certbot --nginx -d api.petties.world
```

## 📊 Monitoring

### Check Container Status

```bash
docker-compose -f docker-compose.prod.yml ps
docker stats
```

### Check Nginx Status

```bash
sudo systemctl status nginx
sudo nginx -t
```

### Check Disk Space

```bash
df -h
docker system df
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f ai-service
```

## 🔄 Update Deployment

### Manual Update

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
git pull origin main
docker-compose -f docker-compose.prod.yml --env-file .env down
docker-compose -f docker-compose.prod.yml --env-file .env up -d --build
```

### Automatic Update (via GitHub Actions)

Chỉ cần push vào `main` branch, GitHub Actions sẽ tự động deploy.

## 📝 Notes

- **Ports**: Backend (8080) và AI Service (8000) bind to `127.0.0.1` để chỉ Nginx có thể access
- **Memory**: Tối ưu cho `t3.small` (2GB RAM), nếu cần có thể upgrade
- **SSL**: Certificates tự động renew mỗi 90 ngày
- **Environment Variables**: Không commit file `.env` lên Git
- **Backup**: Nên backup file `.env` và database thường xuyên

## 🔗 Related Documentation

- **Vercel Frontend Setup**: Xem `deployment/VERCEL_PRODUCTION_SETUP.md`
- **Nginx WebSocket Config**: Xem `infrastructure/NGINX_WEBSOCKET_CONFIG.md`
- **Environment Setup**: Xem `setup/ENVIRONMENT_SETUP_GUIDE.md`

