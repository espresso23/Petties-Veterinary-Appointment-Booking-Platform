import 'package:flutter/material.dart';
import '../../../data/services/sos_matching_service.dart';
import '../../../data/services/tracking_websocket_service.dart';
import '../../../config/constants/app_colors.dart';

class SosConfirmedContent extends StatelessWidget {
  final SosMatchingStatus? status;
  final TrackingLocation? staffLocation;
  final Function(String) onCall;

  const SosConfirmedContent({
    super.key,
    this.status,
    this.staffLocation,
    required this.onCall,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Success banner
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.green.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.green.shade200),
          ),
          child: Row(
            children: [
              Icon(Icons.check_circle, color: Colors.green.shade700, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Đã tìm thấy phòng khám!',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Colors.green.shade900,
                        fontSize: 16,
                      ),
                    ),
                    if (staffLocation != null)
                      Text(
                        'Bác sĩ đang trên đường đến',
                        style: TextStyle(
                          color: Colors.green.shade700,
                          fontSize: 13,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Staff/Clinic info card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: AppColors.coral.withOpacity(0.2),
                child: const Icon(Icons.local_hospital,
                    color: AppColors.coral, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      status?.clinicName ?? 'Phòng khám',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    // Chỉ hiển thị khoảng cách khi đã có vị trí bác sĩ (đã bấm BẮT ĐẦU DI CHUYỂN)
                    Builder(
                      builder: (context) {
                        final dynamicDistance = staffLocation?.distanceKm;
                        if (dynamicDistance != null) {
                          return Text(
                            'Cách ${dynamicDistance.toStringAsFixed(1)} km',
                            style: TextStyle(
                              color: Colors.grey.shade600,
                              fontSize: 13,
                            ),
                          );
                        }
                        return const SizedBox.shrink();
                      },
                    ),
                    if (staffLocation != null)
                      Text(
                        'ETA: ${staffLocation!.etaMinutes ?? '~'} phút',
                        style: const TextStyle(
                          color: AppColors.coral,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                  ],
                ),
              ),
              // Call button
              if (status?.clinicPhone != null)
                IconButton(
                  onPressed: () => onCall(status!.clinicPhone!),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.all(12),
                  ),
                  icon: const Icon(Icons.phone, size: 24),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
