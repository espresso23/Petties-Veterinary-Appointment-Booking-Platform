import 'api_client.dart';
import '../models/review.dart';

class ReviewService {
  final ApiClient _apiClient = ApiClient.instance;

  Future<Review> createReview({
    required String bookingId,
    required int rating,
    String? comment,
  }) async {
    final response = await _apiClient.post(
      '/reviews',
      data: {
        'bookingId': bookingId,
        'rating': rating,
        'comment': comment,
      },
    );
    return Review.fromJson(response.data);
  }

  Future<Review> updateReview({
    required String reviewId,
    required String bookingId,
    required int rating,
    String? comment,
  }) async {
    final response = await _apiClient.put(
      '/reviews/$reviewId',
      data: {
        'bookingId': bookingId,
        'rating': rating,
        'comment': comment,
      },
    );
    return Review.fromJson(response.data);
  }

  Future<List<Review>> getClinicReviews(String clinicId) async {
    final response = await _apiClient.get('/reviews/clinic/$clinicId');
    if (response.data is List) {
      return (response.data as List)
          .map((json) => Review.fromJson(json))
          .toList();
    }
    return [];
  }
}
