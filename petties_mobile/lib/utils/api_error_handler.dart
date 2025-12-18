import 'package:dio/dio.dart';

/// Utility class to extract meaningful error messages from API exceptions
class ApiErrorHandler {
  /// Extracts the error message from a [DioException] or any [dynamic] error
  static String getErrorMessage(dynamic error) {
    if (error is DioException) {
      // 1. Check for response data from server
      if (error.response?.data != null) {
        final data = error.response!.data;
        if (data is Map) {
          // Priority 1: errors map (detailed validation errors)
          if (data.containsKey('errors') && data['errors'] is Map) {
            final errors = data['errors'] as Map;
            if (errors.isNotEmpty) {
              // Get the first error message
              return errors.values.first.toString();
            }
          }
          // Priority 2: message field from GlobalExceptionHandler
          if (data.containsKey('message') && data['message'] != null) {
            final msg = data['message'].toString();
            if (msg != 'Validation Failed') {
              return msg;
            }
          }
          // Priority 3: error field
          if (data.containsKey('error') && data['error'] != null) {
            return data['error'].toString();
          }
        }
      }

      // 2. Map status codes if message is missing
      switch (error.response?.statusCode) {
        case 400:
          return 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.';
        case 401:
          return 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
        case 403:
          return 'Bạn không có quyền thực hiện thao tác này.';
        case 404:
          return 'Không tìm thấy tài nguyên yêu cầu.';
        case 409:
          return 'Dữ liệu đã tồn tại trong hệ thống.';
        case 429:
          return 'Quá nhiều yêu cầu. Vui lòng thử lại sau.';
        case 500:
          return 'Lỗi hệ thống. Vui lòng thử lại sau ít phút.';
      }

      // 3. Network issues
      if (error.type == DioExceptionType.connectionTimeout) {
        return 'Kết nối quá hạn. Vui lòng kiểm tra mạng.';
      }
      if (error.type == DioExceptionType.receiveTimeout) {
        return 'Server phản hồi chậm. Vui lòng thử lại.';
      }
      if (error.type == DioExceptionType.connectionError) {
        return 'Không thể kết nối đến server. Vui lòng kiểm tra mạng.';
      }
    }

    // 4. Fallback for other errors
    final errorStr = error.toString();
    if (errorStr.contains('SocketException')) {
      return 'Không thể kết nối internet.';
    }
    
    // Clean up typical "Exception: ..." prefix
    return errorStr.replaceAll('Exception: ', '').trim();
  }
}
