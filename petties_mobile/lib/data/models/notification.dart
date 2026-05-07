import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

enum NotificationType {
  // Clinic status
  CLINIC_APPROVED,
  CLINIC_REJECTED,
  CLINIC_PENDING,

  // StaffShift notifications
  STAFF_SHIFT_ASSIGNED,
  STAFF_SHIFT_UPDATED,
  STAFF_SHIFT_DELETED,

  // Booking notifications
  BOOKING_CREATED,
  BOOKING_CONFIRMED,
  BOOKING_ASSIGNED,
  BOOKING_CANCELLED,
  BOOKING_CHECKIN,
  BOOKING_PAYMENT_REQUIRED,
  BOOKING_COMPLETED,
  STAFF_ON_WAY,

  // Reminders
  VACCINATION_REMINDER,
  RE_EXAMINATION_REMINDER,

  // Others
  SYSTEM_NOTIFICATION
}

class NotificationModel {
  final String id;
  final NotificationType type;
  final String message;
  final String? reason;
  final bool isRead;
  final DateTime createdAt;

  // Clinic-related (optional)
  final String? clinicId;
  final String? clinicName;

  // StaffShift-related (optional)
  final String? shiftId;
  final DateTime? shiftDate;
  final String? shiftStartTime;
  final String? shiftEndTime;

  // Actionable fields
  final String? actionType;
  final String? actionData;

  // Parsed action payload (optional)
  final String? bookingId;
  final String? conversationId;

  NotificationModel({
    required this.id,
    required this.type,
    required this.message,
    this.reason,
    required this.isRead,
    required this.createdAt,
    this.clinicId,
    this.clinicName,
    this.shiftId,
    this.shiftDate,
    this.shiftStartTime,
    this.shiftEndTime,
    this.actionType,
    this.actionData,
    this.bookingId,
    this.conversationId,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    final rawType = json['type'] as String?;
    final notificationType = _parseNotificationType(rawType);
    final rawActionData = json['actionData']?.toString().trim();
    String? bookingId;
    String? conversationId;

    if (rawActionData != null && rawActionData.isNotEmpty) {
      try {
        if (rawActionData.startsWith('{') || rawActionData.startsWith('[')) {
          final decoded = jsonDecode(rawActionData);
          if (decoded is Map<String, dynamic>) {
            final dynamic bookingIdValue = decoded['bookingId'];
            final dynamic conversationIdValue = decoded['conversationId'];
            bookingId = bookingIdValue?.toString();
            conversationId = conversationIdValue?.toString();
          }
        } else if (_isBookingNotificationType(notificationType)) {
          bookingId = rawActionData;
        } else if (rawType == 'chat_message') {
          conversationId = rawActionData;
        }
      } catch (e) {
        debugPrint('Error parsing notification actionData JSON: $e');
      }
    }

    return NotificationModel(
      id: json['notificationId'] as String,
      type: notificationType,
      message: json['message'] as String,
      reason: json['reason'] as String?,
      isRead: json['read'] as bool? ?? false,
      createdAt: _parseDateTime(json['createdAt'] as String),
      clinicId: json['clinicId'] as String?,
      clinicName: json['clinicName'] as String?,
      shiftId: json['shiftId'] as String?,
      shiftDate: json['shiftDate'] != null
          ? DateTime.parse(json['shiftDate'] as String)
          : null,
      shiftStartTime: json['shiftStartTime'] as String?,
      shiftEndTime: json['shiftEndTime'] as String?,
      actionType: json['actionType'] as String?,
      actionData: rawActionData,
      bookingId: bookingId,
      conversationId: conversationId,
    );
  }

  static DateTime _parseDateTime(String? dateStr) {
    if (dateStr == null || dateStr.isEmpty) return DateTime.now();
    try {
      // Nếu chuỗi không chứa thông tin múi giờ, coi nó là UTC (chuẩn Backend)
      // Sau đó chuyển sang giờ địa phương (Local) để tính toán timeAgo
      if (!dateStr.contains('Z') && !dateStr.contains('+')) {
        return DateTime.parse('${dateStr}Z').toLocal();
      }
      return DateTime.parse(dateStr).toLocal();
    } catch (e) {
      debugPrint('Error parsing notification date: $e');
      return DateTime.now();
    }
  }

  static NotificationType _parseNotificationType(String? type) {
    if (type == null) return NotificationType.SYSTEM_NOTIFICATION;
    try {
      return NotificationType.values.firstWhere(
        (e) => e.name == type,
        orElse: () => NotificationType.SYSTEM_NOTIFICATION,
      );
    } catch (e) {
      return NotificationType.SYSTEM_NOTIFICATION;
    }
  }

  String get timeAgo {
    final now = DateTime.now();
    final difference = now.difference(createdAt);

    if (difference.inMinutes < 1) {
      return 'Vừa xong';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes} phút trước';
    } else if (difference.inHours < 24) {
      return '${difference.inHours} giờ trước';
    } else if (difference.inDays < 7) {
      return '${difference.inDays} ngày trước';
    } else {
      return DateFormat('dd/MM/yyyy').format(createdAt);
    }
  }
}

bool _isBookingNotificationType(NotificationType type) {
  switch (type) {
    case NotificationType.BOOKING_CREATED:
    case NotificationType.BOOKING_CONFIRMED:
    case NotificationType.BOOKING_ASSIGNED:
    case NotificationType.BOOKING_CANCELLED:
    case NotificationType.BOOKING_CHECKIN:
    case NotificationType.BOOKING_PAYMENT_REQUIRED:
    case NotificationType.BOOKING_COMPLETED:
    case NotificationType.STAFF_ON_WAY:
      return true;
    default:
      return false;
  }
}
