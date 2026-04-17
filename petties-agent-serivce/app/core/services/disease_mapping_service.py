"""
Disease mapping service backed by PostgreSQL with safe in-memory fallback.

Goals:
- Normalize disease labels from KB, KG, EMR and vision into one canonical code.
- Load aliases from PostgreSQL so mapping can evolve without redeploy.
- Keep a bootstrap snapshot for local/dev safety and test isolation.
- Support autonomous canonicalization using existing disease_catalog and
  disease_aliases storage only.
"""

from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from typing import Any, Dict, Iterable, List, Optional, Tuple

from loguru import logger
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.postgres.models import DiseaseAlias, DiseaseCatalog
from app.db.postgres.session import AsyncSessionLocal
from app.services.llm_client import BaseLLMClient, get_llm_client_from_db


def _normalize_text(value: str) -> str:
    text = (value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in text)
    return " ".join(text.split())


@dataclass(frozen=True)
class DiseaseCatalogEntry:
    canonical_code: str
    display_name_vi: str
    species: str = "all"


@dataclass(frozen=True)
class DiseaseAliasEntry:
    source_type: str
    alias_text: str
    normalized_alias: str
    canonical_code: str
    species: str = "all"


@dataclass
class DiseaseMappingResult:
    raw_label: str
    canonical_code: Optional[str]
    display_name_vi: Optional[str]
    mapped: bool
    source_type: str


@dataclass(frozen=True)
class CanonicalCandidate:
    canonical_code: str
    display_name_vi: str
    species: str
    score: float
    matched_aliases: Tuple[str, ...] = ()


@dataclass(frozen=True)
class CanonicalizationDecision:
    action: str
    canonical_code: Optional[str] = None
    display_name_vi: Optional[str] = None
    alias_text: Optional[str] = None
    confidence: float = 0.0


DEFAULT_DISEASE_CATALOG = [
    {
        "canonical_code": "bacterial_dermatosis",
        "display_name_vi": "Viêm da do vi khuẩn",
        "species": "all",
    },
    {
        "canonical_code": "ocular_infection",
        "display_name_vi": "Viêm kết mạc hoặc nhiễm trùng mắt",
        "species": "all",
    },
    {
        "canonical_code": "otitis_or_ear_parasites",
        "display_name_vi": "Viêm tai ngoài hoặc bệnh tai ký sinh trùng",
        "species": "all",
    },
    {
        "canonical_code": "dermatosis_or_ectoparasites",
        "display_name_vi": "Viêm da hoặc bệnh da ký sinh trùng",
        "species": "all",
    },
]

DEFAULT_DISEASE_ALIASES = [
    ("emr", "viem da do vi khuan", "bacterial_dermatosis", "all"),
    ("vision", "bacterial dermatitis", "bacterial_dermatosis", "all"),
    ("kb", "viem da vi khuan", "bacterial_dermatosis", "all"),
    ("kb", "viêm da do vi khuẩn", "bacterial_dermatosis", "all"),
    ("emr", "viem ket mac", "ocular_infection", "all"),
    ("emr", "nhiem trung mat", "ocular_infection", "all"),
    ("vision", "conjunctivitis", "ocular_infection", "all"),
    ("vision", "eye infection", "ocular_infection", "all"),
    ("kb", "viem ket mac hoac nhiem trung mat", "ocular_infection", "all"),
    ("kb", "viêm kết mạc hoặc nhiễm trùng mắt", "ocular_infection", "all"),
    ("kb", "benh mat", "ocular_infection", "all"),
    ("emr", "viem tai ngoai", "otitis_or_ear_parasites", "all"),
    ("emr", "ghe tai", "otitis_or_ear_parasites", "all"),
    ("vision", "otitis externa", "otitis_or_ear_parasites", "all"),
    ("vision", "ear mites", "otitis_or_ear_parasites", "all"),
    (
        "kb",
        "viem tai ngoai hoac benh tai ky sinh trung",
        "otitis_or_ear_parasites",
        "all",
    ),
    (
        "kb",
        "viêm tai ngoài hoặc bệnh tai ký sinh trùng",
        "otitis_or_ear_parasites",
        "all",
    ),
    ("emr", "viem da", "dermatosis_or_ectoparasites", "all"),
    ("emr", "ghe", "dermatosis_or_ectoparasites", "all"),
    ("emr", "demodex", "dermatosis_or_ectoparasites", "all"),
    ("emr", "sarcoptes", "dermatosis_or_ectoparasites", "all"),
    ("vision", "dermatitis", "dermatosis_or_ectoparasites", "all"),
    ("vision", "demodicosis", "dermatosis_or_ectoparasites", "all"),
    ("vision", "sarcoptic mange", "dermatosis_or_ectoparasites", "all"),
    (
        "kb",
        "viem da hoac benh da ky sinh trung",
        "dermatosis_or_ectoparasites",
        "all",
    ),
    (
        "kb",
        "viêm da hoặc bệnh da ký sinh trùng",
        "dermatosis_or_ectoparasites",
        "all",
    ),
    ("kb", "benh da", "dermatosis_or_ectoparasites", "all"),
]


