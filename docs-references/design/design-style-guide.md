# Petties Design Style Guide

## 🎨 Design Philosophy: Neobrutalism

Petties sử dụng phong cách **Neobrutalism (Modern Brutalist Design)** - một xu hướng thiết kế hiện đại kết hợp sự mạnh mẽ, táo bạo của brutalism với màu sắc ấm áp, thân thiện phù hợp với ứng dụng chăm sóc thú cưng.

---

## 🎯 Đặc điểm chính

| Yếu tố | Mô tả |
|--------|-------|
| **Border** | Viền đen dày (4px-8px), cứng cạnh, **không bo góc** |
| **Shadow** | Box-shadow offset lệch (8px 8px 0), tạo hiệu ứng 3D phẳng |
| **Colors** | Contrast cao, màu sắc táo bạo, không dùng gradient phức tạp |
| **Typography** | Font đậm (700), uppercase, letter-spacing rộng |
| **Hover Effects** | Translate + tăng shadow (giống nhấn nút vật lý) |
| **No Rounded Corners** | Góc vuông hoàn toàn, tạo cảm giác cứng cáp |

---

## 🎨 Color Palette

### Primary Colors (Amber/Orange)
| Tên | Mã Hex | CSS Variable | Sử dụng |
|-----|--------|--------------|---------|
| Amber-50 | `#fffbeb` | - | Card background nhẹ |
| Amber-100 | `#fef3c7` | - | Hover state, background sáng |
| Amber-500 | `#f59e0b` | - | Decorative elements, lines |
| **Amber-600** | `#d97706` | - | **Primary button, accent chính** |
| Amber-700 | `#b45309` | - | Button hover state |

### Neutral Colors (Stone)
| Tên | Mã Hex | Sử dụng |
|-----|--------|---------|
| Stone-50 | `#fafaf9` | Page background |
| Stone-400 | `#a8a29e` | Secondary text, icons |
| Stone-500 | `#78716c` | Placeholder text |
| Stone-600 | `#57534e` | Body text secondary |
| Stone-700 | `#44403c` | Body text |
| **Stone-900** | `#1c1917` | **Border, shadow, heading text** |

### Utility Colors
| Màu | Mã Hex | Sử dụng |
|-----|--------|---------|
| White | `#ffffff` | Card background, inputs |
| Black | `#000000` | Text tối (ít dùng) |

---

## 📐 Component Styles

### Buttons

#### Primary Button (`.btn-brutal`)
```css
.btn-brutal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 2rem;
  border: 4px solid #1c1917;
  background-color: #d97706; /* amber-600 */
  color: #fff;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: 4px 4px 0 #1c1917;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.btn-brutal:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 #1c1917;
  background-color: #b45309; /* amber-700 */
}

.btn-brutal:active {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 #1c1917;
}
```

#### Outline Button (`.btn-brutal-outline`)
```css
.btn-brutal-outline {
  padding: 0.75rem 1.5rem;
  border: 4px solid #1c1917;
  background-color: transparent;
  color: #1c1917;
  font-weight: 700;
  text-transform: uppercase;
  box-shadow: 4px 4px 0 #1c1917;
}

.btn-brutal-outline:hover {
  background-color: #fef3c7; /* amber-100 */
}
```

---

### Cards (`.card-brutal`)
```css
.card-brutal {
  background-color: #fff;
  border: 4px solid #1c1917;
  box-shadow: 8px 8px 0 #1c1917;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.card-brutal:hover {
  transform: translate(-4px, -4px);
  box-shadow: 12px 12px 0 #1c1917;
}
```

---

### Form Inputs (`.input-brutal`)
```css
.input-brutal {
  width: 100%;
  padding: 0.875rem 1rem;
  border: 4px solid #1c1917;
  background-color: #fff;
  color: #1c1917;
  font-weight: 500;
  box-shadow: 4px 4px 0 #1c1917;
}

.input-brutal:focus {
  outline: none;
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 #1c1917;
  background-color: #fef3c7; /* amber-100 */
}
```

---

## 📝 Typography

