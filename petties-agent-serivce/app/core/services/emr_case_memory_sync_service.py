"""
Sync one confirmed EMR record into case memory.

This service:
- Receives a confirmed EMR payload from Spring Boot.
- Maps diagnosis text through the disease catalog.
- Upserts mapped or provisional records into case memory.
"""

from __future__ import annotations

from dataclasses import dataclass
import re
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
        mapping_result = await self._map_diagnosis(emr_record)
        mapping_status = "mapped" if mapping_result.mapped else "provisional"
        if not mapping_result.mapped:
            logger.warning(
                "EMR {} keeps provisional diagnosis after autonomous mapping: {}",
                emr_record.get("emr_id", ""),
                emr_record.get("final_diagnosis_text", ""),
            )

        case_id = f"emr:{emr_record.get('emr_id', '')}".strip()
        search_text = self._build_search_text(emr_record, mapping_result)
        image_urls = self._extract_image_urls(emr_record)
        protocol_pattern = self._extract_protocol_pattern(
            emr_record,
            mapping_result,
        )

        payload = {
            "species": emr_record.get("species"),
            "chief_complaint": emr_record.get("chief_complaint"),
            "clinical_notes": emr_record.get("clinical_notes"),
            "final_diagnosis_text": emr_record.get("final_diagnosis_text"),
            "canonical_code": mapping_result.canonical_code,
            "display_name_vi": mapping_result.display_name_vi
            or emr_record.get("final_diagnosis_text"),
            "mapping_status": mapping_status,
            "exam_at": emr_record.get("exam_at"),
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

    async def _map_diagnosis(self, emr_record: Dict[str, Any]) -> DiseaseMappingResult:
        context_parts = [
            str(emr_record.get("chief_complaint") or "").strip(),
            str(emr_record.get("clinical_notes") or "").strip(),
            str((emr_record.get("soap") or {}).get("assessment") or "").strip(),
            str((emr_record.get("soap") or {}).get("plan") or "").strip(),
        ]
        context_text = "\n".join(part for part in context_parts if part)
        return await get_disease_mapping_service().resolve_label(
            raw_label=str(emr_record.get("final_diagnosis_text", "")),
            source_type="emr",
            species=str(emr_record.get("species") or "all"),
            context_text=context_text or None,
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

        soap = self._extract_soap(emr_record)
        for label, key in (
            ("Subjective", "subjective"),
            ("Objective", "objective"),
            ("Assessment", "assessment"),
            ("Plan", "plan"),
            ("Notes", "notes"),
        ):
            value = soap.get(key)
            if value:
                parts.append(f"{label}: {value}")

        vitals = self._extract_vitals(emr_record)
        vital_parts = []
        if vitals.get("weight_kg") not in (None, ""):
            vital_parts.append(f"weight_kg={vitals.get('weight_kg')}")
        if vitals.get("temperature_c") not in (None, ""):
            vital_parts.append(f"temperature_c={vitals.get('temperature_c')}")
        if vitals.get("heart_rate") not in (None, ""):
            vital_parts.append(f"heart_rate={vitals.get('heart_rate')}")
        if vitals.get("bcs") not in (None, ""):
            vital_parts.append(f"bcs={vitals.get('bcs')}")
        if vital_parts:
            parts.append("Vitals: " + ", ".join(vital_parts))

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

        prescriptions = self._extract_prescriptions(emr_record)
        if prescriptions:
            prescription_lines = []
            for rx in prescriptions:
                medicine = str(
                    rx.get("medicine_name") or rx.get("medicine") or ""
                ).strip()
                if not medicine:
                    continue
                details = []
                for key in ("dosage", "frequency", "duration_days", "instructions"):
                    value = rx.get(key)
                    if value not in (None, ""):
                        details.append(str(value))
                prescription_lines.append(
                    medicine if not details else f"{medicine} - {' | '.join(details)}"
                )
            if prescription_lines:
                parts.append("Prescriptions: " + "; ".join(prescription_lines))

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
        protocol_pattern: Dict[str, Any] = {}

        soap = self._extract_soap(emr_record)
        assessment_text = soap.get("assessment") or emr_record.get(
            "final_diagnosis_text"
        )
        if assessment_text:
            protocol_pattern["soap_template"] = {
                "assessment": assessment_text,
            }

        prescriptions = self._extract_prescriptions(emr_record)
        if isinstance(prescriptions, list) and prescriptions:
            extracted_rx = []
            for rx in prescriptions:
                if not isinstance(rx, dict):
                    continue
                rx_entry = {
                    "medicine": rx.get("medicine_name") or rx.get("medicine"),
                    "dosage": rx.get("dosage"),
                    "frequency": rx.get("frequency"),
                    "duration": rx.get("duration") or rx.get("duration_days"),
                    "route": rx.get("route"),
                    "instructions": rx.get("instructions"),
                }
                if any(rx_entry.values()):
                    extracted_rx.append(rx_entry)
            if extracted_rx:
                protocol_pattern["common_prescriptions"] = extracted_rx

        extracted_recommendations = self._extract_plan_recommendations(soap)
        if extracted_recommendations:
            protocol_pattern["common_recommendations"] = extracted_recommendations

        extracted_tests = self._extract_common_tests(soap)
        if extracted_tests:
            protocol_pattern["common_tests"] = [
                {"test": test_name} for test_name in extracted_tests
            ]

        return protocol_pattern

    def _extract_soap(self, emr_record: Dict[str, Any]) -> Dict[str, Any]:
        soap = emr_record.get("soap")
        if not isinstance(soap, dict):
            soap = {}
        return {
            "subjective": soap.get("subjective")
            or emr_record.get("chief_complaint")
            or "",
            "objective": soap.get("objective") or "",
            "assessment": soap.get("assessment")
            or emr_record.get("final_diagnosis_text")
            or "",
            "plan": soap.get("plan") or "",
            "notes": soap.get("notes") or emr_record.get("clinical_notes") or "",
        }

    def _extract_plan_recommendations(self, soap: Dict[str, Any]) -> List[str]:
        recommendations: List[str] = []
        seen: set[str] = set()

        for key in ("plan", "notes"):
            raw_value = soap.get(key)
            if not isinstance(raw_value, str):
                continue

            normalized = raw_value.strip()
            if not normalized:
                continue

            parts = re.split(r"[\r\n;]+", normalized)
            cleaned_parts = [
                re.sub(r"^[-*\u2022\d.)\s]+", "", part).strip() for part in parts
            ]
            meaningful_parts = [part for part in cleaned_parts if len(part) >= 3]
            if not meaningful_parts and normalized:
                meaningful_parts = [normalized]

            for part in meaningful_parts:
                dedupe_key = " ".join(part.lower().split())
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
                recommendations.append(part)

        return recommendations[:5]

    def _extract_common_tests(self, soap: Dict[str, Any]) -> List[str]:
        tests: List[str] = []
        seen: set[str] = set()
        diagnostic_keywords = (
            "xét nghiệm",
            "xet nghiem",
            "test",
            "cbc",
            "siêu âm",
            "sieu am",
            "x-quang",
            "x quang",
            "pcr",
            "cytology",
            "nuôi cấy",
            "nuoi cay",
            "soi",
            "fluorescein",
            "wood",
            "scrape",
        )

        for key in ("plan", "notes"):
            raw_value = soap.get(key)
            if not isinstance(raw_value, str):
                continue

            parts = re.split(r"[\r\n;]+", raw_value.strip())
            for part in parts:
                normalized = re.sub(r"^[-*\u2022\d.)\s]+", "", part).strip()
                if len(normalized) < 3:
                    continue
                lower_value = normalized.lower()
                if not any(keyword in lower_value for keyword in diagnostic_keywords):
                    continue
                dedupe_key = " ".join(lower_value.split())
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)
                tests.append(normalized)

        return tests[:5]

    def _extract_vitals(self, emr_record: Dict[str, Any]) -> Dict[str, Any]:
        vitals = emr_record.get("vitals")
        if not isinstance(vitals, dict):
            vitals = {}
        return {
            "weight_kg": vitals.get("weight_kg"),
            "temperature_c": vitals.get("temperature_c"),
            "heart_rate": vitals.get("heart_rate"),
            "bcs": vitals.get("bcs"),
        }

    def _extract_prescriptions(
        self, emr_record: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        prescriptions = emr_record.get("prescriptions")
        if not isinstance(prescriptions, list):
            return []
        return [item for item in prescriptions if isinstance(item, dict)]


_emr_case_memory_sync_service: Optional[EmrCaseMemorySyncService] = None


def get_emr_case_memory_sync_service() -> EmrCaseMemorySyncService:
    global _emr_case_memory_sync_service
    if _emr_case_memory_sync_service is None:
        _emr_case_memory_sync_service = EmrCaseMemorySyncService()
    return _emr_case_memory_sync_service


def reset_emr_case_memory_sync_service() -> None:
    global _emr_case_memory_sync_service
    _emr_case_memory_sync_service = None
