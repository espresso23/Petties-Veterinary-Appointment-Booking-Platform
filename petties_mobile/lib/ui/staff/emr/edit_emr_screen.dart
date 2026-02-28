import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/models/emr.dart';
import '../../../data/models/pet.dart';
import '../../../data/services/emr_service.dart';
import '../../../data/services/pet_service.dart';

/// Edit EMR Screen - Allows Staff to edit their own EMR within 24h
class EditEmrScreen extends StatefulWidget {
  final String emrId;

  const EditEmrScreen({
    super.key,
    required this.emrId,
  });

  @override
  State<EditEmrScreen> createState() => _EditEmrScreenState();
}

class _EditEmrScreenState extends State<EditEmrScreen> {
  final _formKey = GlobalKey<FormState>();
  final EmrService _emrService = EmrService();
  final PetService _petService = PetService();

  // Data
  EmrRecord? _originalEmr;
  Pet? _petInfo;
  bool _isLoading = true;
  String? _error;

  // Form fields
  final _subjectiveController = TextEditingController();
  final _assessmentController = TextEditingController();
  final _objectiveController = TextEditingController();
  final _planController = TextEditingController();
  final _temperatureController = TextEditingController();
  final _heartRateController = TextEditingController();
  final _weightController = TextEditingController();
  final _notesController = TextEditingController();
  final _bcsController = TextEditingController();
  final _allergiesController = TextEditingController();
  
  DateTime? _reExaminationDate;
  bool _enableReExam = false;

  // Dynamic Re-exam Input
  final _reExamAmountController = TextEditingController(text: '1');
  String _reExamUnit = 'Tuần'; // Ngày, Tuần, Tháng, Năm
  
  List<Prescription> _prescriptions = [];
  List<EmrImage> _images = [];
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // 1. Fetch EMR
      final emr = await _emrService.getEmrById(widget.emrId);
      
      // 2. Fetch Pet
      final pet = await _petService.getPetById(emr.petId);

      // 3. Pre-fill form
      _subjectiveController.text = emr.subjective ?? '';
      _assessmentController.text = emr.assessment ?? '';
      _planController.text = emr.plan ?? '';
      
      if (emr.temperatureC != null) {
        _temperatureController.text = emr.temperatureC.toString();
      }
      if (emr.weightKg != null) {
        _weightController.text = emr.weightKg.toString();
      }
      if (emr.bcs != null) {
        _bcsController.text = emr.bcs.toString();
      }
      
      _objectiveController.text = emr.objective ?? '';
      _notesController.text = emr.notes ?? '';
      _allergiesController.text = pet.allergies ?? '';

      // Prescriptions
      _prescriptions = List.from(emr.prescriptions);
    
      // Images
      _images = List.from(emr.images);
    
      // Client-side lock check (backup for backend timezone issues)
      final now = DateTime.now();
      final createdAt = emr.createdAt;
      final isActuallyLocked = now.difference(createdAt).inHours >= 24;
      
      debugPrint('🔒 EMR Lock Check:');
      debugPrint('   - createdAt: $createdAt');
      debugPrint('   - now: $now');
      debugPrint('   - hours diff: ${now.difference(createdAt).inHours}');
      debugPrint('   - backend isLocked: ${emr.isLocked}');
      debugPrint('   - calculated isLocked: $isActuallyLocked');

