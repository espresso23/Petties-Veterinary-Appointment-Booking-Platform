import 'base_model.dart';

/// Enum cho loại người gửi tin nhắn
enum SenderType {
  petOwner('PET_OWNER'),
  clinic('CLINIC');

  final String value;
  const SenderType(this.value);

  static SenderType fromString(String? value) {
    switch (value?.toUpperCase()) {
      case 'PET_OWNER':
        return SenderType.petOwner;
      case 'CLINIC':
        return SenderType.clinic;
      default:
        return SenderType.petOwner;
    }
  }
}

/// Enum cho trạng thái tin nhắn
enum MessageStatus {
  sent('SENT'),
  delivered('DELIVERED'),
  seen('SEEN');

  final String value;
  const MessageStatus(this.value);

  static MessageStatus fromString(String? value) {
    switch (value?.toUpperCase()) {
      case 'DELIVERED':
        return MessageStatus.delivered;
      case 'SEEN':
        return MessageStatus.seen;
      default:
        return MessageStatus.sent;
    }
  }
}

/// Enum cho loại tin nhắn
enum MessageType {
  text('TEXT'),
  image('IMAGE'),
  imageText('IMAGE_TEXT');

  final String value;
  const MessageType(this.value);

  static MessageType fromString(String? value) {
    switch (value?.toUpperCase()) {
      case 'IMAGE':
        return MessageType.image;
      case 'IMAGE_TEXT':
        return MessageType.imageText;
      default:
        return MessageType.text;
    }
  }
}

/// Model cho cuộc hội thoại (ChatConversation)
class ChatConversation extends BaseModel {
  final String id;
  final String petOwnerId;
  final String clinicId;
  final String? clinicName;
  final String? clinicLogo;
  final String? petOwnerName;
  final String? petOwnerAvatar;
  final String? lastMessage;
  final String? lastMessageSender;
  final DateTime? lastMessageAt;
  final int unreadCount; // API returns unreadCount mapped by role
  final int unreadCountPetOwner;
  final int unreadCountClinic;
  final bool partnerOnline; // API returns partnerOnline mapped by role
  final bool petOwnerOnline;
  final bool clinicOnline;

  ChatConversation({
    required this.id,
    required this.petOwnerId,
    required this.clinicId,
    this.clinicName,
    this.clinicLogo,
    this.petOwnerName,
    this.petOwnerAvatar,
    this.lastMessage,
    this.lastMessageSender,
    this.lastMessageAt,
    this.unreadCount = 0,
    this.unreadCountPetOwner = 0,
    this.unreadCountClinic = 0,
    this.partnerOnline = false,
    this.petOwnerOnline = false,
    this.clinicOnline = false,
  });

  factory ChatConversation.fromJson(Map<String, dynamic> json) {
    // Helper to safely get string or null
    String? getString(String camel, String snake) {
      final val = json[camel] ?? json[snake];
      if (val == null || val.toString().isEmpty) return null;
      return val.toString();
    }

    return ChatConversation(
      id: json['id'] ?? '',
      petOwnerId: json['petOwnerId'] ?? json['pet_owner_id'] ?? '',
      clinicId: json['clinicId'] ?? json['clinic_id'] ?? '',
      clinicName: json['clinicName'] ?? json['clinic_name'],
      clinicLogo: getString('clinicLogo', 'clinic_logo'),
      petOwnerName: json['petOwnerName'] ?? json['pet_owner_name'],
      petOwnerAvatar: json['petOwnerAvatar'] ?? json['pet_owner_avatar'],
      lastMessage: json['lastMessage'] ?? json['last_message'],
      lastMessageSender:
          json['lastMessageSender'] ?? json['last_message_sender'],
      lastMessageAt:
          _parseUtcDateConv(json['lastMessageAt'] ?? json['last_message_at']),
      // API returns unreadCount mapped by role (for Pet Owner, this is their unread count)
      unreadCount: (json['unreadCount'] ?? json['unread_count'] ?? 0) as int,
      unreadCountPetOwner: (json['unreadCountPetOwner'] ??
          json['unread_count_pet_owner'] ??
          0) as int,
      unreadCountClinic: (json['unreadCountClinic'] ??
          json['unread_count_clinic'] ??
          0) as int,
      // API returns partnerOnline mapped by role (for Pet Owner, this is clinic online status)
      partnerOnline: _parseBool(json['partnerOnline']) ??
          _parseBool(json['partner_online']) ??
          false,
      petOwnerOnline: _parseBool(json['petOwnerOnline']) ??
          _parseBool(json['pet_owner_online']) ??
          false,
      clinicOnline: _parseBool(json['clinicOnline']) ??
          _parseBool(json['clinic_online']) ??
          false,
    );
  }

  /// Helper function to safely parse bool from dynamic value
  static bool? _parseBool(dynamic value) {
    if (value == null) return null;
    if (value is bool) return value;
    if (value is String) return value.toLowerCase() == 'true';
    return null;
  }

