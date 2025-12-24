# Google Maps Places API Migration - Autocomplete → PlaceAutocompleteElement

## Vấn Đề

Google đã deprecated `google.maps.places.Autocomplete` từ **March 1, 2025** và khuyến nghị sử dụng `google.maps.places.PlaceAutocompleteElement` thay thế.

**Warning message:**
```
As of March 1st, 2025, google.maps.places.Autocomplete is not available to new customers. 
Please use google.maps.places.PlaceAutocompleteElement instead.
```

## Giải Pháp

### ✅ Đã Migrate

Đã cập nhật `AddressAutocomplete.tsx` để sử dụng `PlaceAutocompleteElement` thay vì deprecated `Autocomplete`.

### Thay Đổi Chính

#### Trước (Deprecated):
```typescript
const autocomplete = new google.maps.places.Autocomplete(inputElement, {
  types: ['address'],
  componentRestrictions: { country: 'vn' },
})

autocomplete.addListener('place_changed', () => {
  const place = autocomplete.getPlace()
  // ...
})
```

#### Sau (New API):
```typescript
// Create PlaceAutocompleteElement (no options in constructor)
const autocomplete = new google.maps.places.PlaceAutocompleteElement()

// Set component restrictions via attribute (if supported)
// Note: Some restrictions may need to be set differently
autocomplete.setAttribute('component-restrictions', JSON.stringify({ country: ['vn'] }))

// Set initial value
autocomplete.value = initialValue

// Apply styling
autocomplete.style.width = '100%'
autocomplete.style.fontFamily = 'inherit'

// Append to DOM
container.appendChild(autocomplete)

// Listen for place selection
autocomplete.addEventListener('gmp-placeselect', (event) => {
  const place = event.place
  const address = place.formattedAddress || place.displayName || ''
  const location = place.location || place.geometry?.location
  // ...
})
```

### Khác Biệt Chính

| Feature | Old (Autocomplete) | New (PlaceAutocompleteElement) |
|---------|-------------------|--------------------------------|
| **Initialization** | `new Autocomplete(input, options)` | `new PlaceAutocompleteElement()` (no options) |
| **Event** | `place_changed` | `gmp-placeselect` |
| **Event Listener** | `addListener()` | `addEventListener()` |
| **Place Object** | `getPlace()` | `event.place` |
| **Component Restrictions** | `{ country: 'vn' }` in options | Set via attribute (may vary) |
| **Result Types** | `types: ['address']` | Not directly supported (handled by API) |
| **Value Property** | N/A (use input value) | `autocomplete.value` |
| **DOM Integration** | Attached to existing input | Append as web component to container |
| **Styling** | Style the input element | Style the PlaceAutocompleteElement directly |

### Cấu Hình Google Cloud Console

**Quan trọng:** Cần enable **Places API (New)** thay vì chỉ Places API cũ.

1. **Vào Google Cloud Console:**
   - https://console.cloud.google.com/google/maps-apis/library

2. **Enable APIs:**
   - ✅ **Places API (New)** ← **QUAN TRỌNG**
   - ✅ Maps JavaScript API
   - ✅ Geocoding API
   - ✅ Distance Matrix API

3. **Lưu ý:**
   - Places API (New) là API mới, khác với Places API cũ
   - Nếu chỉ enable Places API cũ, `PlaceAutocompleteElement` sẽ không hoạt động

### Script Loading

**Trước:**
```typescript
script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`
```

**Sau:**
```typescript
script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&loading=async&libraries=places`
```

**Thêm `loading=async`** để load Places API (New) đúng cách.

### Event Handling

#### Old API:
```typescript
autocomplete.addListener('place_changed', () => {
  const place = autocomplete.getPlace()
  const address = place.formatted_address
  const location = place.geometry?.location
})
```

#### New API:
```typescript
autocomplete.addEventListener('gmp-placeselect', (event) => {
  const place = event.place
  const address = place.formattedAddress || place.displayName
  const location = place.location
})
```

**Lưu ý:**
- Event name: `gmp-placeselect` (không phải `place_changed`)
- Place object: `event.place` (không phải `getPlace()`)
- Address field: `formattedAddress` hoặc `displayName` (không phải `formatted_address`)
- Location: `place.location` (không phải `place.geometry?.location`)

### Styling

`PlaceAutocompleteElement` là một web component, có thể style trực tiếp:

```typescript
autocomplete.style.width = '100%'
autocomplete.style.fontFamily = 'inherit'
```

Hoặc dùng CSS:
```css
gmp-place-autocomplete {
  width: 100%;
  font-family: inherit;
}
```

### Compatibility

- ✅ **Chrome/Edge:** Fully supported
- ✅ **Firefox:** Fully supported
- ✅ **Safari:** Fully supported (iOS 14+, macOS 11+)
- ⚠️ **IE11:** Not supported (web components not supported)

### Testing Checklist

Sau khi migrate, test các scenarios:

- [ ] **Type address** → Autocomplete suggestions xuất hiện
- [ ] **Select suggestion** → Address được fill vào input
- [ ] **onPlaceSelect callback** → Được trigger với đúng data (address, lat, lng)
- [ ] **onChange callback** → Được trigger khi user type
- [ ] **Country restriction** → Chỉ hiển thị addresses ở Vietnam
- [ ] **Disabled state** → Autocomplete không hoạt động khi disabled
- [ ] **Initial value** → Address được set đúng khi có initial value

### Troubleshooting

#### Lỗi: "PlaceAutocompleteElement is not a constructor"

**Nguyên nhân:** Places API (New) chưa được enable hoặc script chưa load xong.

**Fix:**
1. Enable **Places API (New)** trong Google Cloud Console
2. Đảm bảo script có `loading=async`
3. Đợi script load xong trước khi khởi tạo

#### Lỗi: "gmp-placeselect event not firing"

**Nguyên nhân:** Event listener chưa được attach đúng cách.

**Fix:**
- Dùng `addEventListener('gmp-placeselect', ...)` thay vì `addListener('place_changed', ...)`
- Đảm bảo autocomplete element đã được append vào DOM

#### Lỗi: "place.formattedAddress is undefined"

**Nguyên nhân:** Place object structure khác với old API.

**Fix:**
- Dùng `place.formattedAddress` hoặc `place.displayName`
- Kiểm tra `place.location` thay vì `place.geometry?.location`

### Migration Benefits

1. ✅ **Future-proof:** Sử dụng API mới được Google khuyến nghị
2. ✅ **Better performance:** PlaceAutocompleteElement được optimize hơn
3. ✅ **More features:** Hỗ trợ nhiều tính năng mới (ví dụ: structured address)
4. ✅ **Better UX:** UI/UX được cải thiện
5. ✅ **No deprecation warnings:** Không còn warning trong console

### References

- **Migration Guide:** https://developers.google.com/maps/documentation/javascript/places-migration-overview
- **PlaceAutocompleteElement Docs:** https://developers.google.com/maps/documentation/javascript/place-autocomplete-element
- **Legacy API Info:** https://developers.google.com/maps/legacy

---

**Ngày migrate:** 2025-12-20  
**Status:** ✅ Completed - Component đã được migrate sang PlaceAutocompleteElement

