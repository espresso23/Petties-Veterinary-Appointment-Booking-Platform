"""
Sync one confirmed EMR record into case memory.

This service:
- Receives a confirmed EMR payload from Spring Boot.
- Maps diagnosis text through the disease catalog.
- Upserts mapped or provisional records into case memory.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from loguru import logger

from app.core.rag.case_memory import get_case_memory_service
from app.core.services.disease_mapping_service import (
    DiseaseMappingResult,
    get_disease_mapping_service,
)


@dataclass
class EmrCaseMemorySyncResult:
    case_id: str
    mapping_status: str
    canonical_code: Optional[str]
    display_name_vi: Optional[str]
    provisional_label: Optional[str]


class EmrCaseMemorySyncService:
    """Service to upsert a confirmed EMR record into case memory."""

    async def sync_record(self, emr_record: Dict[str, Any]) -> EmrCaseMemorySyncResult:
        await get_disease_mapping_service().refresh_from_db()

        if not self._is_valid_for_ingest(emr_record):
            raise ValueError("Payload EMR khong hop le de dong bo vao case memory")

        return await self._process_emr_record(emr_record)

    async def _process_emr_record(
        self,
        emr_record: Dict[str, Any],
    ) -> EmrCaseMemorySyncResult:
        mapping_result = self._map_diagnosis(emr_record)
        mapping_status = "mapped" if mapping_result.mapped else "provisional"
        if not mapping_result.mapped:
            logger.warning(
                "EMR {} has unmapped diagnosis, ingest as provisional: {}",
                emr_record.get("emr_id", ""),
                emr_record.get("final_diagnosis_text", ""),
            )
            await get_disease_mapping_service().record_unmapped_label(
                raw_label=str(emr_record.get("final_diagnosis_text", "")),
                source_type="emr",
                species=str(emr_record.get("species") or "all"),
                sample_payload={
                    "emr_id": emr_record.get("emr_id"),
                    "species": emr_record.get("species"),
                    "chief_complaint": emr_record.get("chief_complaint"),
                },
            )

        case_id = f"emr:{emr_record.get('emr_id', '')}".strip()
        search_text = self._build_search_text(emr_record, mapping_result)
        image_urls = self._extract_image_urls(emr_record)
        protocol_pattern = self._extract_protocol_pattern(emr_record, mapping_result)

        payload = {
            "source_type": "confirmed_emr",
            "verified": True,
            "clinic_id": emr_record.get("clinic_id"),
            "pet_id": emr_record.get("pet_id"),
            "booking_id": emr_record.get("booking_id"),
            "doctor_id": emr_record.get("doctor_id"),
            "species": emr_record.get("species"),
            "breed": emr_record.get("breed"),
            "chief_complaint": emr_record.get("chief_complaint"),
            "symptoms": emr_record.get("symptoms", []),
            "physical_exam": emr_record.get("physical_exam", []),
            "clinical_notes": emr_record.get("clinical_notes"),
            "final_diagnosis_text": emr_record.get("final_diagnosis_text"),
            "canonical_code": mapping_result.canonical_code,
            "display_name_vi": mapping_result.display_name_vi
            or emr_record.get("final_diagnosis_text"),
            "mapping_status": mapping_status,
            "provisional_label": None
            if mapping_result.mapped
            else emr_record.get("final_diagnosis_text"),
            "emr_updated_at": emr_record.get("updated_at") or emr_record.get("exam_at"),
            "exam_at": emr_record.get("exam_at"),
            "synced_at": datetime.now(timezone.utc).isoformat(),
            "protocol_pattern": protocol_pattern,
        }

        result_case_id = await get_case_memory_service().upsert_case(
            text_to_embed=search_text,
            payload=payload,
            case_id=case_id,
            image_urls=image_urls or None,
        )
        if not result_case_id:
            raise RuntimeError("Khong the upsert EMR vao case memory")

        return EmrCaseMemorySyncResult(
            case_id=result_case_id,
            mapping_status=mapping_status,
            canonical_code=mapping_result.canonical_code,
            display_name_vi=mapping_result.display_name_vi
            or emr_record.get("final_diagnosis_text"),
            provisional_label=None
            if mapping_result.mapped
            else str(emr_record.get("final_diagnosis_text", "")).strip() or None,
        )

    def _is_valid_for_ingest(self, emr_record: Dict[str, Any]) -> bool:
        if not isinstance(emr_record, dict):
            return False
        if not emr_record.get("emr_id"):
            return False
        if not emr_record.get("pet_id"):
            return False
        if not emr_record.get("final_diagnosis_text"):
            return False
        if emr_record.get("verified") is False:
            return False
        return True

    def _map_diagnosis(self, emr_record: Dict[str, Any]) -> DiseaseMappingResult:
        return get_disease_mapping_service().map_label(
            raw_label=str(emr_record.get("final_diagnosis_text", "")),
            source_type="emr",
            species=str(emr_record.get("species") or "all"),
        )

    def _build_search_text(
        self,
        emr_record: Dict[str, Any],
        mapping_result: DiseaseMappingResult,
    ) -> str:
        parts: List[str] = []
        for key in ("species", "breed", "chief_complaint", "clinical_notes"):
            value = emr_record.get(key)
            if value:
                parts.append(str(value))

        symptoms = emr_record.get("symptoms", []) or []
        if isinstance(symptoms, list) and symptoms:
            parts.append("Symptoms: " + ", ".join(str(x) for x in symptoms if x))

        physical_exam = emr_record.get("physical_exam", []) or []
        if isinstance(physical_exam, list) and physical_exam:
            parts.append(
                "Physical exam: " + ", ".join(str(x) for x in physical_exam if x)
            )

        diagnosis_text = mapping_result.display_name_vi or mapping_result.raw_label
        if mapping_result.mapped:
            parts.append(f"Diagnosis: {diagnosis_text}")
        else:
            parts.append(f"Provisional diagnosis: {diagnosis_text}")
        return "\n".join(parts).strip()

    def _extract_image_urls(self, emr_record: Dict[str, Any]) -> List[str]:
        attachments = emr_record.get("attachments", {}) or {}
        if not isinstance(attachments, dict):
            return []
        image_urls = attachments.get("image_urls", []) or []
        if not isinstance(image_urls, list):
            return []
        clean_urls: List[str] = []
        for item in image_urls:
            if not isinstance(item, str):
                continue
            value = item.strip()
            if value.startswith("http://") or value.startswith("https://"):
                clean_urls.append(value)
        return clean_urls

    def _extract_protocol_pattern(
        self,
        emr_record: Dict[str, Any],
        mapping_result: DiseaseMappingResult,
    ) -> Dict[str, Any]:
        """
        Trích xuất protocol pattern từ EMR đã xác nhận.

        Không hardcode gì - hoàn toàn học từ dữ liệu EMR thực tế.
        """
        protocol_pattern = {
            "extracted_from": f"emr:{emr_record.get('emr_id')}",
            "confirmed_at": emr_record.get("exam_at")
            or datetime.now(timezone.utc).isoformat(),
        }

        soap = emr_record.get("soap", {})
        if isinstance(soap, dict):
            protocol_pattern["soap_template"] = {
                "subjective": soap.get("subjective")
                or emr_record.get("chief_complaint"),
                "objective": soap.get("objective") or "",
                "assessment": soap.get("assessment")
                or emr_record.get("final_diagnosis_text"),
                "plan": soap.get("plan") or "",
            }

        prescriptions = emr_record.get("prescriptions", [])
        if isinstance(prescriptions, list) and prescriptions:
            extracted_rx = []
            for rx in prescriptions:
                if not isinstance(rx, dict):
                    continue
                rx_entry = {
                    "medicine": rx.get("medicine_name") or rx.get("medicine"),
                    "dosage": rx.get("dosage"),
                    "frequency": rx.get("frequency"),
                    "duration": rx.get("duration"),
                    "route": rx.get("route"),
                }
                if any(rx_entry.values()):
                    extracted_rx.append(rx_entry)
            if extracted_rx:
                protocol_pattern["common_prescriptions"] = extracted_rx

        test_results = emr_record.get("test_results", []) or []
        if isinstance(test_results, list) and test_results:
            extracted_tests = [
                {"test": t.get("test"), "result": t.get("result")}
                for t in test_results
                if isinstance(t, dict) and t.get("test")
            ]
            if extracted_tests:
                protocol_pattern["common_tests"] = extracted_tests

        recommendations = emr_record.get("recommendations", []) or []
        if isinstance(recommendations, list) and recommendations:
            protocol_pattern["common_recommendations"] = [
                r for r in recommendations if isinstance(r, str) and r.strip()
            ]

        return protocol_pattern


_emr_case_memory_sync_service: Optional[EmrCaseMemorySyncService] = None


def get_emr_case_memory_sync_service() -> EmrCaseMemorySyncService:
    global _emr_case_memory_sync_service
    if _emr_case_memory_sync_service is None:
        _emr_case_memory_sync_service = EmrCaseMemorySyncService()
    return _emr_case_memory_sync_service


def reset_emr_case_memory_sync_service() -> None:
    global _emr_case_memory_sync_service
    _emr_case_memory_sync_service = None
