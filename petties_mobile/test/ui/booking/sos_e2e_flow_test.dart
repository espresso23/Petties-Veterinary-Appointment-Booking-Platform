import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:petties_mobile/data/models/booking.dart';
import 'package:petties_mobile/data/models/clinic.dart';
import 'package:petties_mobile/data/services/sos_matching_service.dart';
import 'package:petties_mobile/data/services/tracking_websocket_service.dart';
import 'package:petties_mobile/data/services/clinic_service.dart';
import 'package:petties_mobile/data/services/booking_service.dart';
import 'package:petties_mobile/ui/booking/sos_radar_map_screen.dart';
import 'package:petties_mobile/ui/booking/sos_tracking_screen.dart';
import 'dart:async';
import 'dart:io';

// Fake GoRouter to avoid Mockito Future issues
class FakeGoRouter extends Fake implements GoRouter {
  @override
  Future<T?> push<T extends Object?>(String location, {Object? extra}) async =>
      null;

  @override
  void go(String location, {Object? extra}) {}

  @override
  Future<T?> pushReplacement<T extends Object?>(String location,
          {Object? extra}) async =>
      null;

  @override
  void pop<T extends Object?>([T? result]) {}
}

class MockGoRouterProvider extends StatelessWidget {
  const MockGoRouterProvider({
    required this.router,
    required this.child,
    super.key,
  });

  final GoRouter router;
  final Widget child;

  @override
  Widget build(BuildContext context) => InheritedGoRouter(
        goRouter: router,
        child: child,
      );
}

// Mock HTTP for image loading
class MockHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return _MockHttpClient();
  }
}

class _MockHttpClient extends Fake implements HttpClient {
  @override
  Future<HttpClientRequest> getUrl(Uri url) async => _MockHttpClientRequest();
}

class _MockHttpClientRequest extends Fake implements HttpClientRequest {
  @override
  final HttpHeaders headers = _MockHttpHeaders();

  @override
  Future<HttpClientResponse> close() async => _MockHttpClientResponse();
}

class _MockHttpHeaders extends Fake implements HttpHeaders {
  @override
  void add(String name, Object value, {bool preserveHeaderCase = false}) {}

  @override
  void set(String name, Object value, {bool preserveHeaderCase = false}) {}
}

class _MockHttpClientResponse extends Fake implements HttpClientResponse {
  @override
  int get statusCode => 404;

  @override
  StreamSubscription<List<int>> listen(void Function(List<int> event)? onData,
      {Function? onError, void Function()? onDone, bool? cancelOnError}) {
    return Stream<List<int>>.fromIterable([<int>[]]).listen(onData,
        onError: onError, onDone: onDone, cancelOnError: cancelOnError);
  }
}

