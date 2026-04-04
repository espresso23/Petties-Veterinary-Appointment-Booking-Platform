from pathlib import Path
import sys
import unittest
from unittest.mock import AsyncMock, Mock, patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.ai_diagnose.schemas import (
    DiagnosisSuggestion,
    GeminiVisionDiagnosisResponse,
    SoapDraft,
    Species,
    StaffDiagnosisRequest,
)
from app.core.rag.case_memory import CaseResult
from app.core.rag.hybrid_engine import HybridChunk, HybridResult
from app.ai_diagnose.staff_diagnosis_service import (
    CachedAnalysisContext,
    StaffDiagnosisService,
)
from app.ai_diagnose.diagnosis_protocol_service import ProtocolDecision
from app.ai_diagnose.schemas import PrescriptionSuggestion
from datetime import datetime


class StaffDiagnosisServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_selected_only_reuses_cached_context_and_keeps_emr_pattern_prescriptions(
        self,
    ):
        service = StaffDiagnosisService()
        previous_request_id = "req-first"

        cached_top = [
            DiagnosisSuggestion(
                canonical_code="pyoderma",
                display_name_vi="Viêm da do vi khuẩn (Pyoderma)",
                rank=1,
                score_percent=38,
                score_basis="matching_internal",
                confidence_note="Độ tự tin: 38%",
                supporting_reasons=["Khớp mô tả tổn thương da mủ."],
            )
        ]
        cached_hybrid = HybridResult(
            chunks=[
                HybridChunk(
                    content="Pyoderma thường có tổn thương da mủ và viêm đỏ.",
                    score=0.8,
                    source="rag",
                    metadata={"document_name": "Cẩm nang da liễu"},
                )
            ],
            expanded_query="dog pyoderma",
            original_query="dog pyoderma",
            sources_used={"rag": 1, "kg": 0},
        )

        service._analysis_cache[previous_request_id] = CachedAnalysisContext(
            created_at=datetime.utcnow(),
            evidence_mode="internal_grounded",
            evidence_banner="Đã đối chiếu dữ liệu nội bộ",
            score_label="Độ tự tin (%)",
            top_differentials=cached_top,
            hybrid_result=cached_hybrid,
            similar_cases=[],
            vision_response=GeminiVisionDiagnosisResponse(
                request_id=previous_request_id
            ),
            image_analysis=[],
        )

        request = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Da đỏ, có mủ",
            synthesis_mode="selected_only",
            previous_request_id=previous_request_id,
            selected_diagnosis_code="pyoderma",
        )

        protocol_service = Mock()
        protocol_service.build_decision.return_value = ProtocolDecision(
            diagnosis_code="pyoderma",
            diagnosis_display_name="Viêm da do vi khuẩn (Pyoderma)",
            summary="Protocol co san",
            prescriptions=[
                PrescriptionSuggestion(
                    medicine_name="Cephalexin",
                    dosage="22 mg/kg",
                    frequency="BID",
                    duration_days=14,
                    instructions="Uong sau an",
                )
            ],
        )
        protocol_service.apply_emr_patterns.side_effect = (
            lambda protocol_decision, emr_patterns, request: protocol_decision
        )

        with (
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_diagnosis_protocol_service",
                return_value=protocol_service,
            ),
            patch.object(
                service,
                "_synthesize_with_llm",
                new=AsyncMock(
                    return_value={
                        "soap_suggestions": {
                            "subjective_draft": "Theo dõi ngứa và mức độ liếm gãi.",
                            "objective_draft": "Quan sát tổn thương da mủ lan tỏa.",
                            "assessment_draft": "Nghi viêm da do vi khuẩn.",
                            "plan_draft": "Theo dõi đáp ứng điều trị trong 3 ngày đầu.",
                        },
                        "safety_suggestions": {
                            "missing_inputs": ["cytology da"],
                            "cautions": ["Theo dõi đáp ứng và tái khám nếu nặng lên."],
                        },
                    }
                ),
            ) as mock_llm,
        ):
            response = await service.analyze_case(request)

        mock_llm.assert_awaited_once()

        self.assertEqual(response.evidence_mode, "internal_grounded")
        self.assertEqual(response.top_differentials[0].canonical_code, "pyoderma")
        self.assertIn("pyoderma", response.soap_suggestions.assessment_draft.lower())
        self.assertIn("selected_only", response.disclaimer)
        self.assertEqual(len(response.prescription_suggestions), 1)
        self.assertEqual(
            response.prescription_suggestions[0].medicine_name,
            "Cephalexin",
        )

    async def test_selected_only_falls_back_to_llm_prescriptions_when_protocol_empty(
        self,
    ):
        service = StaffDiagnosisService()
        previous_request_id = "req-selected-only-fallback"

        cached_top = [
            DiagnosisSuggestion(
                canonical_code="pyoderma",
                display_name_vi="Viêm da do vi khuẩn (Pyoderma)",
                rank=1,
                score_percent=64,
                score_basis="matching_internal",
                confidence_note="Độ tự tin: 64%",
                supporting_reasons=["Khớp tổn thương da mủ và viêm đỏ."],
            )
        ]
        cached_hybrid = HybridResult(
            chunks=[
                HybridChunk(
                    content="Pyoderma ở chó có thể cần kháng sinh và sát khuẩn tại chỗ.",
                    score=0.78,
                    source="rag",
                    metadata={"document_name": "Cẩm nang da liễu"},
                )
            ],
            expanded_query="dog pyoderma",
            original_query="dog pyoderma",
            sources_used={"rag": 1, "kg": 0},
        )

        service._analysis_cache[previous_request_id] = CachedAnalysisContext(
            created_at=datetime.utcnow(),
            evidence_mode="internal_grounded",
            evidence_banner="Đã đối chiếu dữ liệu nội bộ",
            score_label="Độ tự tin (%)",
            top_differentials=cached_top,
            hybrid_result=cached_hybrid,
            similar_cases=[],
            vision_response=GeminiVisionDiagnosisResponse(
                request_id=previous_request_id
            ),
            image_analysis=[],
        )

        request = StaffDiagnosisRequest(
            species=Species.DOG,
            weight_kg=12.0,
            doctor_description="Da đỏ, có mủ, ngứa nhiều",
            synthesis_mode="selected_only",
            previous_request_id=previous_request_id,
            selected_diagnosis_code="pyoderma",
        )

        protocol_service = Mock()
        protocol_service.build_decision.return_value = ProtocolDecision(
            diagnosis_code="pyoderma",
            diagnosis_display_name="Viêm da do vi khuẩn (Pyoderma)",
            summary="Protocol chua co don thuoc chi tiet",
            prescriptions=[],
        )
        protocol_service.apply_emr_patterns.side_effect = (
            lambda protocol_decision, emr_patterns, request: protocol_decision
        )

        with (
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_diagnosis_protocol_service",
                return_value=protocol_service,
            ),
            patch.object(
                service,
                "_synthesize_with_llm",
                new=AsyncMock(
                    return_value={
                        "prescription_suggestions": [
                            PrescriptionSuggestion(
                                medicine_name="Chlorhexidine shampoo",
                                dosage="Tắm 2 lần/tuần",
                                frequency="2 lần/tuần",
                                duration_days=14,
                                instructions="Tắm ngoài da và theo dõi đáp ứng.",
                                caution="Cần bác sĩ xác nhận trước khi kê đơn",
                                source="llm_fallback",
                            )
                        ]
                    }
                ),
            ) as mock_llm,
        ):
            response = await service.analyze_case(request)

        mock_llm.assert_awaited_once()
        self.assertEqual(len(response.prescription_suggestions), 1)
        self.assertEqual(
            response.prescription_suggestions[0].medicine_name,
            "Chlorhexidine shampoo",
        )
        self.assertIn("gợi ý từ ai", response.disclaimer.lower())

    def test_select_diagnosis_prefers_doctor_selected_code(self):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Đỏ mắt, ghèn vàng",
            selected_diagnosis_code="otitis_or_ear_parasites",
        )
        top_differentials = [
            DiagnosisSuggestion(
                canonical_code="ocular_infection",
                display_name_vi="Viêm kết mạc hoặc nhiễm trùng mắt",
                rank=1,
                score_percent=62,
                score_basis="matching_internal",
                confidence_note="Độ tự tin: 62%",
            ),
            DiagnosisSuggestion(
                canonical_code="otitis_or_ear_parasites",
                display_name_vi="Viêm tai ngoài hoặc ký sinh trùng tai",
                rank=2,
                score_percent=38,
                score_basis="matching_internal",
                confidence_note="Độ tự tin: 38%",
            ),
        ]

        selected = service._resolve_selected_diagnosis(
            request=request,
            top_differentials=top_differentials,
        )

        self.assertIsNotNone(selected)
        self.assertEqual(selected.canonical_code, "otitis_or_ear_parasites")

    def test_normalize_percentages_always_sum_to_100(self):
        service = StaffDiagnosisService()
        result = service._normalize_percentages([0.81, 0.26, 0.12])

        self.assertEqual(len(result), 3)
        self.assertEqual(sum(result), 100)

    def test_merge_top_differentials_with_fallback_keeps_three_candidates(self):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Da đỏ, ngứa, rụng lông",
        )
        preferred = [
            DiagnosisSuggestion(
                canonical_code="bacterial_dermatosis",
                display_name_vi="Viêm da do vi khuẩn",
                rank=1,
                score_percent=100,
                score_basis="matching_internal",
                confidence_note="Độ tự tin: 100%",
                supporting_reasons=["Khớp với tổn thương da mủ."],
            )
        ]
        fallback = [
            DiagnosisSuggestion(
                canonical_code="bacterial_dermatosis",
                display_name_vi="Viêm da do vi khuẩn",
                rank=1,
                score_percent=58,
                score_basis="matching_internal",
                confidence_note="Độ tự tin: 58%",
                supporting_reasons=["Khớp dữ liệu nội bộ."],
            ),
            DiagnosisSuggestion(
                canonical_code="dermatosis_or_ectoparasites",
                display_name_vi="Viêm da hoặc bệnh da ký sinh trùng",
                rank=2,
                score_percent=24,
                score_basis="matching_internal",
                confidence_note="Độ tự tin: 24%",
                supporting_reasons=["Cần loại trừ ký sinh trùng ngoài da."],
            ),
            DiagnosisSuggestion(
                canonical_code="ocular_infection",
                display_name_vi="Viêm kết mạc hoặc nhiễm trùng mắt",
                rank=3,
                score_percent=18,
                score_basis="matching_internal",
                confidence_note="Độ tự tin: 18%",
                supporting_reasons=["Cần loại trừ nhiễm trùng mắt thứ phát."],
            ),
        ]

        merged = service._merge_top_differentials_with_fallback(
            preferred=preferred,
            fallback=fallback,
            request=request,
            evidence_mode="internal_grounded",
        )

        self.assertEqual(len(merged), 3)
        self.assertEqual(merged[0].canonical_code, "bacterial_dermatosis")
        self.assertEqual(sum(item.score_percent for item in merged), 100)
        self.assertEqual([item.rank for item in merged], [1, 2, 3])

    async def test_analyze_case_uses_internal_retrieval_and_protocol_prescriptions(
        self,
    ):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            weight_kg=12.5,
            doctor_description="Bé chó đỏ mắt, nhiều ghèn và dụi mắt liên tục.",
            selected_diagnosis_code="ocular_infection",
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
                        "protocol_pattern": {
                            "common_prescriptions": [
                                {
                                    "medicine": "Nước mắt nhân tạo",
                                    "dosage": "1-2 giọt",
                                    "frequency": "3 lần/ngày",
                                    "duration": 5,
                                    "route": "nhỏ mắt",
                                }
                            ],
                        },
                    },
                )
            ]
        )

        with (
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
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
        self.assertEqual(response.evidence_mode, "internal_grounded")
        self.assertEqual(response.score_label, "Độ tự tin (%)")
        self.assertGreater(response.top_differentials[0].score_percent, 0)
        self.assertGreaterEqual(len(response.prescription_suggestions), 1)
        self.assertEqual(
            response.prescription_suggestions[0].medicine_name,
            "Nước mắt nhân tạo",
        )
        self.assertEqual(response.prescription_suggestions[0].duration_days, 5)
        self.assertEqual(response.prescription_suggestions[0].source, "emr_pattern")
        self.assertIn("viêm", response.soap_suggestions.assessment_draft.lower())
        self.assertNotIn(
            "chẩn đoán phân biệt", response.soap_suggestions.assessment_draft.lower()
        )

    def test_build_soap_suggestions_grounds_subjective_and_plan_sections(self):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            weight_kg=11.2,
            doctor_description="Da đỏ và ngứa nhiều ở vùng bụng.",
            soap_draft=SoapDraft(
                subjective="Chủ nuôi ghi nhận ngứa 3 ngày, liếm gãi nhiều về đêm."
            ),
        )
        primary = DiagnosisSuggestion(
            canonical_code="bacterial_dermatosis",
            display_name_vi="Viêm da do vi khuẩn",
        )
        protocol = ProtocolDecision(
            diagnosis_code="bacterial_dermatosis",
            diagnosis_display_name="Viêm da do vi khuẩn",
            summary="Đối chiếu ca EMR xác nhận và KB nội bộ.",
            recommended_tests=["Cytology da"],
            recommended_actions=[
                "Làm sạch vùng da tổn thương",
                "Đánh giá lại sau 48-72 giờ",
            ],
        )

        soap = service._build_soap_suggestions(
            request=request,
            top_differentials=[primary],
            primary_diagnosis=primary,
            vision_response=GeminiVisionDiagnosisResponse(request_id="req-grounded"),
            hybrid_result=HybridResult(
                chunks=[],
                expanded_query="dog dermatitis",
                original_query="dog dermatitis",
                sources_used={},
            ),
            similar_cases=[],
            protocol_decision=protocol,
        )

        self.assertEqual(
            soap.subjective_draft,
            "Chủ nuôi ghi nhận ngứa 3 ngày, liếm gãi nhiều về đêm.",
        )
        self.assertIn("Viêm da do vi khuẩn", soap.plan_draft)
        self.assertNotIn("Cytology da", soap.plan_draft)
        self.assertNotIn("Làm sạch vùng da tổn thương", soap.plan_draft)

    def test_build_llm_synthesis_prompt_includes_grounding_bundle(self):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Loét da, chảy mủ, ngứa nhiều.",
            selected_diagnosis_code="bacterial_dermatosis",
            selected_diagnosis_label="Viêm da do vi khuẩn",
        )
        primary = DiagnosisSuggestion(
            canonical_code="bacterial_dermatosis",
            display_name_vi="Viêm da do vi khuẩn",
            rank=1,
            score_percent=72,
            score_basis="matching_internal",
            confidence_note="Độ tự tin: 72%",
            supporting_reasons=["Khớp biểu hiện da mủ và viêm đỏ."],
        )
        protocol = ProtocolDecision(
            diagnosis_code="bacterial_dermatosis",
            diagnosis_display_name="Viêm da do vi khuẩn",
            summary="Đã đối chiếu KB và ca EMR xác nhận.",
            recommended_tests=["Cytology da"],
            recommended_actions=["Làm sạch vùng da tổn thương"],
        )

        prompt = service._build_llm_synthesis_prompt(
            request=request,
            top_differentials=[primary],
            hybrid_result=HybridResult(
                chunks=[
                    HybridChunk(
                        content="Viêm da do vi khuẩn thường biểu hiện đỏ da, mụn mủ và ngứa.",
                        score=0.82,
                        source="rag",
                        metadata={"document_name": "Cẩm nang da liễu"},
                    )
                ],
                expanded_query="dog pyoderma",
                original_query="dog pyoderma",
                sources_used={"rag": 1},
            ),
            similar_cases=[
                CaseResult(
                    case_id="emr:grounded-1",
                    content="Ca viêm da do vi khuẩn đã xác nhận.",
                    score=0.79,
                    final_score=0.91,
                    payload={
                        "display_name_vi": "Viêm da do vi khuẩn",
                        "final_diagnosis_text": "Pyoderma",
                        "chief_complaint": "Da đỏ, có mụn mủ và ngứa nhiều",
                        "protocol_pattern": {
                            "common_prescriptions": [
                                {
                                    "medicine": "Cephalexin",
                                    "dosage": "22 mg/kg",
                                    "frequency": "BID",
                                    "duration": 14,
                                }
                            ],
                            "common_tests": [{"test": "Cytology da"}],
                            "common_recommendations": ["Làm sạch vùng da tổn thương"],
                        },
                    },
                )
            ],
            protocol_decision=protocol,
            vision_response=GeminiVisionDiagnosisResponse(request_id="req-prompt"),
        )

        self.assertIn('"grounding_bundle"', prompt)
        self.assertIn('"recommended_tests"', prompt)
        self.assertIn('"case_memory_matches"', prompt)
        self.assertIn("QUY TẮC GROUNDED SOAP", prompt)

    def test_parse_llm_synthesis_response_normalizes_mismatched_label_and_code(self):
        service = StaffDiagnosisService()
        fallback = [
            DiagnosisSuggestion(
                canonical_code="ocular_infection",
                display_name_vi="Viêm kết mạc hoặc nhiễm trùng mắt",
                rank=1,
                score_percent=61,
                score_basis="matching_internal",
                confidence_note="Độ tự tin: 61%",
                supporting_reasons=["Khớp triệu chứng mắt."],
            )
        ]

        payload = """{
          \"top_differentials\": [
            {
              \"display_name_vi\": \"Viêm da do vi khuẩn (Pyoderma)\",
              \"supporting_reasons\": [\"Khớp tổn thương da mủ\"]
            }
          ]
        }"""

        parsed = service._parse_llm_synthesis_response(payload, fallback, "dog")

        self.assertIsNotNone(parsed)
        differential = parsed["top_differentials"][0]
        self.assertEqual(differential.display_name_vi, "Viêm da do vi khuẩn")
        self.assertEqual(differential.canonical_code, "bacterial_dermatosis")

    def test_parse_llm_synthesis_response_extracts_safety_suggestions(self):
        service = StaffDiagnosisService()
        fallback = [
            DiagnosisSuggestion(
                canonical_code="bacterial_dermatosis",
                display_name_vi="Viêm da do vi khuẩn",
                rank=1,
                score_percent=70,
                score_basis="matching_internal",
                confidence_note="Độ tự tin: 70%",
                supporting_reasons=["Khớp tổn thương da."],
            )
        ]

        payload = """{
          "top_differentials": [
            {"display_name_vi": "Viêm da do vi khuẩn"}
          ],
          "safety_suggestions": {
            "missing_inputs": ["cân nặng", "cân nặng", ""],
            "cautions": ["Theo dõi đáp ứng 48 giờ", "Theo dõi đáp ứng 48 giờ"]
          }
        }"""

        parsed = service._parse_llm_synthesis_response(payload, fallback, "dog")

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed["safety_suggestions"]["missing_inputs"], ["cân nặng"])
        self.assertEqual(
            parsed["safety_suggestions"]["cautions"],
            ["Theo dõi đáp ứng 48 giờ"],
        )

    def test_build_plan_draft_does_not_append_allergy_or_weight_tail(self):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            weight_kg=12.0,
            allergies=["Không có"],
            doctor_description="Da đỏ, có mủ",
        )
        decision = ProtocolDecision(
            diagnosis_code="bacterial_dermatosis",
            diagnosis_display_name="Viêm da do vi khuẩn (Pyoderma)",
            summary="Hướng viêm da do vi khuẩn",
            cautions=["Cần đối chiếu đơn thuốc với tiền sử dị ứng đã ghi nhận."],
            missing_inputs=["cân nặng"],
        )

        plan = service._build_plan_draft(
            top_label="Viêm da do vi khuẩn (Pyoderma)",
            request=request,
            protocol_decision=decision,
        )

        self.assertNotIn("Chống chỉ định với dị ứng", plan)
        self.assertNotIn("Cân nặng: 12.0 kg", plan)

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
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
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
        self.assertEqual(response.soap_suggestions.plan_draft, "")
        self.assertIn("Chọn một chẩn đoán trong Top 3", response.disclaimer)

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
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_gemini_vision_adapter"
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
            selected_diagnosis_code="ocular_infection",
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
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
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
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
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
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await service.analyze_case(request)

        # Fallback must keep generic candidate as top #1 and still provide Top 3
        self.assertEqual(len(response.top_differentials), 3)
        diff = response.top_differentials[0]
        self.assertIsNone(diff.canonical_code)
        self.assertNotIn("tai", diff.display_name_vi.lower())
        self.assertTrue(diff.confidence_note.startswith("Độ tự tin (tham khảo):"))

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
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await service.analyze_case(request)

        # Must keep generic fallback as top #1 and still render Top 3 for comparison
        self.assertEqual(len(response.top_differentials), 3)
        diff = response.top_differentials[0]
        self.assertIsNone(diff.canonical_code)
        self.assertNotIn("mắt", diff.display_name_vi.lower())
        self.assertNotIn("kết mạc", diff.display_name_vi.lower())
        self.assertTrue(diff.confidence_note.startswith("Độ tự tin (tham khảo):"))

    async def test_analyze_case_with_images_always_runs_vision_even_when_case_match_is_strong(
        self,
    ):
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Tổn thương da đỏ, ẩm, có mủ.",
            image_urls=["https://example.com/lesion.jpg"],
        )

        mock_hybrid_engine = Mock()
        mock_hybrid_engine.query = AsyncMock(
            return_value=HybridResult(
                chunks=[
                    HybridChunk(
                        content="Pyoderma thường gây đỏ da, rỉ dịch và ngứa.",
                        score=0.82,
                        source="rag",
                        metadata={"document_name": "Cẩm nang da liễu"},
                    )
                ],
                expanded_query="dog pyoderma",
                original_query="dog pyoderma",
                sources_used={"rag": 1, "kg": 0},
            )
        )

        mock_case_memory = Mock()
        mock_case_memory.search_similar = AsyncMock(
            return_value=[
                CaseResult(
                    case_id="emr:strong-match",
                    content="Ca tương tự đã xác nhận pyoderma.",
                    score=0.88,
                    final_score=0.98,
                    payload={
                        "species": "dog",
                        "display_name_vi": "Viêm da do vi khuẩn",
                        "final_diagnosis_text": "Viêm da do vi khuẩn",
                        "canonical_code": "bacterial_dermatosis",
                        "chief_complaint": "Da đỏ, chảy dịch, ngứa",
                    },
                )
            ]
        )

        with (
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_gemini_vision_adapter"
            ) as mock_vision,
        ):
            mock_vision.return_value.analyze = AsyncMock(
                return_value=GeminiVisionDiagnosisResponse(
                    request_id="vision-force-test",
                    visual_findings=["Tổn thương da loét nông, viền đỏ."],
                    image_descriptions=["Vùng da tổn thương có viền đỏ và đóng mày."],
                    top_conditions=[],
                )
            )
            response = await service.analyze_case(request)

        mock_vision.return_value.analyze.assert_awaited_once()
        self.assertEqual(len(response.image_analysis), 1)
        self.assertEqual(response.image_analysis[0]["order"], 1)

    async def test_analyze_case_with_images_handles_vision_failure_gracefully(
        self,
    ):
        """When Gemini Vision fails, analysis should still return results from RAG/case memory."""
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            weight_kg=10.0,
            doctor_description="Cho cho bi an kin, co ghen vang mat trai.",
            image_urls=[
                "https://example.com/img1.jpg",
            ],
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
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_gemini_vision_adapter"
            ) as mock_vision,
        ):
            mock_vision.return_value.analyze = AsyncMock(
                side_effect=Exception("Gemini API error: rate limit exceeded")
            )
            response = await service.analyze_case(request)

        self.assertIsNotNone(response.request_id)
        self.assertTrue(len(response.top_differentials) >= 1)
        self.assertEqual(len(response.image_analysis), 1)
        self.assertEqual(
            response.image_analysis[0]["url"], "https://example.com/img1.jpg"
        )
        self.assertIn("Chưa có mô tả", response.image_analysis[0]["description"])
        self.assertEqual(response.vision_findings, [])

    async def test_analyze_case_handles_hybrid_rag_failure_gracefully(
        self,
    ):
        """When Hybrid RAG fails, should still return results from case memory."""
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            weight_kg=12.5,
            doctor_description="Bé chó đỏ mắt, nhiều ghèn.",
        )

        mock_hybrid_engine = Mock()
        mock_hybrid_engine.query = AsyncMock(
            side_effect=Exception("Qdrant connection failed")
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
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await service.analyze_case(request)

        self.assertIsNotNone(response.request_id)
        self.assertTrue(len(response.top_differentials) >= 1)
        self.assertIn("Viêm kết mạc", response.similar_confirmed_cases[0])

    async def test_analyze_case_handles_case_memory_failure_gracefully(
        self,
    ):
        """When Case Memory fails, should still return results from RAG."""
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            weight_kg=12.5,
            doctor_description="Bé chó đỏ mắt, nhiều ghèn.",
        )

        mock_hybrid_engine = Mock()
        mock_hybrid_engine.query = AsyncMock(
            return_value=HybridResult(
                chunks=[
                    HybridChunk(
                        content="Viêm kết mạc ở chó thường biểu hiện đỏ mắt, ghèn mắt.",
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
            side_effect=Exception("Qdrant connection failed")
        )

        with (
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await service.analyze_case(request)

        self.assertIsNotNone(response.request_id)
        self.assertTrue(len(response.top_differentials) >= 1)
        self.assertIn("Cẩm nang bệnh mắt", response.supporting_evidence_from_kb[0])

    async def test_analyze_case_handles_all_services_failure(
        self,
    ):
        """When all services fail, should still return generic fallback."""
        service = StaffDiagnosisService()
        request = StaffDiagnosisRequest(
            species=Species.DOG,
            doctor_description="Bé chó có triệu chứng lạ.",
        )

        mock_hybrid_engine = Mock()
        mock_hybrid_engine.query = AsyncMock(
            side_effect=Exception("Qdrant connection failed")
        )

        mock_case_memory = Mock()
        mock_case_memory.search_similar = AsyncMock(
            side_effect=Exception("Qdrant connection failed")
        )

        with (
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_hybrid_rag_engine",
                return_value=mock_hybrid_engine,
            ),
            patch(
                "app.ai_diagnose.staff_diagnosis_service.get_case_memory_service",
                return_value=mock_case_memory,
            ),
            patch(
                "app.core.services.disease_mapping_service.DiseaseMappingService.refresh_from_db",
                new=AsyncMock(return_value=True),
            ),
        ):
            response = await service.analyze_case(request)

        self.assertIsNotNone(response.request_id)
        self.assertEqual(len(response.top_differentials), 3)
        self.assertIn(
            "Không tìm thấy thông tin phù hợp",
            response.supporting_evidence_from_kb[0],
        )
        self.assertIn(
            "Không tìm thấy ca EMR xác nhận",
            response.similar_confirmed_cases[0],
        )


if __name__ == "__main__":
    unittest.main()
