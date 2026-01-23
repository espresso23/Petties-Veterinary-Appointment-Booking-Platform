# Booking Workflow - Petties

**Version:** 1.5.0  
**Last Updated:** 2026-01-22  

---

## 1. Booking Status State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: Pet Owner tạo booking
    
    PENDING --> CONFIRMED: Clinic xác nhận
    PENDING --> CANCELLED: Pet Owner/Clinic hủy
    
    CONFIRMED --> ASSIGNED: Clinic assign Vet
    CONFIRMED --> CANCELLED: Hủy
    
    ASSIGNED --> ASSIGNED: Manager Reassign Vet (v1.5.0)
    
    ASSIGNED --> CHECK_IN: Vet check-in (IN_CLINIC)
    ASSIGNED --> ON_THE_WAY: Vet bắt đầu di chuyển (HOME_VISIT/SOS)
    ASSIGNED --> NO_SHOW: Khách không đến
    ASSIGNED --> CANCELLED: Hủy
    
    ON_THE_WAY --> ARRIVED: Vet đến nơi
    
    ARRIVED --> CHECK_IN: Vet bắt đầu khám
    
    CHECK_IN --> IN_PROGRESS: Đang khám
    
    IN_PROGRESS --> CHECK_OUT: Vet kết thúc + Thu tiền
    
    CHECK_OUT --> COMPLETED: Thanh toán thành công
    
    CANCELLED --> [*]
    NO_SHOW --> [*]
    COMPLETED --> [*]
```

---

## 2. Status Definitions

| Status | Mô tả | Actor | Booking Type |
|--------|-------|-------|--------------|
| `PENDING` | Chờ xác nhận | Pet Owner tạo | All |
| `CONFIRMED` | Đã xác nhận | Clinic Manager | All |
| `ASSIGNED` | Đã phân công Vet | Clinic Manager | All |
| `ON_THE_WAY` | Vet đang đến | Vet | HOME_VISIT, SOS |
| `ARRIVED` | Vet đã đến | Vet | HOME_VISIT, SOS |
| `CHECK_IN` | Bắt đầu khám | Vet | All |
| `IN_PROGRESS` | Đang khám | Auto | All |
| `CHECK_OUT` | Kết thúc + Thanh toán | Vet | All |
| `COMPLETED` | Hoàn thành | Auto (after payment) | All |
| `CANCELLED` | Đã hủy | Pet Owner/Clinic | All |
| `NO_SHOW` | Khách không đến | Clinic | All |

---

## 3. Booking Types

### 3.1 IN_CLINIC (Khám tại phòng khám)
```
PENDING → CONFIRMED → ASSIGNED → CHECK_IN → IN_PROGRESS → CHECK_OUT → COMPLETED
```

### 3.2 HOME_VISIT (Khám tại nhà)
```
PENDING → CONFIRMED → ASSIGNED → ON_THE_WAY → ARRIVED → CHECK_IN → IN_PROGRESS → CHECK_OUT → COMPLETED
```

### 3.3 SOS (Cấp cứu)
```
PENDING → CONFIRMED → ASSIGNED → ON_THE_WAY (GPS Tracking) → ARRIVED → CHECK_IN → IN_PROGRESS → CHECK_OUT → COMPLETED
```

> **Note:** SOS có thêm GPS tracking real-time qua Redis

---

## 4. Sequence Diagrams

### 4.1 IN_CLINIC Flow

```mermaid
sequenceDiagram
    participant PO as Pet Owner
    participant CM as Clinic Manager
    participant V as Vet
    participant S as System

    PO->>S: Tạo booking (chọn slot)
    S->>S: Lock slot(s)
    S-->>PO: Booking PENDING
    S->>CM: 🔔 Notification: Booking mới

    CM->>S: Xác nhận booking
    S-->>PO: 🔔 Booking CONFIRMED

    CM->>S: Assign Vet
    S-->>V: 🔔 Được phân công
    S-->>PO: 🔔 Booking ASSIGNED

    Note over PO: Pet Owner đến phòng khám

    V->>S: Check-in
    S->>S: Status = CHECK_IN → IN_PROGRESS
    S-->>PO: 🔔 Đang được khám

    Note over V: Vet khám + Ghi EMR

    V->>S: Check-out
    S->>S: Status = CHECK_OUT
    S-->>PO: 💳 Yêu cầu thanh toán

    PO->>S: Thanh toán (Cash/Online)
    S->>S: Payment PAID
    S->>S: Status = COMPLETED
    S-->>PO: ✅ Hoàn thành
