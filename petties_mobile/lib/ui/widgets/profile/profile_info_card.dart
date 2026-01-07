import 'package:flutter/material.dart';
import '../../../config/constants/app_colors.dart';

/// Profile info card widget with Neobrutalism style
/// Displays a label-value pair with optional icon and action
class ProfileInfoCard extends StatelessWidget {
  /// Card label (e.g., "Ho va ten")
  final String label;

  /// Card value (e.g., "Nguyen Van A")
  final String? value;

  /// Placeholder when value is null
  final String placeholder;

  /// Leading icon
  final IconData? icon;

  /// Icon color (defaults to primary)
  final Color? iconColor;

  /// Trailing action widget
  final Widget? trailing;

  /// Callback when card is tapped
  final VoidCallback? onTap;

  /// Whether to show border on bottom (for list items)
  final bool showBottomBorder;

  const ProfileInfoCard({
    super.key,
    required this.label,
    this.value,
    this.placeholder = 'Chưa cập nhật',
    this.icon,
    this.iconColor,
    this.trailing,
    this.onTap,
    this.showBottomBorder = false,
  });

  @override
  Widget build(BuildContext context) {
    final hasValue = value != null && value!.isNotEmpty;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: AppColors.white,
          border: showBottomBorder
              ? const Border(
                  bottom: BorderSide(color: AppColors.stone200, width: 1),
                )
              : null,
        ),
        child: Row(
          children: [
            // Leading icon
            if (icon != null) ...[
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: (iconColor ?? AppColors.primary).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.stone900, width: 2),
                ),
                child: Icon(
                  icon,
                  color: iconColor ?? AppColors.primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
            ],

            // Label and value
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.stone500,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    hasValue ? value! : placeholder,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: hasValue ? AppColors.stone900 : AppColors.stone400,
                    ),
                  ),
                ],
              ),
            ),

            // Trailing widget or chevron if onTap exists
            if (trailing != null)
              trailing!
            else if (onTap != null)
              const Icon(
                Icons.chevron_right,
                color: AppColors.stone400,
                size: 24,
              ),
          ],
        ),
      ),
    );
  }
}

/// Section header for profile groups
class ProfileSectionHeader extends StatelessWidget {
  final String title;
  final Widget? trailing;

  const ProfileSectionHeader({
    super.key,
    required this.title,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: AppColors.stone600,
              letterSpacing: 1.5,
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Card container for profile info group
class ProfileInfoGroup extends StatelessWidget {
  final List<Widget> children;
  final EdgeInsets? margin;

  const ProfileInfoGroup({
    super.key,
    required this.children,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: margin ?? const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        children: children,
      ),
    );
  }
}

/// Action button for profile (e.g., Edit, Logout)
class ProfileActionButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final Color? color;
  final bool isDestructive;

  const ProfileActionButton({
    super.key,
    required this.label,
    required this.icon,
    this.onTap,
    this.color,
    this.isDestructive = false,
  });

  @override
  Widget build(BuildContext context) {
    final buttonColor =
        color ?? (isDestructive ? AppColors.error : AppColors.primary);

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: buttonColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.stone900, width: 2),
              ),
              child: Icon(icon, color: buttonColor, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label.toUpperCase(),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: buttonColor,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            Icon(
              Icons.chevron_right,
              color: buttonColor.withOpacity(0.6),
              size: 24,
            ),
          ],
        ),
      ),
    );
  }
}
