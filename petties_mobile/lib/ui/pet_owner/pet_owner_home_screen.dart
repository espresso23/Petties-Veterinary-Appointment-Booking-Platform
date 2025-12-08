import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';

/// Pet Owner Home Screen
class PetOwnerHomeScreen extends StatelessWidget {
  const PetOwnerHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.user;

    return Scaffold(
      appBar: AppBar(
        title: const Text('🐕 Petties'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {},
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => authProvider.logout(),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Header
            Text(
              'Chào mừng, ${user?.username ?? 'Pet Owner'}! 👋',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Hôm nay bạn muốn làm gì cho thú cưng?',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 24),

            // Quick Actions
            _buildQuickActions(context),
            const SizedBox(height: 24),

            // My Pets Section
            _buildSectionHeader(context, 'Thú cưng của tôi', 'Xem tất cả'),
            const SizedBox(height: 12),
            _buildMyPetsPlaceholder(context),
            const SizedBox(height: 24),

            // Upcoming Bookings
            _buildSectionHeader(context, 'Lịch hẹn sắp tới', 'Xem tất cả'),
            const SizedBox(height: 12),
            _buildBookingsPlaceholder(context),
          ],
        ),
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: 0,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Trang chủ'),
          BottomNavigationBarItem(icon: Icon(Icons.explore), label: 'Khám phá'),
          BottomNavigationBarItem(icon: Icon(Icons.calendar_today), label: 'Lịch hẹn'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Tài khoản'),
        ],
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        _buildActionCard(context, Icons.local_hospital, 'Đặt lịch khám', Colors.blue),
        _buildActionCard(context, Icons.home_work, 'Khám tại nhà', Colors.green),
        _buildActionCard(context, Icons.pets, 'Thêm pet', Colors.orange),
        _buildActionCard(context, Icons.medical_services, 'Sổ tiêm', Colors.purple),
      ],
    );
  }

  Widget _buildActionCard(BuildContext context, IconData icon, String label, Color color) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: color, size: 28),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title, String actionText) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        TextButton(
          onPressed: () {},
          child: Text(actionText),
        ),
      ],
    );
  }

  Widget _buildMyPetsPlaceholder(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: const Center(
        child: Column(
          children: [
            Icon(Icons.pets, size: 48, color: Colors.grey),
            SizedBox(height: 8),
            Text('Chưa có thú cưng nào'),
            SizedBox(height: 4),
            Text('Thêm thú cưng để bắt đầu', style: TextStyle(color: Colors.grey)),
          ],
        ),
      ),
    );
  }

  Widget _buildBookingsPlaceholder(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.grey[100],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: const Center(
        child: Column(
          children: [
            Icon(Icons.calendar_today, size: 48, color: Colors.grey),
            SizedBox(height: 8),
            Text('Chưa có lịch hẹn'),
            SizedBox(height: 4),
            Text('Đặt lịch khám cho thú cưng', style: TextStyle(color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}
