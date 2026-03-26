import 'dart:convert';
import 'package:dio/dio.dart';

import '../../config/constants/app_constants.dart';
import '../../config/env/environment.dart';
import '../../utils/storage_service.dart';
import '../models/diagnosis.dart';

class DiagnosisService {
  final StorageService _storage = StorageService();
  final Dio _dio = Dio(BaseOptions(
    baseUrl: '${Environment.aiServiceUrl}/api',
    connectTimeout: const Duration(seconds: 30),
    receiveTimeout: const Duration(seconds: 60),
  ));

  DiagnosisService() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _getToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
    ));
  }

  Future<String?> _getToken() async {
    final token = await _storage.getString(AppConstants.accessTokenKey);
    if (token == null || token.isEmpty) {
      return null;
    }
    return token;
  }

  Future<StaffDiagnosisResponse> analyzeCase({
    required DiagnosisSpecies species,
    String? petId,
    String? bookingId,
    String? breed,
    int? ageMonths,
    double? weightKg,
    DiagnosisSex? sex,
    List<String>? allergies,
    required String doctorDescription,
    String? bodyPart,
    List<String>? symptoms,
    List<String>? imageUrls,
    DiagnosisImageAnalysisMode imageAnalysisMode =
        DiagnosisImageAnalysisMode.full,
    SoapDraft? soapDraft,
  }) async {
    final request = StaffDiagnosisRequest(
      petId: petId,
      bookingId: bookingId,
      species: species,
      breed: breed,
      ageMonths: ageMonths,
      weightKg: weightKg,
      sex: sex,
      allergies: allergies,
      doctorDescription: doctorDescription,
      bodyPart: bodyPart,
      symptoms: symptoms,
      imageUrls: imageUrls,
      imageAnalysisMode: imageAnalysisMode,
      soapDraft: soapDraft,
    );

    try {
      final response = await _dio.post(
        '/v1/staff-diagnosis/analyze',
        data: jsonEncode(request.toJson()),
        options: Options(
          headers: {
            'Content-Type': 'application/json',
          },
        ),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        return StaffDiagnosisResponse.fromJson(
            response.data as Map<String, dynamic>);
      } else {
        throw DiagnosisException(
          message: 'Phân tích thất bại. Vui lòng thử lại.',
          statusCode: response.statusCode,
        );
      }
    } on DioException catch (e) {
      throw _handleDioError(e);
    }
  }

  DiagnosisException _handleDioError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return DiagnosisException(
          message: 'Kết nối quá thời gian. Vui lòng kiểm tra mạng.',
        );
      case DioExceptionType.connectionError:
        return DiagnosisException(
          message: 'Không thể kết nối máy chủ. Vui lòng thử lại.',
        );
      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        final data = e.response?.data;
        String message = 'Đã xảy ra lỗi.';
        
        if (data is Map<String, dynamic>) {
          message = data['detail'] ?? data['message'] ?? message;
        }
        
        return DiagnosisException(
          message: message,
          statusCode: statusCode,
        );
      default:
        return DiagnosisException(
          message: 'Đã xảy ra lỗi không xác định.',
        );
    }
  }
}

class DiagnosisException implements Exception {
  final String message;
  final int? statusCode;

  DiagnosisException({
    required this.message,
    this.statusCode,
  });

  @override
  String toString() => message;
}
