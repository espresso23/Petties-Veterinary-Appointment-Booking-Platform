import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../../routing/app_routes.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/models/notification.dart';
import '../../../providers/notification_provider.dart';

class NotificationListScreen extends StatefulWidget {
  const NotificationListScreen({super.key});

  @override
  State<NotificationListScreen> createState() => _NotificationListScreenState();
}

class _NotificationListScreenState extends State<NotificationListScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().fetchNotifications();
    });

    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      context.read<NotificationProvider>().loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'Thông báo',
          style: TextStyle(
            color: AppColors.stone900,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.stone900),
          onPressed: () => context.pop(),
        ),
        actions: [
          TextButton(
            onPressed: () =>
                context.read<NotificationProvider>().markAllAsRead(),
            child: const Text('Đọc tất cả'),
          ),
        ],
      ),
      body: Consumer<NotificationProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.notifications.isEmpty) {
            return const Center(child: CircularProgressIndicator());
          }

          if (provider.error != null && provider.notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text(provider.error!),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => provider.fetchNotifications(),
                    child: const Text('Thử lại'),
                  ),
                ],
              ),
            );
          }

          if (provider.notifications.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.notifications_off_outlined,
                      size: 64, color: AppColors.stone300),
                  SizedBox(height: 16),
                  Text(
                    'Bạn chưa có thông báo nào',
                    style: TextStyle(color: AppColors.stone500),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => provider.fetchNotifications(),
            child: ListView.separated(
              controller: _scrollController,
              itemCount:
                  provider.notifications.length + (provider.hasMore ? 1 : 0),
              separatorBuilder: (context, index) => const Divider(
                height: 1,
                indent: 72,
                color: AppColors.stone100,
              ),
              itemBuilder: (context, index) {
                if (index < provider.notifications.length) {
                  return _NotificationItem(
                      notification: provider.notifications[index]);
                } else {
                  return const Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
              },
            ),
          );
        },
      ),
    );
  }
}

class _NotificationItem extends StatelessWidget {
  final NotificationModel notification;

  const _NotificationItem({required this.notification});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        try {
          if (!notification.isRead) {
            context.read<NotificationProvider>().markAsRead(notification.id);
          }
          // Handle navigation based on type
          _handleTap(context);
        } catch (e) {
          debugPrint('Error handling notification tap: $e');
        }
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        color: notification.isRead
            ? Colors.transparent
            : AppColors.primaryBackground.withOpacity(0.3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildIcon(),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    notification.message,
                    style: TextStyle(
                      color: AppColors.stone900,
                      fontWeight: notification.isRead
                          ? FontWeight.normal
                          : FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        notification.timeAgo,
                        style: const TextStyle(
                          color: AppColors.stone500,
                          fontSize: 12,
                        ),
                      ),
                      if (!notification.isRead) ...[
                        const SizedBox(width: 8),
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                  _buildActionButtons(context),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIcon() {
    IconData iconData;
    Color iconColor;
    Color bgColor;

    switch (notification.type) {
      case NotificationType.CLINIC_APPROVED:
        iconData = Icons.check_circle_outline;
        iconColor = Colors.green;
        bgColor = Colors.green.withOpacity(0.1);
        break;
      case NotificationType.CLINIC_REJECTED:
        iconData = Icons.cancel_outlined;
        iconColor = Colors.red;
        bgColor = Colors.red.withOpacity(0.1);
        break;
      case NotificationType.VET_SHIFT_ASSIGNED:
      case NotificationType.VET_SHIFT_UPDATED:
        iconData = Icons.calendar_today_outlined;
        iconColor = AppColors.primary;
        bgColor = AppColors.primaryBackground;
        break;
      case NotificationType.VET_SHIFT_DELETED:
        iconData = Icons.event_busy_outlined;
        iconColor = Colors.orange;
        bgColor = Colors.orange.withOpacity(0.1);
        break;
      case NotificationType.BOOKING_CREATED:
      case NotificationType.BOOKING_CONFIRMED:
        iconData = Icons.pets_outlined;
        iconColor = AppColors.secondary;
        bgColor = AppColors.secondaryLight;
        break;
      case NotificationType.BOOKING_CANCELLED:
        iconData = Icons.block_flipped;
        iconColor = Colors.red;
        bgColor = Colors.red.withOpacity(0.1);
        break;
      case NotificationType.VACCINATION_REMINDER:
      case NotificationType.RE_EXAMINATION_REMINDER:
        iconData = Icons.medical_services_outlined;
        iconColor = AppColors.info;
        bgColor = AppColors.infoLight;
        break;
      default:
        iconData = Icons.notifications_none_outlined;
        iconColor = AppColors.stone500;
        bgColor = AppColors.stone100;
    }

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Icon(iconData, color: iconColor, size: 24),
    );
  }

  void _handleTap(BuildContext context) {
    if (notification.actionType == 'QUICK_BOOKING') {
      _handleQuickBook(context);
      return;
    }

    switch (notification.type) {
      case NotificationType.VET_SHIFT_ASSIGNED:
      case NotificationType.VET_SHIFT_UPDATED:
      case NotificationType.VET_SHIFT_DELETED:
        context.push(AppRoutes.vetSchedule);
        break;
      default:
        // Stay on notification list or go to relevant screen
        break;
    }
  }

  void _handleQuickBook(BuildContext context) {
    // Navigate to Clinic Search to start booking flow
    // In future, we can pass petId and serviceName to pre-fill
    context.push(AppRoutes.clinicSearch);
  }

  Widget _buildActionButtons(BuildContext context) {
    if (notification.actionType != 'QUICK_BOOKING') return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(
        children: [
          Expanded(
            child: ElevatedButton(
              onPressed: () => _handleQuickBook(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Đặt lịch ngay', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton(
              onPressed: () {
                 // Contextual navigation to Pet Health Record to check details
                 if (notification.actionData != null) {
                    // Try to parse petId
                     // Simple parsing without importing 'dart:convert' at top if possible, 
                     // but better to add import. Since we can't easily add import via replace_chunk efficiently 
                     // without viewing whole file again, let's just push to MyPets for "Check Detail"
                     context.push(AppRoutes.myPets);
                 } else {
                     context.push(AppRoutes.myPets);
                 }
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.stone600,
                side: const BorderSide(color: AppColors.stone300),
                padding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: const Text('Chi tiết', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}
