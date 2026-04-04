# 📝 GIT WORKFLOW - PETTIES TEAM (PHIÊN BẢN NGẮN GỌN)

---

## 🎯 NHANH CHÓNG (Quick Start)

### **Team: 5 người**
```
Tân (Leader) - SE181717
Tuân - DE180807
Triết - DE180687
Huyền - DE180773
Uyên - DE180893
```

### **2 branch chính**
```
main (production, live) ← Auto-deploy Vercel, EC2 
  ↑
develop (integration, share code)
  ↑
feature/* (mỗi người làm riêng)
```

---

## 📋 SETUP (LẦN ĐẦU - 30 phút)

### **Bước 1: Tân tạo GitHub repo**
```
Repo name: petties-booking-system
Visibility: Private
Add collaborators: 4 người còn lại
```

### **Bước 2: Mỗi người clone**
```bash
git clone https://github.com/your-org/petties-booking-system.git
cd petties-booking-system

git config --global user.name "Your Name"
git config --global user.email "your-email@fpt.edu.vn"
```

### **Bước 3: Setup branch protection (Tân)**
```
GitHub Settings → Branches

Protect main:
  ✓ Require PR
  ✓ Require 2 approvals
  ✓ Require CI/CD pass

Protect develop:
  ✓ Require PR
  ✓ Require 1 approval
  ✓ Require CI/CD pass
```

---

## 🚀 DAILY WORKFLOW - MỖI NGÀY LÀM GÌ

### **Sáng (9:00)**
```bash
# 1. Update develop (cái chung của team)
git checkout develop
git fetch origin
git pull origin develop

# 2. Xem đã có feature mới nào được merge chưa?
git log --oneline -5
```

### **Làm việc (10:00-17:00)**
```bash
# 3. Làm trên feature branch của mình (KHÔNG trên develop!)
git checkout feature/your-feature
# Hoặc tạo mới:
git checkout -b feature/your-feature

# 4. Code + commit
git add .
git commit -m "feat: mô tả ngắn"
git commit -m "fix: mô tả bug fix"

# 5. Push lên GitHub
git push origin feature/your-feature
```

### **Cuối ngày (17:00)**
```bash
# 6. Push commit cuối cùng
git push origin feature/your-feature

# 7. Nếu feature xong → Tạo PR
# GitHub → Pull Requests → New PR
# Base: develop
# Compare: feature/your-feature
```

---

## 🔄 FLOW CHI TIẾT - 5 BƯỚC

### **Step 1: Tạo feature branch**
```bash
# Từ develop (LUÔN luôn từ develop, không phải main!)
git checkout develop
git pull origin develop
git checkout -b feature/booking-scheduler

# Tên branch:
# feature/tên-feature (e.g., feature/booking-scheduler)
# bugfix/tên-bug (e.g., bugfix/fix-double-booking)
```

### **Step 2: Code + Commit**
```bash
# Edit file...
git add .

# Commit message format: [Type] Description
# feat: thêm feature mới
# fix: fix bug
# test: thêm test
# docs: cập nhật docs
# refactor: sửa code (không thay logic)

git commit -m "feat: implement vet shift management"
git commit -m "fix: resolve double-booking conflict"
git commit -m "test: add unit tests for booking"

# Multiple commits OK!
```

### **Step 3: Push lên GitHub**
```bash
git push origin feature/booking-scheduler

# First push tạo nhánh trên GitHub
# Push lần sau chỉ cần: git push
```

### **Step 4: Tạo Pull Request (PR) + Review**
```
GitHub UI:

Title: "feat: Implement vet shift management"

Description:
## Mô tả
Thêm hệ thống quản lý shift cho nhân viên

## Feature
✓ Auto-detect available vets
✓ Handle split shifts (sáng + tối)
✓ Manager override

## Testing
✓ Unit tests: 5/5 pass
✓ Manual test: OK
✓ No conflicts

Assign Reviewers: 1 người (e.g., @tuannguyen)
Labels: feature, backend
```

