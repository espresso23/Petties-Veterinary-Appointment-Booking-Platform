# Migration Guide: Separate Domains → Unified Domain Architecture

## Overview

This guide covers migrating from separate subdomains (`ai.petties.world`) to a unified domain architecture (`api.petties.world`) for backend and AI services.

### Before (Separate Domains)
```
Frontend:  https://www.petties.world       → Vercel
Backend:   https://api.petties.world/api   → EC2 Nginx → Spring Boot
AI Service: https://ai.petties.world       → EC2 Nginx → FastAPI
```

### After (Unified Domain - Like Ngrok)
```
Frontend:  https://www.petties.world              → Vercel
Backend:   https://api.petties.world/api          → EC2 Nginx → Spring Boot
AI Service: https://api.petties.world/ai          → EC2 Nginx → FastAPI
WebSocket:  https://api.petties.world/ws/chat/*   → EC2 Nginx → FastAPI
```

---

## Migration Steps

### Step 1: Update Vercel Environment Variables

**Action Required:** Update your Vercel project environment variables

1. Go to Vercel Dashboard → `petties-web` project → Settings → Environment Variables
2. Update the following variable (Production environment only):

| Variable | Old Value | New Value |
|----------|-----------|-----------|
| `VITE_AGENT_SERVICE_URL` | `https://ai.petties.world` | `https://api.petties.world/ai` |

3. **Keep these unchanged:**
   - `VITE_API_BASE_URL=https://api.petties.world/api` ✅
   - `VITE_WS_URL=wss://api.petties.world/ws` ✅

4. Click **Save** and **Redeploy**

---

### Step 2: Update EC2 `.env.prod` File

**Action Required:** SSH into your EC2 instance and update `.env.prod`

```bash
# SSH into EC2
ssh ubuntu@your-ec2-host

# Edit .env.prod
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
nano .env.prod
```

**No changes needed to Nginx variables** - they already support unified routing:
```bash
NGINX_SERVER_NAME=api.petties.world  # ✅ Already correct
NGINX_FRONTEND_UPSTREAM=https://www.petties.world  # ✅ Already correct
```

**Update CORS (optional cleanup):**
```bash
# Old
CORS_ORIGINS=https://petties.world,https://www.petties.world,https://api.petties.world,https://ai.petties.world

# New (cleaner)
CORS_ORIGINS=https://petties.world,https://www.petties.world,https://api.petties.world
```

---

### Step 3: Update DNS Records (Optional)

**Action Required:** Remove the `ai.petties.world` DNS record

Since all traffic now goes through `api.petties.world`, you can safely delete:
- ❌ `ai.petties.world` A record (no longer needed)

Keep these:
- ✅ `www.petties.world` → Vercel (CNAME)
- ✅ `api.petties.world` → EC2 IP (A record)

---

### Step 4: Deploy Changes

**Action Required:** Push code changes to trigger deployment

```bash
# From your local machine
git add .
git commit -m "feat: migrate to unified domain architecture"
git push origin main
```

GitHub Actions will automatically:
1. Deploy to EC2 with unified Nginx routing
2. Nginx will route:
   - `/api/*` → Backend (port 8080)
   - `/ai/*` → AI Service (port 8000)
   - `/ws/*` → Backend WebSocket (port 8080)
   - `/ws/chat/*` → AI Service WebSocket (port 8000)

---

### Step 5: Redeploy Frontend on Vercel

**Action Required:** Trigger a new Vercel deployment

Either:
- Push a new commit to `main` branch (auto-deploy), OR
- Manually redeploy from Vercel Dashboard → Deployments → ⋯ → Redeploy

---

### Step 6: Verify Migration

**Test 1: Check Frontend Config**

1. Open `https://www.petties.world`
2. Open Browser Console (F12)
3. Look for config log:

```javascript
🔧 Environment Config: {
  environment: "production",
  hostname: "www.petties.world",
  API_BASE_URL: "https://api.petties.world/api",
  WS_URL: "wss://api.petties.world/ws",
  AGENT_SERVICE_URL: "https://api.petties.world/ai",
  AGENT_API_BASE_URL: "https://api.petties.world/ai",
  AGENT_WS_BASE_URL: "wss://api.petties.world",
  agentUsesUnifiedProxy: true  // ← Should be true
}
```

**Test 2: Test Backend REST API**

```bash
curl -f https://api.petties.world/api/actuator/health
# Expected: {"status":"UP"}
```

**Test 3: Test AI Service REST API**

```bash
curl -f https://api.petties.world/ai/health
# Expected: {"status":"ok"}
```

**Test 4: Test AI WebSocket Connection**

1. Open `https://www.petties.world`
2. Navigate to AI Chat feature
3. Open Browser Console → Network tab → WS filter
4. Look for WebSocket connection to: `wss://api.petties.world/ws/chat/{sessionId}`
5. Status should be `101 Switching Protocols` ✅

**Test 5: Test Full AI Chat Flow**

1. Login to `https://www.petties.world`
2. Open AI Chat
3. Send a message: "Hello, test connection"
4. Verify AI responds correctly
5. Check Network tab - all AI calls should use `https://api.petties.world/ai/*`

---

## Rollback Plan (If Issues Occur)

If you encounter issues, rollback to separate domains:

### Step 1: Revert Vercel Env Var

