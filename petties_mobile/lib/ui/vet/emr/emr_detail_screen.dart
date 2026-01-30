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
      backgroundColor: AppColors.stone100,
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
            return Center(child: Text('Lỗi: ${snapshot.error}'));
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
                _buildPetInfoCard(emr),
                const SizedBox(height: 16),
                
                // General Info
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.stone200),
                  ),
                  child: Column(
                    children: [
                      _buildInfoRow('Ngày khám', DateFormat('dd/MM/yyyy HH:mm').format(emr.examinationDate.isUtc ? emr.examinationDate.toLocal() : emr.examinationDate)),
                      _buildInfoRow('Bác sĩ', emr.vetName ?? 'N/A'),
                      _buildInfoRow('Phòng khám', emr.clinicName ?? 'N/A'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // SOAP Content styled like Create Form
                _buildSoapContent(emr),
                
                const SizedBox(height: 16),
                _buildPrescriptions(emr),
                
                const SizedBox(height: 16),
                _buildImages(emr),

                const SizedBox(height: 80), 
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
           // Simplified lock check
           final now = DateTime.now();
           final createdAt = emr.createdAt.isUtc ? emr.createdAt.toLocal() : emr.createdAt;
           final diff = now.difference(createdAt).inHours;
           final isActuallyLocked = diff >= 24;

           if (!isActuallyLocked && !emr.isLocked && emr.vetId == _currentUserId) {
            return Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.primary, AppColors.primary.withOpacity(0.8)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(30),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.4),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(30),
                  onTap: () async {
                     final result = await context.push('/vet/emr/edit/${emr.id}');
                     if (result == true) {
                       setState(() { _loadData(); });
                     }
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(Icons.edit_outlined, color: Colors.white, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Chỉnh sửa',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w900,
                            fontSize: 15,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          }
           return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _buildPetInfoCard(EmrRecord emr) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 70,
                height: 70,
                decoration: BoxDecoration(
                  color: AppColors.stone100,
                  borderRadius: BorderRadius.circular(35),
                  image: _pet?.imageUrl != null
                      ? DecorationImage(
                          image: NetworkImage(_pet!.imageUrl!),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: _pet?.imageUrl == null
                    ? Center(
                        child: Text(
                          emr.petName?[0] ?? 'P',
                          style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: AppColors.stone400),
                        ),
                      )
                    : null,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            emr.petName ?? 'Thú cưng',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: AppColors.stone900,
                            ),
                          ),
                        ),
                        if (emr.bookingCode != null) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.orange.shade50,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.orange.shade200),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.confirmation_number, size: 12, color: Colors.orange.shade700),
                                const SizedBox(width: 4),
                                Text(
                                  emr.bookingCode!,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.orange.shade700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${emr.petSpecies} • ${emr.petBreed}',
                      style: const TextStyle(color: AppColors.stone500, fontSize: 13),
                    ),
                    if (_pet != null)
                      Text(
                        '${_pet!.gender == 'MALE' ? 'Đực' : 'Cái'} • ${_calculateAge(_pet!.dateOfBirth)}',
                        style: const TextStyle(color: AppColors.stone500, fontSize: 13),
                      ),
                    const SizedBox(height: 4),
                    Text(
                      'Chủ: ${emr.ownerName ?? 'N/A'}',
                      style: const TextStyle(color: AppColors.stone400, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (_pet?.allergies != null && _pet!.allergies!.isNotEmpty) ...[
            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, size: 16, color: Colors.amber),
                    SizedBox(width: 4),
                    Text('Dị ứng / Lưu ý:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppColors.stone600)),
                  ],
                ),
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.amber.shade200),
                  ),
                  child: Text(
                    _pet!.allergies!,
                    style: const TextStyle(fontSize: 13, color: AppColors.stone800),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSoapContent(EmrRecord emr) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Chi tiết khám (SOAP)',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.stone900),
          ),
          const SizedBox(height: 20),

          // S
          _buildContextSection('S - Chủ quan (Subjective)', Colors.blue, emr.subjective),
          
          const SizedBox(height: 20),

          // O - Vitals
          Row(
            children: [
              Text('O - Khách quan (Objective)', style: TextStyle(color: Colors.teal, fontWeight: FontWeight.w800, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
               Expanded(child: _buildVitalBox('Cân nặng', '${emr.weightKg ?? "-"} kg')),
               const SizedBox(width: 8),
               Expanded(child: _buildVitalBox('Nhiệt độ', '${emr.temperatureC ?? "-"} °C')),
               const SizedBox(width: 8),
               Expanded(child: _buildVitalBox('Nhịp tim', '${emr.heartRate ?? "-"} bpm')),
            ],
          ),
          const SizedBox(height: 8),
          if (emr.bcs != null)
             Align(
               alignment: Alignment.centerLeft,
               child: Container(
                 padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                 decoration: BoxDecoration(
                   color: AppColors.stone100,
                   borderRadius: BorderRadius.circular(20),
                 ),
                 child: Text('BCS: ${emr.bcs}/9', style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.stone700)),
               ),
             ),
          
          if (emr.objective != null && emr.objective!.isNotEmpty) ...[
             const SizedBox(height: 12),
             Container(
               width: double.infinity,
               padding: const EdgeInsets.all(12),
               decoration: BoxDecoration(
                 color: AppColors.stone50,
                 borderRadius: BorderRadius.circular(12),
                 border: Border.all(color: AppColors.stone200),
               ),
               child: Text(emr.objective!, style: const TextStyle(color: AppColors.stone800)),
             ),
          ],

          const SizedBox(height: 20),

          // A
          _buildContextSection('A - Đánh giá (Assessment)', Colors.purple, emr.assessment),

          const SizedBox(height: 20),

          // P
          _buildContextSection('P - Kế hoạch (Plan)', Colors.orange, emr.plan),

          const SizedBox(height: 20),
          
          if (emr.notes != null && emr.notes!.isNotEmpty)
            _buildContextSection('Ghi chú', Colors.grey, emr.notes),

          if (emr.reExaminationDate != null) ...[
             const SizedBox(height: 20),
             Container(
               padding: const EdgeInsets.all(12),
               decoration: BoxDecoration(
                 color: Colors.blue.shade50,
                 borderRadius: BorderRadius.circular(12),
                 border: Border.all(color: Colors.blue.shade100),
               ),
               child: Row(
                 mainAxisAlignment: MainAxisAlignment.center,
                 children: [
                   const Icon(Icons.calendar_month, color: Colors.blue),
                   const SizedBox(width: 8),
                   Column(
                     crossAxisAlignment: CrossAxisAlignment.start,
                     children: [
                       const Text('Hẹn tái khám', style: TextStyle(fontSize: 12, color: Colors.blue)),
                       Text(
                         DateFormat('dd/MM/yyyy').format(emr.reExaminationDate!),
                         style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue, fontSize: 16),
                       ),
                     ],
                   )
                 ],
               ),
             ),
          ]
        ],
      ),
    );
  }

  Widget _buildContextSection(String title, Color color, String? content) {
    if (content == null || content.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 14)),
        const SizedBox(height: 8),
        Container(
           width: double.infinity,
           padding: const EdgeInsets.all(12),
           decoration: BoxDecoration(
             color: AppColors.stone50,
             borderRadius: BorderRadius.circular(12),
             border: Border.all(color: AppColors.stone200),
           ),
           child: Text(content, style: const TextStyle(color: AppColors.stone800, height: 1.5)),
        ),
      ],
    );
  }

  Widget _buildVitalBox(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.stone50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontSize: 10, color: AppColors.stone500)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.stone800)),
        ],
      ),
    );
  }

  Widget _buildPrescriptions(EmrRecord emr) {
    if (emr.prescriptions.isEmpty) return const SizedBox.shrink();
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Đơn thuốc', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.stone900)),
          const SizedBox(height: 12),
          ...emr.prescriptions.map((p) => Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.stone50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.medicineName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 4),
                Row(
                   children: [
                     if (p.dosage != null) 
                       Container(
                         margin: const EdgeInsets.only(right: 8),
                         padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                         decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(4)),
                         child: Text(p.dosage!, style: const TextStyle(fontSize: 12)),
                       ),
                     Text('${p.frequency} • ${p.durationDays} ngày', style: const TextStyle(fontSize: 13, color: AppColors.stone600)),
                   ],
                ),
                if (p.instructions != null && p.instructions!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text('HDSD: ${p.instructions}', style: const TextStyle(fontStyle: FontStyle.italic, color: AppColors.stone500, fontSize: 12)),
                  ),
              ],
            ),
          )),
        ],
      ),
    );
  }

  Widget _buildImages(EmrRecord emr) {
    if (emr.images.isEmpty) return const SizedBox.shrink();

    return Container(
       padding: const EdgeInsets.all(16),
       decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Hình ảnh lâm sàng', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: AppColors.stone900)),
          const SizedBox(height: 12),
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
              return GestureDetector(
                onTap: () => _showFullScreenImage(context, img),
                child: Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    image: DecorationImage(
                      image: NetworkImage(img.url),
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
              );
            },
          ),
        ],
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


  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.stone500)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.stone900)),
        ],
      ),
    );
  }

  String _calculateAge(DateTime? dob) {
    if (dob == null) return '';
    final now = DateTime.now();
    final years = now.year - dob.year;
    return '$years tuổi';
  }
}
