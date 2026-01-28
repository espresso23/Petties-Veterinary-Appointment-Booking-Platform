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
    
    CONFIRMED --> ASSIGNED: Clinic assign Staff
    CONFIRMED --> CANCELLED: Hủy
    
    ASSIGNED --> ASSIGNED: Manager Reassign Staff (v1.5.0)
    
    ASSIGNED --> IN_PROGRESS: Staff check-in (IN_CLINIC)
    ASSIGNED --> ON_THE_WAY: Staff bắt đầu di chuyển (HOME_VISIT/SOS)
    ASSIGNED --> NO_SHOW: Khách không đến
    ASSIGNED --> CANCELLED: Hủy
    
    ON_THE_WAY --> ARRIVED: Staff đến nơi
    
    ARRIVED --> IN_PROGRESS: Staff check-in
    
    IN_PROGRESS --> COMPLETED: Staff checkout + Thanh toán
    
    CANCELLED --> [*]
    NO_SHOW --> [*]
    COMPLETED --> [*]
```

> **Note:** `check-in` và `checkout` là **hành động (actions)**, không phải trạng thái. Check-in chuyển booking sang `IN_PROGRESS`, checkout chuyển sang `COMPLETED`.

---

## 2. Status Definitions

| Status | Mô tả | Actor | Booking Type |
|--------|-------|-------|--------------|
| `PENDING` | Chờ xác nhận | Pet Owner tạo | All |
| `CONFIRMED` | Đã xác nhận | Clinic Manager | All |
| `ASSIGNED` | Đã phân công Staff | Clinic Manager | All |
| `ON_THE_WAY` | Staff đang đến | Staff | HOME_VISIT, SOS |
| `ARRIVED` | Staff đã đến | Staff | HOME_VISIT, SOS |
| `IN_PROGRESS` | Đang khám (sau check-in) | Staff | All |
| `COMPLETED` | Hoàn thành (sau checkout + thanh toán) | Staff | All |
| `CANCELLED` | Đã hủy | Pet Owner/Clinic | All |
| `NO_SHOW` | Khách không đến | Clinic | All |

### Actions (Hành động)

| Action | Trigger | Transition |
|--------|---------|------------|
| `check-in` | Staff bấm check-in | ASSIGNED/ARRIVED → IN_PROGRESS |
| `checkout` | Staff bấm checkout | IN_PROGRESS → COMPLETED |

---

## 3. Booking Types

### 3.1 IN_CLINIC (Khám tại phòng khám)
```
PENDING → CONFIRMED → ASSIGNED → (check-in) → IN_PROGRESS → (checkout) → COMPLETED
```

### 3.2 HOME_VISIT (Khám tại nhà)
```
PENDING → CONFIRMED → ASSIGNED → ON_THE_WAY → ARRIVED → (check-in) → IN_PROGRESS → (checkout) → COMPLETED
```

### 3.3 SOS (Cấp cứu)
```
PENDING → CONFIRMED → ASSIGNED → ON_THE_WAY (GPS Tracking) → ARRIVED → (check-in) → IN_PROGRESS → (checkout) → COMPLETED
```

> **Note:** SOS có thêm GPS tracking real-time qua Redis

---

## 4. Sequence Diagrams

### 4.1 IN_CLINIC Flow

```mermaid
sequenceDiagram
    participant PO as Pet Owner
    participant CM as Clinic Manager
    participant V as Staff
    participant S as System

    PO->>S: Tạo booking (chọn slot)
    S->>S: Lock slot(s)
    S-->>PO: Booking PENDING
    S->>CM: 🔔 Notification: Booking mới

    CM->>S: Xác nhận booking
    S-->>PO: 🔔 Booking CONFIRMED

    CM->>S: Assign Staff
    S-->>V: 🔔 Được phân công
    S-->>PO: 🔔 Booking ASSIGNED

    Note over PO: Pet Owner đến phòng khám

    V->>S: Check-in (action)
    S->>S: Status = IN_PROGRESS
    S-->>PO: 🔔 Đang được khám

    Note over V: Staff khám + Ghi EMR

    V->>S: Checkout (action)
    S->>S: Status = COMPLETED
    S-->>PO: ✅ Hoàn thành
```

### 4.2 HOME_VISIT Flow

```mermaid
sequenceDiagram
    participant PO as Pet Owner
    participant CM as Clinic Manager
    participant V as Staff
    participant S as System

    PO->>S: Tạo booking HOME_VISIT
    S->>S: Tính distance + price
    S-->>PO: Booking PENDING

    CM->>S: Xác nhận + Assign Staff
    S-->>V: 🔔 Được phân công

    V->>S: Bắt đầu di chuyển
    S->>S: Status = ON_THE_WAY
    S-->>PO: 🔔 Staff đang đến

    V->>S: Đã đến nơi
    S->>S: Status = ARRIVED
    S-->>PO: 🔔 Staff đã đến

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
    participant V as Staff

    PO->>S: 🆘 Tạo SOS booking
    S->>S: Auto-assign nearest Staff
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

    V->>S: Check-in (action) → Khám → Checkout (action)
    S->>S: IN_PROGRESS → COMPLETED
```

---

## 5. Payment Flow

```mermaid
flowchart TD
    A[IN_PROGRESS] --> B[Staff hoàn thành khám]
    B -->|CASH| C[Staff thu tiền]
    B -->|ONLINE| D[Pet Owner thanh toán online]
    
    C --> E[Staff confirm nhận tiền]
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
| Status = ASSIGNED | Pet Owner | Cần thông báo Staff |
| Status ≥ CHECK_IN | Không thể | Đã bắt đầu khám |

---

## 7. No-Show Handling

- **Trigger:** Staff đánh dấu NO_SHOW khi khách không đến
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

## 9. Reassign Staff & Availability Check (v1.5.0) ✅

- **UC-CM-14:** Kiểm tra tính khả dụng của Staff trước khi gán (Check Staff Availability).
- **UC-CM-15:** Gán lại nhân viên (Reassign Staff) khi có thay đổi nhân sự hoặc cấp cứu.
- **UC-VT-14:** Nhân viên xem tổng quan Dashboard lịch của mình (Staff Home Dashboard Summary).

*Document này mô tả toàn bộ booking workflow cho project Petties.*
