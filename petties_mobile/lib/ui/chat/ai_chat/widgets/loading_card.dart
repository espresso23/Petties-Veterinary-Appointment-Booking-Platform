import 'package:flutter/material.dart';
import '../../../../config/constants/app_colors.dart';

class AiLoadingCard extends StatelessWidget {
  const AiLoadingCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1C1917), width: 2),
        boxShadow: const [
          BoxShadow(
            color: Color(0xFF1C1917),
            offset: Offset(4, 4),
            blurRadius: 0,
          ),
        ],
      ),
      child: Row(
        children: [
          const SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              strokeWidth: 3,
              color: Color(0xFFD97706),
            ),
          ),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'HỆ THỐNG ĐANG XỬ LÝ...',
                style: TextStyle(
                  color: AppColors.stone500,
                  fontWeight: FontWeight.bold,
                  fontSize: 10,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'Vui lòng đợi trong giây lát',
                style: TextStyle(
                  color: Color(0xFF1C1917),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
