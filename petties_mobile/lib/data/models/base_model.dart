/// Base model class for API responses
abstract class BaseModel {
  Map<String, dynamic> toJson();
  
  @override
  String toString() => toJson().toString();
}

/// Generic API response wrapper
class ApiResponse<T> {
  final bool success;
  final String? message;
  final T? data;
  final Map<String, dynamic>? errors;
  final Pagination? pagination;

  ApiResponse({
    required this.success,
    this.message,
    this.data,
    this.errors,
    this.pagination,
  });

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic)? fromJsonT,
  ) {
    return ApiResponse<T>(
      success: json['success'] ?? false,
      message: json['message'],
      data: json['data'] != null && fromJsonT != null
          ? fromJsonT(json['data'])
          : json['data'],
      errors: json['errors'],
      pagination: json['pagination'] != null
          ? Pagination.fromJson(json['pagination'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'success': success,
      'message': message,
      'data': data,
      'errors': errors,
      'pagination': pagination?.toJson(),
    };
  }
}

/// Pagination model
class Pagination {
  final int currentPage;
  final int totalPages;
  final int pageSize;
  final int totalCount;
  final bool hasNext;
  final bool hasPrevious;

  Pagination({
    required this.currentPage,
    required this.totalPages,
    required this.pageSize,
    required this.totalCount,
    required this.hasNext,
    required this.hasPrevious,
  });

  factory Pagination.fromJson(Map<String, dynamic> json) {
    return Pagination(
      currentPage: json['current_page'] ?? json['currentPage'] ?? 1,
      totalPages: json['total_pages'] ?? json['totalPages'] ?? 1,
      pageSize: json['page_size'] ?? json['pageSize'] ?? 20,
      totalCount: json['total_count'] ?? json['totalCount'] ?? 0,
      hasNext: json['has_next'] ?? json['hasNext'] ?? false,
      hasPrevious: json['has_previous'] ?? json['hasPrevious'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'current_page': currentPage,
      'total_pages': totalPages,
      'page_size': pageSize,
      'total_count': totalCount,
      'has_next': hasNext,
      'has_previous': hasPrevious,
    };
  }
}
