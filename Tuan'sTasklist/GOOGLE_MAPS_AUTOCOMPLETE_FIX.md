# Google Maps Autocomplete Fix

## Vấn đề gặp phải

Khi migrate sang `PlaceAutocompleteElement` (API mới), gặp các lỗi sau:

1. **`ERR_BLOCKED_BY_CLIENT`**: Script bị block bởi ad blocker hoặc CSP
2. **Element already defined**: Script được load nhiều lần, gây conflict
3. **`InvalidValueError: Unknown property 'requestedResultTypes'`**: `PlaceAutocompleteElement` không nhận options trong constructor như class thông thường
4. **`Cannot read properties of undefined (reading 'Bq')`**: Lỗi nội bộ của Google Maps API

## Giải pháp

### Quay lại sử dụng `Autocomplete` (Classic API)

Mặc dù Google khuyến nghị dùng `PlaceAutocompleteElement` cho khách hàng mới, nhưng:
- `Autocomplete` vẫn được hỗ trợ đầy đủ và ổn định
- Không bị deprecated ngay lập tức (ít nhất 12 tháng notice)
- API đơn giản hơn, dễ sử dụng hơn
- Tương thích tốt với React

### Thay đổi trong code

**File:** `petties-web/src/components/clinic/AddressAutocomplete.tsx`

#### Trước (PlaceAutocompleteElement - có lỗi):
```typescript
const autocomplete = new google.maps.places.PlaceAutocompleteElement({
  requestedResultTypes: ['GEOCODE'], // ❌ Lỗi: property không tồn tại
  componentRestrictions: { country: ['vn'] },
})
```

#### Sau (Autocomplete - hoạt động ổn định):
```typescript
const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
  componentRestrictions: { country: 'vn' }, // ✅ Hoạt động đúng
  fields: ['formatted_address', 'geometry', 'name'],
  types: ['address'],
})
```

### Cải thiện

1. **Prevent script loading multiple times**:
   - Sử dụng `scriptLoadedRef` để track script đã được load
   - Kiểm tra script đã tồn tại trong DOM trước khi thêm mới

2. **Proper cleanup**:
   - Clear event listeners khi component unmount
   - Sử dụng `google.maps.event.clearInstanceListeners()`

3. **Better error handling**:
   - Kiểm tra script load thành công
   - Timeout sau 10 giây nếu API không available

## Code mới

```typescript
import { useRef, useEffect, useState } from 'react'

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string) => void
  onPlaceSelect?: (place: {
    address: string
    latitude?: number
    longitude?: number
  }) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Enter address...',
  className = '',
  disabled = false,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const scriptLoadedRef = useRef(false)

  useEffect(() => {
    // Prevent loading script multiple times
    if (scriptLoadedRef.current) {
      if (window.google?.maps?.places?.Autocomplete) {
        setIsLoaded(true)
      }
      return
    }

    // Check if Google Maps is already loaded
    if (typeof window !== 'undefined' && window.google?.maps?.places?.Autocomplete) {
      setIsLoaded(true)
      scriptLoadedRef.current = true
      return
    }

    // Check if script is already in the document
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')
    if (existingScript) {
      scriptLoadedRef.current = true
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.places?.Autocomplete) {
          setIsLoaded(true)
          clearInterval(checkLoaded)
        }
      }, 100)
      setTimeout(() => clearInterval(checkLoaded), 10000)
      return
    }

    // Load Google Maps script
    scriptLoadedRef.current = true
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.places?.Autocomplete) {
          setIsLoaded(true)
          clearInterval(checkLoaded)
        }
      }, 100)
      setTimeout(() => {
        clearInterval(checkLoaded)
        if (!window.google?.maps?.places?.Autocomplete) {
          console.error('Google Maps Autocomplete not available.')
        }
      }, 10000)
    }
    script.onerror = () => {
      console.error('Failed to load Google Maps script')
      scriptLoadedRef.current = false
    }
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!isLoaded || !inputRef.current || disabled) return

    // Initialize Autocomplete
    if (!autocompleteRef.current) {
      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'vn' },
        fields: ['formatted_address', 'geometry', 'name'],
        types: ['address'],
      })

      // Listen for place selection
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (place) {
          const address = place.formatted_address || place.name || ''
          onChange(address)

          if (onPlaceSelect && place.geometry?.location) {
            onPlaceSelect({
              address,
              latitude: place.geometry.location.lat(),
              longitude: place.geometry.location.lng(),
            })
          }
        }
      })

      autocompleteRef.current = autocomplete
    }

    // Update value if it changed externally
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
  }, [isLoaded, value, onChange, onPlaceSelect, disabled])

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input-brutal w-full ${className}`}
        placeholder={placeholder}
        disabled={disabled || !isLoaded}
      />
      {!isLoaded && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-stone-500 font-bold uppercase pointer-events-none">
          Loading...
        </div>
      )}
    </div>
  )
}
```

## Kết quả

✅ Không còn lỗi `InvalidValueError`  
✅ Không còn lỗi "Element already defined"  
✅ Script chỉ load một lần  
✅ Autocomplete hoạt động ổn định  
✅ Cleanup đúng cách khi component unmount  

## Lưu ý

- Warning về `Autocomplete` không available cho new customers vẫn sẽ hiển thị trong console, nhưng không ảnh hưởng đến functionality
- Khi Google chính thức deprecated `Autocomplete` (ít nhất 12 tháng notice), sẽ cần migrate lại sang `PlaceAutocompleteElement` hoặc API mới hơn
- Hiện tại, `Autocomplete` là giải pháp ổn định nhất cho production

## Testing

1. Mở form tạo/sửa clinic
2. Click vào field "Địa chỉ"
3. Gõ địa chỉ (ví dụ: "123 Đường Lê Lợi, Đà Nẵng")
4. Chọn từ dropdown suggestions
5. Verify:
   - Địa chỉ được điền vào field
   - `onPlaceSelect` callback được gọi với đúng coordinates
   - Không có lỗi trong console

## Files changed

- ✅ `petties-web/src/components/clinic/AddressAutocomplete.tsx` - Quay lại dùng Autocomplete
- ✅ `petties-web/src/types/google-maps.d.ts` - Đã xóa (không cần thiết)


