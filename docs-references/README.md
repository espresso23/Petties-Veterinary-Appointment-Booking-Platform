# PETTIES Documentation Index

**Last Updated:** 2026-03-25

This folder contains the project documentation used by the Petties team.
The core source-of-truth set is intentionally smaller than the full archive of working notes, presentations, and historical analyses.

## Core source-of-truth documents

### Product and design

- `documentation/SRS/PETTIES_SRS.md` - Software Requirements Specification
- `documentation/SDD/REPORT_4_SDD_SYSTEM_DESIGN.md` - Software Design Document
- `documentation/PETTIES_Features.md` - feature inventory and scope reference

### Data model

- `database/PETTIES_DBML.dbml` - canonical PostgreSQL physical schema
- `documentation/PETTIES_ERD_DIAGRAM.md` - canonical hybrid ERD across PostgreSQL, MongoDB, and Qdrant
- `documentation/DATABASE_SCHEMA_ANALYSIS.md` - narrative schema analysis and storage rationale

### Testing

- `testing/TEST_CASES.md` - test inventory and coverage tracking
- `testing/TESTING_STRATEGY.md` - testing strategy
- `testing/AI_SERVICE_TESTING.md` - AI service testing reference

## Folder guide

| Folder | Purpose |
|---|---|
| `database/` | Canonical database artifacts |
| `documentation/` | Requirements, architecture, technical specifications, feature notes |
| `testing/` | Test strategy, test inventories, and feature-level reports |
| `setup/` | Environment setup and local bootstrap guides |
| `deployment/` | Deployment guides for dev, test, and production |
| `development/` | Team workflow, engineering guides, and historical implementation reports |
| `design/` | UI design system and related references |
| `presentation/` | Presentation materials and slide-oriented content |
| `operations/` | Logging, monitoring, and operational playbooks |
| `infrastructure/` | Nginx and environment infrastructure references |
| `reference-command/` | Command references and quick operational commands |

## Important notes

- Technical documents may use English by default to reduce encoding issues.
- Not every file in `docs-references/` is source-of-truth. Some are working notes, presentations, or historical snapshots.
- When database architecture changes, update these files together:
  - `database/PETTIES_DBML.dbml`
  - `documentation/PETTIES_ERD_DIAGRAM.md`
  - `documentation/DATABASE_SCHEMA_ANALYSIS.md`
  - database sections inside SRS and SDD

## Legacy and historical documents

Some documents in `development/`, `presentation/`, and standalone AI notes are retained for historical context.
If a legacy document conflicts with the core source-of-truth set, the core set wins.
