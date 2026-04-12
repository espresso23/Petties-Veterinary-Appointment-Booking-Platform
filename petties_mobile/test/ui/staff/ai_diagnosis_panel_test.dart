import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:petties_mobile/data/models/diagnosis.dart';
import 'package:petties_mobile/data/services/diagnosis_service.dart';
import 'package:petties_mobile/ui/staff/widgets/ai_diagnosis_panel.dart';

class FakeDiagnosisService extends DiagnosisService {
  FakeDiagnosisService({required this.handler});

  final Future<StaffDiagnosisResponse> Function({
    required DiagnosisImageAnalysisMode imageAnalysisMode,
    required String doctorDescription,
    List<String>? imageUrls,
    SoapDraft? soapDraft,
    String? synthesisMode,
    String? selectedDiagnosisLabel,
  }) handler;

  final List<DiagnosisImageAnalysisMode> modes = [];
  final List<String?> synthesisModes = [];

  @override
  Future<StaffDiagnosisResponse> analyzeCase({
    required DiagnosisSpecies species,
    String? previousRequestId,
    String? petId,
    String? bookingId,
    String? breed,
    int? ageMonths,
    double? weightKg,
    DiagnosisSex? sex,
    List<String>? allergies,
    required String doctorDescription,
    String? bodyPart,
    List<String>? symptoms,
    List<String>? imageUrls,
    DiagnosisImageAnalysisMode imageAnalysisMode =
        DiagnosisImageAnalysisMode.full,
    String? synthesisMode,
    String? selectedDiagnosisCode,
    String? selectedDiagnosisLabel,
    SoapDraft? soapDraft,
  }) async {
    modes.add(imageAnalysisMode);
    synthesisModes.add(synthesisMode);
    return handler(
      imageAnalysisMode: imageAnalysisMode,
      doctorDescription: doctorDescription,
      imageUrls: imageUrls,
      soapDraft: soapDraft,
      synthesisMode: synthesisMode,
      selectedDiagnosisLabel: selectedDiagnosisLabel,
    );
  }
}

StaffDiagnosisResponse _buildResponse({
  List<String> imageDescriptions = const [],
  List<String> visionFindings = const [],
  String diagnosis = 'Viêm kết mạc',
}) {
  return StaffDiagnosisResponse(
    requestId: 'req-1',
    evidenceMode: 'internal_grounded',
    evidenceBanner: 'Chỉ dùng dữ liệu nội bộ',
    scoreLabel: 'Độ tự tin (%)',
    topDifferentials: [
      StaffDiagnosisSuggestion(
        canonicalCode: 'DX-001',
        displayNameVi: diagnosis,
        rank: 1,
        scorePercent: 72,
        scoreBasis: 'normalized',
        confidenceNote: 'Độ tự tin tương đối theo dữ liệu nội bộ',
        supportingReasons: const ['Có dấu hiệu đỏ mắt'],
      ),
    ],
    supportingEvidenceFromKb: const ['Evidence 1'],
    similarConfirmedCases: const ['Case 1'],
    visionFindings: visionFindings,
    imageDescriptions: imageDescriptions,
    imageAnalysis: const [],
    suggestedQuestions: const ['Bé bị bao lâu rồi?'],
    soapSuggestions: SoapSuggestions(
      subjectiveDraft: 'Subjective',
      objectiveDraft: 'Objective',
      assessmentDraft: 'Assessment',
      planDraft: 'Plan',
    ),
    prescriptionSuggestions: const [],
    disclaimer: 'Chỉ dùng tham khảo',
  );
}

Widget _buildTestApp(AiDiagnosisPanel child) {
  return MaterialApp(
    home: Scaffold(body: child),
  );
}

void main() {
  final tinyImage = base64Decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9l9iUAAAAASUVORK5CYII=',
  );

  group('AiDiagnosisPanel Widget', () {
    const analyzeLabel = 'PHÂN TÍCH TÌNH TRẠNG';
    const addImageLabel = '+ Thêm ảnh';

    testWidgets('renders header and analyze button', (tester) async {
      await tester.pumpWidget(
        _buildTestApp(
          const AiDiagnosisPanel(species: 'dog'),
        ),
      );

      expect(find.text(analyzeLabel), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets('picked preview image uses describe_only mode', (tester) async {
      final fakeService = FakeDiagnosisService(
        handler: ({
          required imageAnalysisMode,
          required doctorDescription,
          List<String>? imageUrls,
          SoapDraft? soapDraft,
          String? synthesisMode,
          String? selectedDiagnosisLabel,
        }) async {
          return _buildResponse(
            imageDescriptions: const ['Mô tả ảnh preview'],
          );
        },
      );

      await tester.pumpWidget(
        _buildTestApp(
          AiDiagnosisPanel(
            species: 'dog',
            diagnosisService: fakeService,
            pickImagesOverride: () async => [
              XFile.fromData(
                Uint8List.fromList(tinyImage),
                mimeType: 'image/png',
                name: 'preview.png',
              ),
            ],
          ),
        ),
      );

      await tester.tap(find.text(addImageLabel));
      await tester.pumpAndSettle();

      expect(fakeService.modes.first, DiagnosisImageAnalysisMode.describeOnly);
    });

    testWidgets('full analyze uses full mode and apply callback returns SOAP',
        (tester) async {
      final fakeService = FakeDiagnosisService(
        handler: ({
          required imageAnalysisMode,
          required doctorDescription,
          List<String>? imageUrls,
          SoapDraft? soapDraft,
          String? synthesisMode,
          String? selectedDiagnosisLabel,
        }) async {
          return _buildResponse();
        },
      );
      SoapSuggestions? appliedDraft;

      await tester.pumpWidget(
        _buildTestApp(
          AiDiagnosisPanel(
            species: 'dog',
            diagnosisService: fakeService,
            onApplyDraft: (draft) => appliedDraft = draft,
          ),
        ),
      );

      await tester.enterText(find.byType(TextField).first, 'Bé bị đỏ mắt và chảy ghèn');
      await tester.pump();
      await tester.tap(find.text(analyzeLabel));
      await tester.pumpAndSettle();

      expect(fakeService.modes.last, DiagnosisImageAnalysisMode.full);
      expect(find.textContaining('Viêm kết mạc'), findsOneWidget);

      await tester.ensureVisible(find.textContaining('EMR'));
      await tester.tap(find.textContaining('EMR'));
      await tester.pumpAndSettle();

      expect(appliedDraft, isNotNull);
      expect(appliedDraft!.planDraft, 'Plan');
    });

    testWidgets('shows recoverable error message when analyze fails',
        (tester) async {
      final fakeService = FakeDiagnosisService(
        handler: ({
          required imageAnalysisMode,
          required doctorDescription,
          List<String>? imageUrls,
          SoapDraft? soapDraft,
          String? synthesisMode,
          String? selectedDiagnosisLabel,
        }) async {
          throw DiagnosisException(message: 'Không thể phân tích ca bệnh');
        },
      );

      await tester.pumpWidget(
        _buildTestApp(
          AiDiagnosisPanel(
            species: 'cat',
            diagnosisService: fakeService,
          ),
        ),
      );

      await tester.enterText(find.byType(TextField).first, 'Mèo bỏ ăn');
      await tester.pump();
      await tester.tap(find.text(analyzeLabel));
      await tester.pumpAndSettle();

      expect(find.textContaining('Không thể phân tích ca bệnh'), findsOneWidget);
    });
  });
}
