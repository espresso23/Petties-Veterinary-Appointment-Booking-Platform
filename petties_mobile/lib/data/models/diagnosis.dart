enum DiagnosisSpecies {
  dog,
  cat,
  other,
}

enum DiagnosisSex {
  male,
  female,
  unknown,
}

enum DiagnosisImageAnalysisMode {
  full,
  describeOnly,
}

class StaffDiagnosisRequest {
  final String? requestId;
  final String? previousRequestId;
  final String? petId;
  final String? bookingId;
  final DiagnosisSpecies species;
  final String? breed;
  final int? ageMonths;
  final double? weightKg;
  final DiagnosisSex? sex;
  final List<String>? allergies;
  final String doctorDescription;
  final String? bodyPart;
  final List<String>? symptoms;
  final List<String>? imageUrls;
  final DiagnosisImageAnalysisMode? imageAnalysisMode;
  final String? synthesisMode;
  final String? selectedDiagnosisCode;
  final String? selectedDiagnosisLabel;
  final SoapDraft? soapDraft;

  StaffDiagnosisRequest({
    this.requestId,
    this.previousRequestId,
    this.petId,
    this.bookingId,
    required this.species,
    this.breed,
    this.ageMonths,
    this.weightKg,
    this.sex,
    this.allergies,
    required this.doctorDescription,
    this.bodyPart,
    this.symptoms,
    this.imageUrls,
    this.imageAnalysisMode,
    this.synthesisMode,
    this.selectedDiagnosisCode,
    this.selectedDiagnosisLabel,
    this.soapDraft,
  });

  Map<String, dynamic> toJson() {
    return {
      if (requestId != null) 'request_id': requestId,
      if (previousRequestId != null) 'previous_request_id': previousRequestId,
      if (petId != null) 'pet_id': petId,
      if (bookingId != null) 'booking_id': bookingId,
      'species': species.name,
      if (breed != null) 'breed': breed,
      if (ageMonths != null) 'age_months': ageMonths,
      if (weightKg != null) 'weight_kg': weightKg,
      if (sex != null) 'sex': sex!.name,
      if (allergies != null) 'allergies': allergies,
      'doctor_description': doctorDescription,
      if (bodyPart != null) 'body_part': bodyPart,
      if (symptoms != null) 'symptoms': symptoms,
      if (imageUrls != null) 'image_urls': imageUrls,
      if (imageAnalysisMode != null)
        'image_analysis_mode':
            imageAnalysisMode == DiagnosisImageAnalysisMode.describeOnly
                ? 'describe_only'
                : 'full',
      if (synthesisMode != null) 'synthesis_mode': synthesisMode,
      if (selectedDiagnosisCode != null)
        'selected_diagnosis_code': selectedDiagnosisCode,
      if (selectedDiagnosisLabel != null)
        'selected_diagnosis_label': selectedDiagnosisLabel,
      if (soapDraft != null) 'soap_draft': soapDraft!.toJson(),
    };
  }
}

class SoapDraft {
  final String? subjective;
  final String? objective;
  final String? assessment;
  final String? plan;

  SoapDraft({
    this.subjective,
    this.objective,
    this.assessment,
    this.plan,
  });

  Map<String, dynamic> toJson() {
    return {
      if (subjective != null) 'subjective': subjective,
      if (objective != null) 'objective': objective,
      if (assessment != null) 'assessment': assessment,
      if (plan != null) 'plan': plan,
    };
  }
}

class StaffDiagnosisSuggestion {
  final String? canonicalCode;
  final String displayNameVi;
  final int rank;
  final int scorePercent;
  final String scoreBasis;
  final String confidenceNote;
  final List<String> supportingReasons;

  StaffDiagnosisSuggestion({
    this.canonicalCode,
    required this.displayNameVi,
    required this.rank,
    required this.scorePercent,
    required this.scoreBasis,
    required this.confidenceNote,
    required this.supportingReasons,
  });

