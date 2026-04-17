"""
Disease Taxonomy Service - AI-Assisted Classification

Uses LLM to classify symptoms/diagnoses into hierarchical disease taxonomy.
Works alongside DiseaseMappingService to provide better context for mapping.

This service DOES NOT replace DiseaseMappingService.
It acts as a PRE-PROCESSOR to provide taxonomy hints for mapping.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from loguru import logger

from app.db.postgres.session import AsyncSessionLocal
from app.services.llm_client import get_llm_client_from_db


@dataclass
class TaxonomyClassification:
    """Result from taxonomy classification."""

    canonical_code: str
    display_name_vi: str
    system: str  # e.g., "HÔ HẤP"
    subsystem: str  # e.g., "Hô hấp dưới"
    confidence: float
    reasoning: str
    differential_diagnoses: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class TaxonomyDisease:
    """Single disease entry from taxonomy."""

    canonical_code: str
    display_name_vi: str
    system: str
    subsystem: str
    aliases: List[str] = field(default_factory=list)
    species: List[str] = field(default_factory=list)


class DiseaseTaxonomyService:
    """
    Classify disease symptoms into hierarchical taxonomy using LLM.

    This service provides:
    1. classify_disease(): Classify clinical text into taxonomy
    2. get_disease_info(): Get disease details from taxonomy
    3. list_diseases(): List all diseases with filters
    """

    _instance: Optional["DiseaseTaxonomyService"] = None
    _taxonomy: Optional[Dict[str, Any]] = None
    _flat_index: Optional[Dict[str, TaxonomyDisease]] = None

    def __init__(self):
        if DiseaseTaxonomyService._taxonomy is None:
            self._load_taxonomy()

    @classmethod
    def get_instance(cls) -> "DiseaseTaxonomyService":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _load_taxonomy(self) -> None:
        """Load taxonomy from JSON file."""
        try:
            taxonomy_path = Path(__file__).parent / "disease_taxonomy.json"
            with open(taxonomy_path, "r", encoding="utf-8") as f:
                DiseaseTaxonomyService._taxonomy = json.load(f)
            self._build_flat_index()
            logger.info(
                f"Loaded disease taxonomy from {taxonomy_path} "
                f"({len(self._flat_index)} diseases)"
            )
        except Exception as e:
            logger.error(f"Failed to load disease taxonomy: {e}")
            DiseaseTaxonomyService._taxonomy = {}
            DiseaseTaxonomyService._flat_index = {}

    def _build_flat_index(self) -> None:
        """Build flat index: canonical_code -> TaxonomyDisease."""
        DiseaseTaxonomyService._flat_index = {}

        if not DiseaseTaxonomyService._taxonomy:
            return

        for system_key, system_data in DiseaseTaxonomyService._taxonomy.items():
            system_name = system_data.get("display_name_vi", system_key)

            for sub_key, sub_data in system_data.get("subcategories", {}).items():
                sub_name = sub_data.get("display_name_vi", sub_key)

                for disease_code, disease_data in sub_data.get("diseases", {}).items():
                    DiseaseTaxonomyService._flat_index[disease_code] = TaxonomyDisease(
                        canonical_code=disease_code,
                        display_name_vi=disease_data.get(
                            "display_name_vi", disease_code
                        ),
                        system=system_name,
                        subsystem=sub_name,
                        aliases=disease_data.get("aliases", []),
                        species=disease_data.get("species", ["dog", "cat"]),
                    )

    async def classify_disease(
        self,
        clinical_text: str,
        species: str = "all",
        symptoms: Optional[List[str]] = None,
    ) -> Optional[TaxonomyClassification]:
        """
        Use LLM to classify clinical text into disease taxonomy.

        Args:
            clinical_text: Clinical description or chief complaint
            species: "dog", "cat", or "all"
            symptoms: List of symptoms

        Returns:
            TaxonomyClassification if successful, None if LLM fails
        """
        if not DiseaseTaxonomyService._taxonomy:
            logger.warning("Taxonomy not loaded, cannot classify")
            return None

        prompt = self._build_classification_prompt(
            clinical_text=clinical_text, species=species, symptoms=symptoms or []
        )

        try:
            async with AsyncSessionLocal() as db:
                llm_client = await get_llm_client_from_db(db)
            if llm_client is None:
                logger.warning("LLM client not available for taxonomy classification")
                return None

            response = await llm_client.generate(
                prompt=prompt, temperature=0.1, max_tokens=800
            )

            classification = self._parse_llm_response(response.content)

            if classification:
                logger.info(
                    f"Taxonomy classification: {classification.canonical_code} "
                    f"({classification.confidence:.2f})"
                )

            return classification

        except Exception as e:
            logger.error(f"Taxonomy classification failed: {e}")
            return None

    def _build_classification_prompt(
        self, clinical_text: str, species: str, symptoms: List[str]
    ) -> str:
        """Build prompt for LLM disease classification."""
        # Build readable taxonomy tree
        taxonomy_text = self._format_taxonomy_for_prompt()

        symptoms_text = ", ".join(symptoms) if symptoms else "Không có"
        species_map = {"dog": "chó", "cat": "mèo", "all": "tất cả"}
        species_vi = species_map.get(species, "tất cả")

        prompt = f"""Bạn là bác sĩ thú y chuyên khoa. Hãy phân tích trường hợp lâm sàng sau và phân loại vào hệ thống phân cấp bệnh.

