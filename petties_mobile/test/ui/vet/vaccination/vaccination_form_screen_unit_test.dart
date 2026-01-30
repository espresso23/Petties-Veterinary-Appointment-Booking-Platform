import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/ui/vet/patient/vaccination_form_screen.dart';
import 'package:petties_mobile/data/models/vaccination.dart';
import 'package:petties_mobile/data/models/vaccine_template.dart';
import 'package:petties_mobile/data/services/vaccination_service.dart';
import 'package:petties_mobile/data/services/vaccine_template_service.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

// --- Fakes ---
class FakeVaccinationService extends VaccinationService {
  @override
  Future<List<VaccinationRecord>> getVaccinationsByPet(String petId) async {
    return []; // Return empty history for now
  }

  @override
  Future<List<VaccinationRecord>> getUpcomingVaccinations(String petId) async {
    return []; // Return empty upcoming
  }
  
  @override
  Future<VaccinationRecord> createVaccination(CreateVaccinationRequest request) async {
    return VaccinationRecord(
      id: 'mock-id',
      petId: request.petId,
      vaccineName: request.vaccineName,
      status: 'COMPLETED', 
      workflowStatus: 'COMPLETED',
      vetId: 'mock-vet-id',
      clinicName: 'Mock Clinic',
      vetName: 'Mock Vet',
    );
  }
}

class FakeVaccineTemplateService extends VaccineTemplateService {
  @override
  Future<List<VaccineTemplate>> getTemplates() async {
    return [
      VaccineTemplate(id: 't1', name: 'Rabies', description: 'Anti-rabies', targetSpecies: 'DOG'),
      VaccineTemplate(id: 't2', name: 'DHPPi', description: '5-in-1', targetSpecies: 'DOG'),
    ];
  }
}

void main() {
  late FakeVaccinationService mockVaccinationService;
  late FakeVaccineTemplateService mockTemplateService;

  setUp(() {
    mockVaccinationService = FakeVaccinationService();
    mockTemplateService = FakeVaccineTemplateService();
  });

  testWidgets('renders toggle button and input fields', (WidgetTester tester) async {
    // Basic pump
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en', 'US'), Locale('vi', 'VN')],
        home: Scaffold(
          body: VaccinationFormScreen(
            petId: 'pet1',
            petName: 'Pet Name',
            bookingId: 'booking1',
            bookingCode: 'BK123',
            vaccinationService: mockVaccinationService,
            templateService: mockTemplateService,
          ),
        ),
      ),
    );

    await tester.pumpAndSettle(); // Wait for futures to complete

    // Verify Title (Title is in AppBar, might catch it)
    expect(find.text('Ghi nhận Tiêm chủng - Pet Name'), findsOneWidget);

    // Verify Section Titles
    expect(find.text('THÔNG TIN VẮC-XIN'), findsOneWidget);
    expect(find.text('THỜI GIAN'), findsOneWidget);
    expect(find.text('GHI CHÚ'), findsOneWidget);

    // Verify Booking Badge
    expect(find.text('Booking #BK123'), findsOneWidget);
  });

  testWidgets('toggles between Form and Roadmap views', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en', 'US'), Locale('vi', 'VN')],
        home: Scaffold(
          body: VaccinationFormScreen(
            petId: 'pet1',
            petName: 'Pet Name',
            vaccinationService: mockVaccinationService,
            templateService: mockTemplateService,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Verify "LIST" toggle is visible
    expect(find.text('LIST'), findsOneWidget);
    expect(find.text('ROADMAP'), findsOneWidget);
    
    // Verify we can tap ROADMAP without crash
    await tester.tap(find.text('ROADMAP'));
    await tester.pumpAndSettle();
    
    // Just verify state changed and no crash
    expect(find.text('LỊCH SỬ TIÊM CHỦNG'), findsOneWidget);
  });
}
