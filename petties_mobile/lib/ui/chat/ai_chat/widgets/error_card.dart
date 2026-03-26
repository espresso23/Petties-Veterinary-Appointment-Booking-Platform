import 'package:flutter/material.dart';
import '../../../../config/constants/app_colors.dart';

import '../../../../data/models/ai_chat.dart';

class AiErrorCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final List<UiAction>? actions;
  final Function(UiAction)? onAction;

  const AiErrorCard({
    super.key, 
    required this.data,
    this.actions,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final message = data['message']?.toString() ?? 'Đã có lỗi xảy ra';
    final code = data['error_code']?.toString() ?? data['code']?.toString();
    final effectiveActions = actions ?? [];

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.error_outline, color: Color(0xFFEF4444), size: 16),
              const SizedBox(width: 8),
              Text(
                'HỆ THỐNG GẶP LỖI',
                style: TextStyle(
                  color: const Color(0xFFEF4444),
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(
              color: Color(0xFF1C1917),
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          if (code != null) ...[
            const SizedBox(height: 8),
            Text(
              'Mã lỗi: $code',
              style: TextStyle(
                color: AppColors.stone400,
                fontSize: 10,
                fontFamily: 'monospace',
              ),
            ),
          ],
          if (effectiveActions.isNotEmpty) ...[
            const SizedBox(height: 16),
            ...effectiveActions.map((action) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: onAction != null ? () => onAction!(action) : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF1C1917),
                    elevation: 0,
                    side: const BorderSide(color: Color(0xFF1C1917), width: 2),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ).copyWith(
                    overlayColor: WidgetStateProperty.all(AppColors.stone100),
                  ),
                  child: Text(
                    action.label.toUpperCase(),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            )).toList(),
          ],
        ],
      ),
    );
  }
}
