import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/diagnosis.dart';

void main() {
  group('Diagnosis Models', () {
    group('StaffDiagnosisRequest', () {
      test('toJson with all fields', () {
        final request = StaffDiagnosisRequest(
          petId: 'pet-123',
          bookingId: 'booking-456',
          species: DiagnosisSpecies.dog,
          breed: 'Golden Retriever',
          ageMonths: 24,
          weightKg: 30.5,
          sex: DiagnosisSex.male,
          allergies: ['Chicken', 'Beef'],
          doctorDescription: 'Dog has red eyes and discharge',
          bodyPart: 'eyes',
          symptoms: ['redness', 'discharge', 'squinting'],
          imageUrls: ['https://example.com/img1.jpg'],
          soapDraft: SoapDraft(
            subjective: 'Owner reports eye discharge',
            objective: 'Conjunctival redness',
            assessment: 'Conjunctivitis',
            plan: 'Antibiotic eye drops',
          ),
        );

        final json = request.toJson();

        expect(json['pet_id'], 'pet-123');
        expect(json['booking_id'], 'booking-456');
        expect(json['species'], 'dog');
        expect(json['breed'], 'Golden Retriever');
        expect(json['age_months'], 24);
        expect(json['weight_kg'], 30.5);
        expect(json['sex'], 'male');
        expect(json['allergies'], ['Chicken', 'Beef']);
        expect(json['doctor_description'], 'Dog has red eyes and discharge');
        expect(json['body_part'], 'eyes');
        expect(json['symptoms'], ['redness', 'discharge', 'squinting']);
        expect(json['image_urls'], ['https://example.com/img1.jpg']);
        expect(json['soap_draft'], isNotNull);
        expect(json['soap_draft']['subjective'], 'Owner reports eye discharge');
        expect(json['soap_draft']['assessment'], 'Conjunctivitis');
      });

      test('toJson with minimal fields', () {
        final request = StaffDiagnosisRequest(
          species: DiagnosisSpecies.cat,
          doctorDescription: 'Cat not eating',
        );

        final json = request.toJson();

        expect(json['species'], 'cat');
        expect(json['doctor_description'], 'Cat not eating');
        expect(json['pet_id'], isNull);
        expect(json['booking_id'], isNull);
        expect(json['breed'], isNull);
      });

      test('toJson handles null soapDraft', () {
        final request = StaffDiagnosisRequest(
          species: DiagnosisSpecies.other,
          doctorDescription: 'Test description',
          soapDraft: null,
        );

        final json = request.toJson();

        expect(json.containsKey('soap_draft'), isFalse);
      });
    });

    group('SoapDraft', () {
      test('toJson with all fields', () {
        final draft = SoapDraft(
          subjective: 'Subjective note',
          objective: 'Objective finding',
          assessment: 'Assessment diagnosis',
          plan: 'Treatment plan',
        );

        final json = draft.toJson();

        expect(json['subjective'], 'Subjective note');
        expect(json['objective'], 'Objective finding');
        expect(json['assessment'], 'Assessment diagnosis');
        expect(json['plan'], 'Treatment plan');
      });

      test('toJson with null fields', () {
        final draft = SoapDraft();

        final json = draft.toJson();

        expect(json['subjective'], isNull);
        expect(json['objective'], isNull);
        expect(json['assessment'], isNull);
        expect(json['plan'], isNull);
      });
    });

    group('StaffDiagnosisSuggestion', () {
      test('fromJson with all fields', () {
        final json = {
          'canonical_code': 'C001',
          'display_name_vi': 'Viêm kết mạc',
          'confidence_note': 'Khả năng cao (85%)',
          'supporting_reasons': ['Đỏ mắt', 'Tiết dịch'],
        };

        final suggestion = StaffDiagnosisSuggestion.fromJson(json);

        expect(suggestion.canonicalCode, 'C001');
        expect(suggestion.displayNameVi, 'Viêm kết mạc');
        expect(suggestion.confidenceNote, 'Khả năng cao (85%)');
        expect(suggestion.supportingReasons, ['Đỏ mắt', 'Tiết dịch']);
      });

      test('fromJson with null optional fields', () {
        final json = {
          'display_name_vi': 'Dị ứng',
          'confidence_note': 'Trung bình (50%)',
        };

        final suggestion = StaffDiagnosisSuggestion.fromJson(json);

        expect(suggestion.canonicalCode, isNull);
        expect(suggestion.displayNameVi, 'Dị ứng');
        expect(suggestion.supportingReasons, isEmpty);
      });
    });

    group('StaffDiagnosisPrescriptionSuggestion', () {
      test('fromJson with all fields', () {
        final json = {
          'medicine_name': 'Amoxicillin 500mg',
          'dosage': '1 viên',
          'frequency': '2 lần/ngày',
          'duration_days': 7,
          'instructions': 'Uống sau ăn',
          'caution': 'Không dùng cho mèo',
        };

        final prescription = StaffDiagnosisPrescriptionSuggestion.fromJson(json);

        expect(prescription.medicineName, 'Amoxicillin 500mg');
        expect(prescription.dosage, '1 viên');
        expect(prescription.frequency, '2 lần/ngày');
        expect(prescription.durationDays, 7);
        expect(prescription.instructions, 'Uống sau ăn');
        expect(prescription.caution, 'Không dùng cho mèo');
      });

      test('fromJson with null optional fields', () {
        final json = {
          'medicine_name': 'Vitamin B complex',
          'dosage': '1 viên',
          'frequency': '1 lần/ngày',
        };

        final prescription = StaffDiagnosisPrescriptionSuggestion.fromJson(json);

        expect(prescription.medicineName, 'Vitamin B complex');
        expect(prescription.durationDays, isNull);
        expect(prescription.caution, isNull);
      });
    });

    group('ImageAnalysisResult', () {
      test('fromJson', () {
        final json = {
          'url': 'https://example.com/img.jpg',
          'description': 'Mắt đỏ có dịch',
          'order': 1,
        };

        final result = ImageAnalysisResult.fromJson(json);

        expect(result.url, 'https://example.com/img.jpg');
        expect(result.description, 'Mắt đỏ có dịch');
        expect(result.order, 1);
      });
    });

    group('SoapSuggestions', () {
      test('fromJson with all fields', () {
        final json = {
          'subjective_draft': 'Subjective from AI',
          'objective_draft': 'Objective from AI',
          'assessment_draft': 'Assessment from AI',
          'plan_draft': 'Plan from AI',
        };

        final suggestions = SoapSuggestions.fromJson(json);

        expect(suggestions.subjectiveDraft, 'Subjective from AI');
        expect(suggestions.objectiveDraft, 'Objective from AI');
        expect(suggestions.assessmentDraft, 'Assessment from AI');
        expect(suggestions.planDraft, 'Plan from AI');
      });

      test('fromJson with null fields', () {
        final json = <String, dynamic>{};

        final suggestions = SoapSuggestions.fromJson(json);

        expect(suggestions.subjectiveDraft, isEmpty);
        expect(suggestions.objectiveDraft, isEmpty);
        expect(suggestions.assessmentDraft, isEmpty);
        expect(suggestions.planDraft, isEmpty);
      });
    });

    group('StaffDiagnosisResponse', () {
      test('fromJson with full response', () {
        final json = {
          'request_id': 'req-123',
          'top_differentials': [
            {
              'display_name_vi': 'Viêm kết mạc',
              'confidence_note': '85%',
              'supporting_reasons': ['Đỏ mắt'],
            },
            {
              'display_name_vi': 'Dị ứng mắt',
              'confidence_note': '60%',
              'supporting_reasons': [],
            },
          ],
          'supporting_evidence_from_kb': ['Evidence 1'],
          'similar_confirmed_cases': ['Case 1'],
          'vision_findings': ['Mắt đỏ', 'Dịch tiết'],
          'image_descriptions': ['Mắt trái đỏ'],
          'image_analysis': [
            {'url': 'https://example.com/1.jpg', 'description': 'Test', 'order': 1}
          ],
          'suggested_questions': ['Bé có sốt không?'],
          'soap_suggestions': {
            'subjective_draft': 'Subjective',
            'objective_draft': 'Objective',
            'assessment_draft': 'Assessment',
            'plan_draft': 'Plan',
          },
          'prescription_suggestions': [
            {
              'medicine_name': 'Tobramycin',
              'dosage': '1 giọt',
              'frequency': '3 lần/ngày',
              'duration_days': 7,
              'instructions': 'Nhỏ mắt',
            },
          ],
          'disclaimer': 'Chỉ dùng tham khảo',
        };

        final response = StaffDiagnosisResponse.fromJson(json);

        expect(response.requestId, 'req-123');
        expect(response.topDifferentials, hasLength(2));
        expect(response.topDifferentials[0].displayNameVi, 'Viêm kết mạc');
        expect(response.visionFindings, hasLength(2));
        expect(response.visionFindings[0], 'Mắt đỏ');
        expect(response.soapSuggestions.assessmentDraft, 'Assessment');
        expect(response.prescriptionSuggestions, hasLength(1));
        expect(response.prescriptionSuggestions[0].medicineName, 'Tobramycin');
        expect(response.disclaimer, 'Chỉ dùng tham khảo');
      });

      test('fromJson with minimal response', () {
        final json = {
          'request_id': 'req-456',
          'top_differentials': [],
          'supporting_evidence_from_kb': [],
          'similar_confirmed_cases': [],
          'vision_findings': [],
          'image_descriptions': [],
          'image_analysis': [],
          'suggested_questions': [],
          'soap_suggestions': null,
          'prescription_suggestions': [],
          'disclaimer': '',
        };

        final response = StaffDiagnosisResponse.fromJson(json);

        expect(response.requestId, 'req-456');
        expect(response.topDifferentials, isEmpty);
        expect(response.visionFindings, isEmpty);
        expect(response.soapSuggestions.subjectiveDraft, isEmpty);
        expect(response.prescriptionSuggestions, isEmpty);
      });
    });

    group('DiagnosisSpecies enum', () {
      test('enum values', () {
        expect(DiagnosisSpecies.values, contains(DiagnosisSpecies.dog));
        expect(DiagnosisSpecies.values, contains(DiagnosisSpecies.cat));
        expect(DiagnosisSpecies.values, contains(DiagnosisSpecies.other));
      });
    });

    group('DiagnosisSex enum', () {
      test('enum values', () {
        expect(DiagnosisSex.values, contains(DiagnosisSex.male));
        expect(DiagnosisSex.values, contains(DiagnosisSex.female));
        expect(DiagnosisSex.values, contains(DiagnosisSex.unknown));
      });
    });
  });
}
