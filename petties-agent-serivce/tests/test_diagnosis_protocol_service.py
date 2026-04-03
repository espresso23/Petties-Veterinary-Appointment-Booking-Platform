from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.ai_diagnose.diagnosis_protocol_service import DiagnosisProtocolService
from app.ai_diagnose.schemas import DiagnosisSuggestion, Species, StaffDiagnosisRequest


class DiagnosisProtocolServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = DiagnosisProtocolService()

    def test_build_decision_keeps_generic_safety_for_ocular_case(self):
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Bé chó đỏ mắt, nheo mắt và nghi loét giác mạc.",
        )
        primary = DiagnosisSuggestion(
            canonical_code="ocular_infection",
            display_name_vi="Viêm kết mạc hoặc nhiễm trùng mắt",
        )

        decision = self.service.build_decision(
            request=request, primary_diagnosis=primary
        )

        self.assertTrue(decision.protocol_applied)
        self.assertEqual(decision.prescriptions, [])
        self.assertEqual(decision.cautions, [])
        self.assertIn("cân nặng", decision.missing_inputs)
        self.assertIn("định hướng an toàn", decision.summary.lower())

    def test_bacterial_dermatosis_protocol_requires_weight_for_systemic_dose(self):
        request = StaffDiagnosisRequest(
            species=Species.CAT,
            doctor_description="Da đỏ, nghi viêm da do vi khuẩn.",
        )
        primary = DiagnosisSuggestion(
            canonical_code="bacterial_dermatosis",
            display_name_vi="Viêm da do vi khuẩn",
        )

        decision = self.service.build_decision(
            request=request, primary_diagnosis=primary
        )

        self.assertTrue(decision.protocol_applied)
        self.assertIn("cân nặng", decision.missing_inputs)
        self.assertEqual(decision.prescriptions, [])
        self.assertIn("thiếu dữ liệu", decision.summary.lower())

    def test_apply_emr_patterns_prioritizes_higher_support_signal(self):
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Da do va co ton thuong dang mu",
            weight_kg=10.0,
        )
        primary = DiagnosisSuggestion(
            canonical_code="bacterial_dermatosis",
            display_name_vi="Viêm da do vi khuẩn",
        )

        decision = self.service.build_decision(
            request=request, primary_diagnosis=primary
        )

        patterns = [
            {
                "case_id": "emr:low-quality",
                "score": 0.95,
                "species": "dog",
                "canonical_code": "bacterial_dermatosis",
                "diagnosis_support_count": 1,
                "pattern_support_score": 1.0,
                "common_prescriptions": [
                    {
                        "medicine": "Thuoc A",
                        "dosage": "10 mg",
                        "frequency": "2 lan/ngay",
                        "duration": 7,
                    }
                ],
                "common_tests": [{"test": "Cytology da"}],
                "common_recommendations": ["Làm sạch vùng da tổn thương"],
            },
            {
                "case_id": "emr:high-quality",
                "score": 0.75,
                "species": "dog",
                "canonical_code": "bacterial_dermatosis",
                "diagnosis_support_count": 8,
                "pattern_support_score": 8.0,
                "common_prescriptions": [
                    {
                        "medicine": "Thuoc B",
                        "dosage": "12 mg",
                        "frequency": "2 lan/ngay",
                        "duration": 7,
                    }
                ],
                "common_tests": [{"test": "Cytology da"}, {"test": "Nhuộm soi"}],
                "common_recommendations": [
                    "Làm sạch vùng da tổn thương",
                    "Đánh giá lại sau 48-72 giờ",
                ],
            },
        ]

        merged = self.service.apply_emr_patterns(
            protocol_decision=decision,
            emr_patterns=patterns,
            request=request,
        )

        self.assertGreaterEqual(len(merged.prescriptions), 1)
        self.assertEqual(merged.prescriptions[0].medicine_name, "Thuoc B")
        self.assertEqual(merged.prescriptions[0].duration_days, 7)
        self.assertIn("Cytology da", merged.recommended_tests)
        self.assertIn("Làm sạch vùng da tổn thương", merged.recommended_actions)


if __name__ == "__main__":
    unittest.main()
