import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../config/constants/app_colors.dart';
import '../../routing/app_routes.dart';

/// VET Home Screen - Neobrutalism Style
class VetHomeScreen extends StatelessWidget {
  const VetHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.user;

    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        backgroundColor: AppColors.primaryDark,
        elevation: 0,
        title: const Text(
          '🩺 BÁC SĨ THÚ Y',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            letterSpacing: 2,
            color: AppColors.white,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              authProvider.logout();
              context.go(AppRoutes.login);
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Header - Brutal Card
            _buildWelcomeCard(context, user?.username ?? 'Bác sĩ'),
            const SizedBox(height: 24),

            // Stats Cards
            _buildSectionTitle('THỐNG KÊ HÔM NAY'),
            const SizedBox(height: 12),
            _buildStatsRow(context),
            const SizedBox(height: 24),

            // Today's Schedule
            _buildSectionTitle('LỊCH HÔM NAY'),
            const SizedBox(height: 12),
            _buildScheduleCard(context),
            const SizedBox(height: 24),

            // Pending Bookings
            _buildSectionTitle('BOOKINGS CHỜ PHÊ DUYỆT'),
            const SizedBox(height: 12),
            _buildPendingBookingsCard(context),
          ],
        ),
      ),
      bottomNavigationBar: _buildBrutalNavBar(),
    );
  }

  Widget _buildWelcomeCard(BuildContext context, String username) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        border: Border.all(color: AppColors.stone900, width: 4),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(6, 6)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'XIN CHÀO, BÁC SĨ $username! 👨‍⚕️',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.stone900,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Sẵn sàng chăm sóc thú cưng hôm nay',
            style: TextStyle(
              fontSize: 14,
              color: AppColors.stone600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w800,
        color: AppColors.stone900,
        letterSpacing: 1.5,
      ),
    );
  }

  Widget _buildStatsRow(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _buildStatCard('—', 'Bookings\nhôm nay', AppColors.primary)),
        const SizedBox(width: 12),
        Expanded(child: _buildStatCard('—', 'Chờ phê\nduyệt', AppColors.primaryLight)),
        const SizedBox(width: 12),
        Expanded(child: _buildStatCard('—', 'Hoàn\nthành', AppColors.primaryDark)),
      ],
    );
  }

  Widget _buildStatCard(String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border.all(color: AppColors.stone900, width: 3),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.15),
              border: Border.all(color: AppColors.stone900, width: 2),
            ),
            child: Text(
              value,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.stone600,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildScheduleCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border.all(color: AppColors.stone900, width: 3),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
        ],
      ),
      child: const Center(
        child: Column(
          children: [
            Icon(Icons.calendar_today, size: 48, color: AppColors.stone400),
            SizedBox(height: 12),
            Text(
              'CHƯA CÓ LỊCH HẸN',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.stone900,
                letterSpacing: 1,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Lịch hẹn hôm nay sẽ hiển thị ở đây',
              style: TextStyle(color: AppColors.stone500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingBookingsCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.primarySurface,
        border: Border.all(color: AppColors.stone900, width: 3),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
        ],
      ),
      child: const Center(
        child: Column(
          children: [
            Icon(Icons.pending_actions, size: 48, color: AppColors.primary),
            SizedBox(height: 12),
            Text(
              'KHÔNG CÓ BOOKING CHỜ',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.stone900,
                letterSpacing: 1,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Các yêu cầu mới sẽ hiển thị ở đây',
              style: TextStyle(color: AppColors.stone600),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBrutalNavBar() {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(
          top: BorderSide(color: AppColors.stone900, width: 4),
        ),
      ),
      child: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        backgroundColor: AppColors.white,
        selectedItemColor: AppColors.primaryDark,
        unselectedItemColor: AppColors.stone400,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700),
        currentIndex: 0,
        elevation: 0,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'DASHBOARD'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_today), label: 'LỊCH'),
          BottomNavigationBarItem(icon: Icon(Icons.assignment), label: 'BỆNH NHÂN'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'HỒ SƠ'),
        ],
      ),
    );
  }
}
