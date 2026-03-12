import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../config/constants/app_colors.dart';
import '../../routing/app_routes.dart';

/// Bottom navigation bar dùng chung cho Pet Owner.
///
/// AI Chat Bubble đã được chuyển sang [Scaffold.floatingActionButton]
/// để fix hit-test issue (bubble nằm ngoài bounds của bottomNavigationBar
/// nên không nhận được tap).
class PetOwnerBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const PetOwnerBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const navItems = <({IconData icon, String label})>[
      (icon: Icons.home, label: 'TRANG CHỦ'),
      (icon: Icons.explore, label: 'KHÁM PHÁ'),
      (icon: Icons.calendar_today, label: 'LỊCH HẸN'),
      (icon: Icons.chat_bubble_outline, label: 'TIN NHẮN'),
      (icon: Icons.person, label: 'TÀI KHOẢN'),
    ];

    return SafeArea(
      top: false,
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.white,
          border: Border(
            top: BorderSide(color: AppColors.stone900, width: 2),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
        child: MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.noScaling,
          ),
          child: Row(
            children: List.generate(navItems.length, (index) {
              final item = navItems[index];
              final isSelected = currentIndex == index;

              return Expanded(
                child: InkWell(
                  onTap: () => onTap(index),
                  borderRadius: BorderRadius.circular(10),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          item.icon,
                          size: 22,
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.stone400,
                        ),
                        const SizedBox(height: 4),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            item.label,
                            maxLines: 1,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight:
                                  isSelected ? FontWeight.w700 : FontWeight.w500,
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.stone400,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}

/// Hàm điều hướng mặc định dùng lại logic như Home
void handlePetOwnerNavTap(BuildContext context, int index) {
  switch (index) {
    case 0:
      context.go(AppRoutes.petOwnerHome);
      break;
    case 1:
      context.go('${AppRoutes.petOwnerHome}?tab=1');
      break;
    case 2:
      context.go('${AppRoutes.petOwnerHome}?tab=2');
      break;
    case 3:
      context.go(AppRoutes.chatList);
      break;
    case 4:
      context.go(AppRoutes.profile);
      break;
  }
}