// Fakes for Services
class FakeSosMatchingService extends ChangeNotifier
    implements SosMatchingService {
  @override
  SosMatchingStatus? currentStatus;
  @override
  String? get error => null;
  @override
  bool get isLoading => false;
  @override
  String? get currentBookingId => 'booking_123';
  @override
  void setAccessToken(String? token) {}
  @override
  Future<void> connect() async {}
  @override
  void disconnect() {}
  @override
  void clear() {}
  final Map<String, SosMatchingHandler> _subscribers = {};

  @override
  Future<bool> cancelMatching(String bookingId) async => true;
  @override
  bool get isConnected => true;
  @override
  Future<SosMatchResponse?> getActiveSosBooking() async => null;
  @override
  Future<SosMatchResponse?> startMatching(SosMatchRequest request) async {
    currentStatus = SosMatchingStatus(
      bookingId: 'booking_123',
      status: 'SEARCHING',
    );
    return SosMatchResponse(
      bookingId: 'booking_123',
      status: 'SEARCHING',
    );
  }

  @override
  Future<SosMatchingStatus?> getMatchingStatus(String bookingId) async =>
      currentStatus;
  @override
  Future<void> subscribeToMatching(
      String bookingId, SosMatchingHandler handler) async {
    _subscribers[bookingId] = handler;
  }

  @override
  void unsubscribeFromMatching(String bookingId) {
    _subscribers.remove(bookingId);
  }

  void triggerNotify() {
    notifyListeners();
    if (currentStatus != null &&
        _subscribers.containsKey(currentStatus!.bookingId)) {
      _subscribers[currentStatus!.bookingId]!(currentStatus!);
    }
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeTrackingWebsocketService implements TrackingWebsocketService {
  @override
  Future<void> subscribeToTracking(
      String bookingId, TrackingHandler handler) async {}
  @override
  void setAccessToken(String? token) {}
  @override
  void unsubscribeFromTracking(String bookingId, TrackingHandler handler) {}
  @override
  Future<void> connect() async {}
  @override
  void disconnect() {}
  @override
  Future<void> updateLocation(String bookingId, double lat, double lng,
      {String? status}) async {}
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeClinicService extends Fake implements ClinicService {
  @override
  Future<List<Clinic>> searchClinics({
    double? latitude,
    double? longitude,
    double? radiusKm,
    String? searchQuery,
    bool? isOpenNow,
    bool? sortByRating,
    bool? sortByDistance,
    String? province,
    String? district,
    double? minPrice,
    double? maxPrice,
    int page = 0,
    int size = 20,
  }) async =>
      <Clinic>[];
}

class FakeBookingService extends Fake implements BookingService {
  @override
  Future<BookingResponse> getBookingById(String id) async => BookingResponse(
        bookingId: id,
        type: 'SOS',
        status: id == 'booking_123' ? 'IN_PROGRESS' : 'CONFIRMED',
        clinicName: 'Test Clinic',
        assignedStaffName: id == 'booking_123' ? 'BS. Minh' : null,
        homeLat: 10.1,
        homeLong: 106.1,
        clinicLat: 10.2,
        clinicLong: 106.2,
      );
  @override
  Future<BookingResponse> startMoving(String bookingId) async =>
      BookingResponse(bookingId: bookingId, status: 'IN_PROGRESS');
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  HttpOverrides.global = MockHttpOverrides();

  late FakeSosMatchingService fakeSosService;
  late FakeTrackingWebsocketService fakeTrackingService;
  late FakeClinicService fakeClinicService;
  late FakeBookingService fakeBookingService;
  late FakeGoRouter fakeRouter;

  final dummyPosition = Position(
    latitude: 10.762622,
    longitude: 106.660172,
    timestamp: DateTime.now(),
    accuracy: 10,
    altitude: 10,
    altitudeAccuracy: 1,
    heading: 0,
    headingAccuracy: 1,
    speed: 0,
    speedAccuracy: 0,
  );

  setUp(() {
    SharedPreferences.setMockInitialValues({
      'access_token': 'dummy_token',
    });
    fakeSosService = FakeSosMatchingService();
    fakeTrackingService = FakeTrackingWebsocketService();
    fakeClinicService = FakeClinicService();
    fakeBookingService = FakeBookingService();
    fakeRouter = FakeGoRouter();
  });

  group('SOS E2E Flow Tests', () {
    testWidgets('Luồng SOS: Từ tìm kiếm radar đến màn hình theo dõi',
        (WidgetTester tester) async {
      fakeSosService.currentStatus =
          SosMatchingStatus(bookingId: 'booking_123', status: 'SEARCHING');

      await tester.pumpWidget(MaterialApp(
        home: MockGoRouterProvider(
          router: fakeRouter,
          child: SosRadarMapScreen(
            petId: 'pet_1',
            petName: 'Luffy',
            symptoms: 'Ngộ độc',
            sosService: fakeSosService,
            clinicService: fakeClinicService,
            websocketService: fakeTrackingService,
            initialPosition: dummyPosition,
          ),
        ),
      ));

      // Wait for location initialization and start matching
      for (int i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }

      debugDumpApp();
      expect(find.text('Đang tìm phòng khám gần bạn...'), findsOneWidget);

      fakeSosService.currentStatus = SosMatchingStatus(
        bookingId: 'booking_123',
        status: 'CONFIRMED',
        clinicName: 'Phòng khám ABC',
        staffName: 'BS. Hùng',
        staffPhone: '0987654321',
        clinicLat: 10.1,
        clinicLng: 106.1,
      );

      fakeSosService.triggerNotify();
      await tester.pumpAndSettle();

      expect(find.text('Phòng khám ABC'), findsOneWidget);
      expect(find.text('Đã tìm thấy phòng khám!'), findsOneWidget);

      // Advance time to clear navigation timer (2s)
      await tester.pump(const Duration(seconds: 3));
    });

    testWidgets('Luồng SOS: Kiểm tra hiển thị thông tin bác sĩ đang di chuyển',
        (WidgetTester tester) async {
      final movingBooking = BookingResponse(
        bookingId: 'booking_123',
        type: 'SOS',
        status: 'IN_PROGRESS',
        assignedStaffName: 'BS. Minh',
        clinicName: 'Clinic XYZ',
        homeLat: 10.1,
        homeLong: 106.1,
        clinicLat: 10.2,
        clinicLong: 106.2,
      );

      await tester.runAsync(() async {
        await tester.pumpWidget(MaterialApp(
          home: SosTrackingScreen(
            booking: movingBooking,
            bookingService: fakeBookingService,
            websocketService: fakeTrackingService,
          ),
        ));

        // Multiple pumps for async initState
        for (int i = 0; i < 10; i++) {
          await tester.pump(const Duration(milliseconds: 200));
        }
      });

      // Print widget tree for debugging if it still fails
      // debugDumpApp();

      // Tên bác sĩ có thể xuất hiện ở nhiều vị trí (card chính, sheet thu gọn, v.v.)
      // nên chỉ kiểm tra là có ít nhất một widget hiển thị đúng tên.
      expect(find.text('BS. Minh'), findsWidgets);
      // Khi chưa nhận được tracking location nào, màn hình hiển thị trạng thái điều phối.
      expect(
        find.text(
            'Bác sĩ đã bắt đầu di chuyển, đang chờ cập nhật vị trí...'),
        findsOneWidget,
      );
    });
  });
}
