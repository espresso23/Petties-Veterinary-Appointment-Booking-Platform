# API Documentation: Clinic Active Locations Filter

## Overview
This API provides a list of all unique administrative divisions (Province, District, Ward) that currently contain at least one **approved** and **non-deleted** clinic. This data is intended to be used by the Frontend to build dynamic search filters, ensuring users only select regions that actually have available clinics.

- **Base URL**: `/api/clinics`
- **Access**: Public (No authentication required)

---

## 1. Get Active Locations
Returns a list of unique locations where clinics are currently operating.

### Request
- **Method**: `GET`
- **Endpoint**: `/locations`
- **Headers**: `Content-Type: application/json`

### Response
- **Status Code**: `200 OK`
- **Body**: An array of objects containing `province`, `district`, and `ward`.

#### JSON Structure:
```json
[
  {
    "province": "Thành phố Đà Nẵng",
    "district": "Quận Thanh Khê",
    "ward": "Phường Vĩnh Trung"
  },
  {
    "province": "Thành phố Hồ Chí Minh",
    "district": "Quận 1",
    "ward": "Phường Bến Nghé"
  }
]
```

---

## 2. Implementation Details

### Database Query
The API uses a `DISTINCT` query on the `clinics` table:
```sql
SELECT DISTINCT province, district, ward 
FROM clinics 
WHERE status = 'APPROVED' 
  AND deleted_at IS NULL
ORDER BY province, district, ward;
```

### Business Rules
1. **Implicit Standardization**: Since these values come from the database, they will match exactly how the clinic addresses were saved (including manual inputs or customized names).
2. **Zero-Result Prevention**: By using this API for filters on the Search page, the Frontend can guarantee that any location selected by the user will return at least one valid clinic result.
3. **Dynamic Updates**: As soon as a clinic in a new ward is approved, that ward will automatically appear in the filter list without any manual configuration.
