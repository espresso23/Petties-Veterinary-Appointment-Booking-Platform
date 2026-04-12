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

**Cập nhật các giá trị (chuẩn thống nhất):**
- `DB_HOST`: Neon test branch host
- `DB_PASSWORD`: Neon test branch password
- `DATABASE_URL`: Full connection string
- `MONGO_URI`: MongoDB test database
- `MONGODB_URL`: MongoDB URL cho AI service
- `MONGODB_DATABASE`: tên DB test

---

## 4️⃣ Nginx Template (không config thủ công)

Test stack dùng nginx container render tự động từ template `nginx/templates/default.conf.template` bằng biến môi trường.

Chỉ cần đặt các biến trong `.env.test`:

```bash
NGINX_SERVER_NAME=api-test.petties.world
NGINX_FRONTEND_UPSTREAM=https://test.petties.world
NGINX_FRONTEND_HOST=test.petties.world
NGINX_HOST_PORT=81
```

Không cần tạo `nginx.test.conf` hoặc chỉnh tay file nginx theo môi trường.

---

## 5️⃣ Start Test Containers

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform

# Checkout develop branch
git checkout develop
git pull origin develop

# Start test containers (compose chung)
docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test up -d --build

# Check status
docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test ps
```

---

## 6️⃣ Verify

```bash
# Health checks
curl http://127.0.0.1:8081/api/actuator/health
curl http://127.0.0.1:8001/health

# Through Nginx
curl https://api-test.petties.world/api/actuator/health
```

---

## 7️⃣ Configure Vercel for Test FE

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
- [ ] `.env.test` có Nginx vars (`NGINX_SERVER_NAME`, `NGINX_FRONTEND_UPSTREAM`, `NGINX_FRONTEND_HOST`)
- [ ] Test containers running
- [ ] `https://api-test.petties.world/api/actuator/health` trả về UP
- [ ] Vercel preview với domain `test.petties.world`

---

## 🔧 Commands Reference

```bash
# View test logs
docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test logs -f

# Restart test containers
docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test restart

# Stop test containers (giữ prod running)
docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test down

# View all running containers
docker ps
```