class DiseaseMappingService:
    """Canonical disease mapping with DB-backed snapshot and autonomous updates."""

    MAP_EXISTING_CONFIDENCE = 0.90
    CREATE_NEW_CONFIDENCE = 0.85  # Reduced from 0.94 to enable autonomous learning
    MAX_CANDIDATES = 5

    def __init__(self, *, snapshot_ttl_seconds: int = 300) -> None:
        self._snapshot_ttl = timedelta(seconds=snapshot_ttl_seconds)
        self._catalog: Dict[str, DiseaseCatalogEntry] = {}
        self._aliases: Dict[Tuple[str, str, str], str] = {}
        self._alias_entries: list[DiseaseAliasEntry] = []
        self._last_refresh_at: Optional[datetime] = None
        self._last_db_attempt_at: Optional[datetime] = None
        self._loaded_from_db = False
        self._llm_client: Optional[BaseLLMClient] = None
        self._load_default_snapshot()

    def _load_default_snapshot(self) -> None:
        catalog: Dict[str, DiseaseCatalogEntry] = {}
        for item in DEFAULT_DISEASE_CATALOG:
            catalog[item["canonical_code"]] = DiseaseCatalogEntry(**item)

        alias_entries = [
            DiseaseAliasEntry(
                source_type=source_type,
                alias_text=alias_text,
                normalized_alias=_normalize_text(alias_text),
                canonical_code=canonical_code,
                species=(species or "all").lower(),
            )
            for source_type, alias_text, canonical_code, species in DEFAULT_DISEASE_ALIASES
        ]
        self._replace_snapshot(catalog, alias_entries, loaded_from_db=False)

    def _replace_snapshot(
        self,
        catalog: Dict[str, DiseaseCatalogEntry],
        alias_entries: list[DiseaseAliasEntry],
        *,
        loaded_from_db: bool,
    ) -> None:
        self._catalog = catalog
        self._alias_entries = alias_entries
        self._aliases = {
            (
                entry.source_type,
                entry.normalized_alias,
                entry.species,
            ): entry.canonical_code
            for entry in alias_entries
        }
        self._loaded_from_db = loaded_from_db
        self._last_refresh_at = datetime.now(timezone.utc)

    def _should_refresh(self) -> bool:
        if self._last_refresh_at is None:
            return True
        return datetime.now(timezone.utc) - self._last_refresh_at >= self._snapshot_ttl

    async def refresh_from_db(self, *, force: bool = False) -> bool:
        """Reload active disease catalog and aliases from PostgreSQL."""
        now = datetime.now(timezone.utc)
        if (
            not force
            and self._last_db_attempt_at is not None
            and now - self._last_db_attempt_at < self._snapshot_ttl
        ):
            return self._loaded_from_db
        self._last_db_attempt_at = now

        try:
            catalog_entries, alias_entries = await self._fetch_active_rows()
        except Exception as exc:
            if self._is_missing_mapping_schema_error(exc):
                logger.warning(
                    "Disease mapping tables are missing. Run Alembic migration "
                    "`004_disease_mapping_catalog` or `alembic upgrade head`. "
                    "Fallback snapshot remains active."
                )
            else:
                logger.warning(
                    "Disease mapping refresh failed, keep fallback snapshot: {}",
                    exc,
                )
            return self._loaded_from_db

        if not catalog_entries or not alias_entries:
            logger.warning(
                "Disease mapping tables are empty or incomplete, keep fallback snapshot"
            )
            return self._loaded_from_db

        self._replace_snapshot(catalog_entries, alias_entries, loaded_from_db=True)
        return True

    def _is_missing_mapping_schema_error(self, exc: Exception) -> bool:
        message = str(exc).lower()
        return (
            "undefinedtableerror" in message
            or 'relation "disease_catalog" does not exist' in message
            or 'relation "disease_aliases" does not exist' in message
        )

    async def _fetch_active_rows(
        self,
    ) -> tuple[Dict[str, DiseaseCatalogEntry], list[DiseaseAliasEntry]]:
        async with AsyncSessionLocal() as session:
            catalog_result = await session.execute(
                select(DiseaseCatalog).where(DiseaseCatalog.is_active.is_(True))
            )
            alias_result = await session.execute(
                select(DiseaseAlias).where(DiseaseAlias.is_active.is_(True))
            )
            catalog_rows = list(catalog_result.scalars().all())
            alias_rows = list(alias_result.scalars().all())

        catalog_entries = {
            row.canonical_code: DiseaseCatalogEntry(
                canonical_code=row.canonical_code,
                display_name_vi=row.display_name_vi,
                species=(row.species or "all").lower(),
            )
            for row in catalog_rows
        }
        alias_entries = [
            DiseaseAliasEntry(
                source_type=(row.source_type or "").lower(),
                alias_text=row.alias_text,
                normalized_alias=_normalize_text(
                    row.normalized_alias or row.alias_text
                ),
                canonical_code=row.canonical_code,
                species=(row.species or "all").lower(),
            )
            for row in alias_rows
            if row.canonical_code in catalog_entries
        ]
        return catalog_entries, alias_entries

    def map_label(
        self,
        *,
        raw_label: str,
        source_type: str,
        species: Optional[str] = None,
        taxonomy_hint: Optional[str] = None,  # NEW: Taxonomy hint to boost confidence
    ) -> DiseaseMappingResult:
        normalized_label = _normalize_text(raw_label)
        normalized_species = (species or "all").strip().lower() or "all"

        if not normalized_label:
            return self._provisional_result(
                raw_label=raw_label, source_type=source_type
            )

        canonical_code = self._lookup_alias(
            source_type=source_type,
            normalized_alias=normalized_label,
            species=normalized_species,
        )
        catalog_entry = self._catalog.get(canonical_code) if canonical_code else None

        # Build result
        result = DiseaseMappingResult(
            raw_label=raw_label,
            canonical_code=canonical_code,
            display_name_vi=catalog_entry.display_name_vi if catalog_entry else None,
            mapped=canonical_code is not None,
            source_type=source_type,
        )

        return result

    async def resolve_label(
        self,
        *,
        raw_label: str,
        source_type: str,
        species: Optional[str] = None,
        context_text: Optional[str] = None,
        taxonomy_hint: Optional[str] = None,  # NEW: Taxonomy hint to boost confidence
    ) -> DiseaseMappingResult:
        direct_match = self.map_label(
            raw_label=raw_label,
            source_type=source_type,
            species=species,
            taxonomy_hint=taxonomy_hint,
        )
        if direct_match.mapped:
            return direct_match

        normalized_species = (species or "all").strip().lower() or "all"
        candidates = self._find_candidate_canonicals(
            raw_label=raw_label,
            species=normalized_species,
        )
        decision = await self._resolve_with_llm(
            raw_label=raw_label,
            source_type=source_type,
            species=normalized_species,
            context_text=context_text,
            candidates=candidates,
            taxonomy_hint=taxonomy_hint,  # Pass hint to LLM
        )
        if decision is None:
            return self._provisional_result(
                raw_label=raw_label, source_type=source_type
            )

        if decision.action == "map_existing":
            mapped_result = await self._persist_existing_alias_mapping(
                raw_label=raw_label,
                source_type=source_type,
                species=normalized_species,
                decision=decision,
            )
            if mapped_result is not None:
                return mapped_result

        if decision.action == "create_new":
            mapped_result = await self._persist_new_canonical_mapping(
                raw_label=raw_label,
                source_type=source_type,
                species=normalized_species,
                decision=decision,
            )
            if mapped_result is not None:
                return mapped_result

        return self._provisional_result(raw_label=raw_label, source_type=source_type)

    def _lookup_alias(
        self,
        *,
        source_type: str,
        normalized_alias: str,
        species: str,
    ) -> Optional[str]:
        source = (source_type or "").lower()
        exact_key = (source, normalized_alias, species)
        all_species_key = (source, normalized_alias, "all")
        if exact_key in self._aliases:
            return self._aliases[exact_key]
        if all_species_key in self._aliases:
            return self._aliases[all_species_key]

        for (
            alias_source,
            alias_text,
            alias_species,
        ), canonical_code in self._aliases.items():
            if alias_source != source or alias_text != normalized_alias:
                continue
            if alias_species in {species, "all"}:
                return canonical_code

        for (
            alias_source,
            alias_text,
            alias_species,
        ), canonical_code in self._aliases.items():
            if alias_text != normalized_alias:
                continue
            if alias_species in {species, "all"}:
                return canonical_code
        return None

    def map_many(
        self,
        *,
        labels: Iterable[str],
        source_type: str,
        species: Optional[str] = None,
    ) -> list[DiseaseMappingResult]:
        return [
            self.map_label(raw_label=label, source_type=source_type, species=species)
            for label in labels
        ]

    def find_canonical_in_text(
        self,
        *,
        text: str,
        preferred_source_types: Optional[Iterable[str]] = None,
        species: Optional[str] = None,
    ) -> DiseaseMappingResult:
        normalized_text = _normalize_text(text)
        normalized_species = (species or "all").strip().lower() or "all"
        if not normalized_text:
            return DiseaseMappingResult(
                raw_label=text,
                canonical_code=None,
                display_name_vi=None,
                mapped=False,
                source_type="text",
            )

        preferred = [
            source_type.lower()
            for source_type in (preferred_source_types or [])
            if source_type
        ]
        source_priority = {
            source_type: index for index, source_type in enumerate(preferred)
        }
        best_match: Optional[tuple[int, int, int, str]] = None

        for entry in self._alias_entries:
            if preferred and entry.source_type not in source_priority:
                continue
            if entry.species not in {normalized_species, "all"}:
                continue
            if (
                not entry.normalized_alias
                or entry.normalized_alias not in normalized_text
            ):
                continue

            species_score = 1 if entry.species == normalized_species else 0
            preferred_rank = -source_priority.get(entry.source_type, len(preferred))
            candidate = (
                len(entry.normalized_alias),
                species_score,
                preferred_rank,
                entry.canonical_code,
            )
            if best_match is None or candidate > best_match:
                best_match = candidate

        canonical_code = best_match[3] if best_match else None
        catalog_entry = self._catalog.get(canonical_code) if canonical_code else None
        return DiseaseMappingResult(
            raw_label=text,
            canonical_code=canonical_code,
            display_name_vi=catalog_entry.display_name_vi if catalog_entry else None,
            mapped=canonical_code is not None,
            source_type="text",
        )

    async def _get_llm_client(self) -> Optional[BaseLLMClient]:
        if self._llm_client is not None:
            return self._llm_client

        try:
            async with AsyncSessionLocal() as db:
                self._llm_client = await get_llm_client_from_db(db)
            return self._llm_client
        except Exception as exc:
            logger.warning(
                "Disease mapping autonomous LLM unavailable, keep provisional fallback: {}",
                exc,
            )
            return None

    def _find_candidate_canonicals(
        self,
        *,
        raw_label: str,
        species: str,
    ) -> List[CanonicalCandidate]:
        normalized_label = _normalize_text(raw_label)
        if not normalized_label:
            return []

        candidates: List[CanonicalCandidate] = []
        for canonical_code, entry in self._catalog.items():
            if entry.species not in {species, "all"}:
                continue

            alias_hits: List[tuple[float, str]] = []
            score = self._score_text_similarity(
                normalized_label,
                _normalize_text(entry.display_name_vi),
            )

            for alias_entry in self._alias_entries:
                if alias_entry.canonical_code != canonical_code:
                    continue
                if alias_entry.species not in {species, "all"}:
                    continue
                alias_score = self._score_text_similarity(
                    normalized_label,
                    alias_entry.normalized_alias,
                )
                if alias_score <= 0.0:
                    continue
                score = max(score, alias_score)
                alias_hits.append((alias_score, alias_entry.alias_text))

            if score < 0.25:
                continue

            matched_aliases = tuple(
                text for _, text in sorted(alias_hits, reverse=True)[:3]
            )
            candidates.append(
                CanonicalCandidate(
                    canonical_code=canonical_code,
                    display_name_vi=entry.display_name_vi,
                    species=entry.species,
                    score=round(score, 3),
                    matched_aliases=matched_aliases,
                )
            )

        candidates.sort(
            key=lambda item: (item.score, item.display_name_vi), reverse=True
        )
        return candidates[: self.MAX_CANDIDATES]

    def _score_text_similarity(self, left: str, right: str) -> float:
        if not left or not right:
            return 0.0
        if left == right:
            return 1.0

        sequence_ratio = SequenceMatcher(None, left, right).ratio()
        left_tokens = set(left.split())
        right_tokens = set(right.split())
        overlap = 0.0
        if left_tokens and right_tokens:
            overlap = len(left_tokens & right_tokens) / len(left_tokens | right_tokens)

        substring_bonus = 0.0
        if left in right or right in left:
            substring_bonus = 0.92

        return max(sequence_ratio, overlap, substring_bonus)

    async def _resolve_with_llm(
        self,
        *,
        raw_label: str,
        source_type: str,
        species: str,
        context_text: Optional[str],
        candidates: List[CanonicalCandidate],
        taxonomy_hint: Optional[str] = None,  # NEW
    ) -> Optional[CanonicalizationDecision]:
        llm_client = await self._get_llm_client()
        if llm_client is None:
            return None

        prompt = self._build_llm_prompt(
            raw_label=raw_label,
            source_type=source_type,
            species=species,
            context_text=context_text,
            candidates=candidates,
            taxonomy_hint=taxonomy_hint,
        )

        try:
            response = await llm_client.generate(
                prompt, temperature=0.1, max_tokens=700
            )
            return self._parse_llm_decision(response.content)
        except Exception as exc:
            logger.warning(
                "Autonomous disease canonicalization failed for '{}': {}",
                raw_label,
                exc,
            )
            return None

    def _build_llm_prompt(
        self,
        *,
        raw_label: str,
        source_type: str,
        species: str,
        context_text: Optional[str],
        candidates: List[CanonicalCandidate],
        taxonomy_hint: Optional[str] = None,  # NEW
    ) -> str:
        candidate_payload = [
            {
                "canonical_code": item.canonical_code,
                "display_name_vi": item.display_name_vi,
                "species": item.species,
                "score": item.score,
                "matched_aliases": list(item.matched_aliases),
            }
            for item in candidates
        ]

        taxonomy_hint_text = ""
        if taxonomy_hint:
            taxonomy_hint_text = f"""

GỢI Ý QUAN TRỌNG:
Có gợi ý từ hệ thống phân loại: '{taxonomy_hint}'
Hãy ưu tiên xem xét bệnh này nếu phù hợp với ngữ cảnh."""

        payload = {
            "raw_label": raw_label,
            "source_type": source_type,
            "species": species,
            "context_text": context_text or "",
            "candidate_canonicals": candidate_payload,
            "taxonomy_hint": taxonomy_hint,
        }
        return f"""You are an internal disease normalization resolver for Petties veterinary AI.
Your job is to normalize a raw disease label into one canonical disease code.

Rules:
- Prefer `map_existing` when a strong canonical candidate already exists.
- Use `create_new` only when no candidate safely matches.
- Use `keep_provisional` if confidence is too low.
- Output valid JSON only.
- `canonical_code` must be snake_case ASCII.
- `display_name_vi` should be short Vietnamese clinical wording.
- Confidence is a number from 0 to 1.
{taxonomy_hint_text}

Return JSON with this schema:
{{
  "action": "map_existing | create_new | keep_provisional",
  "canonical_code": "snake_case_or_null",
  "display_name_vi": "string_or_null",
  "alias_text": "string_or_null",
  "confidence": 0.0
}}

Input:
{json.dumps(payload, ensure_ascii=False, indent=2)}
"""

    def _parse_llm_decision(self, content: str) -> Optional[CanonicalizationDecision]:
        if not content:
            return None

        text = content.strip()
        if text.startswith("```"):
            parts = text.split("```")
            text = next((part for part in parts if "{" in part and "}" in part), text)
            text = text.replace("json", "", 1).strip()

        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None

        try:
            payload = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None

        action = str(payload.get("action") or "keep_provisional").strip().lower()
        if action not in {"map_existing", "create_new", "keep_provisional"}:
            action = "keep_provisional"

        try:
            confidence = float(payload.get("confidence") or 0.0)
        except (TypeError, ValueError):
            confidence = 0.0
        confidence = max(0.0, min(confidence, 1.0))

        canonical_code = self._normalize_canonical_code(payload.get("canonical_code"))
        display_name_vi = str(payload.get("display_name_vi") or "").strip() or None
        alias_text = str(payload.get("alias_text") or "").strip() or None

        return CanonicalizationDecision(
            action=action,
            canonical_code=canonical_code,
            display_name_vi=display_name_vi,
            alias_text=alias_text,
            confidence=confidence,
        )

    async def _persist_existing_alias_mapping(
        self,
        *,
        raw_label: str,
        source_type: str,
        species: str,
        decision: CanonicalizationDecision,
    ) -> Optional[DiseaseMappingResult]:
        canonical_code = decision.canonical_code
        if (
            decision.confidence < self.MAP_EXISTING_CONFIDENCE
            or not canonical_code
            or canonical_code not in self._catalog
        ):
            return None

        alias_text = decision.alias_text or raw_label
        persisted = await self._upsert_alias(
            canonical_code=canonical_code,
            source_type=source_type,
            alias_text=alias_text,
            species=species,
        )
        if not persisted:
            return None

        catalog_entry = self._catalog.get(canonical_code)
        if catalog_entry is None:
            await self.refresh_from_db(force=True)
            catalog_entry = self._catalog.get(canonical_code)
        if catalog_entry is None:
            return None

        return DiseaseMappingResult(
            raw_label=raw_label,
            canonical_code=canonical_code,
            display_name_vi=catalog_entry.display_name_vi,
            mapped=True,
            source_type=source_type,
        )

    async def _persist_new_canonical_mapping(
        self,
        *,
        raw_label: str,
        source_type: str,
        species: str,
        decision: CanonicalizationDecision,
    ) -> Optional[DiseaseMappingResult]:
        if decision.confidence < self.CREATE_NEW_CONFIDENCE:
            return None

        canonical_code = (
            decision.canonical_code
            or self._generate_fallback_canonical_code(
                decision.display_name_vi or raw_label
            )
        )
        display_name_vi = decision.display_name_vi or raw_label.strip()
        if not canonical_code or not display_name_vi:
            return None

        persisted = await self._create_canonical_and_alias(
            canonical_code=canonical_code,
            display_name_vi=display_name_vi,
            source_type=source_type,
            alias_text=decision.alias_text or raw_label,
            species=species,
        )
        if not persisted:
            return None

        catalog_entry = self._catalog.get(canonical_code)
        if catalog_entry is None:
            await self.refresh_from_db(force=True)
            catalog_entry = self._catalog.get(canonical_code)
        if catalog_entry is None:
            return None

        return DiseaseMappingResult(
            raw_label=raw_label,
            canonical_code=canonical_code,
            display_name_vi=catalog_entry.display_name_vi,
            mapped=True,
            source_type=source_type,
        )

    async def _upsert_alias(
        self,
        *,
        canonical_code: str,
        source_type: str,
        alias_text: str,
        species: str,
    ) -> bool:
        normalized_alias = _normalize_text(alias_text)
        normalized_source = (source_type or "unknown").strip().lower() or "unknown"
        normalized_species = species or "all"
        if not normalized_alias:
            return False

        try:
            async with AsyncSessionLocal() as session:
                catalog_result = await session.execute(
                    select(DiseaseCatalog).where(
                        DiseaseCatalog.canonical_code == canonical_code,
                        DiseaseCatalog.is_active.is_(True),
                    )
                )
                catalog_row = catalog_result.scalar_one_or_none()
                if catalog_row is None:
                    return False

                alias_result = await session.execute(
                    select(DiseaseAlias).where(
                        DiseaseAlias.source_type == normalized_source,
                        DiseaseAlias.normalized_alias == normalized_alias,
                        DiseaseAlias.species == normalized_species,
                    )
                )
                existing = alias_result.scalar_one_or_none()

                if existing is None:
                    session.add(
                        DiseaseAlias(
                            canonical_code=canonical_code,
                            source_type=normalized_source,
                            alias_text=alias_text.strip(),
                            normalized_alias=normalized_alias,
                            species=normalized_species,
                            is_active=True,
                        )
                    )
                elif existing.canonical_code != canonical_code:
                    logger.warning(
                        "Refuse to overwrite disease alias '{}' from {} to {}",
                        normalized_alias,
                        existing.canonical_code,
                        canonical_code,
                    )
                    return False
                else:
                    existing.alias_text = alias_text.strip()
                    existing.is_active = True

                await session.commit()
        except IntegrityError as exc:
            logger.warning(
                "Disease alias upsert conflicted for '{}': {}", alias_text, exc
            )
            await self.refresh_from_db(force=True)
            return self.map_label(
                raw_label=alias_text,
                source_type=normalized_source,
                species=normalized_species,
            ).mapped
        except Exception as exc:
            logger.warning("Disease alias upsert failed for '{}': {}", alias_text, exc)
            return False

        await self.refresh_from_db(force=True)
        return True

    async def _create_canonical_and_alias(
        self,
        *,
        canonical_code: str,
        display_name_vi: str,
        source_type: str,
        alias_text: str,
        species: str,
    ) -> bool:
        normalized_code = self._normalize_canonical_code(canonical_code)
        normalized_display = display_name_vi.strip()
        if not normalized_code or not normalized_display:
            return False

        normalized_species = species or "all"
        try:
            async with AsyncSessionLocal() as session:
                existing_catalog_result = await session.execute(
                    select(DiseaseCatalog).where(
                        DiseaseCatalog.canonical_code == normalized_code
                    )
                )
                catalog_row = existing_catalog_result.scalar_one_or_none()

                if catalog_row is None:
                    session.add(
                        DiseaseCatalog(
                            canonical_code=normalized_code,
                            display_name_vi=normalized_display,
                            species="all",
                            is_active=True,
                        )
                    )
                    await session.flush()

                alias_result = await session.execute(
                    select(DiseaseAlias).where(
                        DiseaseAlias.source_type == (source_type or "unknown").lower(),
                        DiseaseAlias.normalized_alias == _normalize_text(alias_text),
                        DiseaseAlias.species == normalized_species,
                    )
                )
                existing_alias = alias_result.scalar_one_or_none()

                if existing_alias is None:
                    session.add(
                        DiseaseAlias(
                            canonical_code=normalized_code,
                            source_type=(source_type or "unknown").lower(),
                            alias_text=alias_text.strip(),
                            normalized_alias=_normalize_text(alias_text),
                            species=normalized_species,
                            is_active=True,
                        )
                    )
                elif existing_alias.canonical_code != normalized_code:
                    logger.warning(
                        "Canonical creation conflict for alias '{}' -> '{}'",
                        alias_text,
                        existing_alias.canonical_code,
                    )
                    return False

                await session.commit()
        except IntegrityError as exc:
            logger.warning(
                "Disease canonical create/upsert conflicted for '{}': {}",
                normalized_code,
                exc,
            )
            await self.refresh_from_db(force=True)
            return self.map_label(
                raw_label=alias_text,
                source_type=source_type,
                species=normalized_species,
            ).mapped
        except Exception as exc:
            logger.warning(
                "Disease canonical create/upsert failed for '{}': {}",
                normalized_code,
                exc,
            )
            return False

        await self.refresh_from_db(force=True)
        return True

    def _provisional_result(
        self,
        *,
        raw_label: str,
        source_type: str,
    ) -> DiseaseMappingResult:
        return DiseaseMappingResult(
            raw_label=raw_label,
            canonical_code=None,
            display_name_vi=None,
            mapped=False,
            source_type=source_type,
        )

    def _normalize_canonical_code(self, value: Optional[str]) -> Optional[str]:
        normalized = _normalize_text(str(value or "")).replace(" ", "_")
        normalized = normalized.strip("_")
        if not normalized:
            return None
        if normalized[0].isdigit():
            normalized = f"disease_{normalized}"
        return normalized[:100]

    def _generate_fallback_canonical_code(self, value: str) -> Optional[str]:
        normalized = self._normalize_canonical_code(value)
        if not normalized:
            return None
        return normalized


_disease_mapping_service: Optional[DiseaseMappingService] = None


def get_disease_mapping_service() -> DiseaseMappingService:
    global _disease_mapping_service
    if _disease_mapping_service is None:
        _disease_mapping_service = DiseaseMappingService()
    return _disease_mapping_service
