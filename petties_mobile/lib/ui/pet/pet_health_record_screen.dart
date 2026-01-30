import 'package:flutter/material.dart';
import '../../data/models/emr.dart';
import '../../data/models/vaccination.dart';
import '../../data/services/emr_service.dart';
import '../../data/services/vaccination_service.dart';
import '../../config/constants/app_colors.dart';
import 'package:intl/intl.dart';
import '../vet/patient/widgets/vaccination_roadmap_table.dart';

class PetHealthRecordScreen extends StatefulWidget {
  final String petId;
  final int initialTabIndex;

  const PetHealthRecordScreen({
    super.key,
    required this.petId,
    this.initialTabIndex = 0,
  });

  @override
  State<PetHealthRecordScreen> createState() => _PetHealthRecordScreenState();
}

class _PetHealthRecordScreenState extends State<PetHealthRecordScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _emrService = EmrService();
  final _vaccinationService = VaccinationService();

  late Future<List<EmrRecord>> _emrFuture;
  late Future<List<VaccinationRecord>> _vaccinationFuture;
  late Future<List<VaccinationRecord>> _upcomingFuture;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: 2,
      vsync: this,
      initialIndex: widget.initialTabIndex,
    );
    _loadData();
  }

  void _loadData() {
    setState(() {
      _emrFuture = _emrService.getEmrsByPetId(widget.petId);
      _vaccinationFuture = _vaccinationService.getVaccinationsByPet(widget.petId);
      _upcomingFuture = _vaccinationService.getUpcomingVaccinations(widget.petId);
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.white,
        title: const Text('HỒ SƠ SỨC KHỎE'),
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: AppColors.stone900,
          indicatorWeight: 4,
          labelColor: AppColors.white,
          unselectedLabelColor: AppColors.white.withOpacity(0.7),
          labelStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
          tabs: const [
            Tab(text: 'TIÊM CHỦNG'),
            Tab(text: 'BỆNH ÁN'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildVaccinationList(),
          _buildEmrList(),
        ],
      ),
    );
  }

  Widget _buildVaccinationList() {
    return FutureBuilder<List<List<VaccinationRecord>>>(
      future: Future.wait([_vaccinationFuture, _upcomingFuture]),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(child: Text('Lỗi: ${snapshot.error}'));
        }

        final history = snapshot.data?[0] ?? [];
        final upcoming = snapshot.data?[1] ?? [];

        if (history.isEmpty && upcoming.isEmpty) {
          return const _EmptyState(message: 'Chưa có ghi nhận tiêm phòng nào.');
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Roadmap Grid
              const Text(
                'LỘ TRÌNH TIÊM CHỦNG',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 14,
                  color: AppColors.stone500,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 12),
              VaccinationRoadmapTable(
                records: history,
                upcoming: upcoming,
              ),
              const SizedBox(height: 24),

              // Recent History List
              if (history.isNotEmpty) ...[
                const Text(
                  'LỊCH SỬ CHI TIẾT',
                  style: TextStyle(
                    fontWeight: FontWeight.w900,
                    fontSize: 14,
                    color: AppColors.stone500,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 12),
                ...history.map((record) => _VaccinationCard(record: record)),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildEmrList() {
    return FutureBuilder<List<EmrRecord>>(
      future: _emrFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return Center(child: Text('Lỗi: ${snapshot.error}'));
        }
        final records = snapshot.data ?? [];
        if (records.isEmpty) {
          return const _EmptyState(message: 'Chưa có hồ sơ bệnh án nào.');
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: records.length,
          itemBuilder: (context, index) => _EmrCard(record: records[index]),
        );
      },
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String message;
  const _EmptyState({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.history_edu, size: 64, color: AppColors.stone300),
          const SizedBox(height: 16),
          Text(message, style: const TextStyle(color: AppColors.stone500)),
        ],
      ),
    );
  }
}

class _VaccinationCard extends StatelessWidget {
  final VaccinationRecord record;
  const _VaccinationCard({required this.record});

  @override
  Widget build(BuildContext context) {
    final bool isUpcoming = record.nextDueDate != null && record.nextDueDate!.isAfter(DateTime.now());

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [BoxShadow(color: AppColors.stone900, offset: Offset(3, 3))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  record.vaccineName.toUpperCase(),
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.stone100,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: AppColors.stone900),
                ),
                child: Text(
                  record.vaccinationDate != null
                      ? DateFormat('dd/MM/yyyy').format(record.vaccinationDate!)
                      : 'N/A',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildInfoRow(Icons.person, 'Bác sĩ: ${record.vetName ?? "N/A"}'),
          _buildInfoRow(Icons.business, 'Phòng khám: ${record.clinicName ?? "N/A"}'),
          if (record.nextDueDate != null) ...[
            const Divider(color: AppColors.stone200, height: 24),
            Row(
              children: [
                Icon(
                  isUpcoming ? Icons.schedule : Icons.check_circle,
                  size: 16,
                  color: isUpcoming ? Colors.blue : Colors.green,
                ),
                const SizedBox(width: 8),
                Text(
                  'Tái chủng: ${DateFormat('dd/MM/yyyy').format(record.nextDueDate!)}',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: isUpcoming ? Colors.blue : AppColors.stone600,
                  ),
                ),
                if (isUpcoming) ...[
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.blue.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'SẮP TỚI',
                      style: TextStyle(color: Colors.blue, fontSize: 10, fontWeight: FontWeight.w900),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Icon(icon, size: 14, color: AppColors.stone400),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(color: AppColors.stone600, fontSize: 13))),
        ],
      ),
    );
  }
}