**Thông tin lâm sàng:**
- Mô tả: {clinical_text}
- Loài: {species_vi}
- Triệu chứng: {symptoms_text}

**Hệ thống phân cấp bệnh:**

{taxonomy_text}

**Yêu cầu:**
1. Chọn MỘT bệnh phù hợp nhất từ danh sách trên
2. Nếu có nhiều bệnh có thể, chọn bệnh có khả năng cao nhất
3. Trả về JSON với định dạng sau:

```json
{{
  "canonical_code": "tên_bệnh_chính_xác",
  "display_name_vi": "Tên bệnh tiếng Việt",
  "system": "HỆ_CƠ_QUAN",
  "subsystem": "Phân_hệ",
  "confidence": 0.85,
  "reasoning": "Lý do chọn bệnh này (2-3 câu)",
  "differential_diagnoses": [
    {{"code": "bệnh_khác_1", "probability": 0.60}},
    {{"code": "bệnh_khác_2", "probability": 0.40}}
  ]
}}
```

**Lưu ý quan trọng:**
- Chỉ chọn bệnh CÓ TRONG danh sách trên
- Confidence từ 0.5-1.0
- Nếu không bệnh nào phù hợp, trả về: {{"canonical_code": null}}
- Tất cả text bằng tiếng Việt
- Differential diagnoses là các bệnh khác có thể, với probability 0-100"""

        return prompt

    def _format_taxonomy_for_prompt(self) -> str:
        """Format taxonomy as readable tree for LLM prompt."""
        lines = []

        for system_key, system_data in DiseaseTaxonomyService._taxonomy.items():
            system_name = system_data.get("display_name_vi", system_key)
            lines.append(f"\n{system_name}")
            lines.append("=" * len(system_name))

            for sub_key, sub_data in system_data.get("subcategories", {}).items():
                sub_name = sub_data.get("display_name_vi", sub_key)
                lines.append(f"\n  {sub_name}:")

                for disease_code, disease_data in sub_data.get("diseases", {}).items():
                    display_name = disease_data.get("display_name_vi", disease_code)
                    aliases = disease_data.get("aliases", [])
                    species = disease_data.get("species", [])

                    species_text = ""
                    if "dog" in species and "cat" in species:
                        species_text = " (chó/mèo)"
                    elif "dog" in species:
                        species_text = " (chó)"
                    elif "cat" in species:
                        species_text = " (mèo)"

                    lines.append(f"    - {display_name}{species_text}")
                    if aliases:
                        lines.append(f"      Aliases: {', '.join(aliases[:5])}")

        return "\n".join(lines)

    def _parse_llm_response(
        self, response_text: str
    ) -> Optional[TaxonomyClassification]:
        """Parse JSON response from LLM."""
        try:
            # Extract JSON from response
            json_str = response_text.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()

            data = json.loads(json_str)

            if data is None or data.get("canonical_code") is None:
                return None

            return TaxonomyClassification(
                canonical_code=data["canonical_code"],
                display_name_vi=data.get("display_name_vi", ""),
                system=data.get("system", ""),
                subsystem=data.get("subsystem", ""),
                confidence=float(data.get("confidence", 0.0)),
                reasoning=data.get("reasoning", ""),
                differential_diagnoses=data.get("differential_diagnoses", []),
            )
        except Exception as e:
            logger.error(f"Failed to parse LLM taxonomy response: {e}")
            return None

    def get_disease_info(self, canonical_code: str) -> Optional[TaxonomyDisease]:
        """Get disease information from taxonomy."""
        if DiseaseTaxonomyService._flat_index is None:
            return None
        return DiseaseTaxonomyService._flat_index.get(canonical_code)

    def list_diseases(
        self, species: Optional[str] = None, system: Optional[str] = None
    ) -> List[TaxonomyDisease]:
        """
        List all diseases with optional filters.

        Args:
            species: Filter by species ("dog", "cat", or None for all)
            system: Filter by system key (e.g., "HO_HAP")

        Returns:
            List of TaxonomyDisease
        """
        if DiseaseTaxonomyService._flat_index is None:
            return []

        diseases = list(DiseaseTaxonomyService._flat_index.values())

        if species:
            diseases = [d for d in diseases if species in d.species]

        if system and DiseaseTaxonomyService._taxonomy:
            system_data = DiseaseTaxonomyService._taxonomy.get(system, {})
            system_name = system_data.get("display_name_vi", system)
            diseases = [d for d in diseases if d.system == system_name]

        return diseases

    def get_taxonomy_stats(self) -> Dict[str, Any]:
        """Get taxonomy statistics."""
        if DiseaseTaxonomyService._flat_index is None:
            return {"total_diseases": 0}

        systems = {}
        species_count = {"dog": 0, "cat": 0}

        for disease in DiseaseTaxonomyService._flat_index.values():
            if disease.system not in systems:
                systems[disease.system] = 0
            systems[disease.system] += 1

            if "dog" in disease.species:
                species_count["dog"] += 1
            if "cat" in disease.species:
                species_count["cat"] += 1

        return {
            "total_diseases": len(DiseaseTaxonomyService._flat_index),
            "total_systems": len(systems),
            "systems": systems,
            "species_count": species_count,
        }


def get_disease_taxonomy_service() -> DiseaseTaxonomyService:
    """Get the disease taxonomy service singleton."""
    return DiseaseTaxonomyService.get_instance()