### Font Family
```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Headings (`.heading-brutal`)
```css
.heading-brutal {
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 700;
  line-height: 1.1;
  text-transform: uppercase;
  letter-spacing: -0.02em;
}
```

### Subheadings (`.subheading-brutal`)
```css
.subheading-brutal {
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  font-weight: 600;
  line-height: 1.3;
}
```

---

## 📱 Responsive Breakpoints

| Breakpoint | Min Width | Sử dụng |
|------------|-----------|---------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Large desktop |

---

## 🔧 CSS Files

| File | Mô tả |
|------|-------|
| `src/styles/brutalist.css` | Brutalist component classes |
| `src/styles/global.css` | Global styles, layout utilities |
| `src/index.css` | Base styles, resets |
| `src/App.css` | Root container styles |

---

## ✅ Do's and Don'ts

### ✅ DO
- Sử dụng border đen dày (4px trở lên)
- Giữ góc vuông, không bo tròn
- Dùng shadow offset (không blur)
- Text uppercase cho headings và buttons
- High contrast colors
- Hover effects với translate + shadow
- **Dùng icon libraries (Heroicons, Lucide) cho icons nếu cần** - Dùng SVG icons từ library, không dùng emoji

### ❌ DON'T
- Không dùng `border-radius` (trừ trường hợp đặc biệt)
- Không dùng gradient phức tạp
- Không dùng drop-shadow blur
- Không dùng thin borders (< 3px)
- Không dùng lowercase cho primary buttons
- **KHÔNG DÙNG EMOJI trong UI components, buttons, labels, hoặc text hiển thị** - Emoji như 💰📊🎉✅❌🚀💡🔧📝 trông "AI-generated" và không phù hợp với brutalist design
- **KHÔNG DÙNG EMOJI trong code comments, log messages, hoặc user-facing text** - Chỉ dùng text thuần, không emoji
- Nếu cần visual indicators, dùng icon từ Heroicons/Lucide thay vì emoji

### Icon Guidelines
**Nếu cần icons:**
- ✅ Sử dụng **Heroicons** (đã có trong project): `<IconName />` components
- ✅ Sử dụng **Lucide React** (nếu có): `<LucideIcon />` components
- ❌ KHÔNG dùng emoji: 💰📊🎉✅❌🚀💡🔧📝📱💻🌐⚙️

**Ví dụ:**
```tsx
// ✅ ĐÚNG: Dùng Heroicons
import { CurrencyDollarIcon, ChartBarIcon } from '@heroicons/react/24/outline'
<CurrencyDollarIcon className="w-5 h-5" />

// ❌ SAI: Không dùng emoji
<span>💰 Payment</span>
<span>📊 Analytics</span>
```

---

## 🚫 Anti-Pattern: Emoji Usage

**QUAN TRỌNG: KHÔNG BAO GIỜ dùng emoji trong UI code, components, hoặc user-facing text.**

### Lý do không dùng emoji:
1. **Không phù hợp với Brutalist Design**: Emoji tạo cảm giác "playful" và "AI-generated", không match với phong cách cứng cáp, minimal của brutalism
2. **Accessibility**: Emoji có thể không hiển thị đúng trên một số platforms/độ tuổi
3. **Consistency**: Emoji thay đổi theo platform, không consistent
4. **Professional**: Petties là ứng dụng chuyên nghiệp, emoji giảm độ nghiêm túc

### Thay thế bằng:
- **Text thuần**: "Payment", "Analytics", "Settings" thay vì "💰 Payment", "📊 Analytics"
- **Icons từ libraries**: Heroicons, Lucide React nếu cần visual indicator
- **Typography + Color**: Dùng font weight, color để nhấn mạnh thay vì emoji

### Ví dụ cụ thể:

// ❌ SAI - Trông "AI-generated"
<button>💰 Thanh toán</button>
<div>📊 Thống kê</div>
<span>✅ Hoàn thành</span>

// ✅ ĐÚNG - Professional, clean
<button className="btn-brutal">THANH TOÁN</button>
<div className="heading-brutal">THỐNG KÊ</div>
<span className="text-success">Hoàn thành</span>

// ✅ Nếu cần icon
<button className="btn-brutal">
  <CurrencyDollarIcon className="w-5 h-5 mr-2" />
  THANH TOÁN
</button>### Debug/Development:
- ❌ KHÔNG dùng emoji trong console.log, debug messages
- ❌ KHÔNG dùng emoji trong comments
- ✅ Dùng text thuần: `console.log('[API Config] Base URL:', url)`

---

## �� Brand Identity

**Petties** là nền tảng chăm sóc thú cưng, phong cách thiết kế cần:

1. **Ấm áp & Thân thiện**: Màu amber/orange tạo cảm giác chào đón
2. **Tin cậy & Chuyên nghiệp**: Border cứng cáp, typography mạnh mẽ
3. **Hiện đại & Độc đáo**: Neobrutalism là xu hướng nổi bật, dễ nhận diện
4. **Dễ sử dụng**: Contrast cao, accessibility tốt

---

*Last updated: December 2024*
