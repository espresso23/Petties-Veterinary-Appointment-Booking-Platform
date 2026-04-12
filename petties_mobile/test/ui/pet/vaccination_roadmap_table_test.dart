import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/ui/staff/patient/widgets/vaccination_roadmap_table.dart';
import 'package:petties_mobile/data/models/vaccination.dart';
import 'package:petties_mobile/config/constants/app_colors.dart';

void main() {
  group('VaccinationRoadmapTable Widget Tests', () {
    testWidgets('Should display "-" for non-scheduled and non-completed doses', (WidgetTester tester) async {
      final record = VaccinationRecord(
        id: 'real-id-1',
        petId: 'pet-1',
        staffId: 'staff-1',
        clinicName: 'Clinic',
        staffName: 'Staff',
        vaccineName: 'Rabies',
        status: 'PLANNED',
        nextDueDate: null,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VaccinationRoadmapTable(
              records: [record],
            ),
          ),
        ),
      );

      // In VaccinationRoadmapTable, if !isCompleted && dose.nextDueDate == null, it returns '-'
      expect(find.text('-'), findsAtLeastNWidgets(1));
    });

    testWidgets('Should display "SẮP TIÊM" when nextDueDate is present for non-predicted record', (WidgetTester tester) async {
      final record = VaccinationRecord(
        id: 'draft-id', // Does not start with 'predicted-'
        petId: 'pet-1',
        staffId: 'staff-1',
        clinicName: 'Clinic',
        staffName: 'Staff',
        vaccineName: 'Rabies',
        status: 'PLANNED',
        nextDueDate: DateTime.now().add(const Duration(days: 7)),
        doseNumber: 1,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VaccinationRoadmapTable(
              records: [record],
            ),
          ),
        ),
      );

      expect(find.text('SẮP TIÊM'), findsOneWidget);
    });

    testWidgets('Should display "ĐÃ TIÊM" when status is COMPLETED', (WidgetTester tester) async {
      final record = VaccinationRecord(
        id: 'real-1',
        petId: 'pet-1',
        staffId: 'staff-1',
        clinicName: 'Clinic',
        staffName: 'Staff',
        vaccineName: 'Rabies',
        status: 'COMPLETED',
        vaccinationDate: DateTime.now(),
        doseNumber: 1,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: VaccinationRoadmapTable(
              records: [record],
            ),
          ),
        ),
      );

      expect(find.text('ĐÃ TIÊM'), findsOneWidget);
    });
  });
}
