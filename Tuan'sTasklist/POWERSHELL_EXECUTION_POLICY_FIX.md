# Fix PowerShell Execution Policy Error

## Vấn Đề

Khi chạy `npm run dev`, gặp lỗi:
```
npm : File G:\node.js\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```

## Nguyên Nhân

PowerShell đang block việc chạy `.ps1` scripts do Execution Policy.

## Giải Pháp

### Cách 1: Sử dụng npm.cmd (Khuyến nghị ✅)

Thay vì dùng `npm`, dùng `npm.cmd`:

```powershell
cd petties-web
npm.cmd run dev
```

### Cách 2: Bypass Execution Policy cho session hiện tại

```powershell
# Chạy lệnh này trước khi chạy npm
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
cd petties-web
npm run dev
```

### Cách 3: Sử dụng script helper

Đã tạo file `petties-web/start-dev.ps1`:

```powershell
cd petties-web
powershell.exe -ExecutionPolicy Bypass -File start-dev.ps1
```

### Cách 4: Sử dụng Command Prompt (CMD) thay vì PowerShell

Mở **Command Prompt** (cmd.exe) thay vì PowerShell:

```cmd
cd G:\Petties-Veterinary-Appointment-Booking-Platform\petties-web
npm run dev
```

### Cách 5: Thay đổi Execution Policy vĩnh viễn (Cần Admin)

```powershell
# Mở PowerShell as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Quick Fix (Copy & Paste)

```powershell
# Option 1: Dùng npm.cmd
cd G:\Petties-Veterinary-Appointment-Booking-Platform\petties-web
npm.cmd run dev

# Option 2: Bypass cho session hiện tại
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
cd G:\Petties-Veterinary-Appointment-Booking-Platform\petties-web
npm run dev
```

---

## Kiểm Tra Execution Policy

```powershell
Get-ExecutionPolicy -List
```

Output sẽ hiển thị policy ở các scope khác nhau.

---

## Lưu Ý

- **Cách 1 (npm.cmd)** là an toàn nhất và không cần thay đổi policy
- **Cách 2** chỉ áp dụng cho session hiện tại, không ảnh hưởng system-wide
- **Cách 4 (CMD)** là cách đơn giản nhất nếu không muốn thay đổi PowerShell settings

---

**Recommended**: Sử dụng `npm.cmd run dev` hoặc chuyển sang Command Prompt.



