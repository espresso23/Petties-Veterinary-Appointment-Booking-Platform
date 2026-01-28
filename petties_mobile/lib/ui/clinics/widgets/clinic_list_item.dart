import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/models/clinic.dart';

/// Clinic list item widget - Neobrutalism Style
class ClinicListItem extends StatelessWidget {
  final Clinic clinic;
  final VoidCallback? onTap;
  final VoidCallback? onBookAppointment;
  final bool showBookButton;

  const ClinicListItem({
    super.key,
    required this.clinic,
    this.onTap,
    this.onBookAppointment,
    this.showBookButton = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Clinic Image with Rating Badge
          _buildClinicImage(),

          // Clinic Info
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Name and Distance Row
                _buildNameRow(),
                const SizedBox(height: 4),

                // Address
                _buildAddress(),
                const SizedBox(height: 8),

                // Status Row (Open/Emergency)
                _buildStatusRow(),
                const SizedBox(height: 12),

                // Action Button
                _buildActionButton(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClinicImage() {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(10),
          ),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: clinic.primaryImageUrl != null
                ? CachedNetworkImage(
                    imageUrl: clinic.primaryImageUrl!,
                    fit: BoxFit.cover,
                    placeholder: (context, url) => Container(
                      color: AppColors.stone100,
                      child: const Center(
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    errorWidget: (context, url, error) =>
                        _buildPlaceholderImage(),
                  )
                : _buildPlaceholderImage(),
          ),
        ),

        // Rating Badge - Neobrutalism
        if (clinic.ratingAvg != null && clinic.ratingCount != null)
          Positioned(
            top: 12,
            left: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.stone900, width: 2),
                boxShadow: const [
                  BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.star,
                    size: 14,
                    color: AppColors.warning,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    clinic.ratingAvg!.toStringAsFixed(1),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: AppColors.stone900,
                    ),
                  ),
                  Text(
                    ' (${clinic.ratingCount})',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppColors.stone500,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildPlaceholderImage() {
    return Container(
      color: AppColors.stone100,
      child: Center(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.stone300, width: 2),
          ),
          child: const Icon(
            Icons.local_hospital,
            size: 40,
            color: AppColors.stone400,
          ),
        ),
      ),
    );
  }

  Widget _buildNameRow() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            clinic.name,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.stone900,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (clinic.distance != null) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.stone900, width: 1.5),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(1, 1)),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.near_me,
                  size: 12,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 3),
                Text(
                  '${clinic.distance!.toStringAsFixed(1)} km',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildAddress() {
    return Text(
      clinic.shortAddress,
      style: const TextStyle(
        fontSize: 13,
        color: AppColors.stone600,
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }

  Widget _buildStatusRow() {
    final isOpen = clinic.isOpen;
    final closingTime = clinic.closingTimeString;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: isOpen ? AppColors.white : AppColors.stone100,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: isOpen ? AppColors.success : AppColors.stone400,
          width: 1.5,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: isOpen ? AppColors.success : AppColors.stone400,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Text(
            isOpen
                ? (closingTime != null
                    ? 'Mở cửa đến $closingTime'
                    : 'Đang mở cửa')
                : 'Đã đóng cửa',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: isOpen ? AppColors.success : AppColors.stone600,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButton() {
    // if (showBookButton) {
    //   return GestureDetector(
    //     onTap: onBookAppointment ?? onTap,
    //     child: Container(
    //       width: double.infinity,
    //       padding: const EdgeInsets.symmetric(vertical: 12),
    //       decoration: BoxDecoration(
    //         color: AppColors.primary,
    //         borderRadius: BorderRadius.circular(8),
    //         border: Border.all(color: AppColors.stone900, width: 2),
    //         boxShadow: const [
    //           BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
    //         ],
    //       ),
    //       child: const Center(
    //         child: Text(
    //           'ĐẶT LỊCH KHÁM',
    //           style: TextStyle(
    //             fontSize: 13,
    //             fontWeight: FontWeight.w800,
    //             color: AppColors.white,
    //             letterSpacing: 1,
    //           ),
    //         ),
    //       ),
    //     ),
    //   );
    // }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.stone900, width: 2),
        ),
        child: const Center(
          child: Text(
            'XEM CHI TIẾT',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
              letterSpacing: 1,
            ),
          ),
        ),
      ),
    );
  }
}
