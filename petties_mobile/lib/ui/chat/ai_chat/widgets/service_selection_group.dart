import 'package:flutter/material.dart';

import '../../../../config/constants/app_colors.dart';
import '../../../../data/models/ai_chat.dart';

class AiServiceSelectionGroup extends StatelessWidget {
  final List<UiComponentV1> serviceChips;
  final UiComponentV1? actionButton;
  final Set<String> selectedServiceIds;
  final bool isBusy;
  final ValueChanged<UiComponentV1> onToggleService;
  final VoidCallback? onContinue;

  const AiServiceSelectionGroup({
    super.key,
    required this.serviceChips,
    required this.actionButton,
    required this.selectedServiceIds,
    required this.isBusy,
    required this.onToggleService,
    required this.onContinue,
  });

  @override
  Widget build(BuildContext context) {
    if (serviceChips.isEmpty) {
      return const SizedBox.shrink();
    }

    final primaryAction = actionButton?.actions != null &&
            actionButton!.actions!.isNotEmpty
        ? actionButton!.actions!.first
        : null;
    final label =
        actionButton?.data['label']?.toString() ?? primaryAction?.label ?? 'Tiếp tục';
    final canContinue = selectedServiceIds.isNotEmpty && !isBusy;

    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(
            color: AppColors.stone900,
            offset: Offset(4, 4),
            blurRadius: 0,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: serviceChips.map(_buildChip).toList(),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: canContinue ? onContinue : null,
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    canContinue ? AppColors.primary : AppColors.stone300,
                foregroundColor:
                    canContinue ? AppColors.white : AppColors.stone600,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: const BorderSide(
                    color: AppColors.stone900,
                    width: 2,
                  ),
                ),
              ),
              child: Text(
                label.toUpperCase(),
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChip(UiComponentV1 component) {
    final actionServiceId = (component.actions ?? const <UiAction>[])
        .map((action) => action.payload?['item_id']?.toString())
        .firstWhere(
          (value) => value != null && value.trim().isNotEmpty,
          orElse: () => null,
        );
    final serviceId =
        component.data['id']?.toString() ?? actionServiceId ?? component.id;
    final isSelected = selectedServiceIds.contains(serviceId);
    final label = component.data['name']?.toString() ??
        component.data['label']?.toString() ??
        'Dịch vụ';

    return InkWell(
      onTap: isBusy ? null : () => onToggleService(component),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primarySurface : AppColors.white,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.stone900,
            width: 2,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected ? AppColors.primary : AppColors.stone900,
              offset: const Offset(3, 3),
            ),
          ],
        ),
        child: Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            color: isSelected ? AppColors.primary : AppColors.stone900,
          ),
        ),
      ),
    );
  }
}
