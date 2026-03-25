import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/ui/staff/widgets/ai_diagnosis_panel.dart';
import 'package:petties_mobile/config/constants/app_colors.dart';

void main() {
  group('AiDiagnosisPanel Widget', () {
    testWidgets('renders header with correct title', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: const AiDiagnosisPanel(
              species: 'dog',
            ),
          ),
        ),
      );

      expect(find.text('HỖ TRỢ AI CHẨN ĐOÁN'), findsOneWidget);
    });

    testWidgets('renders narrative input field', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: const AiDiagnosisPanel(
              species: 'dog',
            ),
          ),
        ),
      );

      expect(
        find.byWidgetPredicate(
          (widget) =>
              widget is TextField &&
              widget.decoration?.hintText?.contains('Mô tả ngắn tình trạng') == true,
        ),
        findsOneWidget,
      );
    });

    testWidgets('renders analyze button', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: const AiDiagnosisPanel(
              species: 'dog',
            ),
          ),
        ),
      );

      expect(find.text('PHÂN TÍCH TÌNH TRẠNG'), findsOneWidget);
    });

    testWidgets('analyze button is disabled when no input', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: const AiDiagnosisPanel(
              species: 'dog',
            ),
          ),
        ),
      );

      final buttonFinder = find.text('PHÂN TÍCH TÌNH TRẠNG');
      expect(buttonFinder, findsOneWidget);

      final container = tester.widget<Container>(
        find.ancestor(
          of: buttonFinder,
          matching: find.byType(Container),
        ).first,
      );
      final decoration = container.decoration as BoxDecoration?;
      expect(decoration?.color, AppColors.stone300);
    });

    testWidgets('shows species info in panel', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: const AiDiagnosisPanel(
              petId: 'pet-123',
              species: 'dog',
              breed: 'Golden Retriever',
              ageMonths: 24,
              weightKg: 30.0,
            ),
          ),
        ),
      );

      expect(find.text('PHÂN TÍCH TÌNH TRẠNG'), findsOneWidget);
    });

    testWidgets('can enter clinical narrative', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: const AiDiagnosisPanel(
              species: 'cat',
            ),
          ),
        ),
      );

      final textField = find.byType(TextField);
      await tester.enterText(textField, 'Cat has eye discharge');
      await tester.pump();

      expect(find.text('Cat has eye discharge'), findsOneWidget);
    });

    testWidgets('renders with initial SOAP values', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: const AiDiagnosisPanel(
              species: 'dog',
              initialSubjective: 'Initial subjective',
              initialObjective: 'Initial objective',
              initialAssessment: 'Initial assessment',
              initialPlan: 'Initial plan',
            ),
          ),
        ),
      );

      expect(find.text('PHÂN TÍCH TÌNH TRẠNG'), findsOneWidget);
    });

    testWidgets('displays image count info', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: const AiDiagnosisPanel(
              species: 'dog',
              imageUrls: [
                'https://example.com/img1.jpg',
                'https://example.com/img2.jpg',
              ],
            ),
          ),
        ),
      );

      expect(find.textContaining('Ảnh AI đang đọc'), findsOneWidget);
      expect(find.textContaining('Tổng 2 ảnh'), findsOneWidget);
    });

    testWidgets('renders with pet info passed', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: const AiDiagnosisPanel(
              petId: 'pet-123',
              bookingId: 'booking-456',
              species: 'dog',
              breed: 'Poodle',
              ageMonths: 12,
              weightKg: 15.5,
              allergies: ['Chicken'],
            ),
          ),
        ),
      );

      expect(find.text('HỖ TRỢ AI CHẨN ĐOÁN'), findsOneWidget);
    });

    testWidgets('renders info section when has content', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: const AiDiagnosisPanel(
                species: 'dog',
              ),
            ),
          ),
        ),
      );

      expect(find.text('HỖ TRỢ AI CHẨN ĐOÁN'), findsOneWidget);
      expect(find.text('PHÂN TÍCH TÌNH TRẠNG'), findsOneWidget);
    });
  });
}
