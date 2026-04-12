# FE Same-Origin Cutover Checklist (Test and Prod)

Last Updated: 2026-04-12

## 1. Goal

Use FE domains as the single public entrypoint (same-origin style, like ngrok):
- Test FE domain: https://test.petties.world
- Prod FE domain: https://www.petties.world

Expected FE calls:
- Backend REST: `/api/*`
- Backend WS: `/ws/*`
- AI REST: `/ai/*`
- AI WS: `/ws/chat/*`

## 2. Stop Criteria (Do Not Cut Over If Any Item Fails)

- [ ] FE domain cannot proxy `/api` to backend.
- [ ] FE domain cannot proxy `/ai` to AI service.
- [ ] WebSocket upgrade fails on `/ws` or `/ws/chat`.
- [ ] Vercel env is still mixed between same-origin and api-subdomain mode.

## 3. Pre-Flight Inputs

- [ ] Confirm EC2 public IP for API gateway is final.
- [ ] Confirm backend health path: `/api/actuator/health`.
- [ ] Confirm AI health path: `/health` (through `/ai/health` when proxied).
- [ ] Confirm TLS certs are valid for `www.petties.world` and `test.petties.world`.

## 4. DNS Checklist (Namecheap)

- [ ] `A @ -> 76.76.21.21` (frontend root on Vercel).
- [ ] `CNAME www -> cname.vercel-dns.com`.
- [ ] `CNAME test -> cname.vercel-dns.com`.
- [ ] Keep `A api -> <EC2_IP>` only if you want fallback/debug path.
- [ ] Keep `A api-test -> <EC2_IP>` only if you want fallback/debug path.
- [ ] Remove legacy records not used (`ai`, `ai-test`).
- [ ] Remove conflicting `@` old IP records.

## 5. Vercel Domain Binding

- [ ] `www.petties.world` attached to Production environment.
- [ ] `test.petties.world` attached to Preview environment.
- [ ] Preview branch tracking is pinned to `develop` (not all unassigned branches).

## 6. Vercel ENV Checklist (Same-Origin Mode)

Set these values in Vercel project variables.

### 6.1 Production

- [ ] `VITE_APP_ENV=production`
- [ ] `VITE_API_BASE_URL=https://www.petties.world/api`
- [ ] `VITE_WS_URL=wss://www.petties.world/ws`
- [ ] `VITE_AGENT_API_BASE_URL=https://www.petties.world/ai`
- [ ] `VITE_AGENT_WS_BASE_URL=wss://www.petties.world`
- [ ] `VITE_FORCE_VIP=false`
- [ ] `VITE_DEBUG=false`

### 6.2 Preview (test)

- [ ] `VITE_APP_ENV=production`
- [ ] `VITE_API_BASE_URL=https://test.petties.world/api`
- [ ] `VITE_WS_URL=wss://test.petties.world/ws`
- [ ] `VITE_AGENT_API_BASE_URL=https://test.petties.world/ai`
- [ ] `VITE_AGENT_WS_BASE_URL=wss://test.petties.world`
- [ ] `VITE_FORCE_VIP=false`
- [ ] `VITE_DEBUG=false`

### 6.3 Remove Legacy Variables

- [ ] Remove `VITE_AI_SERVICE_URL`.
- [ ] Remove `VITE_AI_WS_URL`.
- [ ] Optional: remove `VITE_AGENT_SERVICE_URL` if both `VITE_AGENT_API_BASE_URL` and `VITE_AGENT_WS_BASE_URL` are set.

## 7. Reverse Proxy Routing Checklist (Mandatory)

Your FE domains must route traffic to backend/AI services.

- [ ] `https://www.petties.world/api/*` reaches backend.
- [ ] `https://www.petties.world/ai/*` reaches AI service.
- [ ] `wss://www.petties.world/ws/*` works.
- [ ] `wss://www.petties.world/ws/chat/*` works.
- [ ] Same checks pass for `test.petties.world`.

If any item above is not implemented, same-origin mode will fail even if ENV is correct.

## 8. EC2 ENV Checklist (Still Required)

### 8.1 Test (`.env.test`)

- [ ] `NGINX_SERVER_NAME=api-test.petties.world`
- [ ] `NGINX_FRONTEND_UPSTREAM=https://test.petties.world`
- [ ] `NGINX_FRONTEND_HOST=test.petties.world`
- [ ] `CORS_ORIGINS` includes `https://test.petties.world`

### 8.2 Prod (`.env.prod`)

- [ ] `NGINX_SERVER_NAME=api.petties.world`
- [ ] `NGINX_FRONTEND_UPSTREAM=https://www.petties.world`
- [ ] `NGINX_FRONTEND_HOST=www.petties.world`
- [ ] `CORS_ORIGINS` includes `https://www.petties.world` (and `https://petties.world` if used)

### 8.3 Ubuntu SSH ENV Verification (Do this on EC2)

If your Ubuntu user does not have Docker group permission, run Docker commands with `sudo`.

- [ ] SSH into EC2 and open project directory:

```bash
cd ~/petties-backend/Petties-Veterinary-Appointment-Booking-Platform
pwd
```

- [ ] Confirm env files exist:

```bash
ls -la .env.prod .env.test
```

- [ ] Confirm required keys exist in `.env.test`:

```bash
grep -E '^(COMPOSE_PROJECT_NAME|NGINX_SERVER_NAME|NGINX_FRONTEND_UPSTREAM|NGINX_FRONTEND_HOST|CORS_ORIGINS|DB_HOST|DATABASE_URL|MONGODB_URL)=' .env.test
```

- [ ] Confirm required keys exist in `.env.prod`:

