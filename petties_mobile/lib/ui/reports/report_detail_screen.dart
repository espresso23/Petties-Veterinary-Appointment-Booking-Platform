import 'package:flutter/material.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/report.dart';

class ReportDetailScreen extends StatelessWidget {
  final dynamic report;

  const ReportDetailScreen({super.key, required this.report});

  @override
  Widget build(BuildContext context) {
    if (report is! ReportResponse) {
      return Scaffold(
        appBar: AppBar(title: const Text('CHI TIẾT BÁO CÁO')),
        body: const Center(child: Text('Dữ liệu báo cáo không hợp lệ')),
      );
    }

    final data = report as ReportResponse;

    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        title: const Text(
          'CHI TIẾT BÁO CÁO',
          style: TextStyle(
            fontWeight: FontWeight.w900,
            letterSpacing: 1.1,
            color: AppColors.stone900,
            fontSize: 18,
          ),
        ),
        backgroundColor: AppColors.white,
        centerTitle: true,
        elevation: 0,
        iconTheme: const IconThemeData(color: AppColors.stone900),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(3),
          child: Container(color: AppColors.stone900, height: 3),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status and ID Card
            _buildStatusHeader(data),
            const SizedBox(height: 24),

            // Info Details
            _buildSectionLayout(
              title: 'THÔNG TIN CHUNG',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildDetailRow('Đang báo cáo:', data.reportedName),
                  const SizedBox(height: 12),
                  _buildDetailRow('Lịch hẹn:', data.bookingCode),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Reason
            _buildSectionLayout(
              title: 'NỘI DUNG',
              child: Text(
                data.reason,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.5,
                  color: AppColors.stone900,
                ),
              ),
            ),
            const SizedBox(height: 24),

            if (data.adminNote != null && data.adminNote!.trim().isNotEmpty) ...[
              _buildSectionLayout(
                title: 'LỜI NHẮN TỪ QUẢN TRỊ VIÊN',
                child: Text(
                  data.adminNote!,
                  style: const TextStyle(
                    fontSize: 14,
                    height: 1.5,
                    fontStyle: FontStyle.italic,
                    color: AppColors.error,
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],

            // Image Proof
            if (data.imageUrls.isNotEmpty) ...[
              _buildSectionLayout(
                title: 'HÌNH ẢNH ĐÍNH KÈM',
                child: SizedBox(
                  height: 200,
                  width: double.infinity,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: data.imageUrls.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (context, index) {
                      final url = data.imageUrls[index];
                      return Container(
                        width: 150,
                        decoration: BoxDecoration(
                          color: AppColors.stone200,
                          border: Border.all(color: AppColors.stone900, width: 2),
                        ),
                        child: Image.network(
                          url,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) => const Center(
                            child: Icon(Icons.broken_image, size: 40, color: AppColors.stone400),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              const SizedBox(height: 32),
            ] else ...[
              _buildSectionLayout(
                title: 'HÌNH ẢNH ĐÍNH KÈM',
                child: const Text('Không có hình ảnh đính kèm',
                    style: TextStyle(color: AppColors.stone500, fontStyle: FontStyle.italic)),
              ),
              const SizedBox(height: 32),
            ],

            // Actions - Only show if PENDING or PROCESSING (mock validation)
            if (data.status == 'PENDING' || data.status == 'PROCESSING') ...[
              _buildActionButton(
                context,
                label: 'CẬP NHẬT BÁO CÁO',
                color: AppColors.primary,
                textColor: AppColors.white,
              ),
              const SizedBox(height: 16),
              _buildActionButton(
                context,
                label: 'HỦY BÁO CÁO',
                color: AppColors.white,
                textColor: AppColors.error,
              ),
              const SizedBox(height: 24),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusHeader(ReportResponse data) {
    Color statusColor;
    switch (data.status) {
      case 'PENDING':
        statusColor = AppColors.warning;
        break;
      case 'PROCESSING':
        statusColor = AppColors.info;
        break;
      case 'RESOLVED':
        statusColor = AppColors.success;
        break;
      case 'CANCELLED':
        statusColor = AppColors.stone500;
        break;
      default:
        statusColor = AppColors.stone900;
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border.all(color: AppColors.stone900, width: 3),
        boxShadow: const [
          BoxShadow(
            color: AppColors.stone900,
            offset: Offset(6, 6),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        children: [
          Text(
            'MÃ BÁO CÁO: #${data.id}',
            style: const TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 18,
              color: AppColors.stone900,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: statusColor,
              border: Border.all(color: AppColors.stone900, width: 3),
            ),
            child: Text(
              data.statusText.toUpperCase(),
              style: const TextStyle(
                fontWeight: FontWeight.w900,
                fontSize: 16,
                color: AppColors.white,
                letterSpacing: 1,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionLayout({required String title, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: const BoxDecoration(
            color: AppColors.stone900,
          ),
          child: Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 12,
              color: AppColors.white,
              letterSpacing: 1.2,
            ),
          ),
        ),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: AppColors.white,
            border: Border.all(color: AppColors.stone900, width: 3),
          ),
          padding: const EdgeInsets.all(16),
          child: child,
        ),
      ],
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 100,
          child: Text(
            label,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: AppColors.stone600,
              fontSize: 13,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              color: AppColors.stone900,
              fontSize: 14,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton(BuildContext context,
      {required String label,
      required Color color,
      required Color textColor}) {
    return GestureDetector(
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '$label: Tính năng đang được phát triển',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            behavior: SnackBarBehavior.floating,
            backgroundColor: AppColors.stone900,
          ),
        );
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color,
          border: Border.all(color: AppColors.stone900, width: 3),
          boxShadow: const [
            BoxShadow(
              color: AppColors.stone900,
              offset: Offset(4, 4),
            ),
          ],
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 16,
            color: textColor,
            letterSpacing: 1,
          ),
        ),
      ),
    );
  }
}
