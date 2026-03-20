from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api.schemas.diagnosis_contracts import DiagnosisSuggestion, Species, StaffDiagnosisRequest
from app.core.services.diagnosis_protocol_service import DiagnosisProtocolService


class DiagnosisProtocolServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = DiagnosisProtocolService()

    def test_ocular_protocol_blocks_antibiotic_drop_when_ulcer_risk_is_present(self):
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Bé chó đỏ mắt, nheo mắt và nghi loét giác mạc.",
        )
        primary = DiagnosisSuggestion(
            canonical_code="ocular_infection",
            display_name_vi="Viêm kết mạc hoặc nhiễm trùng mắt",
        )

        decision = self.service.build_decision(request=request, primary_diagnosis=primary)

        self.assertTrue(decision.protocol_applied)
        self.assertEqual(len(decision.prescriptions), 1)
        self.assertIn("loét giác mạc", " ".join(decision.cautions).lower())
        self.assertTrue(any("fluorescein" in item.lower() for item in decision.missing_inputs))

    def test_bacterial_dermatosis_protocol_requires_weight_for_systemic_dose(self):
        request = StaffDiagnosisRequest(
            species=Species.CAT,
            doctor_description="Da đỏ, nghi viêm da do vi khuẩn.",
        )
        primary = DiagnosisSuggestion(
            canonical_code="bacterial_dermatosis",
            display_name_vi="Viêm da do vi khuẩn",
        )

        decision = self.service.build_decision(request=request, primary_diagnosis=primary)

        self.assertTrue(decision.protocol_applied)
        self.assertIn("cân nặng", decision.missing_inputs)
        self.assertEqual(len(decision.prescriptions), 1)
        self.assertIn("thiếu dữ liệu", decision.summary.lower())


if __name__ == "__main__":
    unittest.main()
