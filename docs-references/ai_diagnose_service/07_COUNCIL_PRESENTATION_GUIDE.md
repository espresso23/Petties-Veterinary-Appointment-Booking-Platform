# AI Diagnose Council Presentation Guide

> Last Updated: 2026-04-02
> Scope: staff AI diagnosis, grounded SOAP synthesis, Case Memory, runtime safety, and likely council questions

---

## 1. One-minute opening

Use this message first:

"Petties AI Diagnose is a clinical support feature for staff inside the EMR workspace. It does not replace the doctor. It retrieves internal evidence from the Knowledge Base, Knowledge Graph, and confirmed EMR Case Memory, then generates a grounded SOAP draft and treatment suggestions for faster documentation and safer decision support."

---

## 2. What problem it solves

- Staff often write SOAP manually from fragmented inputs.
- Similar past cases are hard to recall consistently.
- Treatment planning quality depends on personal memory and time pressure.
- AI Diagnose turns scattered clinical input into a grounded draft faster and more consistently.

---

## 3. Core value proposition

### 3.1 Clinical value

- Suggests differential diagnoses from internal evidence only.
- Drafts SOAP in a structure doctors already use.
- Reuses confirmed EMR patterns for repeated cases.
- Helps standardize treatment planning and documentation quality.

### 3.2 Safety value

- Internal-only evidence boundary.
- Grounded SOAP by section.
- No hardcoded disease-specific prescription rules.
- Final diagnosis and final prescription always belong to the doctor.

---

## 4. Runtime story to present

### 4.1 Full analysis

1. Doctor enters narrative, draft SOAP, optional images.
2. AI retrieves KB, KG, and similar confirmed cases from Case Memory.
3. If needed, vision analyzes the images.
4. The service builds a grounding bundle for Subjective, Objective, Assessment, and Plan.
5. The model writes a grounded SOAP draft and differential diagnoses.

### 4.2 Selected-only follow-up

1. Doctor selects one diagnosis from the differential list.
2. AI reuses the cached grounded context.
3. The service prioritizes learned protocol items from confirmed EMR for that diagnosis.
4. The plan and prescription suggestions become more focused.

### 4.3 Confirmed learning loop

1. Doctor edits the EMR and saves the final record.
2. Spring Boot pushes the confirmed EMR to the AI service.
3. AI builds runtime protocol metadata from confirmed EMR content.
4. The case is stored in Case Memory for future retrieval.

---

## 5. Architecture in simple words

### 5.1 Inputs

- doctor narrative
- current SOAP draft
- pet context
- optional clinical images

### 5.2 Internal evidence sources

- Knowledge Base
- Knowledge Graph
- confirmed EMR Case Memory

### 5.3 Outputs

- top differential diagnoses
- grounded SOAP suggestions
- learned protocol suggestions
- safety reminders

---

## 6. Why Case Memory matters

Case Memory is not a full EMR mirror anymore.

It now keeps only runtime-relevant fields:

- `text_content`
- `species`
- `chief_complaint`
- `clinical_notes`
- `display_name_vi`
- `final_diagnosis_text`
- `canonical_code`
- `mapping_status`
- `exam_at`
- `protocol_pattern`

This makes the system easier to explain, easier to audit, and closer to real runtime usage.

---

## 7. Council FAQ with suggested answers

### Q1. Does the AI replace the doctor?

**Answer:** No. The AI only supports documentation and clinical reasoning. The doctor still chooses the final diagnosis, final SOAP, and final prescriptions.

### Q2. Why is this trustworthy?

**Answer:** The diagnosis flow uses internal evidence only: KB, KG, confirmed EMR Case Memory, and image analysis when needed. The SOAP draft is grounded section by section instead of free-form generation.

### Q3. How do you reduce hallucination?

**Answer:** We use grounded SOAP rules. The model cannot invent a diagnosis outside the normalized differential set. Each SOAP section is constrained by the evidence bundle built before generation.

### Q4. Why not use open web search?

**Answer:** For staff diagnosis, web search is intentionally blocked. We prioritize internal trust and consistency over uncontrolled external content.