  factory StaffDiagnosisSuggestion.fromJson(Map<String, dynamic> json) {
    return StaffDiagnosisSuggestion(
      canonicalCode: json['canonical_code'] as String?,
      displayNameVi: json['display_name_vi'] as String,
      rank: json['rank'] as int? ?? 0,
      scorePercent: json['score_percent'] as int? ?? 0,
      scoreBasis: json['score_basis'] as String? ?? '',
      confidenceNote: json['confidence_note'] as String,
      supportingReasons: (json['supporting_reasons'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
    );
  }
}

class StaffDiagnosisPrescriptionSuggestion {
  final String medicineName;
  final String dosage;
  final String frequency;
  final int? durationDays;
  final String instructions;
  final String? caution;

  StaffDiagnosisPrescriptionSuggestion({
    required this.medicineName,
    required this.dosage,
    required this.frequency,
    this.durationDays,
    required this.instructions,
    this.caution,
  });

  factory StaffDiagnosisPrescriptionSuggestion.fromJson(
      Map<String, dynamic> json) {
    return StaffDiagnosisPrescriptionSuggestion(
      medicineName: json['medicine_name'] as String,
      dosage: json['dosage'] as String? ?? '',
      frequency: json['frequency'] as String? ?? '',
      durationDays: json['duration_days'] as int?,
      instructions: json['instructions'] as String? ?? '',
      caution: json['caution'] as String?,
    );
  }
}

class ImageAnalysisResult {
  final String url;
  final String description;
  final int order;

  ImageAnalysisResult({
    required this.url,
    required this.description,
    required this.order,
  });

  factory ImageAnalysisResult.fromJson(Map<String, dynamic> json) {
    return ImageAnalysisResult(
      url: json['url'] as String,
      description: json['description'] as String? ?? '',
      order: json['order'] as int,
    );
  }
}

class SoapSuggestions {
  final String subjectiveDraft;
  final String objectiveDraft;
  final String assessmentDraft;
  final String planDraft;

  SoapSuggestions({
    required this.subjectiveDraft,
    required this.objectiveDraft,
    required this.assessmentDraft,
    required this.planDraft,
  });

  factory SoapSuggestions.fromJson(Map<String, dynamic> json) {
    return SoapSuggestions(
      subjectiveDraft: json['subjective_draft'] as String? ?? '',
      objectiveDraft: json['objective_draft'] as String? ?? '',
      assessmentDraft: json['assessment_draft'] as String? ?? '',
      planDraft: json['plan_draft'] as String? ?? '',
    );
  }
}

class StaffDiagnosisResponse {
  final String requestId;
  final String evidenceMode;
  final String evidenceBanner;
  final String scoreLabel;
  final List<StaffDiagnosisSuggestion> topDifferentials;
  final List<String> supportingEvidenceFromKb;
  final List<String> similarConfirmedCases;
  final List<String> visionFindings;
  final List<String> imageDescriptions;
  final List<ImageAnalysisResult> imageAnalysis;
  final List<String> suggestedQuestions;
  final SoapSuggestions soapSuggestions;
  final List<StaffDiagnosisPrescriptionSuggestion> prescriptionSuggestions;
  final String disclaimer;

  StaffDiagnosisResponse({
    required this.requestId,
    required this.evidenceMode,
    required this.evidenceBanner,
    required this.scoreLabel,
    required this.topDifferentials,
    required this.supportingEvidenceFromKb,
    required this.similarConfirmedCases,
    required this.visionFindings,
    required this.imageDescriptions,
    required this.imageAnalysis,
    required this.suggestedQuestions,
    required this.soapSuggestions,
    required this.prescriptionSuggestions,
    required this.disclaimer,
  });

  factory StaffDiagnosisResponse.fromJson(Map<String, dynamic> json) {
    return StaffDiagnosisResponse(
      requestId: json['request_id'] as String,
      evidenceMode: json['evidence_mode'] as String? ?? 'internal_grounded',
      evidenceBanner: json['evidence_banner'] as String? ?? '',
      scoreLabel: json['score_label'] as String? ?? 'Độ tự tin (%)',
      topDifferentials: (json['top_differentials'] as List<dynamic>?)
              ?.map((e) =>
                  StaffDiagnosisSuggestion.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      supportingEvidenceFromKb:
          (json['supporting_evidence_from_kb'] as List<dynamic>?)
                  ?.map((e) => e as String)
                  .toList() ??
              [],
      similarConfirmedCases: (json['similar_confirmed_cases'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      visionFindings: (json['vision_findings'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      imageDescriptions: (json['image_descriptions'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      imageAnalysis: (json['image_analysis'] as List<dynamic>?)
              ?.map((e) =>
                  ImageAnalysisResult.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      suggestedQuestions: (json['suggested_questions'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [],
      soapSuggestions: json['soap_suggestions'] != null
          ? SoapSuggestions.fromJson(
              json['soap_suggestions'] as Map<String, dynamic>)
          : SoapSuggestions(
              subjectiveDraft: '',
              objectiveDraft: '',
              assessmentDraft: '',
              planDraft: '',
            ),
      prescriptionSuggestions:
          (json['prescription_suggestions'] as List<dynamic>?)
                  ?.map((e) => StaffDiagnosisPrescriptionSuggestion.fromJson(
                      e as Map<String, dynamic>))
                  .toList() ??
              [],
      disclaimer: json['disclaimer'] as String? ?? '',
    );
  }
}
