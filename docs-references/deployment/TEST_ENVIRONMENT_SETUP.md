# 🧪 Test Environment Setup Guide

Hướng dẫn setup Test Environment trên EC2 (chạy song song với Production).

## 📋 Prerequisites

- EC2 đã có Production environment đang chạy
- DNS records cho `test.petties.world` và `api-test.petties.world`
- Neon database branch cho Test

---

## 1️⃣ Tạo Neon Database Branch

1. Vào [Neon Console](https://console.neon.tech)
2. Chọn project **petties**
3. Vào **Branches** → **Create child branch**
4. Đặt tên: `test`
5. Copy connection string của branch mới

---

## 2️⃣ Thêm DNS Records (Namecheap)

Vào **Namecheap** → **Domain List** → **Manage** → **Advanced DNS**

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A Record | `test` | `15.134.219.97` | Automatic |
| A Record | `api-test` | `15.134.219.97` | Automatic |

> Đợi 5-30 phút để DNS propagate

---

## 3️⃣ SSH vào EC2 và tạo .env.test

```bash
ssh -i petties-key.pem ubuntu@15.134.219.97

cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform

# Copy template
cp .env.test.example .env.test

# Chỉnh sửa với credentials thật
sudo nano .env.test
```

**Cập nhật các giá trị:**
- `DB_HOST_TEST`: Neon test branch host
- `DB_PASSWORD_TEST`: Neon test branch password
- `DATABASE_URL_TEST`: Full connection string
- `MONGO_URI_TEST`: MongoDB test database

---

## 4️⃣ Tạo Nginx Config cho Test

```bash
sudo nano /etc/nginx/sites-available/api-test.petties.world
```

**Paste nội dung:**

```nginx
server {
    listen 80;
    server_name api-test.petties.world;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api-test.petties.world;
    
    # SSL - managed by Certbot
    ssl_certificate /etc/letsencrypt/live/api-test.petties.world/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api-test.petties.world/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 15M;

    # ============================================
    # BACKEND API (Spring Boot - Port 8081)
    # ============================================
    location /api/ {
        proxy_pass http://127.0.0.1:8081/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # Backend WebSocket (Spring Boot)
    location /ws/ {
        proxy_pass http://127.0.0.1:8081/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
    }

    # Health check
    location /api/actuator/health {
        proxy_pass http://127.0.0.1:8081/api/actuator/health;
        access_log off;
    }

    # ============================================
    # AI SERVICE (FastAPI - Port 8001)
    # ============================================
    # AI WebSocket PHẢI ĐẶT TRƯỚC /ai/ (specific route first)
    location /ai/ws/ {
        proxy_pass http://127.0.0.1:8001/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }

    # AI REST API
    location /ai/ {
        proxy_pass http://127.0.0.1:8001/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

---

## 5️⃣ Enable Site và tạo SSL

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/api-test.petties.world /etc/nginx/sites-enabled/

# Test config (sẽ lỗi SSL, bỏ qua)
sudo nginx -t

# Tạo SSL certificate
sudo certbot --nginx -d api-test.petties.world

# Reload Nginx
sudo systemctl reload nginx
```

---

## 6️⃣ Start Test Containers

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform

# Checkout develop branch
git checkout develop
git pull origin develop

# Start test containers
docker-compose -f docker-compose.test.yml --env-file .env.test up -d --build

# Check status
docker-compose -f docker-compose.test.yml ps
```

---

## 7️⃣ Verify

```bash
# Health checks
curl http://127.0.0.1:8081/api/actuator/health
curl http://127.0.0.1:8001/health

# Through Nginx
curl https://api-test.petties.world/api/actuator/health
```

---

## 8️⃣ Configure Vercel for Test FE

1. Vào [Vercel Dashboard](https://vercel.com/dashboard)
2. Chọn project **petties-web**
3. **Settings** → **Domains**
4. Thêm domain: `test.petties.world`
5. **Settings** → **Git**
6. **Production Branch**: `main`
7. Tạo **Branch Deployment** cho `develop`

### Environment Variables cho Preview:

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_API_BASE_URL` | `https://api-test.petties.world/api` | Preview |
| `VITE_WS_URL` | `wss://api-test.petties.world/ws` | Preview |
| `VITE_AGENT_SERVICE_URL` | `https://api-test.petties.world/ai` | Preview |

---

## ✅ Verification Checklist

- [ ] DNS records trỏ đúng IP
- [ ] Neon test branch đã tạo
- [ ] `.env.test` đã cấu hình trên EC2
- [ ] Nginx config đã enable
- [ ] SSL cert đã tạo
- [ ] Test containers running
- [ ] `https://api-test.petties.world/api/actuator/health` trả về UP
- [ ] Vercel preview với domain `test.petties.world`

---

## 🔧 Commands Reference

```bash
# View test logs
docker-compose -f docker-compose.test.yml logs -f

# Restart test containers
docker-compose -f docker-compose.test.yml restart

# Stop test containers (giữ prod running)
docker-compose -f docker-compose.test.yml down

# View all running containers
docker ps
```
