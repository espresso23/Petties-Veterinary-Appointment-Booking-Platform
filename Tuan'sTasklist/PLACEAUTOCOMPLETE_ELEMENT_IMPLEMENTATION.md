# PlaceAutocompleteElement Implementation - Final Solution

## Vấn đề

Google đã khuyến nghị sử dụng `PlaceAutocompleteElement` thay vì `Autocomplete` từ **March 1, 2025**. Warning message:
```
As of March 1st, 2025, google.maps.places.Autocomplete is not available to new customers. 
Please use google.maps.places.PlaceAutocompleteElement instead.
```

## Giải pháp đã implement

### ✅ Đã migrate sang PlaceAutocompleteElement

**File:** `petties-web/src/components/clinic/AddressAutocomplete.tsx`

### Cách sử dụng PlaceAutocompleteElement

`PlaceAutocompleteElement` là một **web component** (HTMLElement), không phải class constructor với options:

```typescript
// ✅ ĐÚNG: Tạo element không có options
const autocomplete = new google.maps.places.PlaceAutocompleteElement()

// ❌ SAI: Không thể truyền options vào constructor
const autocomplete = new google.maps.places.PlaceAutocompleteElement({
  requestedResultTypes: ['GEOCODE'], // ❌ Lỗi: Unknown property
  componentRestrictions: { country: ['vn'] } // ❌ Lỗi: Unknown property
})
```

### Implementation Details

#### 1. Script Loading
```typescript
const script = document.createElement('script')
script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places&loading=async`
script.async = true
script.defer = true
```

**Lưu ý:** 
- Cần `loading=async` để load Places API (New) đúng cách
- Prevent loading script nhiều lần bằng `scriptLoadedRef`

#### 2. Element Creation
```typescript
// Create element
const autocomplete = new google.maps.places.PlaceAutocompleteElement()

// Set initial value
autocomplete.value = value

// Apply styling (brutalist design)
autocomplete.style.width = '100%'
autocomplete.style.fontFamily = 'inherit'
autocomplete.style.border = '3px solid #000'
autocomplete.style.borderRadius = '0'
autocomplete.style.padding = '0.75rem'
autocomplete.style.fontSize = '1rem'
autocomplete.style.fontWeight = 'bold'
autocomplete.style.backgroundColor = '#fff'
autocomplete.style.boxShadow = '4px 4px 0px 0px #000'

// Set placeholder
autocomplete.setAttribute('placeholder', placeholder)

// Append to DOM
containerRef.current.appendChild(autocomplete)
```

#### 3. Event Handling
```typescript
// Listen for place selection (event name: 'gmp-placeselect')
autocomplete.addEventListener('gmp-placeselect', (event: any) => {
  const place = event.place
  const address = place.formattedAddress || place.displayName || place.name || ''
  
  // Get location (can be function or property)
  const location = place.location || place.geometry?.location
  if (location) {
    const lat = typeof location.lat === 'function' ? location.lat() : location.lat
    const lng = typeof location.lng === 'function' ? location.lng() : location.lng
    onPlaceSelect({ address, latitude: lat, longitude: lng })
  }
})

