import 'package:flutter/material.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:go_router/go_router.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/booking.dart';
import '../../data/services/review_service.dart';

class WriteReviewScreen extends StatefulWidget {
  final BookingResponse booking;
  final bool isEditMode;

  const WriteReviewScreen({super.key, required this.booking, this.isEditMode = false});

  @override
  State<WriteReviewScreen> createState() => _WriteReviewScreenState();
}

class _WriteReviewScreenState extends State<WriteReviewScreen> {
  final ReviewService _reviewService = ReviewService();
  double _rating = 5.0;
  final TextEditingController _commentController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.isEditMode) {
      _rating = widget.booking.rating?.toDouble() ?? 5.0;
      _commentController.text = widget.booking.reviewComment ?? '';
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _submitReview() async {
    if (widget.booking.bookingId == null) return;
    
    setState(() => _isLoading = true);

    try {
      await _reviewService.createReview(
        bookingId: widget.booking.bookingId!,
        rating: _rating.toInt(),
        comment: _commentController.text,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cảm ơn bạn đã đánh giá!'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pop(true); // Return true to indicate success
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _updateReview() async {
     if (widget.booking.reviewId == null) return;

     setState(() => _isLoading = true);

    try {
      await _reviewService.updateReview(
        reviewId: widget.booking.reviewId!,
        bookingId: widget.booking.bookingId!,
        rating: _rating.toInt(),
        comment: _commentController.text,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cập nhật đánh giá thành công!'),
            backgroundColor: AppColors.success,
          ),
        );
        context.pop(true);
      }
    } catch (e) {
        // Handle error
         if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi: ${e.toString()}'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
       if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.white,
      appBar: AppBar(
        title: const Text('Đánh giá dịch vụ'),
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.stone900,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Clinic Info
            widget.booking.clinicLogo != null && widget.booking.clinicLogo!.isNotEmpty
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(
                      widget.booking.clinicLogo!,
                      width: 64,
                      height: 64,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(Icons.storefront_rounded, size: 64, color: AppColors.primary),
                    ),
                  )
                : const Icon(Icons.storefront_rounded, size: 64, color: AppColors.primary),
            const SizedBox(height: 16),
            Text(
              widget.booking.clinicName ?? 'Phòng khám',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppColors.stone900,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Lịch hẹn: ${widget.booking.bookingDate}',
              style: const TextStyle(
                fontSize: 14,
                color: AppColors.stone500,
              ),
            ),
            
            const SizedBox(height: 48),

            // Rating Bar
            const Text(
              'Bạn cảm thấy dịch vụ thế nào?',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.stone700,
              ),
            ),
            const SizedBox(height: 16),
            RatingBar.builder(
              initialRating: 5,
              minRating: 1,
              direction: Axis.horizontal,
              allowHalfRating: false,
              itemCount: 5,
              itemPadding: const EdgeInsets.symmetric(horizontal: 4.0),
              itemBuilder: (context, _) => const Icon(
                Icons.star_rounded,
                color: Colors.amber,
              ),
              onRatingUpdate: (rating) {
                setState(() {
                  _rating = rating;
                });
              },
            ),

            const SizedBox(height: 32),

            // Comment
            TextField(
              controller: _commentController,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Nhập đánh giá của bạn (tùy chọn)...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.stone300),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.stone300),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.primary),
                ),
                filled: true,
                fillColor: AppColors.stone50,
              ),
            ),

            const SizedBox(height: 32),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton(
                onPressed: _isLoading ? null : (widget.isEditMode ? _updateReview : _submitReview),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: _isLoading
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        widget.isEditMode ? 'CẬP NHẬT ĐÁNH GIÁ' : 'GỬI ĐÁNH GIÁ',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