```

### 4.2 HOME_VISIT Flow

```mermaid
sequenceDiagram
    participant PO as Pet Owner
    participant CM as Clinic Manager
    participant V as Vet
    participant S as System

    PO->>S: Tạo booking HOME_VISIT
    S->>S: Tính distance + price
    S-->>PO: Booking PENDING

    CM->>S: Xác nhận + Assign Vet
    S-->>V: 🔔 Được phân công

    V->>S: Bắt đầu di chuyển
    S->>S: Status = ON_THE_WAY
    S-->>PO: 🔔 Vet đang đến

    V->>S: Đã đến nơi
    S->>S: Status = ARRIVED
    S-->>PO: 🔔 Vet đã đến

    V->>S: Check-in
    S->>S: Status = IN_PROGRESS

    Note over V: Khám tại nhà

    V->>S: Check-out + Thu tiền Cash
    S->>S: Payment PAID, Status = COMPLETED
    S-->>PO: ✅ Hoàn thành
```

### 4.3 SOS Flow (với GPS Tracking)

```mermaid
sequenceDiagram
    participant PO as Pet Owner
    participant S as System
    participant R as Redis
    participant V as Vet

    PO->>S: 🆘 Tạo SOS booking
    S->>S: Auto-assign nearest Vet
    S-->>V: 🚨 SOS Alert
    S->>S: Status = ASSIGNED

    V->>S: Accept + Start moving
    S->>S: Status = ON_THE_WAY

    loop Every 5 seconds
        V->>R: Update GPS location
        R-->>PO: Real-time GPS via WebSocket
    end

    V->>S: Arrived
    S->>S: Status = ARRIVED
    R->>R: Stop GPS tracking

    V->>S: Check-in → IN_PROGRESS → Check-out
    S->>S: Status = COMPLETED
```

---

## 5. Payment Flow

```mermaid
flowchart TD
    A[CHECK_OUT] --> B{Payment Method?}
    B -->|CASH| C[Vet thu tiền]
    B -->|ONLINE| D[Pet Owner thanh toán online]
    
    C --> E[Vet confirm nhận tiền]
    D --> F[Payment gateway callback]
    
    E --> G[Payment PAID]
    F --> G
    
    G --> H[Booking COMPLETED]
```

**Payment entity:**
```
PAYMENT {
    booking_id FK
    amount
    method: CASH | ONLINE
    status: PENDING | PAID | REFUNDED | FAILED
}
```

---

## 6. Cancellation Rules

| Thời điểm | Ai hủy | Hành động |
|-----------|--------|-----------|
| Status = PENDING | Pet Owner | Free cancel |
| Status = CONFIRMED | Pet Owner | Có thể tính phí |
| Status = ASSIGNED | Pet Owner | Cần thông báo Vet |
| Status ≥ CHECK_IN | Không thể | Đã bắt đầu khám |

---

## 7. No-Show Handling

- **Trigger:** Vet đánh dấu NO_SHOW khi khách không đến
- **Thời điểm:** Sau 15 phút kể từ `booking_time`
- **Hậu quả:** Slot được giải phóng, Pet Owner có thể bị ghi nhận

---

## 8. Redis Keys (SOS GPS)

```
Key:   sos:location:{bookingId}
Value: {
  "vetId": "uuid",
  "lat": 10.762622,
  "long": 106.660172,
  "updatedAt": "2026-01-11T00:30:00",
  "status": "ON_THE_WAY"
}
TTL:   60 seconds
```

---

---

## 9. Reassign Vet & Availability Check (v1.5.0) ✅

- **UC-CM-14:** Kiểm tra tính khả dụng của Vet trước khi gán (Check Vet Availability).
- **UC-CM-15:** Gán lại bác sĩ (Reassign Vet) khi có thay đổi nhân sự hoặc cấp cứu.
- **UC-VT-14:** Bác sĩ xem tổng quan Dashboard lịch của mình (Vet Home Dashboard Summary).

*Document này mô tả toàn bộ booking workflow cho project Petties.*
