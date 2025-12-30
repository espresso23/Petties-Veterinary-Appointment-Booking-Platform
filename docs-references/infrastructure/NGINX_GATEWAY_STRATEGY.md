# Chiến lược API Gateway & Nginx (NGINX Gateway Strategy)

Tài liệu này mô tả cách hệ thống **Petties** sử dụng Nginx làm API Gateway để quản lý lưu lượng, bảo mật và khả năng mở rộng trong tương lai.

---

## 1. Tổng quan vai trò của Nginx
Trong hệ thống Petties, Nginx không chỉ là một Web Server mà đóng vai trò là **API Gateway** duy nhất tiếp nhận mọi yêu cầu từ Internet (Web/Mobile) và điều phối chúng đến các dịch vụ nội bộ (Spring Boot & Python FastAPI).

### Các nhiệm vụ chính:
- **Reverse Proxy**: Che giấu cấu trúc mạng nội bộ và các cổng dịch vụ (8080, 8000).
- **SSL Termination**: Xử lý mã hóa HTTPS tập trung tại Gateway.
- **Service Routing**: Điều hướng yêu cầu dựa trên Domain/Path.
- **WebSocket Gateway**: Hỗ trợ kết nối song công cho AI Chat.

---

## 2. Chiến lược Load Balancing (Cân bằng tải)

### Hiện tại (Giai đoạn Development/UAT):
Do triển khai trên một máy chủ (Single Node), Load Balancing được thực hiện ở mức **Điều phối dịch vụ (Service Segregation)**:
- Truy cập `api.petties.world` -> Proxy tới `http://127.0.0.1:8080` (Spring Boot).
- Truy cập `ai.petties.world` -> Proxy tới `http://127.0.0.1:8000` (AI Service).

### Tương lai (Giai đoạn Scaling):
Khi lượng người dùng tăng, Nginx sẽ được cấu hình `upstream` để phân phối tải giữa nhiều container/server:

```nginx
# Ví dụ cấu hình Load Balancing cho tương lai
upstream backend_cluster {
    server 127.0.0.1:8080 weight=3;
    server 10.0.0.5:8080; # Server phụ trong mạng nội bộ
    keepalive 32;
}

server {
    location /api/ {
        proxy_pass http://backend_cluster;
    }
}
```

---

## 3. Chiến lược Rate Limiting (Giới hạn lưu lượng)

Để bảo vệ hệ thống khỏi các cuộc tấn công Brute-force hoặc Spam API, chiến lược gồm 2 lớp:

### Lớp 1: Application Level (Spring Boot/Redis) - *Đang sử dụng*
- **Ưu điểm**: Kiểm soát chính xác theo `user_id`, hỗ trợ logic nghiệp vụ phức tạp (ví dụ: Vet được gọi API nhiều hơn Guest).
- **Công nghệ**: Sử dụng Redis để đếm số lần gọi API trong một khoảng thời gian.

### Lớp 2: Gateway Level (Nginx) - *Kế hoạch triển khai Production*
Triển khai tại Nginx để chặn các yêu cầu rác ngay từ "vòng gửi xe", giảm tải cho Backend.

**Cấu hình khuyến nghị:**
```nginx
# Định nghĩa vùng nhớ lưu trữ trạng thái rate limit (10MB lưu được ~160k IPs)
limit_req_zone $binary_remote_addr zone=one:10m rate=10r/s;

server {
    location /api/auth/ {
        # Giới hạn cực nghiêm ngặt cho login/register
        limit_req zone=one burst=5 nodelay;
        proxy_pass http://127.0.0.1:8080;
    }
}
```

---

## 4. Tối ưu hóa cho AI Real-time Streaming
Đặc thù của AI Service là trả về dữ liệu dạng stream (Server-Sent Events hoặc WebSocket). Nginx được cấu hình đặc biệt để không làm gián đoạn luồng này:

- **`proxy_buffering off`**: Vô hiệu hóa bộ đệm của Nginx. Dữ liệu từ AI Service sẽ được đẩy thẳng tới thiết bị người dùng ngay khi được tạo ra, tránh cảm giác "lag" khi nhận phản hồi từ AI.
- **`proxy_read_timeout 3600s`**: Duy trì kết nối WebSocket lâu dài cho các phiên tư vấn thú y kéo dài.

---

## 5. Danh sách các đầu mút (Endpoints) quan trọng

| Dịch vụ | Protocol | URL Production | URL Local |
| :--- | :--- | :--- | :--- |
| **Backend API** | HTTPS | `https://api.petties.world/api` | `http://localhost:8080/api` |
| **AI Service** | HTTPS | `https://ai.petties.world` | `http://localhost:8000` |
| **Websocket AI** | WSS | `wss://ai.petties.world/ws/chat/` | `ws://localhost:8000/ws/chat/` |

---

## 6. Hướng dẫn bảo trì
Mỗi khi thay đổi cấu hình Nginx, bắt buộc thực hiện:
1. Kiểm tra cú pháp: `sudo nginx -t`
2. Tải lại cấu hình (không làm đứt kết nối hiện tại): `sudo systemctl reload nginx`
3. Theo dõi log lỗi: `sudo tail -f /var/log/nginx/error.log`
