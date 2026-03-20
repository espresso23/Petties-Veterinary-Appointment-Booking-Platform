"""
Disease mapping service backed by PostgreSQL with safe in-memory fallback.

Goals:
- Normalize disease labels from KB, KG, EMR and vision into one canonical code.
- Load aliases from PostgreSQL so mapping can evolve without redeploy.
- Keep an in-memory default snapshot for local/dev safety and test isolation.
- Persist unmapped labels into a review queue instead of silently skipping them.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, Optional, Tuple

from loguru import logger
from sqlalchemy import select

from app.db.postgres.models import (
    DiseaseAlias,
    DiseaseCatalog,
    DiseaseMappingReviewItem,
)
from app.db.postgres.session import AsyncSessionLocal


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
    body_system: Optional[str] = None
    protocol_key: Optional[str] = None


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


DEFAULT_DISEASE_CATALOG = [
    {
        "canonical_code": "bacterial_dermatosis",
        "display_name_vi": "Viêm da do vi khuẩn",
        "species": "all",
        "body_system": "skin",
        "protocol_key": "bacterial_dermatosis",
    },
    {
        "canonical_code": "ocular_infection",
        "display_name_vi": "Viêm kết mạc hoặc nhiễm trùng mắt",
        "species": "all",
        "body_system": "eye",
        "protocol_key": "ocular_infection",
    },
    {
        "canonical_code": "otitis_or_ear_parasites",
        "display_name_vi": "Viêm tai ngoài hoặc bệnh tai ký sinh trùng",
        "species": "all",
        "body_system": "ear",
        "protocol_key": "otitis_or_ear_parasites",
    },
    {
        "canonical_code": "dermatosis_or_ectoparasites",
        "display_name_vi": "Viêm da hoặc bệnh da ký sinh trùng",
        "species": "all",
        "body_system": "skin",
        "protocol_key": "dermatosis_or_ectoparasites",
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
    ("kb", "viem tai ngoai hoac benh tai ky sinh trung", "otitis_or_ear_parasites", "all"),
    ("kb", "viêm tai ngoài hoặc bệnh tai ký sinh trùng", "otitis_or_ear_parasites", "all"),
    ("emr", "viem da", "dermatosis_or_ectoparasites", "all"),
    ("emr", "ghe", "dermatosis_or_ectoparasites", "all"),
    ("emr", "demodex", "dermatosis_or_ectoparasites", "all"),
    ("emr", "sarcoptes", "dermatosis_or_ectoparasites", "all"),
    ("vision", "dermatitis", "dermatosis_or_ectoparasites", "all"),
    ("vision", "demodicosis", "dermatosis_or_ectoparasites", "all"),
    ("vision", "sarcoptic mange", "dermatosis_or_ectoparasites", "all"),
    ("kb", "viem da hoac benh da ky sinh trung", "dermatosis_or_ectoparasites", "all"),
    ("kb", "viêm da hoặc bệnh da ký sinh trùng", "dermatosis_or_ectoparasites", "all"),
    ("kb", "benh da", "dermatosis_or_ectoparasites", "all"),
]


class DiseaseMappingService:
    """Canonical disease mapping with DB-backed snapshot and review queue."""

    def __init__(self, *, snapshot_ttl_seconds: int = 300) -> None:
        self._snapshot_ttl = timedelta(seconds=snapshot_ttl_seconds)
        self._catalog: Dict[str, DiseaseCatalogEntry] = {}
        self._aliases: Dict[Tuple[str, str, str], str] = {}
        self._alias_entries: list[DiseaseAliasEntry] = []
        self._last_refresh_at: Optional[datetime] = None
        self._last_db_attempt_at: Optional[datetime] = None
        self._loaded_from_db = False
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
            (entry.source_type, entry.normalized_alias, entry.species): entry.canonical_code
            for entry in alias_entries
        }
        self._loaded_from_db = loaded_from_db
        self._last_refresh_at = datetime.now(timezone.utc)

    def _should_refresh(self) -> bool:
        if self._last_refresh_at is None:
            return True
        return datetime.now(timezone.utc) - self._last_refresh_at >= self._snapshot_ttl

    async def refresh_from_db(self, *, force: bool = False) -> bool:
        """
        Reload active disease catalog and aliases from PostgreSQL.

        Returns:
            True if DB snapshot is active after refresh, False if fallback snapshot remains.
        """
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
                logger.warning("Disease mapping refresh failed, keep fallback snapshot: {}", exc)
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
            or 'relation "disease_mapping_review_items" does not exist' in message
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
                body_system=row.body_system,
                protocol_key=row.protocol_key,
            )
            for row in catalog_rows
        }
        alias_entries = [
            DiseaseAliasEntry(
                source_type=(row.source_type or "").lower(),
                alias_text=row.alias_text,
                normalized_alias=_normalize_text(row.normalized_alias or row.alias_text),
                canonical_code=row.canonical_code,
                species=(row.species or "all").lower(),
            )
            for row in alias_rows
            if row.canonical_code in catalog_entries
        ]
        return catalog_entries, alias_entries

    def get_catalog_entry(self, canonical_code: Optional[str]) -> Optional[DiseaseCatalogEntry]:
        if not canonical_code:
            return None
        return self._catalog.get(canonical_code)

    def map_label(
        self,
        *,
        raw_label: str,
        source_type: str,
        species: Optional[str] = None,
    ) -> DiseaseMappingResult:
        normalized_label = _normalize_text(raw_label)
        normalized_species = (species or "all").strip().lower() or "all"

        if not normalized_label:
            return DiseaseMappingResult(
                raw_label=raw_label,
                canonical_code=None,
                display_name_vi=None,
                mapped=False,
                source_type=source_type,
            )

        canonical_code = self._lookup_alias(
            source_type=source_type,
            normalized_alias=normalized_label,
            species=normalized_species,
        )
        catalog_entry = self._catalog.get(canonical_code) if canonical_code else None
        return DiseaseMappingResult(
            raw_label=raw_label,
            canonical_code=canonical_code,
            display_name_vi=catalog_entry.display_name_vi if catalog_entry else None,
            mapped=canonical_code is not None,
            source_type=source_type,
        )

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

        for (alias_source, alias_text, alias_species), canonical_code in self._aliases.items():
            if alias_source != source or alias_text != normalized_alias:
                continue
            if alias_species in {species, "all"}:
                return canonical_code

        for (alias_source, alias_text, alias_species), canonical_code in self._aliases.items():
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
            if not entry.normalized_alias or entry.normalized_alias not in normalized_text:
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

    async def record_unmapped_label(
        self,
        *,
        raw_label: str,
        source_type: str,
        species: Optional[str] = None,
        sample_payload: Optional[dict] = None,
    ) -> bool:
        normalized_label = _normalize_text(raw_label)
        if not normalized_label:
            return False

        try:
            await self._upsert_review_item(
                raw_label=raw_label,
                normalized_label=normalized_label,
                source_type=(source_type or "unknown").lower(),
                species=(species or "all").lower(),
                sample_payload=sample_payload or {},
            )
            return True
        except Exception as exc:
            logger.warning("Failed to record unmapped disease label '{}': {}", raw_label, exc)
            return False

    async def _upsert_review_item(
        self,
        *,
        raw_label: str,
        normalized_label: str,
        source_type: str,
        species: str,
        sample_payload: dict,
    ) -> None:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(DiseaseMappingReviewItem).where(
                    DiseaseMappingReviewItem.source_type == source_type,
                    DiseaseMappingReviewItem.normalized_label == normalized_label,
                    DiseaseMappingReviewItem.species == species,
                )
            )
            existing = result.scalar_one_or_none()

            if existing is None:
                session.add(
                    DiseaseMappingReviewItem(
                        raw_label=raw_label,
                        normalized_label=normalized_label,
                        source_type=source_type,
                        species=species,
                        sample_payload=sample_payload,
                    )
                )
            else:
                existing.raw_label = raw_label
                existing.hit_count = int(existing.hit_count or 0) + 1
                existing.last_seen_at = datetime.now(timezone.utc)
                if sample_payload:
                    existing.sample_payload = sample_payload

            await session.commit()


_disease_mapping_service: Optional[DiseaseMappingService] = None


def get_disease_mapping_service() -> DiseaseMappingService:
    global _disease_mapping_service
    if _disease_mapping_service is None:
        _disease_mapping_service = DiseaseMappingService()
    return _disease_mapping_service


def reset_disease_mapping_service() -> None:
    global _disease_mapping_service
    _disease_mapping_service = None
