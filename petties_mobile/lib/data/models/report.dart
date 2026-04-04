class ReportResponse {
  final String id;
  final String bookingId;
  final String bookingCode;
  final String reportedName; // Map từ reportedClinicName hoặc reportedUserName
  final String reason;
  final List<String> imageUrls;
  final String status;
  final String? adminNote;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  ReportResponse({
    required this.id,
    required this.bookingId,
    required this.bookingCode,
    required this.reportedName,
    required this.reason,
    this.imageUrls = const [],
    required this.status,
    this.adminNote,
    this.createdAt,
    this.updatedAt,
  });

  factory ReportResponse.fromJson(Map<String, dynamic> json) {
    List<String> parsedImages = [];
    if (json['attachmentUrls'] != null) {
      parsedImages = List<String>.from(json['attachmentUrls']);
    }

    String reported = json['reportedClinicName'] ?? json['reportedUserName'] ?? 'Đối tượng không xác định';

    return ReportResponse(
      id: json['id']?.toString() ?? '',
      bookingId: json['bookingId']?.toString() ?? '',
      bookingCode: json['bookingCode']?.toString() ?? '',
      reportedName: reported,
      reason: json['reason'] ?? '',
      status: json['status'] ?? 'PENDING',
      adminNote: json['adminNote']?.toString(),
      imageUrls: parsedImages,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt']) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt']) : null,
    );
  }

  String get statusText {
    switch (status) {
      case 'PENDING':
        return 'Chờ xử lý';
      case 'PROCESSING':
        return 'Đang xử lý';
      case 'RESOLVED':
        return 'Đã xử lý';
      case 'CANCELLED':
        return 'Đã hủy';
      case 'REJECTED':
        return 'Từ chối giải quyết';
      default:
        return status;
    }
  }
}
