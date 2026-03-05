# Petties Design Style Guide

## 🎨 Design Philosophy: Soft Neobrutalism

Petties sử dụng phong cách **Soft Neobrutalism** - kết hợp đặc trưng mạnh mẽ của brutalism với sự mềm mại, thân thiện phù hợp với ứng dụng chăm sóc thú cưng.

**Soft Neobrutalism** giữ lại bản sắc brutalist (borders, shadows, bold typography) nhưng làm mềm đi bằng:
- Bo góc nhẹ (8-12px radius)
- Viền mỏng hơn (2px thay vì 4-8px)
- Shadow offset nhỏ hơn (3-4px thay vì 8px)
- Màu sắc đa dạng, ấm áp

---

## 🎯 Đặc điểm chính

| Yếu tố | Mô tả |
|--------|-------|
| **Border** | Viền đen mỏng (2px), **bo góc nhẹ** (8-12px radius) |
| **Shadow** | Box-shadow offset nhẹ (3-4px), không blur |
| **Colors** | Amber primary + Coral/Mint/Blue accents |
| **Typography** | Font bold (700), mixed case (không uppercase tất cả) |
| **Hover Effects** | Translate + tăng shadow nhẹ |
| **Corners** | Rounded nhẹ (8-12px), không vuông góc |

---

## 🎨 Color Palette

### Primary Colors (Amber/Orange)
| Tên | Mã Hex | Sử dụng |
|-----|--------|---------|
| Amber-50 | `#fffbeb` | Card background nhẹ |
| Amber-100 | `#fef3c7` | Hover state, background sáng |
| Amber-500 | `#f59e0b` | Decorative elements, lines |
| **Amber-600** | `#d97706` | **Primary button, accent chính** |
| Amber-700 | `#b45309` | Button hover state |

### Accent Colors (NEW)
| Tên | Mã Hex | Sử dụng |
|-----|--------|---------|
| **Coral** | `#FF6B6B` | Featured cards, CTAs, warnings, highlights |
| **Mint/Teal** | `#38B2AC` | Success states, health-related, completed |
| **Blue** | `#4299E1` | Info, links, secondary actions |
| **Yellow** | `#FBBF24` | Highlights, badges, notifications |

### Neutral Colors (Stone)
| Tên | Mã Hex | Sử dụng |
|-----|--------|---------|
| Stone-50 | `#fafaf9` | Page background |
| Stone-100 | `#f5f5f4` | Card background secondary, icon containers |
| Stone-400 | `#a8a29e` | Secondary text, icons |
| Stone-500 | `#78716c` | Placeholder text |
| Stone-600 | `#57534e` | Body text secondary |
| Stone-700 | `#44403c` | Body text |
| **Stone-900** | `#1c1917` | **Border, shadow, heading text** |

### Utility Colors
| Màu | Mã Hex | Sử dụng |
|-----|--------|---------|
| White | `#ffffff` | Card background, inputs |
| Success | `#22c55e` | Success messages |
| Error | `#ef4444` | Error messages |
| Warning | `#f59e0b` | Warning messages |

---

## 📐 Component Styles

### Cards (`.card-brutal`)
```css
.card-brutal {
  background-color: #fff;
  border: 2px solid #1c1917;
  border-radius: 12px;
  box-shadow: 4px 4px 0 #1c1917;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.card-brutal:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 #1c1917;
}
```

**Tailwind equivalent:**
```html
<div class="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] hover:shadow-[6px_6px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all">
```

---

### Buttons

#### Primary Button (`.btn-brutal`)
```css
.btn-brutal {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border: 2px solid #1c1917;
  border-radius: 8px;
  background-color: #d97706; /* amber-600 */
  color: #fff;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: 3px 3px 0 #1c1917;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.btn-brutal:hover {
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 #1c1917;
  background-color: #b45309; /* amber-700 */
}

.btn-brutal:active {
  transform: translate(1px, 1px);
  box-shadow: 2px 2px 0 #1c1917;
}
```

**Tailwind equivalent:**
```html
<button class="px-6 py-3 bg-amber-600 border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-[5px_5px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 font-bold uppercase text-white transition-all">
  Button Text
</button>
```

