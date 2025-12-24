# 🗺️ Google Maps Styling Guide

Hướng dẫn tùy chỉnh Google Maps để phù hợp với design của Petties app.

## 📋 Tổng quan

Google Maps cho phép tùy chỉnh:
- Màu sắc các elements (đường, nước, buildings, parks...)
- Ẩn/hiện labels và icons
- Tạo dark mode map
- Phù hợp với brand colors của app

---

## 🎨 Cách tạo Custom Map Style

### Bước 1: Sử dụng Google Map Styling Wizard

1. Truy cập: **https://mapstyle.withgoogle.com/**

2. Chọn theme cơ bản:

| Theme | Mô tả | Phù hợp với |
|-------|-------|-------------|
| **Standard** | Mặc định | Light mode |
| **Silver** | Nhạt, minimalist | Modern apps |
| **Retro** | Cổ điển, vintage | - |
| **Dark** | Tối | Dark mode |
| **Night** | Ban đêm | Dark mode |
| **Aubergine** | Tím đậm | Premium feel |

3. Click **More Options** để tùy chỉnh chi tiết

4. Click **Finish** → **Copy JSON**

### Bước 2: Tạo file JSON style

Tạo folder và file: `assets/map_styles/map_style.json`

```json
[
  {
    "elementType": "geometry",
    "stylers": [{"color": "#f5f5f5"}]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#616161"}]
  },
  {
    "featureType": "water",
    "elementType": "geometry.fill",
    "stylers": [{"color": "#c9e4f5"}]
  }
]
```

### Bước 3: Thêm assets vào pubspec.yaml

```yaml
flutter:
  uses-material-design: true
  assets:
    - assets/map_styles/
```

### Bước 4: Load style trong Flutter code

```dart
import 'package:flutter/services.dart' show rootBundle;
import 'package:google_maps_flutter/google_maps_flutter.dart';

class MapScreen extends StatefulWidget {
  @override
  _MapScreenState createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  GoogleMapController? _mapController;
  String? _mapStyle;

  @override
  void initState() {
    super.initState();
    _loadMapStyle();
  }

  Future<void> _loadMapStyle() async {
    _mapStyle = await rootBundle.loadString('assets/map_styles/map_style.json');
    setState(() {});
  }

  void _onMapCreated(GoogleMapController controller) {
    _mapController = controller;
    if (_mapStyle != null) {
      _mapController!.setMapStyle(_mapStyle);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GoogleMap(
      onMapCreated: _onMapCreated,
      initialCameraPosition: CameraPosition(
        target: LatLng(10.8231, 106.6297), // Ho Chi Minh City
        zoom: 12,
      ),
    );
  }
}
```

---

## 🎨 Pre-made Styles cho Petties

### 1. Light Mode Style (Soft Pastel - Phù hợp Pet App)

```json
[
  {
    "elementType": "geometry",
    "stylers": [{"color": "#f8f9fa"}]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#6c757d"}]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{"color": "#ffffff"}]
  },
  {
    "featureType": "water",
    "elementType": "geometry.fill",
    "stylers": [{"color": "#a8d5e2"}]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{"color": "#ffffff"}]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{"color": "#e9ecef"}]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry.fill",
    "stylers": [{"color": "#c8e6c9"}]
  },
  {
    "featureType": "poi.medical",
    "elementType": "geometry.fill",
    "stylers": [{"color": "#ffcdd2"}]
  },
  {
    "featureType": "poi.business",
    "stylers": [{"visibility": "off"}]
  }
]
```

### 2. Dark Mode Style

```json
[
  {
    "elementType": "geometry",
    "stylers": [{"color": "#1a1a2e"}]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{"color": "#8b8b8b"}]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{"color": "#1a1a2e"}]
  },
  {
    "featureType": "water",
    "elementType": "geometry.fill",
    "stylers": [{"color": "#0f0f1a"}]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{"color": "#2d2d44"}]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{"color": "#1a1a2e"}]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry.fill",
    "stylers": [{"color": "#1b3a1b"}]
  },
  {
    "featureType": "poi.business",
    "stylers": [{"visibility": "off"}]
  }
]
```

