import 'package:flutter/material.dart';

import '../../../config/constants/app_colors.dart';
import '../../../data/models/diagnosis.dart';
import 'ai_diagnosis_panel.dart';

class AiDiagnosisSheet {
  static Future<void> show(
    BuildContext context, {
    String? petId,
    String? bookingId,
    String? species,
    String? breed,
    int? ageMonths,
    double? weightKg,
    List<String>? allergies,
    String? initialSubjective,
    String? initialObjective,
    String? initialAssessment,
    String? initialPlan,
    List<String>? imageUrls,
    void Function(StaffDiagnosisResponse?)? onDiagnosisResult,
    void Function(SoapSuggestions)? onApplyDraft,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.85,
          minChildSize: 0.5,
          maxChildSize: 0.95,
          builder: (context, scrollController) {
            return Container(
              decoration: const BoxDecoration(
                color: AppColors.primaryBackground,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
              ),
              child: Column(
                children: [
                  _buildHandle(),
                  Expanded(
                    child: SingleChildScrollView(
                      controller: scrollController,
                      child: AiDiagnosisPanel(
                        petId: petId,
                        bookingId: bookingId,
                        species: species,
                        breed: breed,
                        ageMonths: ageMonths,
                        weightKg: weightKg,
                        allergies: allergies,
                        initialSubjective: initialSubjective,
                        initialObjective: initialObjective,
                        initialAssessment: initialAssessment,
                        initialPlan: initialPlan,
                        imageUrls: imageUrls,
                        onDiagnosisResult: onDiagnosisResult,
                        onApplyDraft: onApplyDraft,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  static Widget _buildHandle() {
    return Container(
      margin: const EdgeInsets.only(top: 12, bottom: 8),
      width: 40,
      height: 4,
      decoration: BoxDecoration(
        color: AppColors.stone300,
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }
}
