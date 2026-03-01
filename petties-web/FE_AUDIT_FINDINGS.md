# Rà soát Frontend React – Petties Web

**Ngày:** 2026-02-27  
**Phạm vi:** Toàn bộ `petties-web/src` (dashboard Admin, Clinic Owner, Clinic Manager, Staff)

---

## 1. Tổng quan scan hooks & stores

### 1.1 Scan useEffect / useCallback / useMemo

- **Số file dùng hooks:** ~55+ file trong `src/components`, `src/pages`, `src/hooks`, `src/layouts`.
- **Hook custom:** `useAuth`, `useToast`, `useSidebar`, `useSyncProfile`, `useSseNotification`, `useNotificationPolling`.
- **Đã xử lý:** `ClinicList.tsx` – trước đây gây "Maximum update depth exceeded" do `useEffect` gọi `setFilters` + `getMyClinics`; đã chuyển logic load lên `ClinicsListPage` và chỉ gọi `getMyClinics()` một lần khi mount.

### 1.2 Stores (Zustand)

| Store | Vai trò | Nguy cơ vòng lặp |
|-------|--------|-------------------|
| `clinicStore` | Clinics list, filters, getMyClinics, fetchClinics, setFilters | **Đã xử lý** – Component con không còn `setFilters` trong effect. Page gọi `getMyClinics()` on mount. |
| `notificationStore` | unreadCount, refreshUnreadCount, setUnreadCount | Actions ổn định. Không thấy pattern effect → setState → re-run. |
| `bookingStore` | pendingBookingCount, refreshPendingBookingCount | Dùng trong layout để badge; refresh gọi từ effect với deps ổn định. |
| `chatStore` | unreadCount, activeConversationId, refreshChatUnreadCount | Layout/ChatPage subscribe chat; cleanup có. |
| `userStore` | profile, fetchProfile, clearProfile | `useSyncProfile` dùng refs để tránh sync vô hạn; logic an toàn. |
| `authStore` | user, setUser, clearAuth, validateTokens | setUser được gọi từ useSyncProfile với guard ref; ổn định. |

---

## 2. Lỗi tiềm ẩn theo mức độ

### CRITICAL (có thể gây loop hoặc crash)

- **Không phát hiện thêm.** Vấn đề "Maximum update depth exceeded" tại `ClinicList`/`ClinicsListPage` đã được xử lý trong phiên trước.

### MEDIUM (rò rỉ, reconnect sai, race)

| # | File | Mô tả | Đề xuất |
|---|------|--------|--------|
| 1 | `src/hooks/useSseNotification.ts` | ~~Trong `eventSource.onerror`, callback reconnect rỗng~~ → **Đã sửa:** gọi `connectRef.current()` trong setTimeout; thêm `connectRef` và clear `reconnectTimeoutRef` trong `disconnect()`. | — |
| 2 | `src/layouts/ClinicManagerLayout.tsx` | ~~Race: unsubscribes gán async nên cleanup có thể bỏ qua~~ → **Đã sửa:** dùng `unsubscribesRef`, gán sau khi setup xong; cleanup gọi `unsubscribesRef.current.forEach(u => u())`. | — |
| 3 | `src/pages/clinic-manager/ChatPage.tsx` | Effect mount phụ thuộc `[loadChatBoxes, refreshChatUnreadCount, connectWebSocket]`. Nếu một trong các callback này không ổn định (recreated mỗi render), effect sẽ chạy lại nhiều lần → connect/load nhiều lần. | Đảm bảo `loadChatBoxes`, `refreshChatUnreadCount`, `connectWebSocket` được wrap trong `useCallback` với deps tối thiểu; hoặc dùng ref cho các handler. Hiện tại đã dùng useCallback – cần kiểm tra deps có ổn không. |
| 4 | `src/hooks/useNotificationPolling.ts` | Effect deps: `[showToast, interval, fetchLimit, setUnreadCount]`. Nếu `showToast` từ `useToast()` thay đổi mỗi lần render thì polling sẽ bị clearInterval rồi setInterval lại liên tục. | Kiểm tra `useToast` trả về `showToast` ổn định (useCallback). Nếu không, dùng ref: `showToastRef.current = showToast` và gọi qua ref trong interval. |

### LOW (UX / performance / code smell)

| # | File | Mô tả | Đề xuất |
|---|------|--------|--------|
| 1 | `src/components/profile/EmailChangeModal.tsx` | useEffect cho countdown có deps `[step, countdown]`. Mỗi giây `countdown` thay đổi → effect chạy lại → clearInterval và tạo interval mới. Hoạt động đúng nhưng **dư thừa**. | Chỉ phụ thuộc `[step]`. Trong interval, dùng `setCountdown(prev => ...)`; không cần đưa `countdown` vào deps. |
| 2 | `src/components/clinic-owner/ServiceGrid.tsx` | `useEffect(() => loadClinics(), [])` – `loadClinics` không có trong deps (eslint-disable hoặc implicit). | Thêm `loadClinics` vào deps hoặc gọi một lần bằng cách đặt tên rõ: `useEffect(() => { loadClinics() }, [])` và đảm bảo loadClinics là stable (hoặc wrap useCallback). |
| 3 | `src/components/clinic-owner/MasterServiceGrid.tsx` | Tương tự: `useEffect(() => loadMasterServices(), [])` và một effect `setHasClinic(true)` không cần thiết. | Chuẩn hóa: loadMasterServices ổn định hoặc deps rõ ràng; bỏ effect setHasClinic nếu luôn true. |
| 4 | Inline object/array trong dependency array | Một số nơi có thể dùng object/array inline trong deps (vd. `[filters]` với filters là object tạo mới mỗi lần). | Tránh tạo object/array mới trong render khi dùng làm deps; dùng `useMemo` cho filters hoặc so sánh shallow trước khi gọi action. |
| 5 | `src/components/booking/SosAlertModal.tsx` | Effect WebSocket: deps `[clinicId, onAlertReceived]`. `onAlertReceived` phụ thuộc `[playAlertSound, showToast, resetAlert]`. Khi các callback này đổi reference, effect disconnect + connect lại. | Chấp nhận được nếu các callback đã được memo đúng. Có thể giảm re-subscribe bằng cách dùng ref cho handler và chỉ deps `[clinicId]`. |

