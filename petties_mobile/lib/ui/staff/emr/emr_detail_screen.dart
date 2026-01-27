import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/models/emr.dart';
import '../../../data/models/pet.dart';
import '../../../data/services/emr_service.dart';
import '../../../data/services/auth_service.dart';
import '../../../data/services/pet_service.dart';

class EmrDetailScreen extends StatefulWidget {
  final String emrId;

  const EmrDetailScreen({
    super.key,
    required this.emrId,
  });

  @override
  State<EmrDetailScreen> createState() => _EmrDetailScreenState();
}

class _EmrDetailScreenState extends State<EmrDetailScreen> {
  final _emrService = EmrService();
  final _authService = AuthService();
  final _petService = PetService();
  
  late Future<EmrRecord> _emrFuture;
  String? _currentUserId;
  Pet? _pet;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() {
    _emrFuture = _emrService.getEmrById(widget.emrId);
    _emrFuture.then((emr) {
      _loadPet(emr.petId);
    });
    _getCurrentUser();
  }

  Future<void> _loadPet(String petId) async {
    try {
      final pet = await _petService.getPetById(petId);
      if (mounted) setState(() => _pet = pet);
    } catch (e) {
      debugPrint('Error loading pet: $e');
    }
  }

  Future<void> _getCurrentUser() async {
    final user = await _authService.getCurrentUser();
    if (mounted) {
      setState(() {
        _currentUserId = user.userId;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // Stone 50
      appBar: AppBar(
        title: const Text('Chi tiết Bệnh án', style: TextStyle(fontWeight: FontWeight.bold)),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.stone900),
          onPressed: () => context.pop(),
        ),
      ),
      body: FutureBuilder<EmrRecord>(
        future: _emrFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator(color: AppColors.primary));
          }

          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                   Icon(Icons.error_outline, size: 64, color: AppColors.stone300),
                  const SizedBox(height: 16),
                  Text('Lỗi: ${snapshot.error}', style: const TextStyle(color: AppColors.stone500)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => setState(() { _loadData(); }),
                    child: const Text('Thử lại'),
                  ),
                ],
              ),
            );
          }

          if (!snapshot.hasData) {
            return const Center(child: Text('Không tìm thấy bệnh án'));
          }

          final emr = snapshot.data!;
          
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(emr),
                const SizedBox(height: 24),
                
                _buildSection('1. THÔNG TIN CHUNG', [
                   _buildInfoRow('Ngày khám', DateFormat('dd/MM/yyyy HH:mm').format(emr.examinationDate.isUtc ? emr.examinationDate.toLocal() : emr.examinationDate)),
                   _buildInfoRow('Bác sĩ', emr.staffName ?? 'N/A'),
                   if (emr.reExaminationDate != null)
                     _buildInfoRow('Hẹn tái khám', DateFormat('dd/MM/yyyy').format(emr.reExaminationDate!)),
                   _buildInfoRow('Phòng khám', emr.clinicName ?? 'N/A'),
                   if (emr.notes != null && emr.notes!.isNotEmpty)
                     _buildInfoRow('Ghi chú', emr.notes!),
                ]),
                const SizedBox(height: 24),

                _buildSection('2. DẤU HIỆU SINH TỒN (OBJECTIVE)', [
                  Row(
                    children: [
                      Expanded(child: _buildVitalCard('Cân nặng', '${emr.weightKg ?? "--"} kg', Icons.monitor_weight_outlined, Colors.blue)),
                      const SizedBox(width: 8),
                      Expanded(child: _buildVitalCard('Nhiệt độ', '${emr.temperatureC ?? "--"} °C', Icons.thermostat_outlined, Colors.orange)),
                    ],
                  ),
                  const SizedBox(height: 8), // Gap between rows
                  Row(
                    children: [
                      Expanded(child: _buildVitalCard('Nhịp tim', '${emr.heartRate ?? "--"} bpm', Icons.favorite, Colors.red)),
                      const SizedBox(width: 8),
                      Expanded(child: _buildVitalCard('Thể trạng (BCS)', '${emr.bcs ?? "--"}/9', Icons.accessibility_new, Colors.green)),
                    ],
                  ),
                  if (emr.objective != null && emr.objective!.isNotEmpty)
                     Padding(
                       padding: const EdgeInsets.only(top: 16),
                       child: _buildTextContent(emr.objective!),
                     ),
                ]),
                const SizedBox(height: 24),

                _buildSection('3. TRIỆU CHỨNG (SUBJECTIVE)', [
                   _buildTextContent(emr.subjective ?? 'Không có thông tin'),
                ]),
                const SizedBox(height: 24),

                _buildSection('4. CHẨN ĐOÁN (ASSESSMENT)', [
                   _buildTextContent(emr.assessment ?? 'Chưa có chẩn đoán', isBold: true),
                ]),
                const SizedBox(height: 24),

                _buildSection('5. PHÁC ĐỒ ĐIỀU TRỊ (PLAN)', [
                   _buildTextContent(emr.plan ?? 'Chưa có phác đồ'),
                ]),
                const SizedBox(height: 24),
                
                _buildSection('6. ĐƠN THUỐC', [
                  if (emr.prescriptions.where((p) => p.medicineName.trim().isNotEmpty).isEmpty)
                    _buildTextContent('Không có đơn thuốc')
                  else
                    ...emr.prescriptions
                        .where((p) => p.medicineName.trim().isNotEmpty)
                        .map((p) => _buildPrescriptionCard(p)),
                ]),
                const SizedBox(height: 24),

                if (emr.images.isNotEmpty) ...[
                  _buildSection('7. HÌNH ẢNH', [
                     GridView.builder(
                       shrinkWrap: true,
                       physics: const NeverScrollableScrollPhysics(),
                       gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                         crossAxisCount: 3,
                         crossAxisSpacing: 8,
                         mainAxisSpacing: 8,
                       ),
                       itemCount: emr.images.length,
                       itemBuilder: (context, index) {
                         final img = emr.images[index];
                         return GridTile(
                           footer: (img.description != null && img.description!.isNotEmpty)
                               ? Container(
                                   padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                   color: Colors.black54,
                                   child: Text(
                                     img.description!,
                                     style: const TextStyle(color: Colors.white, fontSize: 10),
                                     maxLines: 1,
                                     overflow: TextOverflow.ellipsis,
                                     textAlign: TextAlign.center,
                                   ),
                                 )
                               : null,
                           child: GestureDetector(
                             onTap: () => _showFullScreenImage(context, img),
                             child: Container(
                               decoration: BoxDecoration(
                                 borderRadius: BorderRadius.circular(8),
                                 border: Border.all(color: AppColors.stone300),
                                 image: DecorationImage(
                                   image: NetworkImage(img.url),
                                   fit: BoxFit.cover,
                                 ),
                               ),
                             ),
                           ),
                         );
                       },
                     ),
                  ]),
                   const SizedBox(height: 80), // Bottom padding for FAB
                ],
              ],
            ),
          );
        },
      ),
      floatingActionButton: FutureBuilder<EmrRecord>(
        future: _emrFuture,
        builder: (context, snapshot) {
          if (!snapshot.hasData) return const SizedBox.shrink();
          final emr = snapshot.data!;
            final now = DateTime.now();
            final createdAt = emr.createdAt.isUtc ? emr.createdAt.toLocal() : emr.createdAt; // Assuming stored as UTC or already local, but best to be safe
            // Check if 24h has passed. 
            // Note: createdAt might need timezone adjustment depending on backend. 
            // Assuming simplified check: compare time difference.
            final diff = now.difference(createdAt).inHours;
            final isActuallyLocked = diff >= 24;

           if (!isActuallyLocked && !emr.isLocked && emr.staffId == _currentUserId) {
            return FloatingActionButton(
              onPressed: () async {
                 final result = await context.push('/staff/emr/edit/${emr.id}');
                 if (result == true) {
                   setState(() { _loadData(); });
                 }
              },
              backgroundColor: AppColors.primary,
              tooltip: 'Chỉnh sửa',
              child: const Icon(Icons.edit, color: Colors.white),
            );
          }
           return const SizedBox.shrink();
        },
      ),
    );
  }

  String _getGenderVietnamese(String? gender) {
    if (gender == 'MALE') return 'Đực';
    if (gender == 'FEMALE') return 'Cái';
    return gender ?? 'N/A';
  }

  String _calculateAge(DateTime? dob) {
    if (dob == null) return 'N/A';
    final now = DateTime.now();
    final years = now.year - dob.year;
    if (years < 1) {
      final months = (now.year - dob.year) * 12 + now.month - dob.month;
      return '$months tháng';
    }
    return '$years tuổi';
  }

  Widget _buildVitalCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color),
          const SizedBox(height: 8),
          Text(label, style: TextStyle(color: color, fontSize: 12), textAlign: TextAlign.center),
          Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 16)),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: const TextStyle(color: AppColors.stone500)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(color: AppColors.stone900, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppColors.stone900,
          ),
        ),
        const SizedBox(height: 12),
        ...children,
      ],
    );
  }

  Widget _buildHeader(EmrRecord emr) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone200),
         boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
           Container(
             width: 80,
             height: 80,
             decoration: BoxDecoration(
               color: AppColors.stone100,
               shape: BoxShape.circle,
               image: _pet?.imageUrl != null
                   ? DecorationImage(
                       image: NetworkImage(_pet!.imageUrl!),
                       fit: BoxFit.cover,
                     )
                   : null,
             ),
             child: _pet?.imageUrl == null
                 ? Icon(
                     (emr.petSpecies?.toLowerCase().contains('chó') ?? false) ? Icons.pets : Icons.pets,
                     color: AppColors.primary,
                     size: 40,
                   )
                 : null,
           ),
           const SizedBox(height: 12),
           Text(
             emr.petName ?? 'Thú cưng',
             style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.stone900),
             textAlign: TextAlign.center,
             maxLines: 2,
             overflow: TextOverflow.ellipsis,
           ),
           const SizedBox(height: 4),
           Text(
             '${emr.petSpecies ?? ''} • ${emr.petBreed ?? ''}',
             style: const TextStyle(color: AppColors.stone500),
             textAlign: TextAlign.center,
             maxLines: 1, 
             overflow: TextOverflow.ellipsis,
           ),
           if (_pet != null) ...[
             const SizedBox(height: 4),
             Text(
               '${_calculateAge(_pet!.dateOfBirth)} • ${_getGenderVietnamese(_pet!.gender)}',
               style: const TextStyle(color: AppColors.stone800, fontWeight: FontWeight.w600),
             ),
           ],
        ],
      ),
    );
  }

  Widget _buildTextContent(String content, {bool isBold = false}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Text(
        content,
        style: TextStyle(
          color: AppColors.stone800,
          fontSize: 15,
          fontWeight: isBold ? FontWeight.w600 : FontWeight.normal,
          height: 1.5,
        ),
      ),
    );
  }

  Widget _buildPrescriptionCard(Prescription p) {
    if (p.medicineName.trim().isEmpty) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Name (Large, Black)
          Text(
            p.medicineName,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.black,
            ),
          ),
          
          const SizedBox(height: 8),

          // 2. Duration Badge (if exists)
          if (p.durationDays != null && p.durationDays! > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                "Thời gian: ${p.durationDays} ngày",
                style: TextStyle(fontSize: 13, color: Colors.blue.shade800, fontWeight: FontWeight.w600),
              ),
            ),

          const SizedBox(height: 12),
          const Divider(height: 1, color: AppColors.stone200),
          const SizedBox(height: 12),

          // 3. Dosage & Frequency (Simple Text Lines)
          _buildSimpleDetailRow("Liều lượng:", p.dosage),
          const SizedBox(height: 8),
          _buildSimpleDetailRow("Tần suất:", p.frequency),

          // 4. Instructions
          if (p.instructions != null && p.instructions!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.stone50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'HDSD: ${p.instructions}',
                style: const TextStyle(fontSize: 14, color: Colors.black87, fontStyle: FontStyle.italic),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSimpleDetailRow(String label, String? value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 100, 
          child: Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
        ),
        Expanded(
          child: Text(
            value ?? 'N/A', 
            style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w500, fontSize: 14),
          ),
        ),
      ],
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
}