### Q5. How does the system learn from real cases?

**Answer:** Only confirmed EMR records are synchronized into Case Memory. Every confirmed EMR is treated as equally valid clinical learning input in runtime ranking.

### Q6. Do you use quality-based runtime penalties for confirmed EMR cases?

**Answer:** No. Runtime retrieval does not use quality-based penalties. Confirmed EMR records are treated as valid learning inputs, and diagnosis behavior is driven by retrieval similarity plus protocol evidence.

### Q7. What if the diagnosis label is not mapped yet?

**Answer:** The system now tries autonomous canonicalization first. It prefers an existing canonical disease, can learn a new alias automatically, and only keeps the case provisional if confidence is still too low.

### Q8. Why do you use `selected_only`?

**Answer:** It supports the doctor workflow. After a doctor chooses a likely diagnosis, the system narrows the SOAP and treatment draft using the already-grounded context instead of recomputing everything from scratch.

### Q9. How do you keep patient privacy under control?

**Answer:** Case Memory keeps a runtime-focused payload instead of a full raw EMR mirror. Only fields needed for retrieval, ranking, and grounded synthesis remain active in the diagnosis runtime schema.

### Q10. What happens if evidence is weak?

**Answer:** The system must stay conservative. It returns safe wording such as "insufficient evidence" or "needs more data" instead of fabricating unsupported clinical facts.

### Q11. How do you migrate old Case Memory data after a schema cleanup?

**Answer:** We provide an admin-only re-sync flow from confirmed EMR records. Spring Boot can replay eligible EMRs into the AI service so Case Memory is rebuilt under the active runtime schema without changing the doctor workflow.

### Q12. Do you need a human admin to maintain disease aliases every day?

**Answer:** No. The active operating model is autonomous canonicalization: the system first tries exact alias mapping, then uses an internal LLM resolver to map to an existing canonical disease or create a new canonical disease when confidence is high enough.

### Q13. Does autonomous canonicalization require new database tables?

**Answer:** No. The planned design reuses `disease_catalog` and `disease_aliases`. The current review-queue table is expected to become unnecessary for the active runtime workflow.

---

## 8. Likely concerns and mitigation

| Concern | Explanation | Mitigation |
|---|---|---|
| Hallucinated SOAP | LLM may over-generalize | Grounding bundle, section-level constraints, internal-only evidence |
| Wrong prescription suggestion | AI suggestion may differ from doctor final treatment | Doctor final review, generic safety checks, protocol learning from confirmed EMR |
| Weak mapping quality | Raw labels from EMR may be inconsistent | disease catalog, alias mapping, provisional fallback |
| Daily admin dependency | Alias maintenance does not scale if it depends on manual review | autonomous canonicalization without new DB tables |
| Noisy Case Memory payload | Extra fields make runtime harder to explain | runtime-only schema |
| Image mismatch | Image may not be the main clinical clue | optional vision, fallback to text-first internal evidence |
| Cache miss in `selected_only` | Cached request may expire | safe fallback, no workflow corruption |

---

## 9. Recommended demo sequence

1. Open EMR page.
2. Enter a short clinical narrative.
3. Run full analysis.
4. Show differential diagnoses and grounded SOAP draft.
5. Select one diagnosis.
6. Show how `selected_only` focuses the plan.
7. Save EMR.
8. Explain how the confirmed EMR becomes future Case Memory.

---

## 10. Backup answers if the demo fails

- If the image step fails: continue with text-only grounded retrieval and explain that image analysis is optional.
- If `selected_only` cache is missing: explain that the system safely falls back to standard runtime behavior.
- If a case has no learned protocol: explain that the system falls back to grounded AI drafting instead of pretending there is learned evidence.

---

## 11. Final message to end the presentation

"The main contribution of Petties AI Diagnose is not unrestricted generation. It is a controlled clinical support pipeline that turns internal evidence and confirmed EMR experience into grounded SOAP assistance for staff, while preserving doctor authority and safety boundaries."