class _EmrCard extends StatelessWidget {
  final EmrRecord record;
  const _EmrCard({required this.record});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [BoxShadow(color: AppColors.stone900, offset: Offset(3, 3))],
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.secondary,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.stone900, width: 1.5),
                    ),
                    child: Text(
                      DateFormat('dd/MM/yyyy').format(record.examinationDate),
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 11),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    record.bookingCode != null
                        ? '#${record.bookingCode}'
                        : '#${record.bookingId?.substring(0, 8) ?? "N/A"}',
                    style: const TextStyle(color: AppColors.stone400, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                (record.assessment ?? 'Khám tổng quát').toUpperCase(),
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
            ],
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Bác sĩ: ${record.vetName}',
                style: const TextStyle(color: AppColors.stone500, fontSize: 12),
              ),
              if (record.clinicName != null)
                Text(
                  'Phòng khám: ${record.clinicName}',
                  style: const TextStyle(color: AppColors.stone400, fontSize: 11, fontStyle: FontStyle.italic),
                ),
            ],
          ),
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              color: AppColors.stone50,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Vital Stats Row
                  Row(
                    children: [
                      _buildMiniInfo('CÂN NẶNG', '${record.weightKg ?? "--"} kg'),
                      _buildMiniInfo('THÂN NHIỆT', '${record.temperatureC ?? "--"} °C'),
                      _buildMiniInfo('NHỊP TIM', '${record.heartRate ?? "--"} bpm'),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  // BCS Segment
                  _buildBcsRow(record.bcs),
                  const SizedBox(height: 16),
                  
                  // SOAP Sections
                  _buildSoapField('S', 'CHỦ QUAN (SUBJECTIVE)', record.subjective),
                  _buildSoapField('O', 'KHÁCH QUAN (OBJECTIVE)', record.objective),
                  _buildSoapField('A', 'ĐÁNH GIÁ (ASSESSMENT)', record.assessment),
                  _buildSoapField('P', 'KẾ HOẠCH (PLAN)', record.plan),

                  // Re-examination Info
                  if (record.reExaminationDate != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.amber.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.amber.shade200),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.event_repeat, color: Colors.amber, size: 20),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('HẸN TÁI KHÁM', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.amber)),
                                Text(DateFormat('dd/MM/yyyy').format(record.reExaminationDate!), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppColors.stone800)),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Prescriptions
                  if (record.prescriptions.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Text('ĐƠN THUỐC', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: AppColors.primary)),
                    const SizedBox(height: 8),
                    ...record.prescriptions.map((p) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.white,
                        border: Border.all(color: AppColors.stone900),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(p.medicineName, style: const TextStyle(fontWeight: FontWeight.bold)),
                          Text('${p.dosage} • ${p.frequency}', style: const TextStyle(fontSize: 12, color: AppColors.stone500)),
                          if (p.instructions != null)
                             Text('HDSD: ${p.instructions}', style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.stone400)),
                        ],
                      ),
                    )),
                  ],

                  // Images
                  if (record.images.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const Text('HÌNH ẢNH LÂM SÀNG', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: AppColors.stone400)),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 100,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: record.images.length,
                        itemBuilder: (context, idx) => Container(
                          width: 100,
                          margin: const EdgeInsets.only(right: 8),
                          decoration: BoxDecoration(
                            border: Border.all(color: AppColors.stone200),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: GestureDetector(
                            onTap: () => _showFullScreenImage(context, record.images[idx]),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: Image.network(record.images[idx].url, fit: BoxFit.cover),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showFullScreenImage(BuildContext context, EmrImage img) {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: EdgeInsets.zero,
        child: Stack(
          alignment: Alignment.center,
          children: [
            InteractiveViewer(
              panEnabled: true,
              minScale: 0.5,
              maxScale: 4,
              child: Image.network(img.url),
            ),
            Positioned(
              top: 40,
              right: 20,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 30),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            if (img.description != null && img.description!.isNotEmpty)
              Positioned(
                bottom: 40,
                left: 20,
                right: 20,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.6),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    img.description!,
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildBcsRow(int? bcs) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('ĐIỂM THỂ TRẠNG (BCS)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.stone400)),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(9, (index) {
            final score = index + 1;
            final isSelected = bcs == score;
            return Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: isSelected ? AppColors.secondary : AppColors.white,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.stone900, width: isSelected ? 2 : 1),
              ),
              child: Center(
                child: Text(
                  '$score',
                  style: TextStyle(
                    fontWeight: isSelected ? FontWeight.w900 : FontWeight.normal,
                    fontSize: 12,
                    color: isSelected ? AppColors.stone900 : AppColors.stone400,
                  ),
                ),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildSoapField(String tag, String label, String? content) {
    if (content == null || content.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(tag, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 10, color: AppColors.primary)),
              ),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.stone400)),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.stone200),
            ),
            child: Text(content, style: const TextStyle(fontSize: 13, color: AppColors.stone800, height: 1.4)),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniInfo(String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.stone400)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
        ],
      ),
    );
  }

  Widget _buildSection(String label, String? content) {
    if (content == null || content.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.stone400)),
          const SizedBox(height: 4),
          Text(content, style: const TextStyle(fontSize: 14, color: AppColors.stone800)),
        ],
      ),
    );
  }
}