```bash
VITE_AGENT_SERVICE_URL=https://ai.petties.world  # Old value
```

### Step 2: Redeploy Frontend

Vercel Dashboard → Deployments → ⋯ → Redeploy

### Step 3: Verify Old Routes Work

```bash
curl -f https://ai.petties.world/health  # Should work again
```

---

## Nginx Routing Details

Your Nginx config (`nginx/templates/default.conf.template`) already handles unified routing:

```nginx
# Backend REST API
location /api {
    proxy_pass http://backend:8080;
}

# AI Service REST API
location /ai/ {
    proxy_pass http://ai-service:8000/;
}

# Backend WebSocket
location /ws/ {
    proxy_pass http://backend:8080/ws/;
}

# AI Service WebSocket
location /ws/chat/ {
    proxy_pass http://ai-service:8000;
}
```

**Route Priority** (longest prefix match):
1. `/api/ws-native` → Backend WebSocket (specific)
2. `/api/v1/` → AI Service via Backend (if configured)
3. `/api` → Backend REST
4. `/ws/chat/` → AI Service WebSocket (specific)
5. `/ws/` → Backend WebSocket (general)
6. `/ai/` → AI Service REST
7. `/` → Frontend (Vercel)

---

## Environment Comparison

| Feature | Old (Separate) | New (Unified) |
|---------|---------------|---------------|
| Backend REST | `api.petties.world/api` | `api.petties.world/api` ✅ |
| Backend WS | `api.petties.world/ws` | `api.petties.world/ws` ✅ |
| AI REST | `ai.petties.world` | `api.petties.world/ai` 🆕 |
| AI WS | `ai.petties.world/ws/chat/*` | `api.petties.world/ws/chat/*` 🆕 |
| Frontend | `www.petties.world` | `www.petties.world` ✅ |
| DNS Records | 3 subdomains | 2 subdomains ✅ |
| CORS Origins | 3 origins | 2 origins ✅ |
| SSL Certs | 2 certs | 1 cert ✅ |

---

## Troubleshooting

### Issue: AI Service returns 404

**Cause:** Nginx not routing `/ai/*` correctly

**Fix:**
```bash
# SSH into EC2
ssh ubuntu@your-ec2-host

# Check Nginx config
docker exec petties-prod-nginx-1 cat /etc/nginx/conf.d/default.conf | grep "location /ai"

# Should show:
# location /ai/ {
#     proxy_pass http://ai-service:8000/;
# }

# If missing, restart containers:
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod down
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

---

### Issue: WebSocket connection fails

**Cause:** Nginx not upgrading WebSocket connection for `/ws/chat/*`

**Fix:**
```bash
# Test WebSocket manually
wscat -c wss://api.petties.world/ws/chat/test

# Check Nginx logs
docker logs petties-prod-nginx-1 2>&1 | grep -i "websocket"

# Verify Nginx has WebSocket headers for /ws/chat/
location /ws/chat/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

### Issue: CORS errors after migration

**Cause:** `ai.petties.world` still in CORS whitelist

**Fix:**
```bash
# Edit .env.prod
nano .env.prod

# Update CORS_ORIGINS
CORS_ORIGINS=https://petties.world,https://www.petties.world,https://api.petties.world

# Restart backend
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod restart backend
```

---

### Issue: Frontend still calls old AI URL

**Cause:** Vercel env var not updated or deployment not rebuilt

**Fix:**
1. Check Vercel Dashboard → Settings → Environment Variables
2. Verify `VITE_AGENT_SERVICE_URL=https://api.petties.world/ai` (Production)
3. Redeploy: Dashboard → Deployments → ⋯ → Redeploy
4. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

---

## Post-Migration Cleanup

After successful migration:

1. **Remove old DNS record:**
   - Delete `ai.petties.world` from your DNS provider

2. **Update documentation:**
   - Replace all references to `ai.petties.world` with `api.petties.world/ai`

3. **Update monitoring/alerting:**
   - Update health check URLs from `ai.petties.world/health` to `api.petties.world/ai/health`

4. **Update Postman collections:**
   - Update environment variables to use `api.petties.world/ai` for AI endpoints

---

## Checklist

- [ ] Vercel env var `VITE_AGENT_SERVICE_URL` updated to `https://api.petties.world/ai`
- [ ] Vercel frontend redeployed
- [ ] EC2 `.env.prod` CORS updated (removed `ai.petties.world`)
- [ ] Code pushed to `main` branch
- [ ] GitHub Actions deployment successful
- [ ] Backend health check passes: `curl https://api.petties.world/api/actuator/health`
- [ ] AI service health check passes: `curl https://api.petties.world/ai/health`
- [ ] AI Chat works and WebSocket connects to `wss://api.petties.world/ws/chat/*`
- [ ] Browser console shows `agentUsesUnifiedProxy: true`
- [ ] Old DNS record `ai.petties.world` removed
- [ ] Documentation updated

---

## Support

If you encounter issues not covered here:
1. Check Nginx logs: `docker logs petties-prod-nginx-1`
2. Check backend logs: `docker logs petties-prod-backend-1`
3. Check AI service logs: `docker logs petties-prod-ai-service-1`
4. Review browser console for frontend errors
5. Check Vercel deployment logs

---

**Migration Date:** _______________  
**Performed By:** _______________  
**Status:** ☐ In Progress  ☐ Completed  ☐ Rolled Back
