import 'dart:io';
import 'package:dio/dio.dart';
import '../models/report.dart';
import 'api_client.dart';

class ReportService {
  final ApiClient _apiClient = ApiClient.instance;

  Future<void> createReport({
    required String bookingId,
    required String reason,
    List<File>? imageFiles,
  }) async {
    final formData = FormData.fromMap({
      'bookingId': bookingId,
      'reason': reason,
    });

    if (imageFiles != null && imageFiles.isNotEmpty) {
      for (var file in imageFiles) {
        formData.files.add(MapEntry(
          'files',
          await MultipartFile.fromFile(file.path, filename: file.path.split('/').last),
        ));
      }
    }

    await _apiClient.post(
      '/reports',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
  }

  Future<void> updateReport({
    required String reportId,
    required String bookingId,
    required String reason,
    List<File>? imageFiles,
  }) async {
    final formData = FormData.fromMap({
      'bookingId': bookingId,
      'reason': reason,
    });

    if (imageFiles != null && imageFiles.isNotEmpty) {
      for (var file in imageFiles) {
        formData.files.add(MapEntry(
          'files',
          await MultipartFile.fromFile(file.path, filename: file.path.split('/').last),
        ));
      }
    }

    await _apiClient.put(
      '/reports/$reportId',
      data: formData,
      options: Options(contentType: 'multipart/form-data'),
    );
  }

  Future<void> deleteReport(String reportId) async {
    await _apiClient.delete('/reports/$reportId');
  }

  Future<List<ReportResponse>> getMyReports({int page = 0, int size = 20}) async {
    final response = await _apiClient.get(
      '/reports/my',
      queryParameters: {
        'page': page,
        'size': size,
      },
    );

    if (response.data != null && response.data['content'] != null) {
      final List content = response.data['content'];
      return content.map((e) => ReportResponse.fromJson(e)).toList();
    }
    return [];
  }
}

