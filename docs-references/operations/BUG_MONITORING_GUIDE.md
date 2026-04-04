# 🐛 Petties Bug Monitoring & Incident Response Guide

**Phiên bản:** 1.0  
**Cập nhật:** 2025-12-27  
**Team Size:** 5 người

---

## 📋 Mục lục

1. [Tổng quan](#1-tổng-quan)
2. [Monitoring Stack](#2-monitoring-stack)
3. [Alert Severity Levels](#3-alert-severity-levels)
4. [On-Call Rotation](#4-on-call-rotation)
5. [Incident Response Workflow](#5-incident-response-workflow)
6. [Alert Templates](#6-alert-templates)
7. [Communication Channels](#7-communication-channels)
8. [Setup Guide](#8-setup-guide)
9. [Postmortem Process](#9-postmortem-process)

---

## 1. Tổng quan

### 1.1 Mục tiêu

- **Phát hiện sớm** - Biết lỗi trước khi user phàn nàn
- **Phản hồi nhanh** - Critical bugs fix trong vòng 1 giờ
- **Thông báo đúng người** - Không spam, alert có ý nghĩa
- **Học từ incidents** - Postmortem để không lặp lại

### 1.2 Nguyên tắc

```
✅ Alert có nghĩa = Alert có action
✅ Mỗi alert có owner
✅ Không ignore warnings
✅ Document mọi incident
```

---

## 2. Monitoring Stack

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PETTIES MONITORING STACK                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │ petties-web │     │ backend-    │     │ ai-service  │       │
│  │   (React)   │     │   spring    │     │  (FastAPI)  │       │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘       │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             ▼                                   │
│                    ┌─────────────────┐                          │
│                    │    🔍 SENTRY    │                          │
│                    │ Error Tracking  │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │  📲 DISCORD │     │  📧 EMAIL   │     │  📊 DAILY   │       │
│  │   Alerts    │     │  (Critical) │     │   Summary   │       │
│  └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🌐 UPTIMEROBOT - Uptime Monitoring (endpoints health)  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Tools Summary

| Tool | Mục đích | Chi phí | URL |
|------|----------|---------|-----|
| **Sentry** | Error tracking, performance | Free 5K events/month | sentry.io |
| **UptimeRobot** | Endpoint health check | Free 50 monitors | uptimerobot.com |
| **Discord** | Team notifications | Free | discord.com |
| **GitHub Issues** | Bug tracking | Free | github.com |

---

## 3. Alert Severity Levels

### 3.1 Định nghĩa Severity

| Level | Emoji | Định nghĩa | Ví dụ |
|-------|-------|------------|-------|
| **Critical** | 🔴 | Production down, data loss, security breach | Database unavailable, payment system down |
| **High** | 🟠 | Major feature broken, many users affected | Booking creation fails, login broken |
| **Medium** | 🟡 | Feature degraded, workaround available | Slow response, minor UI bugs |
| **Low** | 🟢 | Cosmetic issues, rare edge cases | Typos, styling issues |

### 3.2 Response Time SLA

| Severity | Response Time | Resolution Time | Notification |
|----------|---------------|-----------------|--------------|
| 🔴 Critical | < 15 phút | < 2 giờ | Discord + Email |
| 🟠 High | < 1 giờ | < 8 giờ (same day) | Discord |
| 🟡 Medium | < 4 giờ | This sprint | Discord only |
| 🟢 Low | Next business day | Next sprint | GitHub Issue |

### 3.3 Ai quyết định Severity?

```
1. Sentry auto-classify dựa trên error rate
2. On-call có thể escalate/de-escalate
3. Team Lead có final say
```

---

## 4. On-Call Rotation

### 4.1 Schedule (Weekly rotation)

```
Tuần 1: Dev A (Team Lead)  - Primary on-call
Tuần 2: Dev B              - Primary on-call
Tuần 3: Dev C              - Primary on-call
Tuần 4: Dev D              - Primary on-call
Tuần 5: Repeat from Dev A
```

> **Note:** Team Lead luôn là backup on-call

### 4.2 On-Call Responsibilities

#### Trong giờ làm việc (9:00 - 18:00)

- [ ] Monitor Discord #petties-alerts
- [ ] Respond to alerts trong 15 phút
- [ ] Investigate và update status
- [ ] Escalate nếu cần help

#### Ngoài giờ làm việc

- [ ] Chỉ respond Critical alerts
- [ ] Có thể delegate nếu không available
- [ ] Log tất cả incidents

### 4.3 Handoff Process

```markdown
## On-Call Handoff - [Date]

### From: @dev-a
### To: @dev-b

**Active Issues:**
- [ ] Issue #123: Slow booking API (Medium, monitoring)
- [ ] Issue #124: Payment timeout (High, awaiting fix deploy)

**Things to Watch:**
- LLM response times elevated (normal during peak hours)
- New deployment scheduled Tuesday 10:00

**Notes:**
- Sentry dashboard: [link]
- Recent postmortems: [link]
```

---

## 5. Incident Response Workflow

### 5.1 Flowchart

```
                    ┌──────────────────┐
                    │   Alert Received │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Acknowledge     │
                    │  (React 👀 emoji) │
                    └────────┬─────────┘
                             │
                             ▼
               ┌─────────────────────────────┐
               │     Assess Severity          │
               │ Is it really Critical/High?  │
               └─────────────┬───────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ 🔴 Critical  │ │ 🟠 High      │ │ 🟡 Medium+   │
   │ Investigate  │ │ Investigate  │ │ Create Issue │
   │ immediately  │ │ same hour    │ │ for sprint   │
   └──────┬───────┘ └──────┬───────┘ └──────────────┘
          │                │
          ▼                ▼
   ┌──────────────────────────────┐
   │  Identify Root Cause         │
   │  (Logs, Sentry, DB)          │
   └─────────────┬────────────────┘
                 │
                 ▼
   ┌──────────────────────────────┐
   │  Implement Fix               │
   │  (Hotfix if Critical)        │
   └─────────────┬────────────────┘
                 │
                 ▼
   ┌──────────────────────────────┐
   │  Deploy & Verify             │
   │  (Monitor for regression)    │
   └─────────────┬────────────────┘
                 │
                 ▼
   ┌──────────────────────────────┐
   │  Update Discord Status       │
   │  (React ✅ emoji)            │
   └─────────────┬────────────────┘
                 │
                 ▼
   ┌──────────────────────────────┐
   │  Close Sentry Issue          │
   │  Write Postmortem (Critical) │
   └──────────────────────────────┘
```

### 5.2 Discord Status Updates

Use thread replies để update status:

```
🔴 CRITICAL ALERT - Database Connection Failed
  │
  ├─ 👀 @dev-a: Acknowledged, investigating (15:45)
  │
  ├─ 🔍 @dev-a: Found issue - connection pool exhausted (15:52)
  │
  ├─ 🔧 @dev-a: Deploying fix - increase pool size (16:05)
  │
  ├─ ✅ @dev-a: Resolved - verified connections restored (16:12)
  │
  └─ 📝 Postmortem will be created
```

---

## 6. Alert Templates

### 6.1 Critical Alert

```
🔴🔴🔴 CRITICAL ALERT 🔴🔴🔴
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 Service: [petties-backend / petties-web / ai-service]
❌ Issue: [Brief description]
⏰ Time: [YYYY-MM-DD HH:MM:SS +07:00]
👥 Impact: [Estimated users affected]

📋 Details:
[Error message or description]

🔗 Links:
- Sentry: [URL]
- Logs: [URL]
- Dashboard: [URL]

@on-call @team-lead - IMMEDIATE ACTION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 6.2 High Alert

```
🟠 HIGH ALERT - [Service Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Location: [Component/Endpoint]
❌ Error: [Error type and message]
⏰ Time: [YYYY-MM-DD HH:MM:SS +07:00]
📊 Occurrences: [X users in Y minutes]

📋 Context:
[Additional details]

🔗 Sentry: [URL]

@on-call - Please investigate
```

### 6.3 Medium/Warning Alert

```
🟡 WARNING - [Service Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Issue: [Description]
📍 Location: [Component/Endpoint]
⏰ Time: [YYYY-MM-DD HH:MM:SS +07:00]
📊 Metric: [Current value vs threshold]

May require attention.
```

### 6.4 Daily Summary

```
📊 PETTIES DAILY REPORT - [YYYY-MM-DD]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 OVERVIEW
├── Uptime: [XX.XX%] ([Y min downtime])
├── Total Requests: [XX,XXX]
├── Error Rate: [X.XX%]
└── Avg Response Time: [XXX ms]

🐛 ISSUES BY SEVERITY
├── 🔴 Critical: [X] (Resolved: X)
├── 🟠 High: [X] (Resolved: X)
├── 🟡 Medium: [X]
└── 🟢 Low: [X]

📊 TOP ERRORS
1. [Error Type] - [X occurrences]
2. [Error Type] - [X occurrences]
3. [Error Type] - [X occurrences]

🎯 ACTION ITEMS
- [ ] [Task description] - @assignee
- [x] [Completed task] - @assignee

📝 NOTES
[Any important notes for the team]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 7. Communication Channels

### 7.1 Discord Channels

| Channel | Mục đích | Who Posts | Who Monitors |
|---------|----------|-----------|--------------|
| `#petties-alerts` | Production alerts (auto) | Sentry, UptimeRobot | Everyone |
| `#petties-alerts-dev` | Staging alerts (auto) | Sentry | Dev team |
| `#petties-bugs` | Bug discussions | Any team member | Dev team |
| `#petties-general` | General dev chat | Any team member | Dev team |

### 7.2 Escalation Path

```
Level 1: On-call Developer
    │
    │ (If no response in 15 min OR needs help)
    ▼
Level 2: Team Lead
    │
    │ (If critical business impact)
    ▼
Level 3: Stakeholders
```

### 7.3 External Communication

Khi incident ảnh hưởng users:

```markdown
## Status Update - [Service Name]

**Status:** 🔴 Investigating / 🟡 Identified / 🟢 Resolved

**Issue:** [Brief user-friendly description]

**Impact:** [What users might experience]

**ETA:** [Expected resolution time]

**Updates:** We're working on this and will update every [X] minutes.
```

---

## 8. Setup Guide

### 8.1 Sentry Setup

#### A. Create Sentry Project

1. Go to https://sentry.io
2. Create org: `petties`
3. Create projects:
   - `petties-web` (React)
   - `petties-backend` (Spring Boot)
   - `petties-ai-service` (Python)

#### B. Install Sentry SDKs

**React (petties-web):**
```bash
npm install @sentry/react
```

**Spring Boot:**
```xml
<dependency>
    <groupId>io.sentry</groupId>
    <artifactId>sentry-spring-boot-starter</artifactId>
    <version>7.0.0</version>
</dependency>
```

**FastAPI (ai-service):**
```bash
pip install sentry-sdk[fastapi]
```

#### C. Configure Discord Webhook

1. Discord → Channel → Edit → Integrations → Webhooks
2. Create webhook, copy URL
3. Sentry → Alerts → Create alert rules → Action: Webhook
4. Paste Discord webhook URL

### 8.2 UptimeRobot Setup

1. Go to https://uptimerobot.com
2. Create monitors:

| Monitor | URL | Check Interval |
|---------|-----|----------------|
| Web App | `https://petties.world` | 5 min |
| Backend Health | `https://api.petties.world/health` | 5 min |
| AI Service | `https://ai.petties.world/health` | 5 min |

3. Configure Discord webhook for alerts

### 8.3 Discord Webhook Setup

1. Go to Discord → Channel Settings → Integrations → Webhooks
2. Create webhook for `#petties-alerts`
3. Copy webhook URL
4. Add to Sentry & UptimeRobot alert actions

---

## 9. Postmortem Process

### 9.1 Khi nào cần Postmortem?

- ✅ Mọi Critical incident
- ✅ High incident kéo dài > 2 giờ
- ✅ Incident ảnh hưởng > 100 users
- ✅ Data loss hoặc security issue

### 9.2 Postmortem Template

```markdown
# Postmortem: [Incident Title]

**Date:** YYYY-MM-DD
**Author:** @name
**Severity:** 🔴 Critical
**Duration:** X hours Y minutes

## Summary

[1-2 sentence description of what happened]

## Impact

- Users affected: [X]
- Duration: [X hours]
- Revenue impact: [if applicable]

## Timeline (All times in UTC+7)

| Time | Event |
|------|-------|
| 15:45 | Alert triggered |
| 15:48 | On-call acknowledged |
| 16:05 | Root cause identified |
| 16:20 | Fix deployed |
| 16:25 | Verified resolved |

## Root Cause

[Technical explanation of what caused the issue]

## Resolution

[What was done to fix it]

## Lessons Learned

### What went well

- [Thing that worked]
- [Another thing]

### What went wrong

- [Thing that didn't work]
- [Another thing]

## Action Items

| Action | Owner | Deadline | Status |
|--------|-------|----------|--------|
| [Action 1] | @name | YYYY-MM-DD | ⬜ TODO |
| [Action 2] | @name | YYYY-MM-DD | ⬜ TODO |

## Prevention

[What changes will prevent this from happening again]
```

### 9.3 Postmortem Meeting

- **When:** Within 48 hours of incident resolution
- **Duration:** 30 minutes
- **Attendees:** On-call, Team Lead, relevant devs
- **Outcome:** Documented postmortem + action items

---

## 📋 Quick Reference Card

### Emoji Reactions

| Emoji | Meaning |
|-------|---------|
| 👀 | Acknowledged, investigating |
| 🔧 | Working on fix |
| 🔄 | Deploying/In progress |
| ✅ | Resolved |
| 🔁 | Needs more investigation |
| ❌ | Cannot reproduce / Invalid |

### Useful Commands

```bash
# Check production logs
ssh prod-server 'tail -f /var/log/petties/app.log'

# Restart services
ssh prod-server 'sudo systemctl restart petties-backend'

# Check DB connections
ssh prod-server 'psql -c "SELECT count(*) FROM pg_stat_activity"'
```

### Emergency Contacts

| Role | Name | Phone | Discord |
|------|------|-------|-------|
| Team Lead | [Name] | [Phone] | @handle |
| DevOps | [Name] | [Phone] | @handle |
| DB Admin | [Name] | [Phone] | @handle |

---

## 📝 Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-27 | 1.0 | Initial version |

---

> **Câu hỏi?** Liên hệ Team Lead hoặc post trong #petties-general
