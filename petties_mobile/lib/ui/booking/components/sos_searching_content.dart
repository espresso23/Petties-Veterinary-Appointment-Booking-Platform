import 'package:flutter/material.dart';
import '../../../data/services/sos_matching_service.dart';
import '../../../config/constants/app_colors.dart';

class SosSearchingContent extends StatelessWidget {
  final String statusText;
  final Animation<double> pulseAnimation;
  final SosMatchingStatus? status;

  const SosSearchingContent({
    super.key,
    required this.statusText,
    required this.pulseAnimation,
    this.status,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Status text with animation
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedBuilder(
              animation: pulseAnimation,
              builder: (context, child) {
                return Opacity(
                  opacity: pulseAnimation.value,
                  child: const Icon(
                    Icons.radar,
                    color: AppColors.coral,
                    size: 24,
                  ),
                );
              },
            ),
            const SizedBox(width: 8),
            Text(
              statusText,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Progress indicator
        if (status?.currentClinicIndex != null && status?.totalClinics != null)
          Column(
            children: [
              LinearProgressIndicator(
                value:
                    (status!.currentClinicIndex! + 1) / status!.totalClinics!,
                backgroundColor: Colors.grey.shade200,
                color: AppColors.coral,
              ),
              const SizedBox(height: 8),
              Text(
                'Đang liên hệ ${status!.currentClinicIndex! + 1}/${status!.totalClinics} phòng khám',
                style: TextStyle(
                  color: Colors.grey.shade600,
                  fontSize: 13,
                ),
              ),
            ],
          ),

        // Current clinic info
        if (status?.isPendingConfirm == true && status?.clinicName != null)
          Container(
            margin: const EdgeInsets.only(top: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.orange.shade200),
            ),
            child: Row(
              children: [
                Icon(Icons.local_hospital, color: Colors.orange.shade700),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        status!.clinicName!,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.orange.shade900,
                        ),
                      ),
                      if (status!.distance != null)
                        Text(
                          'Cách ${status!.distance!.toStringAsFixed(1)} km • Đang chờ xác nhận',
                          style: TextStyle(
                            color: Colors.orange.shade700,
                            fontSize: 13,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