  /// Parse date string from backend as UTC and convert to local time
  static DateTime? _parseUtcDateConv(dynamic value) {
    if (value == null) return null;
    String dateStr = value.toString();
    if (!dateStr.endsWith('Z') &&
        !dateStr.contains('+') &&
        !RegExp(r'-\d{2}:\d{2}$').hasMatch(dateStr)) {
      dateStr += 'Z';
    }
    return DateTime.parse(dateStr).toLocal();
  }

  @override
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'petOwnerId': petOwnerId,
      'clinicId': clinicId,
      'clinicName': clinicName,
      'clinicLogo': clinicLogo,
      'petOwnerName': petOwnerName,
      'petOwnerAvatar': petOwnerAvatar,
      'lastMessage': lastMessage,
      'lastMessageSender': lastMessageSender,
      'lastMessageAt': lastMessageAt?.toIso8601String(),
      'unreadCountPetOwner': unreadCountPetOwner,
      'unreadCountClinic': unreadCountClinic,
      'petOwnerOnline': petOwnerOnline,
      'clinicOnline': clinicOnline,
    };
  }

  /// Lấy số tin nhắn chưa đọc cho Pet Owner
  /// API trả về unreadCount đã được map theo role, nên ưu tiên dùng unreadCount
  int get myUnreadCount => unreadCount > 0 ? unreadCount : unreadCountPetOwner;

  /// Kiểm tra clinic có online không
  /// API trả về partnerOnline đã được map theo role, nên ưu tiên dùng partnerOnline
  bool get isClinicOnline => partnerOnline || clinicOnline;

  /// Get secure logo URL (force https)
  String? get secureClinicLogo {
    if (clinicLogo == null || clinicLogo!.isEmpty) return null;
    if (clinicLogo!.startsWith('http://')) {
      return clinicLogo!.replaceFirst('http://', 'https://');
    }
    return clinicLogo;
  }

  /// Copy with updated fields
  ChatConversation copyWith({
    String? id,
    String? petOwnerId,
    String? clinicId,
    String? clinicName,
    String? clinicLogo,
    String? petOwnerName,
    String? petOwnerAvatar,
    String? lastMessage,
    String? lastMessageSender,
    DateTime? lastMessageAt,
    int? unreadCount,
    int? unreadCountPetOwner,
    int? unreadCountClinic,
    bool? partnerOnline,
    bool? petOwnerOnline,
    bool? isClinicOnline,
  }) {
    return ChatConversation(
      id: id ?? this.id,
      petOwnerId: petOwnerId ?? this.petOwnerId,
      clinicId: clinicId ?? this.clinicId,
      clinicName: clinicName ?? this.clinicName,
      clinicLogo: clinicLogo ?? this.clinicLogo,
      petOwnerName: petOwnerName ?? this.petOwnerName,
      petOwnerAvatar: petOwnerAvatar ?? this.petOwnerAvatar,
      lastMessage: lastMessage ?? this.lastMessage,
      lastMessageSender: lastMessageSender ?? this.lastMessageSender,
      lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      unreadCount: unreadCount ?? this.unreadCount,
      unreadCountPetOwner: unreadCountPetOwner ?? this.unreadCountPetOwner,
      unreadCountClinic: unreadCountClinic ?? this.unreadCountClinic,
      partnerOnline: partnerOnline ?? this.partnerOnline,
      petOwnerOnline: petOwnerOnline ?? this.petOwnerOnline,
      clinicOnline: isClinicOnline ?? clinicOnline,
    );
  }
}

/// Model cho tin nhắn
class ChatMessage extends BaseModel {
  final String id;
  final String conversationId;
  final String senderId;
  final SenderType senderType;
  final String? senderName;
  final String? senderAvatar;
  final String content;
  final MessageType messageType;
  final String? imageUrl;
  final MessageStatus status;
  final bool isRead;
  final DateTime? readAt;
  final DateTime createdAt;
  final bool isUploading; // Flag for upload state
  final List<ActionButton>? actionButtons; // Add actionButtons

  ChatMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderType,
    this.senderName,
    this.senderAvatar,
    required this.content,
    this.messageType = MessageType.text,
    this.imageUrl,
    this.status = MessageStatus.sent,
    this.isRead = false,
    this.readAt,
    required this.createdAt,
    this.isUploading = false,
    this.actionButtons,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] ?? '',
      conversationId: json['conversationId'] ??
          json['chatBoxId'] ??
          json['chat_box_id'] ??
          '',
      senderId: json['senderId'] ?? json['sender_id'] ?? '',
      senderType:
          SenderType.fromString(json['senderType'] ?? json['sender_type']),
      senderName: json['senderName'] ?? json['sender_name'],
      senderAvatar: json['senderAvatar'] ?? json['sender_avatar'],
      content: json['content'] ?? '',
      messageType:
          MessageType.fromString(json['messageType'] ?? json['message_type']),
      imageUrl: json['imageUrl'] ?? json['image_url'],
      status: MessageStatus.fromString(json['status']),
      isRead: json['isRead'] ?? json['is_read'] ?? false,
      readAt: _parseUtcDate(json['readAt'] ?? json['read_at']),
      createdAt: _parseUtcDate(json['createdAt'] ?? json['created_at']) ??
          DateTime.now(),
      isUploading: json['isUploading'] ??
          false, // Default to false when parsing from JSON
      actionButtons: (json['actionButtons'] ?? json['action_buttons']) != null
          ? ((json['actionButtons'] ?? json['action_buttons']) as List)
              .map((e) =>
                  ActionButton.fromJson(Map<String, dynamic>.from(e as Map)))
              .toList()
          : null,
    );
  }

  /// Parse date string from backend as UTC and convert to local time
  /// Backend returns dates without timezone suffix (e.g., "2026-02-23T03:50:36.568")
  /// which is actually UTC time
  static DateTime? _parseUtcDate(dynamic value) {
    if (value == null) return null;
    String dateStr = value.toString();
    // If no timezone info, treat as UTC by appending 'Z'
    if (!dateStr.endsWith('Z') &&
        !dateStr.contains('+') &&
        !RegExp(r'-\d{2}:\d{2}$').hasMatch(dateStr)) {
      dateStr += 'Z';
    }
    return DateTime.parse(dateStr).toLocal();
  }

  @override
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'conversationId': conversationId,
      'senderId': senderId,
      'senderType': senderType.value,
      'senderName': senderName,
      'senderAvatar': senderAvatar,
      'content': content,
      'status': status.value,
      'isRead': isRead,
      'readAt': readAt?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
      if (actionButtons != null)
        'actionButtons': actionButtons!.map((e) => e.toJson()).toList(),
    };
  }

  /// Kiểm tra tin nhắn có phải của mình không (Pet Owner)
  bool get isMine => senderType == SenderType.petOwner;

  /// Get secure image URL with Cloudinary format optimization
  /// Forces JPG format to avoid PNG rendering issues on some devices
  String? get secureImageUrl {
    if (imageUrl == null || imageUrl!.isEmpty) return null;
    String url = imageUrl!;

    // Force HTTPS
    if (url.startsWith('http://')) {
      url = url.replaceFirst('http://', 'https://');
    }

    // Transform Cloudinary URLs to force JPG format for better compatibility
    if (url.contains('res.cloudinary.com') && url.contains('/upload/')) {
      // Add f_jpg,q_auto transformation after /upload/
      url = url.replaceFirst('/upload/', '/upload/f_jpg,q_auto/');
    }

    return url;
  }

  /// Copy with updated fields
  ChatMessage copyWith({
    String? id,
    String? conversationId,
    String? senderId,
    SenderType? senderType,
    String? senderName,
    String? senderAvatar,
    String? content,
    MessageType? messageType,
    String? imageUrl,
    MessageStatus? status,
    bool? isRead,
    DateTime? readAt,
    DateTime? createdAt,
    bool? isUploading,
    List<ActionButton>? actionButtons,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      conversationId: conversationId ?? this.conversationId,
      senderId: senderId ?? this.senderId,
      senderType: senderType ?? this.senderType,
      senderName: senderName ?? this.senderName,
      senderAvatar: senderAvatar ?? this.senderAvatar,
      content: content ?? this.content,
      messageType: messageType ?? this.messageType,
      imageUrl: imageUrl ?? this.imageUrl,
      status: status ?? this.status,
      isRead: isRead ?? this.isRead,
      readAt: readAt ?? this.readAt,
      createdAt: createdAt ?? this.createdAt,
      isUploading: isUploading ?? this.isUploading,
      actionButtons: actionButtons ?? this.actionButtons,
    );
  }
}

/// Request tạo hoặc lấy chat box
class CreateChatBoxRequest {
  final String clinicId;

  CreateChatBoxRequest({required this.clinicId});

  Map<String, dynamic> toJson() => {'clinicId': clinicId};
}

/// Request gửi tin nhắn
class SendMessageRequest {
  final String content;

  SendMessageRequest({required this.content});

  Map<String, dynamic> toJson() => {'content': content};
}

/// Response số tin nhắn chưa đọc
class UnreadCountResponse {
  final int count;

  UnreadCountResponse({required this.count});

  factory UnreadCountResponse.fromJson(Map<String, dynamic> json) {
    return UnreadCountResponse(count: json['count'] ?? 0);
  }
}

/// Model cho Action Button trong tin nhắn
class ActionButton {
  final String id;
  final String label;
  final String type; // 'MENU', 'OFFER', 'BOOKING', 'CUSTOM'

  ActionButton({
    required this.id,
    required this.label,
    required this.type,
  });

  factory ActionButton.fromJson(Map<String, dynamic> json) {
    return ActionButton(
      id: json['id'] ?? '',
      label: json['label'] ?? '',
      type: json['type'] ?? 'CUSTOM',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'label': label,
      'type': type,
    };
  }
}
