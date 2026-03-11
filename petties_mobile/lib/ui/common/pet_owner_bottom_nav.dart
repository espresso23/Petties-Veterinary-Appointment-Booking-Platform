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
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return Container(
      height: 56 + bottomPadding,
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(
          top: BorderSide(color: AppColors.stone900, width: 2),
        ),
      ),
      padding: EdgeInsets.only(
        left: MediaQuery.of(context).padding.left,
        right: MediaQuery.of(context).padding.right,
        bottom: bottomPadding,
      ),
      child: MediaQuery(
        data: MediaQuery.of(context).copyWith(
          textScaler: TextScaler.noScaling,
        ),
        child: BottomNavigationBar(
          type: BottomNavigationBarType.fixed,
          backgroundColor: AppColors.white,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.stone400,
          selectedLabelStyle: const TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 10,
          ),
          unselectedLabelStyle: const TextStyle(fontSize: 10),
          currentIndex: currentIndex,
          elevation: 0,
          onTap: onTap,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home), label: 'TRANG CHỦ'),
            BottomNavigationBarItem(icon: Icon(Icons.explore), label: 'KHÁM PHÁ'),
            BottomNavigationBarItem(icon: Icon(Icons.calendar_today), label: 'LỊCH HẸN'),
            BottomNavigationBarItem(icon: Icon(Icons.chat_bubble_outline), label: 'TIN NHẮN'),
            BottomNavigationBarItem(icon: Icon(Icons.person), label: 'TÀI KHOẢN'),
          ],
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