#### Outline Button (`.btn-brutal-outline`)
```css
.btn-brutal-outline {
  padding: 0.75rem 1.5rem;
  border: 2px solid #1c1917;
  border-radius: 8px;
  background-color: transparent;
  color: #1c1917;
  font-weight: 700;
  text-transform: uppercase;
  box-shadow: 3px 3px 0 #1c1917;
}

.btn-brutal-outline:hover {
  background-color: #fef3c7; /* amber-100 */
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 #1c1917;
}
```

---

### Form Inputs (`.input-brutal`)
```css
.input-brutal {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #1c1917;
  border-radius: 8px;
  background-color: #fff;
  color: #1c1917;
  font-weight: 500;
  box-shadow: 2px 2px 0 #1c1917;
}

.input-brutal:focus {
  outline: none;
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #1c1917;
  border-color: #d97706; /* amber-600 */
}
```

**Tailwind equivalent:**
```html
<input class="w-full px-4 py-3 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:shadow-[3px_3px_0_#1c1917] focus:border-amber-600 focus:outline-none transition-all" />
```

---

### Badges & Tags
```css
.badge-brutal {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border: 2px solid #1c1917;
  border-radius: 9999px; /* fully rounded */
  font-weight: 700;
  font-size: 0.75rem;
  text-transform: uppercase;
}
```

**Variants:**
```html
<!-- Primary -->
<span class="px-3 py-1 bg-amber-100 border-2 border-amber-600 rounded-full font-bold text-amber-800 text-xs">
  Badge
</span>

<!-- Coral -->
<span class="px-3 py-1 bg-coral/20 border-2 border-coral rounded-full font-bold text-coral text-xs">
  Featured
</span>

<!-- Mint -->
<span class="px-3 py-1 bg-teal-100 border-2 border-teal-500 rounded-full font-bold text-teal-700 text-xs">
  Completed
</span>
```

---

## 📝 Typography

### Font Family
```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Headings
```css
/* Page headings - normal case, not uppercase */
.heading-brutal {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  line-height: 1.2;
  color: #1c1917;
}