### **Step 5: Merge to develop**
```
Reviewer checks:
✓ Code logic đúng
✓ Test pass
✓ No security issue
✓ Code readable

Click [Approve] → Author click [Merge]

After merge:
✓ GitHub auto-delete branch
✓ Local delete: git branch -d feature/booking-scheduler
```

---

## 🔀 REBASE (Khi nào dùng?)

### **Scenario: feature branch outdated**
```
develop: A ── B ── C ── D (Tuân's merge)
feature: A ── B ── E (bạn làm)

Bạn outdated! Cần update.

Solution: REBASE
──────────────

git fetch origin
git rebase origin/develop

Result:
develop: A ── B ── C ── D
feature: A ── B ── C ── D ── E' (up-to-date!)

git push --force-with-lease origin feature/booking-scheduler
```

### **Khi dùng rebase?**
```
✓ Trước khi tạo PR (nếu develop updated)
✓ Để keep feature fresh
✓ Để linear history (clean)

❌ Không dùng rebase:
✗ Lên main/develop (dùng merge)
✗ Nếu người khác cũng work trên nhánh
✗ Đừng --force nếu không sure!
```

---

## 📅 RELEASE FLOW - TUẦN 4 (LÊN PRODUCTION)

### **Day 1-3: Chuẩn bị**
```
All features merged to develop:
✓ feature/booking-scheduler → develop
✓ feature/emr-management → develop
✓ feature/vet-dashboard → develop
✓ feature/payment-gateway → develop
✓ feature/notification-system → develop

develop: A ── B ── C ── D ── E ── F ── G ── H
```


### **Day 4: Merge to main (Production!)**
```
Tân tạo PR: develop → main

Title: "chore: develop to production"

Team reviews + approves (2 people)

Click [Merge pull request]

✓ Auto-deploy to Vercel
✓ LIVE! 🎉

git push origin main
```

---

## 🆘 COMMON COMMANDS

### **Update code từ team**
```bash
git fetch origin          # Download latest
git pull origin develop   # Update develop
```

### **Kiểm tra status**
```bash
git status                # Xem changes
git log --oneline         # Xem commits
git diff                  # Xem chi tiết thay đổi
```

### **Fix mistakes**
```bash
# Discard changes (chưa commit)
git checkout -- file.py

# Undo last commit (chưa push)
git reset --soft HEAD~1

# Xem lại cái đã push (dùng revert, không reset!)
git revert abc1234        # Tạo commit undo
```

### **Stash (lưu tạm)**
```bash
# Lưu uncommitted changes
git stash

# Restore lại
git stash pop

# Useful khi need to switch branch tạm
```

---

## ✅ GIT FLOW CHECKLIST

### **Trước khi push**
```
☑ Code hoàn thành
☑ Tests viết + pass
☑ No console.logs, debuggers
☑ No hardcoded secrets (.env)
☑ Code format OK (prettier)
```

### **Trước khi tạo PR**
```
☑ Rebase với develop (nếu outdated)
☑ Push lên GitHub
☑ PR title + description rõ ràng
☑ Assign 1 reviewer
☑ CI/CD pass (automatic)
```

### **Reviewer checklist**
```
✓ Logic code đúng?
✓ Tests pass?
✓ Security OK? (SQL injection, XSS)
✓ Code readable?
✓ Performance OK?

APPROVE → Merge
COMMENT → Author fix + re-review
```

---

## 🚫 GOLDEN RULES - KHÔNG PHẠM

```
❌ KHÔNG:
├─ git push --force origin main/develop (FORBIDDEN!)
├─ Commit trực tiếp lên main
├─ Commit trực tiếp lên develop
├─ git add .env (secrets!)
├─ Rebase to public branch (main/develop)
└─ Force push mà không sure!

✅ LUÔN:
├─ Commit to feature branch
├─ Open PR → Get review
├─ Use GitHub merge button (not local)
├─ Pull develop daily
├─ Test before push
```

