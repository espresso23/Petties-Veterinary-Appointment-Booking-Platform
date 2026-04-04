import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/report.dart';
import '../../data/services/report_service.dart';
import '../../routing/app_routes.dart';

class ReportListScreen extends StatefulWidget {
  const ReportListScreen({super.key});

  @override
  State<ReportListScreen> createState() => _ReportListScreenState();
}

class _ReportListScreenState extends State<ReportListScreen> {
  final ReportService _reportService = ReportService();
  List<ReportResponse> reports = [];
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchReports();
  }

  Future<void> _fetchReports() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final data = await _reportService.getMyReports();
      setState(() {
        reports = data;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        errorMessage = 'Không thể tải lịch sử báo cáo: ${e.toString().replaceAll("Exception:", "").trim()}';
        isLoading = false;
      });
    }
  }

  Widget _buildBody() {
    if (isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.stone900));
    }

    if (errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: AppColors.error),
              const SizedBox(height: 16),
              Text(
                errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.stone800),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _fetchReports,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.stone900,
                  foregroundColor: AppColors.white,
                ),
                child: const Text('Thử lại'),
              )
            ],
          ),
        ),
      );
    }

    if (reports.isEmpty) {
      return RefreshIndicator(
        onRefresh: _fetchReports,
        color: AppColors.stone900,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: SizedBox(
            height: MediaQuery.of(context).size.height * 0.7,
            child: const Center(
              child: Text(
                'Chưa có báo cáo nào.',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone600,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchReports,
      color: AppColors.stone900,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: reports.length,
        separatorBuilder: (_, __) => const SizedBox(height: 16),
        itemBuilder: (context, index) {
          final report = reports[index];
          return _buildReportCard(report);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        title: const Text(
          'LỊCH SỬ BÁO CÁO',
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
      body: _buildBody(),
    );
  }

  Widget _buildReportCard(ReportResponse report) {
    Color statusColor;
    switch (report.status) {
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

    return GestureDetector(
      onTap: () {
        context.push(AppRoutes.reportDetail, extra: report);
      },
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.white,
          border: Border.all(color: AppColors.stone900, width: 3),
          boxShadow: const [
            BoxShadow(
              color: AppColors.stone900,
              offset: Offset(4, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'BÁO CÁO #${report.id.substring(0, report.id.length > 8 ? 8 : report.id.length)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 16,
                      color: AppColors.stone900),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor,
                    border: Border.all(color: AppColors.stone900, width: 2),
                  ),
                  child: Text(
                    report.statusText.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: AppColors.white,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              report.reportedName,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 14,
                color: AppColors.stone900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Lịch hẹn: ${report.bookingCode}',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.stone600,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(8),
              width: double.infinity,
              decoration: const BoxDecoration(
                color: AppColors.stone50,
                border: Border(
                  left: BorderSide(color: AppColors.stone900, width: 3),
                ),
              ),
              child: Text(
                report.reason,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.stone700,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
            if (report.imageUrls.isNotEmpty) ...[
              const SizedBox(height: 12),
              SizedBox(
                height: 48,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: report.imageUrls.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    return Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: AppColors.stone200,
                        border: Border.all(color: AppColors.stone900, width: 2),
                      ),
                      child: Image.network(
                        report.imageUrls[index],
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) => const Icon(
                          Icons.broken_image,
                          size: 20,
                          color: AppColors.stone400,
                        ),
                      ),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
