import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../config/constants/app_colors.dart';
import '../../routing/app_routes.dart';

class StaffBottomNav extends StatelessWidget {
  final int currentIndex;

  const StaffBottomNav({
    super.key,
    required this.currentIndex,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.stone900, width: 2)),
      ),
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildNavItem(
            context,
            icon: Icons.grid_view_rounded,
            label: 'Trang chủ',
            index: 0,
            route: AppRoutes.staffHome,
          ),
          _buildNavItem(
            context,
            icon: Icons.calendar_month_rounded,
            label: 'Lịch làm việc',
            index: 1,
            route: AppRoutes.staffSchedule,
          ),
          _buildNavItem(
            context,
            icon: Icons.calendar_today_rounded,
            label: 'Lịch hẹn',
            index: 2,
            route: AppRoutes.staffBookings,
          ),
          _buildNavItem(
            context,
            icon: Icons.pets_rounded,
            label: 'Bệnh nhân',
            index: 3,
            route: AppRoutes.staffPatients,
          ),
          _buildNavItem(
            context,
            icon: Icons.person_rounded,
            label: 'Cá nhân',
            index: 4,
            route: AppRoutes.profile,
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    required int index,
    required String route,
  }) {
    final isActive = currentIndex == index;

    return InkWell(
      onTap: isActive ? null : () => context.push(route),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: isActive ? AppColors.primary : AppColors.stone400,
            size: 26,
            shadows: isActive
                ? const [
                    Shadow(color: AppColors.stone900, offset: Offset(1, 1))
                  ]
                : [],
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: isActive ? AppColors.primary : AppColors.stone400,
            ),
          ),
        ],
      ),
    );
  }
}