---

## 📊 BRANCH NAMING CONVENTION

```
Feature:
├─ feature/booking-scheduler (Tân)
├─ feature/emr-management (Tuân)
├─ feature/vet-dashboard (Triết)
├─ feature/payment-gateway (Huyền)
└─ feature/notification-system (Uyên)

Bug:
├─ bugfix/fix-double-booking
└─ bugfix/fix-timezone-issue

Hotfix (emergency, from main):
├─ hotfix/critical-bug

Release:
├─ release/v0.0.1
└─ release/v0.0.2
```

---

## 🎯 EXAMPLE WORKFLOW - TÂN (LEADER)

### **Day 1: Create feature**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/booking-scheduler
git commit -m "feat: add staff_shifts table"
git commit -m "feat: implement get_available_staff"
git push origin feature/booking-scheduler
```

### **Day 2-3: Review + Merge**
```
GitHub PR open
Tuân reviews + approves
Merge to develop ✓
```

### **Day 3-4: Other features merge**
```
develop now updated with 5 features
Tân: git pull develop (see all)
```

### **Day 5: Release preparation**
```bash
git checkout -b release/v0.0.1
# QA test + bugfixes
# PR to main
# MERGE ✓
# LIVE 🎉
```

---

## 📚 COMMIT MESSAGE EXAMPLES

```bash
✅ GOOD:
git commit -m "feat: add vet shift management system"
git commit -m "fix: resolve double-booking in conflict check"
git commit -m "test: add unit tests for booking validation"
git commit -m "docs: update API documentation"

❌ BAD:
git commit -m "update"
git commit -m "fix bug"
git commit -m "asdf"
git commit -m "wip" (work in progress)
```

---

## 🔄 PETTIES TIMELINE (4 tuần)

```
WEEK 1-3:
├─ Tân: feature/booking-scheduler
├─ Tuân: feature/emr-management
├─ Triết: feature/vet-dashboard
├─ Huyền: feature/payment-gateway
└─ Uyên: feature/notification-system

WEEK 4:
├─ Day 1: All features merged to develop
├─ Day 2: release/v0.0.1 created + QA test
├─ Day 3: Bugs fixed
├─ Day 4: PR to main ready
└─ Day 5: MERGE to main + LIVE ✓

RESULT: v0.0.1 production! 🎉
```

---

## ✨ QUICK REFERENCE

```bash
# Setup
git clone <repo>
git config --global user.name "Name"

# Daily
git checkout develop && git pull origin develop
git checkout -b feature/name

# Work
git add .
git commit -m "type: message"
git push origin feature/name

# Create PR
# GitHub UI → New PR → develop ← feature/name

# After review
git merge (GitHub button)
git branch -d feature/name

# Release (Tuân)
git checkout -b release/v0.0.1
git push origin release/v0.0.1
# Test, bugfix...
# PR to main → MERGE → LIVE!

# Hotfix (emergency)
git checkout main && git pull
git checkout -b hotfix/issue
git commit -m "hotfix: issue"
git push origin hotfix/issue
# PR → main
# PR → develop (back-merge)
```

---

## 🎓 SUMMARY

```
MAIN CONCEPTS:
├─ feature/* branch: Cá nhân làm
├─ develop branch: Tất cả integrate
├─ main branch: Production (live)
├─ release/* branch: Staging (test trước)
└─ PR: Code review trước merge

WORKFLOW:
1. Create feature branch
2. Code + commit
3. Push to GitHub
4. Create PR
5. Get review + approval
6. MERGE to develop
7. (Later) Merge to main (for release)

RULES:
✓ Always use PR
✓ Always review
✓ Always test
✓ Rebase when outdated
✓ Never force push main
✓ Tag each release
```

---

**Status: GIT WORKFLOW - PHIÊN BẢN NGẮN GỌN** ✅  
**Tiếng Việt, dễ hiểu** ✅  
**Ready for PETTIES team!** 🚀