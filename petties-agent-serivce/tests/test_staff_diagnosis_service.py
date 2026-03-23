from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.api.schemas.diagnosis_contracts import (
    GeminiVisionDiagnosisResponse,
    Species,
    StaffDiagnosisRequest,
)
from app.core.rag.case_memory import CaseResult
from app.core.rag.hybrid_engine import HybridChunk, HybridResult
from app.core.services.staff_diagnosis_service import StaffDiagnosisService


class StaffDiagnosisServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_analyze_case_uses_internal_retrieval_and_protocol_prescriptions(
        self,
    ):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            weight_kg=12.5,
            doctor_description="Bé chó đỏ mắt, nhiều ghèn và dụi mắt liên tục.",
        )

        mock_hybrid_engine = Mock()
        mock_hybrid_engine.query = AsyncMock(
            return_value=HybridResult(
                chunks=[
                    HybridChunk(
                        content="Viêm kết mạc ở chó thường biểu hiện đỏ mắt, ghèn mắt và khó chịu vùng mắt.",
                        score=0.84,
                        source="rag",
                        metadata={"document_name": "Cẩm nang bệnh mắt"},
                    )
                ],
                expanded_query="dog | đỏ mắt ghèn mắt",
                original_query="dog | đỏ mắt ghèn mắt",
                sources_used={"rag": 1, "kg": 0},
            )
        )

        mock_case_memory = Mock()
        mock_case_memory.search_similar = AsyncMock(
            return_value=[
                CaseResult(
                    case_id="emr:1",
                    content="Ca chó đỏ mắt có ghèn, bác sĩ xác nhận viêm kết mạc.",
                    score=0.82,
                    final_score=0.93,
                    payload={
                        "species": "dog",
                        "display_name_vi": "Viêm kết mạc hoặc nhiễm trùng mắt",
                        "final_diagnosis_text": "Viêm kết mạc",
                        "canonical_code": "ocular_infection",
                        "chief_complaint": "Đỏ mắt, nhiều ghèn mắt",
                        "exam_at": "2026-03-16T08:30:00Z",
                    },
                )
            ]
        )

        with (
            patch(
                "app.core.services.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.core.services.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await service.analyze_case(request)

        mock_hybrid_engine.query.assert_awaited_once()
        mock_case_memory.search_similar.assert_awaited_once()
        self.assertTrue(response.request_id)
        self.assertTrue(response.supporting_evidence_from_kb)
        self.assertIn("Cẩm nang bệnh mắt", response.supporting_evidence_from_kb[0])
        self.assertTrue(response.similar_confirmed_cases)
        self.assertIn("Viêm kết mạc", response.similar_confirmed_cases[0])
        self.assertGreaterEqual(len(response.top_differentials), 1)
        self.assertIn("mắt", response.top_differentials[0].display_name_vi.lower())
        self.assertGreaterEqual(len(response.prescription_suggestions), 1)
        self.assertEqual(
            response.prescription_suggestions[0].medicine_name,
            "Dung dịch rửa mắt vô khuẩn",
        )
        self.assertIn("viêm", response.soap_suggestions.assessment_draft.lower())
        self.assertNotIn(
            "chẩn đoán phân biệt", response.soap_suggestions.assessment_draft.lower()
        )

    async def test_analyze_case_reports_missing_internal_information_when_retrieval_empty(
        self,
    ):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.CAT,
            doctor_description="Bé mèo có tổn thương lạ nhưng chưa rõ nhóm bệnh.",
        )

        mock_hybrid_engine = Mock()
        mock_hybrid_engine.query = AsyncMock(
            return_value=HybridResult(
                chunks=[],
                expanded_query="cat",
                original_query="cat",
                sources_used={"rag": 0, "kg": 0},
            )
        )

        mock_case_memory = Mock()
        mock_case_memory.search_similar = AsyncMock(return_value=[])
        with (
            patch(
                "app.core.services.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.core.services.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await service.analyze_case(request)

        self.assertEqual(
            response.supporting_evidence_from_kb,
            [
                "Không tìm thấy thông tin phù hợp trong kho tri thức nội bộ cho ca bệnh này."
            ],
        )
        self.assertEqual(
            response.similar_confirmed_cases,
            [
                "Không tìm thấy ca EMR xác nhận đủ gần để đối chiếu cho tình huống hiện tại."
            ],
        )
        self.assertEqual(response.prescription_suggestions, [])

    async def test_analyze_case_with_images_returns_image_analysis(self):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            weight_kg=10.0,
            doctor_description="Cho cho bi an kin, co ghen vang mat trai.",
            image_urls=[
                "https://example.com/img1.jpg",
                "https://example.com/img2.jpg",
            ],
        )

        mock_hybrid_engine = Mock()
        mock_hybrid_engine.query = AsyncMock(
            return_value=HybridResult(
                chunks=[
                    HybridChunk(
                        content="Mat trai co ghen vang la dau hieu viem ket mac.",
                        score=0.85,
                        source="rag",
                        metadata={"document_name": "Cam nang mat"},
                    )
                ],
                expanded_query="dog",
                original_query="dog",
                sources_used={"rag": 1, "kg": 0},
            )
        )

        mock_case_memory = Mock()
        mock_case_memory.search_similar = AsyncMock(return_value=[])

        with (
            patch(
                "app.core.services.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.core.services.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.core.services.staff_diagnosis_service.get_gemini_vision_adapter"
            ) as mock_vision,
        ):
            mock_vision.return_value.analyze = AsyncMock(
                return_value=GeminiVisionDiagnosisResponse(
                    request_id="test-123",
                    visual_findings=["Ghen vang o mat trai, co dau hieu sung nhe."],
                    image_descriptions=[
                        "Mat trai co ghen vang dac, duoi mat trai sung nhẹ.",
                        "Mat phai binh thuong, khong co dau hieu bat thuong.",
                    ],
                    top_conditions=[],
                )
            )
            response = await service.analyze_case(request)

        mock_vision.return_value.analyze.assert_awaited_once()
        self.assertIsNotNone(response.image_analysis)
        self.assertEqual(len(response.image_analysis), 2)
        self.assertEqual(
            response.image_analysis[0]["url"], "https://example.com/img1.jpg"
        )
        self.assertEqual(
            response.image_analysis[0]["description"],
            "Mat trai co ghen vang dac, duoi mat trai sung nhẹ.",
        )
        self.assertEqual(response.image_analysis[0]["order"], 1)
        self.assertEqual(response.image_analysis[1]["order"], 2)
        self.assertEqual(
            response.vision_findings, ["Ghen vang o mat trai, co dau hieu sung nhe."]
        )

    async def test_analyze_case_soap_suggestions_are_ready_to_apply(self):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            weight_kg=12.5,
            allergies=["penicillin"],
            doctor_description="Mat trai do, ghen vang, dui mat.",
        )

        mock_hybrid_engine = Mock()
        mock_hybrid_engine.query = AsyncMock(
            return_value=HybridResult(
                chunks=[
                    HybridChunk(
                        content="Mat trai co ghen vang la viem ket mac.",
                        score=0.85,
                        source="rag",
                        metadata={"document_name": "Cam nang mat"},
                    )
                ],
                expanded_query="dog",
                original_query="dog",
                sources_used={"rag": 1, "kg": 0},
            )
        )
        mock_case_memory = Mock()
        mock_case_memory.search_similar = AsyncMock(return_value=[])

        with (
            patch(
                "app.core.services.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.core.services.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await service.analyze_case(request)

        self.assertNotIn(
            "chưa ghi nhận", response.soap_suggestions.subjective_draft.lower()
        )
        self.assertNotIn(
            "chẩn đoán phân biệt", response.soap_suggestions.assessment_draft.lower()
        )
        self.assertNotIn("protocol", response.soap_suggestions.assessment_draft.lower())
        self.assertIn("viêm", response.soap_suggestions.assessment_draft.lower())
        if response.soap_suggestions.plan_draft:
            lines = response.soap_suggestions.plan_draft.split("\n")
            self.assertTrue(len(lines) >= 1)
            for line in lines:
                if line.strip() and line[0].isdigit():
                    self.assertIn(".", line)

    async def test_analyze_case_without_images_returns_empty_image_analysis(self):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Cho cho bi an kin.",
            image_urls=[],
        )

        mock_hybrid_engine = Mock()
        mock_hybrid_engine.query = AsyncMock(
            return_value=HybridResult(
                chunks=[],
                expanded_query="dog",
                original_query="dog",
                sources_used={},
            )
        )
        mock_case_memory = Mock()
        mock_case_memory.search_similar = AsyncMock(return_value=[])

        with (
            patch(
                "app.core.services.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.core.services.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await service.analyze_case(request)

        self.assertEqual(response.image_analysis, [])
        self.assertEqual(response.vision_findings, [])

    async def test_fallback_no_keyword_heuristic_for_ear(self):
        """_fallback_differentials must NOT return ear-specific diagnosis based on keyword 'tai'."""
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Bé gãi tai liên tục, tai có mùi hôi.",  # contains "tai" keyword
        )

        mock_hybrid_engine = Mock()
        mock_hybrid_engine.query = AsyncMock(
            return_value=HybridResult(
                chunks=[],
                expanded_query="dog",
                original_query="dog",
                sources_used={},
            )
        )
        mock_case_memory = Mock()
        mock_case_memory.search_similar = AsyncMock(return_value=[])

        with (
            patch(
                "app.core.services.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.core.services.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await service.analyze_case(request)

        # Fallback must be generic only — no ear-specific disease name
        self.assertEqual(len(response.top_differentials), 1)
        diff = response.top_differentials[0]
        self.assertIsNone(diff.canonical_code)
        self.assertNotIn("tai", diff.display_name_vi.lower())
        self.assertEqual(diff.confidence_note, "Mức gợi ý: thấp")

    async def test_fallback_no_keyword_heuristic_for_eye(self):
        """_fallback_differentials must NOT return eye-specific diagnosis based on keyword 'mắt'."""
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.CAT,
            doctor_description="Bé chảy ghèn mắt, đỏ mắt hôm qua.",  # contains "mắt", "ghèn"
        )

        mock_hybrid_engine = Mock()
        mock_hybrid_engine.query = AsyncMock(
            return_value=HybridResult(
                chunks=[],
                expanded_query="cat",
                original_query="cat",
                sources_used={},
            )
        )
        mock_case_memory = Mock()
        mock_case_memory.search_similar = AsyncMock(return_value=[])

        with (
            patch(
                "app.core.services.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.core.services.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await service.analyze_case(request)

        # Must be generic fallback — NO "mắt" or "kết mạc" in differential name
        self.assertEqual(len(response.top_differentials), 1)
        diff = response.top_differentials[0]
        self.assertIsNone(diff.canonical_code)
        self.assertNotIn("mắt", diff.display_name_vi.lower())
        self.assertNotIn("kết mạc", diff.display_name_vi.lower())
        self.assertEqual(diff.confidence_note, "Mức gợi ý: thấp")


if __name__ == "__main__":
    unittest.main()

