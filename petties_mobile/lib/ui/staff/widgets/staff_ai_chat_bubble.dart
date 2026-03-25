import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../config/constants/app_colors.dart';
import '../../../routing/app_routes.dart';

class StaffAiChatBubble extends StatelessWidget {
  final bool showNotificationDot;

  const StaffAiChatBubble({
    super.key,
    this.showNotificationDot = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        context.push(AppRoutes.staffAiChat);
      },
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.stone900, width: 2),
          boxShadow: const [
            BoxShadow(
              color: AppColors.stone900,
              offset: Offset(3, 3),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.auto_awesome,
              color: AppColors.stone900,
              size: 18,
            ),
            const SizedBox(width: 6),
            const Text(
              'AI Hỗ trợ',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
              ),
            ),
            if (showNotificationDot) ...[
              const SizedBox(width: 6),
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: AppColors.coral,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
