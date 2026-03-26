import 'package:flutter/material.dart';

import '../../../../config/constants/app_colors.dart';

class AiClinicCardList extends StatelessWidget {
  final Map<String, dynamic> data;
  final Function(String)? onSelect;

  const AiClinicCardList({
    super.key,
    required this.data,
    this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final rawItems = data['items'] as List<dynamic>?;
    final items = rawItems ??
        ((data['id'] != null || data['name'] != null)
            ? <dynamic>[data]
            : <dynamic>[]);

    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF1C1917), width: 2),
        ),
        child: const Center(
          child: Text(
            'Không tìm thấy phòng khám phù hợp',
            style: TextStyle(
              fontStyle: FontStyle.italic,
              color: Color(0xFF1C1917),
            ),
          ),
        ),
      );
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 400),
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: items.length > 5 ? 5 : items.length,
        separatorBuilder: (context, index) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final clinic = items[index] as Map<String, dynamic>;
          final clinicId = clinic['id']?.toString() ??
              clinic['clinic_id']?.toString() ??
              index.toString();

          return InkWell(
            onTap: onSelect != null ? () => onSelect!(clinicId) : null,
            borderRadius: BorderRadius.circular(12),
            child: _buildClinicCard(clinic),
          );
        },
      ),
    );
  }

  Widget _buildClinicCard(Map<String, dynamic> clinic) {
    final name = clinic['name']?.toString() ?? 'Phòng khám';
    final address = clinic['address']?.toString() ?? 'Địa chỉ';
    final logo = clinic['logo']?.toString() ??
        clinic['avatar_url']?.toString() ??
        clinic['image_url']?.toString();
    final rating = clinic['rating'];
    final distance = clinic['distance']?.toString();

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1C1917), width: 2),
        boxShadow: const [
          BoxShadow(
            color: Color(0xFF1C1917),
            offset: Offset(4, 4),
            blurRadius: 0,
          ),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 70,
              height: 70,
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: const Color(0xFF1C1917),
                  width: 1.5,
                ),
              ),
              child: logo != null && logo.isNotEmpty
                  ? ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: Image.network(logo, fit: BoxFit.cover),
                    )
                  : const Icon(
                      Icons.medication_outlined,
                      color: Color(0xFFD97706),
                      size: 32,
                    ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        address,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.stone600,
                          fontSize: 10,
                          height: 1.2,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      if (rating != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 4,
                            vertical: 1,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFBBF24),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: const Color(0xFF1C1917),
                              width: 1.5,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.star, size: 8),
                              const SizedBox(width: 2),
                              Text(
                                rating.toString(),
                                style: const TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      if (distance != null)
                        Text(
                          'CÁCH ĐÂY $distance',
                          style: const TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
