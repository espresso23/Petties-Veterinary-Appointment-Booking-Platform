# 🧪 Transaction Service Testing Guide

## 📋 Overview
Guide để test Transaction Service API với Postman collection đã được tạo.

## 🚀 Setup

### 1. Import Postman Collection
1. Mở Postman
2. Click **Import**
3. Chọn file: `Petties-Transaction-Service.postman_collection.json`
4. Import vào workspace

### 2. Import Environment
1. Click **Environments** tab
2. Click **Import**
3. Chọn file: `Petties-Environment.postman_environment.json`
4. Set environment làm active

### 3. Start Backend Server
```bash
cd backend-spring/petties
mvn spring-boot:run
```

Server sẽ chạy trên `http://localhost:8080`

## 📊 Test Data được tạo tự động

Khi start ứng dụng, DataInitializer sẽ tạo:

### **Users**
- `petOwner` / `owner` - Pet Owner
- `clinicOwner` / `123456` - Clinic Owner  
- `clinicManager` / `123456` - Clinic Manager
- `vet` / `123456` - Vet

### **Clinic**
- **Petties Central Hospital** - thuộc clinicOwner

### **Pet**
- **Test Dog** (Corgi, 10.5kg) - thuộc petOwner

### **Services**
- **General Check-up** (500,000 VND) - tại clinic

### **Bookings với Payment Methods**
| Booking Code | Payment Method | Total Price | Type | Status |
|--------------|----------------|-------------|-------|---------|
| `BK-20240101-0001` | **QR** | 500,000 VND | IN_CLINIC | PENDING |
| `BK-20240101-0002` | **CASH** | 300,000 VND | IN_CLINIC | PENDING |
| `BK-20240101-0003` | **CARD** | 750,000 VND | HOME_VISIT | PENDING |

## 🧪 API Testing Steps

### **Step 1: Test QR Payment Description**
```
GET /api/transactions/payment-description/{bookingId}
```

**Expected Response (QR Booking):**
```json
{
  "success": true,
  "bookingId": "uuid-here",
  "paymentDescription": "123e4567-89b12d3a-12345",
  "message": "Tạo payment description thành công"
}
```

**Expected Response (Non-QR Booking):**
```json
{
  "success": false,
  "bookingId": "uuid-here", 
  "paymentDescription": null,
  "message": "Booking không sử dụng phương thức thanh toán QR"
}
```

### **Step 2: Check Payment Method**
```
GET /api/transactions/is-qr/{bookingId}
```

**Expected Response:**
```json
{
  "success": true,
  "bookingId": "uuid-here",
  "isQrPayment": true,
  "paymentMethod": "QR",
  "message": "Kiểm tra phương thức thanh toán thành công"
}
```

### **Step 3: Get Total Price**
```
GET /api/transactions/total-price/{bookingId}
```

**Expected Response:**
```json
{
  "success": true,
  "bookingId": "uuid-here",
  "totalPrice": 500000,
  "message": "Lấy total price thành công"
}
```

## 🔍 Test Cases

### **✅ Positive Cases**
1. **QR Payment** - Should generate payment description
2. **Check QR Method** - Should return true for QR bookings
3. **Get Total Price** - Should return correct amount

### **❌ Negative Cases**
1. **CASH Payment** - Should return null for payment description
2. **CARD Payment** - Should return null for payment description
3. **Invalid Booking ID** - Should return 400 error

## 📝 Payment Description Format

**Format:** `{clinicID}-{petownerID}-{5digit}`

**Example:** `123e4567-89b12d3a-45678`

- **clinicID**: First 8 chars of clinic UUID
- **petownerID**: First 8 chars of pet owner UUID  
- **5digit**: Random 5-digit number (00000-99999)

## 🐛 Debugging Tips

### **Check Application Logs**
```bash
# Monitor logs khi test
tail -f logs/application.log
```

### **Verify Test Data**
```sql
-- Check bookings trong database
SELECT booking_code, total_price, status FROM bookings;

-- Check payment methods
SELECT p.method, p.amount, b.booking_code 
FROM payments p 
JOIN bookings b ON p.booking_id = b.booking_id;
```

### **Postman Console**
- Mở **Console** (View > Show Postman Console)
- Xem response logs và errors

## 🚨 Common Issues

### **1. Booking Not Found**
- **Cause:** Test data chưa được tạo
- **Fix:** Restart application để chạy DataInitializer

### **2. Payment Description Null**
- **Cause:** Booking không có payment method QR
- **Fix:** Sử dụng booking ID của QR booking (`BK-20240101-0001`)

### **3. Connection Refused**
- **Cause:** Backend chưa start
- **Fix:** Start Spring Boot application

## 📞 Support

Nếu có issues:
1. Check application logs
2. Verify database connection
3. Check Postman environment variables
4. Confirm backend is running

---

**Ready to test! 🎉**