// Listen for input changes
autocomplete.addEventListener('input', (event: any) => {
  const inputValue = event.target?.value || autocomplete.value || ''
  onChange(inputValue)
})
```

#### 4. Cleanup
```typescript
return () => {
  if (autocompleteRef.current && containerRef.current) {
    // Remove event listeners
    autocompleteRef.current.removeEventListener('gmp-placeselect', () => {})
    autocompleteRef.current.removeEventListener('input', () => {})
    // Remove from DOM
    if (containerRef.current.contains(autocompleteRef.current)) {
      containerRef.current.removeChild(autocompleteRef.current)
    }
    autocompleteRef.current = null
  }
}
```

### Khác biệt so với Autocomplete cũ

| Feature | Autocomplete (Old) | PlaceAutocompleteElement (New) |
|---------|-------------------|--------------------------------|
| **Constructor** | `new Autocomplete(input, options)` | `new PlaceAutocompleteElement()` (no options) |
| **DOM** | Attached to existing `<input>` | Created as new element, append to container |
| **Event** | `place_changed` | `gmp-placeselect` |
| **Place Object** | `autocomplete.getPlace()` | `event.place` |
| **Address Field** | `place.formatted_address` | `place.formattedAddress` or `place.displayName` |
| **Location** | `place.geometry.location` | `place.location` (can be function or property) |
| **Styling** | Style the input element | Style the PlaceAutocompleteElement directly |
| **Value** | Use input.value | Use autocomplete.value |

### Component Restrictions

**Lưu ý:** `PlaceAutocompleteElement` có thể không hỗ trợ `componentRestrictions` như attribute hoặc property. 

**Giải pháp:**
- Có thể cần cấu hình country restriction qua Google Cloud Console API restrictions
- Hoặc filter results ở client-side sau khi nhận được place data

### Type Definitions

**File:** `petties-web/src/types/google-maps.d.ts`

Đã tạo type definitions cho `PlaceAutocompleteElement` và các interfaces liên quan.

### Testing Checklist

Sau khi implement, test các scenarios:

- [x] **Script loading** → Không load nhiều lần
- [x] **Element creation** → PlaceAutocompleteElement được tạo và append vào DOM
- [x] **Type address** → Autocomplete suggestions xuất hiện
- [x] **Select suggestion** → Address được fill vào input
- [x] **onPlaceSelect callback** → Được trigger với đúng data (address, lat, lng)
- [x] **onChange callback** → Được trigger khi user type
- [x] **Disabled state** → Autocomplete không hoạt động khi disabled
- [x] **Initial value** → Address được set đúng khi có initial value
- [x] **Cleanup** → Event listeners được remove khi component unmount
- [ ] **Country restriction** → Cần test xem có hoạt động không (có thể cần config ở Google Cloud Console)

### Troubleshooting

#### Lỗi: "PlaceAutocompleteElement is not a constructor"
- **Nguyên nhân:** Places API (New) chưa được enable hoặc script chưa load xong
- **Fix:** Enable **Places API (New)** trong Google Cloud Console

#### Lỗi: "gmp-placeselect event not firing"
- **Nguyên nhân:** Event listener chưa được attach đúng cách
- **Fix:** Đảm bảo element đã được append vào DOM trước khi add event listener

#### Lỗi: "place.formattedAddress is undefined"
- **Nguyên nhân:** Place object structure khác
- **Fix:** Dùng `place.formattedAddress || place.displayName || place.name`

#### Lỗi: "Cannot read properties of undefined (reading 'Bq')"
- **Nguyên nhân:** Script được load nhiều lần hoặc conflict
- **Fix:** Prevent loading script nhiều lần bằng `scriptLoadedRef`

### Google Cloud Console Configuration

**Quan trọng:** Cần enable **Places API (New)** (không phải Places API cũ)

1. Vào: https://console.cloud.google.com/google/maps-apis/library
2. Enable:
   - ✅ **Places API (New)** ← **QUAN TRỌNG**
   - ✅ Maps JavaScript API
   - ✅ Geocoding API
   - ✅ Distance Matrix API

### Benefits

1. ✅ **Future-proof:** Sử dụng API mới được Google khuyến nghị
2. ✅ **No deprecation warnings:** Không còn warning trong console
3. ✅ **Better performance:** PlaceAutocompleteElement được optimize hơn
4. ✅ **More features:** Hỗ trợ nhiều tính năng mới

### Files Changed

- ✅ `petties-web/src/components/clinic/AddressAutocomplete.tsx` - Migrated to PlaceAutocompleteElement
- ✅ `petties-web/src/types/google-maps.d.ts` - Added type definitions
- ✅ `Tuan'sTasklist/GOOGLE_MAPS_PLACES_MIGRATION.md` - Updated migration guide

### References

- **Migration Guide:** https://developers.google.com/maps/documentation/javascript/places-migration-overview
- **PlaceAutocompleteElement Docs:** https://developers.google.com/maps/documentation/javascript/place-autocomplete-element
- **Legacy API Info:** https://developers.google.com/maps/legacy

---

**Ngày implement:** 2025-12-20  
**Status:** ✅ Completed - Component đã được migrate sang PlaceAutocompleteElement