### 3. Brand Color Style (với Primary Color của Petties)

Thay thế `#FF6B6B` bằng primary color của app:

```json
[
  {
    "elementType": "geometry",
    "stylers": [{"color": "#f5f5f5"}]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.fill",
    "stylers": [{"color": "#FF6B6B"}, {"lightness": 70}]
  },
  {
    "featureType": "poi.medical",
    "elementType": "geometry.fill",
    "stylers": [{"color": "#FF6B6B"}, {"lightness": 60}]
  },
  {
    "featureType": "water",
    "elementType": "geometry.fill",
    "stylers": [{"color": "#b3e5fc"}]
  }
]
```

---

## 🔧 Dynamic Theme Switching

```dart
class MapStyleService {
  static Future<String> getMapStyle(BuildContext context) async {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    
    if (isDarkMode) {
      return await rootBundle.loadString('assets/map_styles/dark_style.json');
    } else {
      return await rootBundle.loadString('assets/map_styles/light_style.json');
    }
  }
}

// Usage in MapScreen
void _onMapCreated(GoogleMapController controller) async {
  _mapController = controller;
  final style = await MapStyleService.getMapStyle(context);
  _mapController!.setMapStyle(style);
}
```

---

## 📍 Custom Markers

### Tạo custom marker từ asset image

```dart
BitmapDescriptor? _customMarkerIcon;

Future<void> _loadCustomMarker() async {
  _customMarkerIcon = await BitmapDescriptor.fromAssetImage(
    ImageConfiguration(size: Size(48, 48)),
    'assets/images/clinic_marker.png',
  );
}

// Sử dụng trong Marker
Marker(
  markerId: MarkerId('clinic_1'),
  position: LatLng(10.8231, 106.6297),
  icon: _customMarkerIcon ?? BitmapDescriptor.defaultMarker,
  infoWindow: InfoWindow(title: 'Petties Clinic'),
)
```

### Tạo marker từ Widget (advanced)

```dart
import 'dart:ui' as ui;

Future<BitmapDescriptor> _createCustomMarkerFromWidget(String text) async {
  final pictureRecorder = ui.PictureRecorder();
  final canvas = Canvas(pictureRecorder);
  
  // Draw custom marker
  final paint = Paint()..color = Color(0xFFFF6B6B);
  canvas.drawCircle(Offset(25, 25), 25, paint);
  
  // Draw text
  final textPainter = TextPainter(
    text: TextSpan(text: text, style: TextStyle(color: Colors.white, fontSize: 16)),
    textDirection: TextDirection.ltr,
  );
  textPainter.layout();
  textPainter.paint(canvas, Offset(15, 15));
  
  final picture = pictureRecorder.endRecording();
  final image = await picture.toImage(50, 50);
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  
  return BitmapDescriptor.fromBytes(bytes!.buffer.asUint8List());
}
```

---

## 🔗 Resources

| Resource | Link | Mô tả |
|----------|------|-------|
| **Google Map Styling Wizard** | https://mapstyle.withgoogle.com/ | Tạo style nhanh |
| **Snazzy Maps** | https://snazzymaps.com/ | Library 10,000+ styles có sẵn |
| **Map Style Editor (Advanced)** | https://mapstyle.withgoogle.com/advanced | Tùy chỉnh chi tiết |
| **JSON Style Reference** | https://developers.google.com/maps/documentation/javascript/style-reference | Tài liệu đầy đủ |

---

## ⚠️ Lưu ý

1. **Performance**: Load style một lần trong `initState()`, không load lại mỗi khi build widget.

2. **File size**: JSON style nên < 50KB để load nhanh.

3. **Testing**: Test style trên cả light mode và dark mode.

4. **Markers**: Custom markers cần được scale phù hợp (thường 48x48 hoặc 72x72 pixels).

---

## 📁 Cấu trúc thư mục đề xuất

```
petties_mobile/
├── assets/
│   ├── map_styles/
│   │   ├── light_style.json
│   │   └── dark_style.json
│   └── images/
│       ├── clinic_marker.png
│       ├── pet_marker.png
│       └── user_marker.png
└── lib/
    └── core/
        └── services/
            └── map_style_service.dart
```
