# Clinic Mascot Copilot Implementation Plan

Last Updated: 2026-04-07
Owner: AI Platform + Web Team
Status: Draft for execution

## 1. Goal

Replace role-specific AI chat pages with a global mascot copilot experience inside clinic internal web surfaces.

This plan explicitly applies to:
- STAFF
- CLINIC_MANAGER
- CLINIC_OWNER

This plan explicitly does not apply to:
- PET_OWNER

Persona policy:
- Use one unified Petties persona only.
- Do not use clinic-specific branding persona.

Transition policy:
- Do not keep existing AI pages as fallback in product flow.

## 2. Current State

Current implementation is still page-centric for role AI interactions:
- staff ai chat page
- clinic manager ai copilot page
- clinic owner ai copilot page

Routing and sidebar entries currently expose AI as dedicated destinations.

## 3. Target State

One global mascot launcher and one shared copilot panel are mounted in clinic internal layouts.

User can invoke copilot from anywhere in clinic workflow without navigation to a dedicated chat page.

Copilot behavior is context-aware and action-oriented:
- booking actions
- service actions
- staff and shift actions
- emr/patient support actions

All write operations remain HITL:
- preview
- confirmation
- execute

## 4. Scope and Non-Scope

### In Scope
- Global launcher and panel for STAFF, CLINIC_MANAGER, CLINIC_OWNER.
- Context payload from active screen and selected entities.
- Action cards and confirm modals for write actions.
- Remove route-level AI page entry from main user journey.

### Out of Scope
- PET_OWNER mascot experience.
- Multi-persona or clinic-level mascot branding.
- New LLM provider changes.

## 5. Affected Files

| File | Change Type | Purpose |
|---|---|---|
| petties-web/src/App.tsx | modify | remove dedicated AI routes for staff/manager/owner |
| petties-web/src/layouts/StaffLayout.tsx | modify | mount mascot launcher and panel |
| petties-web/src/layouts/ClinicManagerLayout.tsx | modify | mount mascot launcher and panel |
| petties-web/src/layouts/ClinicOwnerLayout.tsx | modify | mount mascot launcher and panel |
| petties-web/src/components/Sidebar/Sidebar.tsx | modify | remove page-centric AI nav entries |
| petties-web/src/store/aiChatStore.ts | modify | support global panel session state |
| petties-web/src/services/agentService.ts | modify | standardize context-aware request payload |
| petties-web/src/types/chat-copilot.ts | modify | shared action and context payload typing |
| petties-web/src/components/chat/renderers/** | modify | align card handling for panel usage |
| petties-agent-serivce/app/core/tools/tool_policy.py | verify/modify | enforce role gating for clinic internal mascot tools |
| docs-references/documentation/SRS/PETTIES_SRS.md | modify | add functional requirement for mascot copilot |
| docs-references/documentation/SDD/REPORT_4_SDD_SYSTEM_DESIGN.md | modify | add architecture and sequence design |
| PROJECT_STATUS.md | modify | update implementation progress and evidence |

## 6. Execution Plan

### Phase 0: Documentation First

- [ ] Add SRS section for Clinic Mascot Copilot (roles, triggers, business rules).
- [ ] Add SDD section (class diagram + sequence for action flow + HITL).
- [ ] Add cross-reference matrix SRS to SDD.

Verification
- [ ] Documentation section numbers are valid.
- [ ] Scope excludes PET_OWNER and excludes clinic branding persona.

### Phase 1: Global Mascot Shell

- [ ] Create shared MascotLauncher component.
- [ ] Create shared MascotPanel component.
- [ ] Mount launcher and panel in StaffLayout, ClinicManagerLayout, ClinicOwnerLayout.
- [ ] Ensure panel can open from every internal page.

Verification
- [ ] Visual smoke test on three roles.
- [ ] No dedicated page navigation required to use copilot.

### Phase 2: Context Engine

- [ ] Define context contract from UI: role, route, clinic_id, booking_id, pet_id, selected entity.
- [ ] Inject context into all agent requests from panel.
- [ ] Add safe defaults for missing context.

Verification
- [ ] Context payload logged and validated in development.
- [ ] Copilot response changes when active screen context changes.

### Phase 3: Action and HITL

- [ ] Map action cards to existing UI actions (confirm booking, cancel booking, reassign staff, refresh slot, update service).
- [ ] Enforce confirm modal before write calls.
- [ ] Standardize error and success toast handling.

Verification
- [ ] No write action executes without explicit confirmation.
- [ ] Failed actions show actionable error recovery.

### Phase 4: Remove Page-Centric AI Flow

- [ ] Remove or disable ai-chat and ai-copilot routes from primary app routing.
- [ ] Remove sidebar links that point to dedicated AI pages.
- [ ] Remove dead imports and obsolete page-specific state.

Verification
- [ ] Route guard and navigation tests pass.
- [ ] Deadcode check reports no unused AI page references.

### Phase 5: Test, Rollout, Monitoring

- [ ] Unit tests for launcher, panel, context mapper, action dispatch.
- [ ] Integration tests for websocket action flow with role-gated tools.
- [ ] UAT matrix for STAFF, CLINIC_MANAGER, CLINIC_OWNER.
- [ ] Rollout with feature flag in test environment before production.

Verification
- [ ] Required test suites pass.
- [ ] Production monitoring dashboards show stable error rate and latency.

## 7. Acceptance Criteria

- [ ] STAFF, CLINIC_MANAGER, CLINIC_OWNER can use mascot copilot from any internal page.
- [ ] PET_OWNER has no access to this mascot flow.
- [ ] Unified Petties persona is used everywhere.
- [ ] Dedicated AI pages are not required in the product journey.
- [ ] All write actions require HITL confirmation.

## 8. Risks and Mitigations

1. Risk: Wrong context injection may trigger incorrect actions.
	Mitigation: strict context schema validation and defensive defaults.

2. Risk: Removing dedicated pages may break old links.
	Mitigation: route audit and explicit redirect messaging where needed.

3. Risk: Role gating drift between frontend and backend.
	Mitigation: policy-based tests against tool_policy and UI guards.

## 9. Rollback Strategy

1. Keep mascot feature behind a runtime feature flag.
2. If severe incident occurs, disable mascot feature immediately.
3. Re-enable previous route entries only in emergency hotfix branch if required.

## 10. Definition of Done

- [ ] Documentation updated (SRS, SDD, PROJECT_STATUS).
- [ ] Web implementation merged and tested.
- [ ] AI role/tool policy verified.
- [ ] UAT signoff for three internal clinic roles.
- [ ] Production rollout completed with monitoring in place.