```bash
grep -E '^(COMPOSE_PROJECT_NAME|NGINX_SERVER_NAME|NGINX_FRONTEND_UPSTREAM|NGINX_FRONTEND_HOST|CORS_ORIGINS|DB_HOST|DATABASE_URL|MONGODB_URL)=' .env.prod
```

- [ ] Validate compose interpolation for test env:

```bash
docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test config >/tmp/petties-test-config.out
test $? -eq 0 && echo OK_TEST_CONFIG
```

```bash
sudo docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test config >/tmp/petties-test-config.out
test $? -eq 0 && echo OK_TEST_CONFIG
```

- [ ] Validate compose interpolation for prod env:

```bash
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod config >/tmp/petties-prod-config.out
test $? -eq 0 && echo OK_PROD_CONFIG
```

```bash
sudo docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod config >/tmp/petties-prod-config.out
test $? -eq 0 && echo OK_PROD_CONFIG
```

- [ ] Confirm running containers received expected Nginx env values:

```bash
docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test exec nginx sh -lc 'echo $NGINX_SERVER_NAME && echo $NGINX_FRONTEND_UPSTREAM && echo $NGINX_FRONTEND_HOST'
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod exec nginx sh -lc 'echo $NGINX_SERVER_NAME && echo $NGINX_FRONTEND_UPSTREAM && echo $NGINX_FRONTEND_HOST'
```

```bash
sudo docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test exec nginx sh -lc 'echo $NGINX_SERVER_NAME && echo $NGINX_FRONTEND_UPSTREAM && echo $NGINX_FRONTEND_HOST'
sudo docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod exec nginx sh -lc 'echo $NGINX_SERVER_NAME && echo $NGINX_FRONTEND_UPSTREAM && echo $NGINX_FRONTEND_HOST'
```

- [ ] Quick health checks from EC2 host:

```bash
curl -f http://127.0.0.1:8081/api/actuator/health
curl -f http://127.0.0.1:8001/health
curl -f http://127.0.0.1:8080/api/actuator/health
curl -f http://127.0.0.1:8000/health
```

## 9. Deployment Sequence

- [ ] Deploy test stack first:

```bash
docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test up -d --build
```

- [ ] Deploy production stack after test passes:

```bash
docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

- [ ] Trigger Vercel redeploy for Preview.
- [ ] Trigger Vercel redeploy for Production.

## 10. Verification Commands

### 10.1 DNS

```bash
nslookup test.petties.world
nslookup www.petties.world
nslookup api-test.petties.world
nslookup api.petties.world
```

### 10.2 HTTP health checks

```bash
curl -I https://test.petties.world
curl -I https://www.petties.world
curl -f https://test.petties.world/api/actuator/health
curl -f https://www.petties.world/api/actuator/health
curl -f https://test.petties.world/ai/health
curl -f https://www.petties.world/ai/health
```

### 10.3 Browser checks (DevTools)

- [ ] No CORS errors on login flow.
- [ ] Network calls go to FE domain paths (`/api`, `/ai`) in same-origin mode.
- [ ] Chat WebSocket connects successfully.

### 10.4 Isolation checks (test and prod must not overlap)

- [ ] Confirm two separate compose projects exist:

```bash
sudo docker compose ls
```

Expected: both `petties-test` and `petties-prod` are listed.

- [ ] Confirm each stack has its own containers:

```bash
sudo docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test ps
sudo docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod ps
```

Expected: both commands return running backend, ai-service, and nginx for each project.

- [ ] Confirm host ports are not overlapping:

```bash
sudo ss -ltnp | grep -E ':80 |:81 |:8080 |:8081 |:8000 |:8001 '
```

Expected:
- prod uses `80`, `8080`, `8000`
- test uses `81`, `8081`, `8001`

- [ ] Confirm each nginx container has the correct env values:

```bash
sudo docker compose -p petties-test -f docker-compose.prod.yml --env-file .env.test exec nginx sh -lc 'echo TEST:$NGINX_SERVER_NAME:$NGINX_FRONTEND_HOST'
sudo docker compose -p petties-prod -f docker-compose.prod.yml --env-file .env.prod exec nginx sh -lc 'echo PROD:$NGINX_SERVER_NAME:$NGINX_FRONTEND_HOST'
```

Expected:
- test -> `api-test.petties.world:test.petties.world`
- prod -> `api.petties.world:www.petties.world`

- [ ] Confirm health checks hit the correct local ports:

```bash
curl -f http://127.0.0.1:8081/api/actuator/health
curl -f http://127.0.0.1:8001/health
curl -f http://127.0.0.1:8080/api/actuator/health
curl -f http://127.0.0.1:8000/health
```

Expected: all return success.

- [ ] Confirm no accidental project-name collision:

```bash
grep -E '^COMPOSE_PROJECT_NAME=' .env.test .env.prod
```

Expected:
- `.env.test` -> `COMPOSE_PROJECT_NAME=petties-test`
- `.env.prod` -> `COMPOSE_PROJECT_NAME=petties-prod`

## 11. Rollback Plan (Fast)

If same-origin mode fails:
- [ ] Revert Vercel env to api-subdomain mode:
  - Prod: `api.petties.world`
  - Test: `api-test.petties.world`
- [ ] Redeploy Vercel Preview and Production.
- [ ] Keep DNS unchanged during rollback.

## 12. Sign-Off

- [ ] Test environment passed all checks.
- [ ] Production environment passed all checks.
- [ ] Team confirmed mobile and web regression smoke tests.
- [ ] Security keys exposed in screenshots were rotated.
