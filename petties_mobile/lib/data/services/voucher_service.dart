import 'api_client.dart';

/// Model cho voucher từ API
class VoucherModel {
  final String clinicVoucherId;
  final String voucherId;
  final String code;
  final String name;
  final String? description;
  final String discountType; // PERCENTAGE | FIXED_AMOUNT
  final double discountValue;
  final double? maxDiscountAmount;
  final double minOrderAmount;
  final String? applicableCategory;
  final int? usageLimit;
  final int usedCount;
  final String startDate;
  final String endDate;
  final bool isEnabled;
  final double? discountAmount; // Tính sẵn từ server

  VoucherModel({
    required this.clinicVoucherId,
    required this.voucherId,
    required this.code,
    required this.name,
    this.description,
    required this.discountType,
    required this.discountValue,
    this.maxDiscountAmount,
    required this.minOrderAmount,
    this.applicableCategory,
    this.usageLimit,
    required this.usedCount,
    required this.startDate,
    required this.endDate,
    required this.isEnabled,
    this.discountAmount,
  });

  factory VoucherModel.fromJson(Map<String, dynamic> json) {
    return VoucherModel(
      clinicVoucherId: json['clinicVoucherId'] ?? '',
      voucherId: json['voucherId'] ?? '',
      code: json['code'] ?? '',
      name: json['name'] ?? '',
      description: json['description'],
      discountType: json['discountType'] ?? 'FIXED_AMOUNT',
      discountValue: (json['discountValue'] as num?)?.toDouble() ?? 0,
      maxDiscountAmount: (json['maxDiscountAmount'] as num?)?.toDouble(),
      minOrderAmount: (json['minOrderAmount'] as num?)?.toDouble() ?? 0,
      applicableCategory: json['applicableCategory'],
      usageLimit: json['usageLimit'],
      usedCount: json['usedCount'] ?? 0,
      startDate: json['startDate'] ?? '',
      endDate: json['endDate'] ?? '',
      isEnabled: json['isEnabled'] ?? true,
      discountAmount: (json['discountAmount'] as num?)?.toDouble(),
    );
  }

  /// Hiển thị mô tả giảm giá ngắn gọn
  String get discountLabel {
    if (discountType == 'PERCENTAGE') {
      return 'Giảm ${discountValue.toStringAsFixed(0)}%';
    }
    return 'Giảm ${_formatVND(discountValue)}';
  }

  String _formatVND(double amount) {
    if (amount >= 1000000) {
      final m = amount / 1000000;
      return '${m % 1 == 0 ? m.toInt() : m.toStringAsFixed(1)}tr';
    }
    if (amount >= 1000) {
      final k = amount / 1000;
      return '${k % 1 == 0 ? k.toInt() : k.toStringAsFixed(0)}k';
    }
    return '${amount.toInt()}đ';
  }
}

/// VoucherService - Gọi API voucher cho Pet Owner
class VoucherService {
  final ApiClient _apiClient = ApiClient.instance;

  /// Lấy voucher khả dụng cho booking
  /// [clinicId] - ID phòng khám
  /// [orderAmount] - Tổng tiền đơn hàng
  /// [paymentMethod] - CASH hoặc QR (filter voucher requireOnlinePayment)
  /// [serviceCategories] - Danh sách category dịch vụ (filter applicableCategory)
  Future<List<VoucherModel>> getAvailableVouchers({
    required String clinicId,
    required double orderAmount,
    String? paymentMethod,
    List<String>? serviceCategories,
  }) async {
    final Map<String, dynamic> queryParams = {
      'clinicId': clinicId,
      'orderAmount': orderAmount,
    };
    if (paymentMethod != null && paymentMethod.isNotEmpty) {
      queryParams['paymentMethod'] = paymentMethod;
    }
    if (serviceCategories != null && serviceCategories.isNotEmpty) {
      queryParams['serviceCategories'] = serviceCategories;
    }
    final response = await _apiClient.get(
      '/vouchers/available',
      queryParameters: queryParams,
    );
    final list = response.data['vouchers'] as List? ?? [];
    return list.map((j) => VoucherModel.fromJson(j)).toList();
  }

  /// Tính discount preview khi chọn voucher
  /// Returns: {discountAmount, finalAmount}
  Future<Map<String, dynamic>> calculateDiscount({
    required String voucherId,
    required String clinicId,
    required double orderAmount,
  }) async {
    final response = await _apiClient.get(
      '/vouchers/calculate',
      queryParameters: {
        'voucherId': voucherId,
        'clinicId': clinicId,
        'orderAmount': orderAmount,
      },
    );
    return response.data;
  }
}
