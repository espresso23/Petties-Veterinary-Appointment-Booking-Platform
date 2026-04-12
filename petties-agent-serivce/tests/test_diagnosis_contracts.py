from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.ai_diagnose.schemas import (
    GeminiVisionDiagnosisRequest,
    GeminiVisionDiagnosisResponse,
    Species,
    StaffDiagnosisRequest,
)


class DiagnosisContractsTests(unittest.TestCase):
    def test_gemini_request_defaults(self):
        req = GeminiVisionDiagnosisRequest(
            request_id="r1",
            species=Species.DOG,
            image_urls=["https://example.com/pet.jpg"],
            doctor_description="Tổn thương da vùng lưng",
        )
        self.assertEqual(req.species, Species.DOG)
        self.assertEqual(req.clinical_context.symptoms, [])

    def test_staff_request_accepts_protocol_inputs(self):
        req = StaffDiagnosisRequest(
            species=Species.CAT,
            doctor_description="Bé mèo ngứa nhiều",
            weight_kg=3.8,
            allergies=["gà", "penicillin"],
        )
        self.assertEqual(req.weight_kg, 3.8)
        self.assertEqual(req.allergies, ["gà", "penicillin"])

    def test_gemini_response_accepts_top_conditions_and_image_descriptions(self):
        resp = GeminiVisionDiagnosisResponse(
            request_id="r1",
            visual_findings=["Đỏ da, có bong vảy"],
            image_descriptions=["Ảnh 1: da đỏ, có bong vảy nhẹ quanh vùng tổn thương."],
            top_conditions=[
                {
                    "raw_label": "bacterial dermatitis",
                    "confidence_score": 0.77,
                    "reason": "Tổn thương da đỏ, gợi ý viêm da do vi khuẩn.",
                }
            ],
        )
        self.assertEqual(resp.request_id, "r1")
        self.assertEqual(len(resp.top_conditions), 1)
        self.assertEqual(
            resp.image_descriptions[0],
            "Ảnh 1: da đỏ, có bong vảy nhẹ quanh vùng tổn thương.",
        )


if __name__ == "__main__":
    unittest.main()
