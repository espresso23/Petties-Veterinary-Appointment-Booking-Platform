# 🔧 FIX: Authorization Header Not Sent

## ❌ Vấn đề
Server báo: `❌ No JWT token found in request headers`
Response: `403 Forbidden`

## ✅ GIẢI PHÁP NGAY

### **Cách 1: Set Token Thủ Công (NHANH NHẤT)**

1. **Copy token từ Login response:**
```
eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJLaW5nb2Z3YXIxMTIzIiwidXNlcklkIjoiZDM2ODFjYmUtNjA3NS00NzY5LWI4MmMtYWQ0OGI5Yjk1YTAyIiwicm9sZSI6IkNMSU5JQ19PV05FUiIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3NjYxMTM2MDYsImV4cCI6MTc2NjIwMDAwNn0.6Sd1YsENvMn4DZ4gUJMl-qjaH4-Q66LZZAZfxmJX3tF3yxcIMwvmYLQsLESd77xj
```

2. **Trong Postman:**
   - Mở request "Create Service - Basic Checkup"
   - Tab **Headers**
   - Tìm dòng `Authorization`
   - ✅ **BẬT checkbox** (quan trọng!)
   - Value: `Bearer eyJhbGciOiJIUzM4NCJ9...` (paste token vào)

3. **Send request** → Phải thành công!

---

### **Cách 2: Check Header Enable/Disable**

**Header Authorization có thể bị TẮT trong Postman!**

1. Mở request "Create Service"
2. Tab **Headers**
3. Xem checkbox bên trái header `Authorization`:
   - ☑️ **Checked** = ENABLED (gửi header)
   - ☐ **Unchecked** = DISABLED (không gửi)
4. **BẬT checkbox** nếu đang tắt!

---

### **Cách 3: Set Collection Variable**

1. **Click vào Collection** "PETTIES Service Management"
2. Tab **Variables**
3. Tìm dòng `accessToken`
4. Trong cột **CURRENT VALUE**, paste token:
```
eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJLaW5nb2Z3YXIxMTIzIiwidXNlcklkIjoiZDM2ODFjYmUtNjA3NS00NzY5LWI4MmMtYWQ0OGI5Yjk1YTAyIiwicm9sZSI6IkNMSU5JQ19PV05FUiIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3NjYxMTM2MDYsImV4cCI6MTc2NjIwMDAwNn0.6Sd1YsENvMn4DZ4gUJMl-qjaH4-Q66LZZAZfxmJX3tF3yxcIMwvmYLQsLESd77xj
```
5. Click **Save** (Ctrl+S)
6. Chạy lại Create Service request

---

### **Cách 4: Verify Header Đang Gửi**

1. Mở **Postman Console** (View → Show Postman Console hoặc `Alt+Ctrl+C`)
2. Chạy request "Create Service"
3. Xem log request:
   - Tìm phần **Request Headers**
   - Kiểm tra có `Authorization: Bearer ...` không?
   - Nếu **KHÔNG CÓ** → Header bị disable hoặc biến rỗng!

---

## 🔍 DEBUG CHECKLIST

- [ ] Login request thành công (200 OK)
- [ ] Response có `accessToken` field
- [ ] Checkbox ✅ của Authorization header được BẬT
- [ ] Biến `{{accessToken}}` có giá trị (hover vào xem)
- [ ] Postman Console hiển thị `Authorization` trong Request Headers
- [ ] Token chưa hết hạn (exp: 1766200006 = 20/12/2024)

---

## 💡 TOKEN INFO

**Token hiện tại của bạn:**
- Issued at: `1766113606` (19/12/2024 03:06:46)
- Expires at: `1766200006` (20/12/2024 03:06:46)
- Valid for: **24 giờ**
- Role: **CLINIC_OWNER** ✅
- User: **Kingofwar1123**

---

## 🚀 QUICK TEST

Copy-paste lệnh này vào Postman Console để test:

```javascript
pm.collectionVariables.set("accessToken", "eyJhbGciOiJIUzM4NCJ9.eyJzdWIiOiJLaW5nb2Z3YXIxMTIzIiwidXNlcklkIjoiZDM2ODFjYmUtNjA3NS00NzY5LWI4MmMtYWQ0OGI5Yjk1YTAyIiwicm9sZSI6IkNMSU5JQ19PV05FUiIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3NjYxMTM2MDYsImV4cCI6MTc2NjIwMDAwNn0.6Sd1YsENvMn4DZ4gUJMl-qjaH4-Q66LZZAZfxmJX3tF3yxcIMwvmYLQsLESd77xj");
console.log("✅ Token set!");
```

Sau đó chạy lại Create Service request.