      if (isActuallyLocked) {
        debugPrint('🔒 EMR is LOCKED (over 24h). Redirecting back...');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Bệnh án đã khóa (quá 24h). Không thể chỉnh sửa.'),
              backgroundColor: Colors.red,
              duration: Duration(seconds: 3),
            ),
          );
          Navigator.of(context).pop();
        }
        return;
      }

      setState(() {
        _originalEmr = emr;
        _reExaminationDate = emr.reExaminationDate;
        _enableReExam = emr.reExaminationDate != null;
        _petInfo = pet;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final request = CreateEmrRequest(
        petId: _originalEmr!.petId,
        subjective: _subjectiveController.text.isEmpty ? null : _subjectiveController.text,
        objective: _objectiveController.text.isEmpty ? null : _objectiveController.text,
        assessment: _assessmentController.text,
        bcs: int.tryParse(_bcsController.text),
        plan: _planController.text,
        weightKg: double.tryParse(_weightController.text),
        temperatureC: double.tryParse(_temperatureController.text),
        heartRate: int.tryParse(_heartRateController.text), 
        prescriptions: _prescriptions.isEmpty ? null : _prescriptions,
        images: _images.isEmpty ? null : _images,
        reExaminationDate: _enableReExam ? _reExaminationDate : null,
        notes: _notesController.text.isEmpty ? null : _notesController.text,
      );

      await _emrService.updateEmr(widget.emrId, request);
      
      // Update allergies if changed
      if (_petInfo != null && _allergiesController.text != (_petInfo!.allergies ?? '')) {
         try {
           await _petService.updateAllergies(_originalEmr!.petId, _allergiesController.text);
         } catch (e) {
            debugPrint('Error updating allergies: $e');
         }
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Cập nhật Bệnh án thành công!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true); // Return true to indicate refresh needed
      }
    } catch (e) {
      debugPrint('Error updating EMR: $e');
      if (mounted) {
        final message = e.toString().replaceFirst('Exception: ', '');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: Colors.red,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  void dispose() {
    _subjectiveController.dispose();
    _assessmentController.dispose();
    _objectiveController.dispose();
    _planController.dispose();
    _temperatureController.dispose();
    _heartRateController.dispose();
    _weightController.dispose();
    _bcsController.dispose();
    _notesController.dispose();
    _reExamAmountController.dispose();
    _allergiesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone100,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.stone900,
        elevation: 1,
        title: const Text(
          'Chỉnh sửa Bệnh án',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          TextButton(
            onPressed: (_isLoading || _isSubmitting) ? null : _handleSubmit,
            child: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text(
                    'LƯU',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (_error != null) {
       return Center(
         child: Column(
           mainAxisAlignment: MainAxisAlignment.center,
           children: [
             const Icon(Icons.error_outline, color: Colors.red, size: 48),
             const SizedBox(height: 16),
             Text('Lỗi: $_error', textAlign: TextAlign.center),
             TextButton(onPressed: _loadData, child: const Text('Thử lại')),
           ],
         ),
       );
    }

    if (_originalEmr?.isLocked == true) {
       return const Center(
         child: Text('Bệnh án này đã bị khóa (quá 24h), không thể chỉnh sửa.'),
       );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Warning Banner
            Container(
              margin: const EdgeInsets.only(bottom: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                border: Border.all(color: Colors.amber.shade200),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'Bạn chỉ có thể chỉnh sửa bệnh án này trong vòng 24h kể từ khi tạo.',
                style: TextStyle(fontSize: 13, color: Color(0xFF92400E)),
              ),
            ),

            if (_petInfo != null) ...[
               _buildPetInfoCard(),
               const SizedBox(height: 16),
            ],

            _buildSoapForm(),
            const SizedBox(height: 20),
            _buildImagesSection(),
            const SizedBox(height: 100),
          ],
        ),
      ),
    );
  }
  
  Widget _buildPetInfoCard() {
    final pet = _petInfo!;
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
              CircleAvatar(
                backgroundImage: pet.imageUrl != null ? NetworkImage(pet.imageUrl!) : null,
                child: pet.imageUrl == null ? const Icon(Icons.pets) : null,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(pet.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        ),
                        if (_originalEmr?.bookingCode != null) ...[
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
                                Icon(Icons.confirmation_number, size: 10, color: Colors.orange.shade700),
                                const SizedBox(width: 4),
                                Text(
                                  _originalEmr!.bookingCode!,
                                  style: TextStyle(
                                    fontSize: 9,
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
                    Text('${pet.species} • ${pet.breed}${pet.color != null ? ' • ${pet.color}' : ''}', style: const TextStyle(color: Colors.grey)),
                    Text(
                      '${_calculateAge(pet.dateOfBirth)} • ${_getGenderVietnamese(pet.gender)}',
                      style: const TextStyle(color: AppColors.stone800, fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
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
              TextFormField(
                controller: _allergiesController,
                maxLines: 2,
                style: const TextStyle(fontSize: 13),
                decoration: InputDecoration(
                  hintText: 'Không có ghi nhận dị ứng.',
                  hintStyle: TextStyle(color: AppColors.stone400),
                  filled: true,
                  fillColor: Colors.amber.shade50,
                  contentPadding: const EdgeInsets.all(12),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.amber.shade200),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.amber.shade200),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Colors.amber),
                  ),
                ),
              ),
            ],
          ),
        ],
      )
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
  
  Widget _buildSoapForm() {
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
          const Text('Biểu mẫu SOAP (Chỉnh sửa)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 20),
          
          _buildSectionHeader('S - Chủ quan', Colors.blue),
          TextFormField(
            controller: _subjectiveController,
            maxLines: 3,
            decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Triệu chứng...'),
          ),
          const SizedBox(height: 16),

          _buildSectionHeader('O - Khách quan', Colors.teal),
          const SizedBox(height: 8),
          Row(
            children: [
               Expanded(child: _buildVitalField('Cân nặng (kg)', _weightController)),
               const SizedBox(width: 12),
               Expanded(child: _buildVitalField('Nhiệt độ (°C)', _temperatureController)),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
               Expanded(child: _buildVitalField('Nhịp tim (bpm)', _heartRateController)),
            ],
          ),
          const SizedBox(height: 12),
          _buildVitalField('Điểm thể trạng (BCS 1-9)', _bcsController),
          const SizedBox(height: 12),
          TextFormField(
            controller: _objectiveController,
            maxLines: 3,
            decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Khám lâm sàng chi tiết...'),
          ),
          const SizedBox(height: 16),

          _buildSectionHeader('A - Đánh giá *', Colors.purple),
          TextFormField(
            controller: _assessmentController,
            maxLines: 3,
            validator: (v) => v!.isEmpty ? 'Không được bỏ trống' : null,
            decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Chẩn đoán...'),
          ),
          const SizedBox(height: 16),

          _buildSectionHeader('P - Kế hoạch *', Colors.orange),
          TextFormField(
            controller: _planController,
            maxLines: 3,
            validator: (v) => v!.isEmpty ? 'Không được bỏ trống' : null,
            decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Điều trị...'),
          ),
          const SizedBox(height: 16),
          _buildSectionHeader('Ghi chú', Colors.grey),
          TextFormField(
            controller: _notesController,
            maxLines: 2,
            decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Ghi chú thêm...'),
          ),
          const SizedBox(height: 16),

          const SizedBox(height: 16),
          
          // Re-examination Date
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(child: _buildSectionHeader('Hẹn tái khám (Tuỳ chọn)', Colors.blue)),
              Switch(
                value: _enableReExam,
                onChanged: (val) {
                  setState(() {
                    _enableReExam = val;
                    if (val && _reExaminationDate == null) {
                       _reExaminationDate = DateTime.now().add(const Duration(days: 7));
                    }
                  });
                },
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Dynamic Date Input
          if (_enableReExam)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: AppColors.stone300),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      const Text('Tái khám sau: ', style: TextStyle(fontWeight: FontWeight.w500)),
                      const SizedBox(width: 8),
                      // Amount Input
                      SizedBox(
                        width: 60,
                        child: TextField(
                          controller: _reExamAmountController,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                           decoration: const InputDecoration(
                            isDense: true,
                            contentPadding: EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                            border: OutlineInputBorder(),
                          ),
                          onChanged: (v) => _updateReExamDate(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Unit Dropdown
                      Expanded(
                        child: PopupMenuButton<String>(
                          initialValue: _reExamUnit,
                          offset: const Offset(0, 40),
                          onSelected: (newValue) {
                             setState(() {
                               _reExamUnit = newValue;
                               _updateReExamDate();
                             });
                          },
                          itemBuilder: (context) => ['Ngày', 'Tuần', 'Tháng', 'Năm'].map((String value) {
                            return PopupMenuItem<String>(
                              value: value,
                              child: Text(value),
                            );
                          }).toList(),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            decoration: BoxDecoration(
                              border: Border.all(color: Colors.grey.shade400),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(_reExamUnit),
                                const Icon(Icons.arrow_drop_down),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Divider(height: 1),
                  const SizedBox(height: 8),
                  // Calculated Date Display
                  InkWell(
                     onTap: () async {
                        final date = await showDatePicker(
                          context: context,
                          initialDate: _reExaminationDate ?? DateTime.now().add(const Duration(days: 7)),
                          firstDate: DateTime.now(),
                          lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
                        );
                        if (date != null) {
                          setState(() {
                             _reExaminationDate = date;
                             _reExamAmountController.text = ''; // Clear auto fields
                          });
                        }
                      },
                    child: Row(
                      children: [
                         const Icon(Icons.calendar_today, size: 20, color: Colors.blue),
                         const SizedBox(width: 8),
                         Text(
                           _reExaminationDate != null
                               ? 'Ngày: ${DateFormat('dd/MM/yyyy').format(_reExaminationDate!)}'
                               : 'Chọn ngày thủ công',
                           style: TextStyle(
                             color: _reExaminationDate != null ? Colors.blue : Colors.grey,
                             fontWeight: FontWeight.bold,
                           ),
                         ),
                         const Spacer(),
                         if (_reExaminationDate != null)
                            const Icon(Icons.edit, size: 16, color: Colors.grey),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 8),

          _buildPrescriptionSection(),
        ],
      ),
    );
  }

  void _updateReExamDate() {
    int amount = int.tryParse(_reExamAmountController.text) ?? 0;
    if (amount <= 0) return;
    
    DateTime now = DateTime.now();
    DateTime newDate = now;

    switch (_reExamUnit) {
      case 'Ngày':
        newDate = now.add(Duration(days: amount));
        break;
      case 'Tuần':
        newDate = now.add(Duration(days: amount * 7));
        break;
      case 'Tháng':
        int newMonth = now.month + amount;
        int yearsToAdd = (newMonth - 1) ~/ 12;
        int monthInYear = (newMonth - 1) % 12 + 1;
        int day = now.day;
        int daysInNewMonth = DateTime(now.year + yearsToAdd, monthInYear + 1, 0).day;
        if (day > daysInNewMonth) day = daysInNewMonth;
        newDate = DateTime(now.year + yearsToAdd, monthInYear, day);
        break;
      case 'Năm':
        newDate = DateTime(now.year + amount, now.month, now.day);
        break;
    }
    
    setState(() {
      _reExaminationDate = newDate;
    });
  }

  Widget _buildSectionHeader(String title, Color color) {
    return Text(title, style: TextStyle(color: color, fontWeight: FontWeight.bold));
  }
  
  Widget _buildVitalField(String label, TextEditingController controller, [String? hint]) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppColors.stone500),
        ),
        const SizedBox(height: 4),
        TextFormField(
          controller: controller,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: AppColors.stone400, fontSize: 14),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColors.stone300),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPrescriptionSection() {
     return Column(
       crossAxisAlignment: CrossAxisAlignment.start,
       children: [
         Row(
           mainAxisAlignment: MainAxisAlignment.spaceBetween,
           children: [
             const Text('Đơn thuốc', style: TextStyle(fontWeight: FontWeight.bold)),
              TextButton.icon(
                onPressed: () => _showPrescriptionDialog(),
                icon: const Icon(Icons.add),
                label: const Text('Thêm'),
              )
           ],
         ),
         if (_prescriptions.isEmpty)
           const Text('Chưa có thuốc', style: TextStyle(fontStyle: FontStyle.italic, color: Colors.grey))
         else
           ..._prescriptions.asMap().entries.map((e) => ListTile(
             title: Text(e.value.medicineName, style: const TextStyle(fontWeight: FontWeight.w600)),
             subtitle: Column(
               crossAxisAlignment: CrossAxisAlignment.start,
               children: [
                 if (e.value.dosage != null && e.value.dosage!.isNotEmpty)
                   Text('Hàm lượng: ${e.value.dosage}', style: const TextStyle(color: AppColors.stone500, fontSize: 13)),
                 Text('${e.value.frequency} - ${e.value.durationDays} ngày'),
                 if (e.value.instructions != null && e.value.instructions!.isNotEmpty)
                   Text(
                     'HDSD: ${e.value.instructions}',
                     style: const TextStyle(color: AppColors.stone500, fontStyle: FontStyle.italic, fontSize: 13),
                   ),
               ],
             ),
             trailing: IconButton(
               icon: const Icon(Icons.delete, color: Colors.red),
               onPressed: () => setState(() => _prescriptions.removeAt(e.key)),
             ),
             contentPadding: EdgeInsets.zero,
             dense: true,
             onTap: () => _showPrescriptionDialog(prescription: e.value, index: e.key),
           )),
       ],
     );
  }

  void _showPrescriptionDialog({Prescription? prescription, int? index}) {
    final nameInfo = TextEditingController(text: prescription?.medicineName ?? '');
    final dosageInfo = TextEditingController(text: prescription?.dosage ?? '');
    final freqInfo = TextEditingController(text: prescription?.frequency ?? '');
    final daysInfo = TextEditingController(text: prescription?.durationDays?.toString() ?? '');
    final noteInfo = TextEditingController(text: prescription?.instructions ?? '');
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(prescription == null ? 'Thêm thuốc' : 'Chi tiết thuốc'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: nameInfo, decoration: const InputDecoration(labelText: 'Tên thuốc')),
              TextField(controller: dosageInfo, decoration: const InputDecoration(labelText: 'Hàm lượng (VD: 500mg)')),
              TextField(controller: freqInfo, decoration: const InputDecoration(labelText: 'Liều dùng (VD: Sáng 1 - Chiều 1)')),
              TextField(controller: daysInfo, decoration: const InputDecoration(labelText: 'Số ngày'), keyboardType: TextInputType.number),
              TextField(controller: noteInfo, decoration: const InputDecoration(labelText: 'HDSD / Ghi chú (nếu có)')),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Hủy')),
          ElevatedButton(
            onPressed: () {
               if (nameInfo.text.isNotEmpty) {
                 setState(() {
                   final newItem = Prescription(
                     medicineName: nameInfo.text,
                     dosage: dosageInfo.text.isEmpty ? null : dosageInfo.text,
                     frequency: freqInfo.text,
                     durationDays: int.tryParse(daysInfo.text),
                     instructions: noteInfo.text.isEmpty ? null : noteInfo.text,
                   );
                   
                   if (index != null) {
                     _prescriptions[index] = newItem;
                   } else {
                     _prescriptions.add(newItem);
                   }
                 });
                 Navigator.pop(ctx);
               }
            },
            child: Text(prescription == null ? 'Thêm' : 'Lưu'),
          )
        ],
      ),
    );
  }

  Widget _buildImagesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Hình ảnh & Tài liệu',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
              ),
            ),
            TextButton.icon(
              onPressed: _pickImage,
              icon: const Icon(Icons.add_photo_alternate_outlined, size: 18),
              label: const Text('Thêm ảnh'),
              style: TextButton.styleFrom(foregroundColor: AppColors.primary),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_images.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.stone50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone200, style: BorderStyle.solid),
            ),
            child: Center(
              child: Column(
                children: [
                  Icon(Icons.photo_library_outlined, size: 40, color: AppColors.stone400),
                  const SizedBox(height: 8),
                  Text(
                    'Chưa có hình ảnh nào',
                    style: TextStyle(color: AppColors.stone400, fontSize: 13),
                  ),
                ],
              ),
            ),
          )
        else
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
            ),
            itemCount: _images.length,
            itemBuilder: (context, index) {
              final img = _images[index];
              return Column(
                children: [
                  Stack(
                    children: [
                      GestureDetector(
                        onTap: () => _showFullScreenImage(img),
                        child: Container(
                          height: 80,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            image: DecorationImage(
                              image: NetworkImage(img.url),
                              fit: BoxFit.contain,
                            ),
                            color: AppColors.stone200,
                            border: Border.all(color: AppColors.stone300),
                          ),
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: GestureDetector(
                          onTap: () {
                            setState(() => _images.removeAt(index));
                          },
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close, size: 14, color: Colors.red),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  TextField(
                    controller: TextEditingController(text: img.description),
                    decoration: const InputDecoration(
                      hintText: 'Mô tả hình ảnh...',
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      border: OutlineInputBorder(),
                    ),
                    style: const TextStyle(fontSize: 11),
                    onChanged: (value) {
                      // Directly update the object in the list
                      _images[index] = EmrImage(url: img.url, description: value);
                    },
                  ),
                ],
              );
            },
          ),
      ],
    );
  }

  Future<void> _pickImage() async {
    final ImagePicker picker = ImagePicker();
    try {
      final XFile? image = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
      if (image != null) {
        _uploadImage(image);
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
  }

  Future<void> _uploadImage(XFile file) async {
    setState(() => _isSubmitting = true);
    try {
      final url = await _emrService.uploadImage(file.path);
      setState(() {
        _images.add(EmrImage(url: url));
        _isSubmitting = false;
      });
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi upload ảnh: $e')),
        );
      }
    }
  }

  void _showFullScreenImage(EmrImage img) {
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
          ],
        ),
      ),
    );
  }
}
