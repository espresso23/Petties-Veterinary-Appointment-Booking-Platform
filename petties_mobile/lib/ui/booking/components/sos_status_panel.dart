import 'package:flutter/material.dart';
import '../../../data/services/sos_matching_service.dart';
import '../../../data/services/tracking_websocket_service.dart';
import '../../../config/constants/app_colors.dart';
import 'sos_searching_content.dart';
import 'sos_confirmed_content.dart';

class SosStatusPanel extends StatelessWidget {
  final bool isConfirmed;
  final bool isSearching;
  final SosMatchingStatus? status;
  final String statusText;
  final Animation<double> pulseAnimation;
  final TrackingLocation? staffLocation;
  final VoidCallback onCancel;
  final VoidCallback onTrack;
  final Function(String) onCall;

  const SosStatusPanel({
    super.key,
    required this.isConfirmed,
    required this.isSearching,
    this.status,
    required this.statusText,
    required this.pulseAnimation,
    this.staffLocation,
    required this.onCancel,
    required this.onTrack,
    required this.onCall,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),

              // Status section
              if (isConfirmed && status != null)
                SosConfirmedContent(
                  status: status,
                  staffLocation: staffLocation,
                  onCall: onCall,
                )
              else if (isSearching)
                SosSearchingContent(
                  statusText: statusText,
                  pulseAnimation: pulseAnimation,
                  status: status,
                )
              else
                _buildIdleContent(),

              const SizedBox(height: 16),

              // Cancel or Track button
              SizedBox(
                width: double.infinity,
                child: isConfirmed
                    ? ElevatedButton.icon(
                        onPressed: onTrack,
                        icon: const Icon(Icons.map_outlined),
                        label: const Text('THEO DÕI BÁC SĨ'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.coral,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      )
                    : OutlinedButton(
                        onPressed: onCancel,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.red,
                          side: const BorderSide(color: Colors.red),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text('HỦY YÊU CẦU'),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildIdleContent() {
    return Column(
      children: [
        Icon(Icons.location_on, color: Colors.grey.shade400, size: 48),
        const SizedBox(height: 16),
        const Text(
          'Đang chờ bắt đầu...',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Vui lòng cho phép quyền truy cập vị trí',
          style: TextStyle(
            color: Colors.grey.shade600,
            fontSize: 13,
          ),
        ),
      ],
    );
  }
}
