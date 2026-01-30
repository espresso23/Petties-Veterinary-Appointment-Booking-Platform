import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/vaccination.dart';
import 'package:petties_mobile/ui/vet/patient/widgets/vaccination_roadmap_table.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

void main() {
  // Common Mock Data
  final mockRecord = VaccinationRecord(
    id: '1',
    petId: 'pet1',
    vetId: 'vet1',
    clinicName: 'Clinic A',
    vetName: 'Dr. John',
    vaccineName: 'Rabies',
    status: 'COMPLETED',
    vaccinationDate: DateTime(2023, 1, 1),
    doseNumber: 1,
    totalDoses: 1,
    workflowStatus: 'COMPLETED',
  );

  final mockUpcoming = VaccinationRecord(
    id: 'predicted-1',
    petId: 'pet1',
    vetId: '',
    clinicName: '',
    vetName: '',
    vaccineName: 'Rabies',
    status: 'PLANNED',
    nextDueDate: DateTime(2027, 1, 1), // Future date relative to 2026
    doseNumber: 2,
    workflowStatus: 'PENDING',
  );

// binding.window setup removed, will use tester.view inside tests

  Future<void> pumpTable(WidgetTester tester, {
    List<VaccinationRecord> records = const [],
    List<VaccinationRecord> upcoming = const [],
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en', 'US'), Locale('vi', 'VN')],
        home: Scaffold(
          body: VaccinationRoadmapTable(
            records: records,
            upcoming: upcoming,
          ),
        ),
      ),
    );
  }

  testWidgets('renders table headers', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(2400, 1200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await pumpTable(tester);

    expect(find.text('LOẠI VACCINE'), findsOneWidget);
    expect(find.text('MŨI 1'), findsOneWidget);
    expect(find.text('MŨI 2'), findsOneWidget);
  });

  testWidgets('displays completed vaccination correctly', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(2400, 1200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await pumpTable(tester, records: [mockRecord]);

    expect(find.text('Rabies'), findsOneWidget);
    expect(find.text('1 MŨI TỔNG CỘNG'), findsOneWidget);
    expect(find.text('ĐÃ TIÊM'), findsOneWidget);
    expect(find.text('1/1/2023'), findsOneWidget);
  });

  testWidgets('merges upcoming vaccination correctly', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(2400, 1200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    // Should show Rabies row with Dose 1 (Done) and Dose 2 (Predicted)
    await pumpTable(tester, records: [mockRecord], upcoming: [mockUpcoming]);

    expect(find.text('Rabies'), findsOneWidget); // Row exists
    
    // Check Statuses
    expect(find.text('SẮP TIÊM'), findsOneWidget); // Dose 2 status (Future date)
    expect(find.text('Dự kiến'), findsOneWidget); // Badge
  });

  testWidgets('does NOT render pure predicted group', (WidgetTester tester) async {
    // Same logic as Web: if no history exists for that vaccine, it should be filtered out
    final newUpcoming = VaccinationRecord(
      id: 'predicted-DHPPi',
      petId: 'pet1',
      vetId: '',
      clinicName: '',
      vetName: '',
      vaccineName: 'DHPPi',
      status: 'PLANNED',
      nextDueDate: DateTime(2027, 2, 1),
      doseNumber: 1,
      workflowStatus: 'PENDING',
    );

    await pumpTable(tester, records: [], upcoming: [newUpcoming]);

    expect(find.text('DHPPi'), findsNothing);
  });
}