---

## 3. WebSocket / SSE / Timer – Cleanup & Reconnect

### 3.1 Đã có cleanup đúng

- **useNotificationPolling:** `return () => clearInterval(pollingInterval)` và clear `shownIdsRef` (qua ref).
- **useAuth:** `return () => clearInterval(interval)` cho validateTokens.
- **SosAlertModal:** countdown interval có `return () => clearInterval(countdownRef.current)`; sync alerts có `return () => clearInterval(retryInterval)`; WebSocket có `return () => { removeHandler(); sosWebSocket.disconnect() }`.
- **ChatPage:** cleanup typing timeout; unsubscribe từng chat box trong effect subscription; offline status khi rời chat.
- **ClinicManagerLayout:** cleanup `clearTimeout(timer)` và `unsubscribes.forEach(u => u())` (chỉ cần cải thiện race như trên).
- **ClinicDetailModal, ClinicInfoPage, ClinicDetailPage:** scroll/resize listener có removeEventListener trong return.
- **BrutalSelect, CalendarPicker, BankSelector, NotificationBell:** click-outside có removeEventListener.
- **useSidebar:** resize listener có removeEventListener.
- **MessageInput:** paste listener có cleanup.
- **PlaygroundPage:** WebSocket đóng trong cleanup; mousemove/mouseup có removeEventListener.
- **RegisterPage, ResetPasswordPage:** countdown interval có clearInterval trong return.

### 3.2 Cần sửa

- **useSseNotification:** Reconnect khi lỗi SSE không chạy (callback setTimeout rỗng). Cần gọi `connect()` trong callback và clear timeout trong `disconnect()`.
- **ClinicManagerLayout:** Đảm bảo cleanup global chat subscriptions luôn gọi đúng danh sách unsubscribes (ref hoặc đợi async xong).

### 3.3 Re-subscribe sau reconnect

- **Chat:** `chatWebSocket` singleton; khi disconnect rồi connect lại, ChatPage effect `[wsConnected, chatBoxes.length]` sẽ chạy lại và subscribe lại – ổn.
- **SOS:** `sosWebSocket` có `handleReconnect()` gọi `connect(clinicId)` lại; sau connect có `subscribeToClinicAlerts`. Cần đảm bảo handler vẫn được giữ (SosAlertModal gắn handler qua `addAlertHandler`) – service giữ `alertHandlers` nên khi reconnect, subscribe lại topic là đủ.

---

## 4. Đề xuất refactor (roadmap)

### Bước 1 – CRITICAL

- Đã xử lý (ClinicList/ClinicsListPage). Không còn item CRITICAL.

### Bước 2 – MEDIUM

1. ~~**useSseNotification**~~ – **Đã sửa:** reconnect gọi `connectRef.current()`; disconnect clear timeout.
2. ~~**ClinicManagerLayout**~~ – **Đã sửa:** `unsubscribesRef` + gán sau setup, cleanup từ ref.
3. **ChatPage:** Xác nhận `loadChatBoxes`, `connectWebSocket` có useCallback với deps ổn (không tạo vòng dependency với state thay đổi liên tục).
4. **useNotificationPolling:** Nếu `showToast` không ổn định, dùng ref để gọi showToast trong interval.

### Bước 3 – LOW

1. **EmailChangeModal:** Bỏ `countdown` khỏi deps của countdown effect; chỉ dùng `[step]`.
2. **ServiceGrid / MasterServiceGrid:** Chuẩn hóa deps của effect load (hoặc useCallback cho loadClinics/loadMasterServices).
3. Kiểm tra toàn bộ nơi dùng object/array trong dependency array và chuyển sang useMemo hoặc so sánh nếu cần.

---

## 5. Cross-reference với plan

| Plan section | Nội dung báo cáo |
|--------------|------------------|
| 2.1 Quét hooks | Mục 1.1 – danh sách file/hook; ClinicList đã fix. |
| 2.2 Store | Mục 1.2 – bảng store và nguy cơ vòng lặp. |
| 2.3 WebSocket/timer | Mục 3 – cleanup và reconnect. |
| 3.1 Vòng lặp render | CRITICAL đã xử lý; MEDIUM/LOW mục 2. |
| 3.2 Store & API | Mục 1.2 và 2. |
| 3.3 WebSocket/interval | Mục 3. |
| 3.4 UX/performance | Mục 2 LOW. |
| 4 Đề xuất refactor | Mục 4. |

---

*Tài liệu này là kết quả rà soát theo plan `fe-audit-react-petties-web`. Cập nhật khi đã áp dụng fix.*