/* Section headings */
.subheading-brutal {
  font-size: clamp(1.25rem, 2.5vw, 1.5rem);
  font-weight: 600;
  line-height: 1.3;
}
```

### Typography Rules

| Element | Style |
|---------|-------|
| Page Headings | `font-bold`, **normal case** hoặc capitalize |
| Card Titles | `font-bold text-lg`, **normal case** |
| Button Text | `font-bold uppercase` |
| Labels | `text-xs font-bold uppercase` |
| Body Text | `font-medium`, normal case |

### Typography scale (Navigation / Sidebar)

Các component điều hướng (Sidebar) dùng scale chữ nhỏ, đậm, uppercase cho hierarchy rõ:

| Vai trò | Tailwind / Style | Ghi chú |
|--------|-------------------|---------|
| Brand (logo text) | `text-xl font-black text-amber-600 uppercase tracking-wider` | PETTIES |
| Role / meta | `text-[10px] font-bold text-stone-500 uppercase tracking-tighter` | Tên role dưới logo |
| Nhóm nav | `text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]` | Tiêu đề nhóm menu |
| Nav item | `text-xs font-bold uppercase tracking-tight` | Label từng mục |
| Tooltip (collapsed) | `text-[9px] font-black uppercase tracking-widest` | Tooltip khi sidebar thu gọn |
| User name | `text-[11px] font-black text-stone-900 truncate uppercase` | Tên user footer |
| User email / meta | `text-[9px] font-medium text-stone-500` | Email, text phụ |
| CTA nhỏ (logout) | `text-[10px] font-black uppercase tracking-widest` | Nút Đăng xuất |

---

## 🧭 Icon System

- **Thư viện:** Heroicons (`@heroicons/react/24/outline`) — ưu tiên bộ **outline** (nét viền), size 24.
- **Không dùng emoji** trong UI; dùng icon thay thế.

### Kích thước (Tailwind)

| Ngữ cảnh | Class | Ghi chú |
|----------|--------|---------|
| Nút nhỏ / toggle | `w-4 h-4` | Chevron, close |
| Nav item (sidebar mở) | `w-5 h-5` | Menu, logout (expanded) |
| Nav item (sidebar thu gọn) | `w-6 h-6` | Icon lớn hơn khi chỉ hiện icon |
| Mobile menu / CTA icon | `w-5 h-5` | Bars, primary action |

### Tương tác

- Nav item: `group-hover:scale-110` cho icon.
- Nút có icon (vd. logout): `group-hover/btn:-translate-x-1` cho hiệu ứng kéo nhẹ.

**Ví dụ (Sidebar):**
```tsx
<link.icon className="w-5 h-5 mr-3 group-hover:scale-110" />
<ArrowLeftOnRectangleIcon className="w-4 h-4 transition-transform group-hover/btn:-translate-x-1" />
```

---

## 📐 Reference Implementation: Sidebar

**Component tham chiếu:** `petties-web/src/components/Sidebar/Sidebar.tsx` — áp dụng đầy đủ Soft Neobrutalism cho navigation.

### UI/UX patterns

| Yếu tố | Áp dụng trong Sidebar |
|--------|------------------------|
| **Border** | `border-r-2 border-stone-900` (aside), `border-b-2` (header), `border-t-2` (footer), `border-2` cho nút/avatar. |
| **Shadow** | Chỉ offset, không blur: `shadow-[3px_3px_0_#000]`, `shadow-[2px_2px_0_#000]` cho nút, logo thu gọn, avatar. |
| **Radius** | `rounded-lg` (nút, container), `rounded-full` (avatar), `rounded-md` (toggle). |
| **Layout** | Expanded `w-64` / Collapsed `w-20`; transition `duration-300 ease-in-out`. |
| **Mobile** | Overlay `bg-stone-900/40 backdrop-blur-sm`; sidebar `fixed z-50`, class `.sidebar-mobile-safe` (safe area). |
| **Hover nav** | `hover:bg-amber-50 hover:text-stone-900`; icon `group-hover:scale-110`. |
| **Active nav** | `bg-amber-500 text-white border-l-4 border-stone-900 font-black`. |
| **Tooltip (collapsed)** | `bg-stone-900 text-white`, viền amber, `opacity-0 group-hover:opacity-100`, slide `-translate-x-2` → `translate-x-0`. |
| **Badge (unread)** | `bg-red-500 text-white rounded-full`, `text-xs font-bold`. |

### Trạng thái & micro-interactions

- **Collapsed:** Logo "P" trong ô `bg-amber-500 rounded-lg border-2 border-stone-900 shadow-[3px_3px_0_#000]`; tooltip bên phải khi hover nav item.
- **Expanded:** Brand "PETTIES" + role; nhóm nav có title; footer có avatar + tên + nút Đăng xuất.
- **Nút Đăng xuất:** Outline style `border-2 border-stone-950 shadow-[3px_3px_0_#000]`, hover `hover:bg-red-500 hover:text-white hover:border-red-600`.
- **Transition:** `duration-200` (nav item), `duration-300` (expand/collapse, fade-in, zoom-in).

Khi làm component navigation/sidebar mới, nên tham chiếu Sidebar để giữ nhất quán UI/UX, typography và icon.

---

## 🔄 Border Radius Scale

| Element | Radius | Tailwind Class |
|---------|--------|----------------|
| Cards | 12px | `rounded-xl` |
| Buttons | 8px | `rounded-lg` |
| Inputs | 8px | `rounded-lg` |
| Badges | 9999px | `rounded-full` |
| Avatars | 9999px | `rounded-full` |
| Icon Containers | 8px | `rounded-lg` |

---

## 🌫️ Shadow Scale

| Element | Shadow | Tailwind Class |
|---------|--------|----------------|
| Cards | `4px 4px 0 #1c1917` | `shadow-[4px_4px_0_#1c1917]` |
| Buttons | `3px 3px 0 #1c1917` | `shadow-[3px_3px_0_#1c1917]` |
| Inputs | `2px 2px 0 #1c1917` | `shadow-[2px_2px_0_#1c1917]` |
| Cards (hover) | `6px 6px 0 #1c1917` | `shadow-[6px_6px_0_#1c1917]` |
| Small elements | `2px 2px 0 #1c1917` | `shadow-[2px_2px_0_#1c1917]` |

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
| `src/styles/brutalist.css` | Soft Brutalist component classes |
| `src/styles/global.css` | Global styles, layout utilities |
| `src/index.css` | Base styles, resets |
| `src/App.css` | Root container styles |

---

## ✅ Do's and Don'ts

### ✅ DO
- Sử dụng border đen mỏng (2px)
- Bo góc nhẹ (8-12px radius)
- Dùng shadow offset nhẹ (3-4px, không blur)
- Text uppercase CHỈ cho buttons và labels
- High contrast colors
- Hover effects với translate + shadow nhẹ
- Dùng accent colors (Coral, Mint, Blue) cho variety
- Dùng icon libraries (Heroicons, Lucide) cho icons

### ❌ DON'T
- Không dùng border quá dày (> 3px)
- Không dùng gradient phức tạp
- Không dùng drop-shadow blur
- Không uppercase TẤT CẢ headings (chỉ buttons/labels)
- Không dùng shadow quá lớn (> 6px offset)
- **KHÔNG DÙNG EMOJI trong UI** - dùng Heroicons thay vì emoji

---

## 🚫 No Emoji Rule

**QUAN TRỌNG: KHÔNG dùng emoji trong UI code hoặc user-facing text.**

### Thay thế bằng:
- **Text thuần**: "Payment", "Analytics", "Settings"
- **Icons từ libraries**: Heroicons, Lucide React
- **Typography + Color**: Dùng font weight, color để nhấn mạnh

### Ví dụ:
```tsx
// ✅ ĐÚNG - Professional, clean
<button className="btn-brutal">THANH TOÁN</button>

// ✅ Với icon
<button className="btn-brutal">
  <CurrencyDollarIcon className="w-5 h-5 mr-2" />
  THANH TOÁN
</button>

// ❌ SAI - Không dùng emoji
<button>💰 Thanh toán</button>
```

---

## 🎯 Component Examples

### Featured Card (Coral accent)
```html
<div class="bg-coral text-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-6">
  <h3 class="font-bold text-xl mb-2">Featured Title</h3>
  <p class="opacity-90">Description text here</p>
  <button class="mt-4 px-4 py-2 bg-stone-900 text-white rounded-lg font-bold">
    Action
  </button>
</div>
```

### Info Card (Blue accent)
```html
<div class="bg-blue-50 border-2 border-blue-400 rounded-xl shadow-[3px_3px_0_#4299E1] p-4">
  <div class="flex items-center gap-2">
    <InformationCircleIcon class="w-5 h-5 text-blue-600" />
    <span class="font-bold text-blue-700">Information</span>
  </div>
  <p class="mt-2 text-blue-600">Info message here</p>
</div>
```

### Success Card (Mint accent)
```html
<div class="bg-teal-50 border-2 border-teal-500 rounded-xl shadow-[3px_3px_0_#38B2AC] p-4">
  <div class="flex items-center gap-2">
    <CheckCircleIcon class="w-5 h-5 text-teal-600" />
    <span class="font-bold text-teal-700">Success</span>
  </div>
</div>
```

### Sidebar / Navigation (Reference)

Sidebar là **reference implementation** cho Soft Neobrutalism. Chi tiết đầy đủ xem section [Reference Implementation: Sidebar](#-reference-implementation-sidebar).

- **Container:** `bg-white border-r-2 border-stone-900`, expanded `w-64` / collapsed `w-20`.
- **Header:** Brand `text-xl font-black text-amber-600 uppercase`; role `text-[10px] font-bold text-stone-500 uppercase`.
- **Nav item active:** `bg-amber-500 text-white border-l-4 border-stone-900 font-black`.
- **Nav item default:** `text-stone-600 hover:bg-amber-50 hover:text-stone-900`, icon `group-hover:scale-110`.
- **Tooltip (collapsed):** `bg-stone-900 text-white text-[9px] font-black uppercase`, viền amber.
- **Source:** `petties-web/src/components/Sidebar/Sidebar.tsx`.

---

## 🎨 Brand Identity

**Petties** - Nền tảng chăm sóc thú cưng với phong cách Soft Neobrutalism:

1. **Mềm mại & Thân thiện**: Bo góc nhẹ, màu sắc đa dạng
2. **Tin cậy & Chuyên nghiệp**: Border và shadow rõ ràng
3. **Hiện đại & Độc đáo**: Kết hợp brutalism với softness
4. **Dễ sử dụng**: Contrast cao, accessibility tốt

---

*Style: **Soft Neobrutalism** - Friendly Brutalist*

*Last updated: March 2025*
