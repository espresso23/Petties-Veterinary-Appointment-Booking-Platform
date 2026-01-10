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
    return ChatConversation(
      id: json['id'] ?? '',
      petOwnerId: json['petOwnerId'] ?? json['pet_owner_id'] ?? '',
      clinicId: json['clinicId'] ?? json['clinic_id'] ?? '',
      clinicName: json['clinicName'] ?? json['clinic_name'],
      clinicLogo: json['clinicLogo'] ?? json['clinic_logo'],
      petOwnerName: json['petOwnerName'] ?? json['pet_owner_name'],
      petOwnerAvatar: json['petOwnerAvatar'] ?? json['pet_owner_avatar'],
      lastMessage: json['lastMessage'] ?? json['last_message'],
      lastMessageSender:
          json['lastMessageSender'] ?? json['last_message_sender'],
      lastMessageAt: json['lastMessageAt'] != null
          ? DateTime.parse(json['lastMessageAt'])
          : json['last_message_at'] != null
              ? DateTime.parse(json['last_message_at'])
              : null,
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
  final String chatBoxId;
  final String senderId;
  final SenderType senderType;
  final String? senderName;
  final String? senderAvatar;
  final String content;
  final MessageStatus status;
  final bool isRead;
  final DateTime? readAt;
  final DateTime createdAt;

  ChatMessage({
    required this.id,
    required this.chatBoxId,
    required this.senderId,
    required this.senderType,
    this.senderName,
    this.senderAvatar,
    required this.content,
    this.status = MessageStatus.sent,
    this.isRead = false,
    this.readAt,
    required this.createdAt,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] ?? '',
      chatBoxId: json['chatBoxId'] ??
          json['chat_box_id'] ??
          json['conversationId'] ??
          '',
      senderId: json['senderId'] ?? json['sender_id'] ?? '',
      senderType:
          SenderType.fromString(json['senderType'] ?? json['sender_type']),
      senderName: json['senderName'] ?? json['sender_name'],
      senderAvatar: json['senderAvatar'] ?? json['sender_avatar'],
      content: json['content'] ?? '',
      status: MessageStatus.fromString(json['status']),
      isRead: json['isRead'] ?? json['is_read'] ?? false,
      readAt: json['readAt'] != null
          ? DateTime.parse(json['readAt'])
          : json['read_at'] != null
              ? DateTime.parse(json['read_at'])
              : null,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'])
          : json['created_at'] != null
              ? DateTime.parse(json['created_at'])
              : DateTime.now(),
    );
  }

  @override
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'chatBoxId': chatBoxId,
      'senderId': senderId,
      'senderType': senderType.value,
      'senderName': senderName,
      'senderAvatar': senderAvatar,
      'content': content,
      'status': status.value,
      'isRead': isRead,
      'readAt': readAt?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
    };
  }

  /// Kiểm tra tin nhắn có phải của mình không (Pet Owner)
  bool get isMine => senderType == SenderType.petOwner;

  /// Copy with updated fields
  ChatMessage copyWith({
    String? id,
    String? chatBoxId,
    String? senderId,
    SenderType? senderType,
    String? senderName,
    String? senderAvatar,
    String? content,
    MessageStatus? status,
    bool? isRead,
    DateTime? readAt,
    DateTime? createdAt,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      chatBoxId: chatBoxId ?? this.chatBoxId,
      senderId: senderId ?? this.senderId,
      senderType: senderType ?? this.senderType,
      senderName: senderName ?? this.senderName,
      senderAvatar: senderAvatar ?? this.senderAvatar,
      content: content ?? this.content,
      status: status ?? this.status,
      isRead: isRead ?? this.isRead,
      readAt: readAt ?? this.readAt,
      createdAt: createdAt ?? this.createdAt,
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
