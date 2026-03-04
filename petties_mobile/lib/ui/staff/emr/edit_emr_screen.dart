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
  bool _isEditingPrescription = false;

  // List of common medicines for autocomplete
  final List<String> _medicineSuggestions = [
    'Amoxicillin',
    'Meloxicam',
    'Prednisone',
    'Simplicef',
    'Clavamox',
    'Metronidazole',
    'Gabapentin',
    'Carprofen',
    'Cephalexin',
    'Furosemide',
    'Doxycycline',
    'Tramadol',
    'Apoquel',
    'Bravecto',
    'NexGard',
    'Revolution Plus',
    'Frontline Gold',
    'Heartgard Plus',
    'Interceptor Plus',
    'Simparica Trio',
    'Cerenia',
    'Denamarin',
    'Vetmedin',
    'Rimadyl',
    'Galliprant',
    'Enrofloxacin',
    'Baytril',
    'Convenia',
    'Cytopoint',
    'ProViable',
    'FortiFlora',
  ];

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

      const List<String> _medicineSuggestions = [
    'Amoxicillin 500mg',
    'Amoxicillin 250mg',
    'Metronidazole 250mg',
    'Doxycycline 100mg',
    'Prednisone 5mg',
    'Cephalexin 500mg',
    'Enrofloxacin 50mg',
  ];

  // Prescription Form State
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

  Future<void> _pickPetImage(Pet pet, ImageSource source) async {
    final picker = ImagePicker();
    final image = await picker.pickImage(
      source: source,
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 85,
    );
    if (image != null) {
      try {
        await _petService.updatePet(
          id: pet.id,
          name: pet.name,
          species: pet.species.value,
          breed: pet.breed,
          dateOfBirth: pet.dateOfBirth,
          weight: pet.weight,
          gender: pet.gender,
          color: pet.color,
          allergies: pet.allergies,
          image: image,
        );
        _loadData(); // Refresh current screen
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Lỗi cập nhật ảnh: $e')),
          );
        }
      }
    }
  }

  void _showPetImagePickerSheet(Pet pet) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.stone300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Ảnh đại diện cho ${pet.name}',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.stone900),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildPickerOption(
                  icon: Icons.camera_alt_rounded,
                  label: 'Chụp ảnh',
                  onTap: () {
                    Navigator.pop(context);
                    _pickPetImage(pet, ImageSource.camera);
                  },
                ),
                _buildPickerOption(
                  icon: Icons.photo_library_rounded,
                  label: 'Thư viện',
                  onTap: () {
                    Navigator.pop(context);
                    _pickPetImage(pet, ImageSource.gallery);
                  },
                ),
              ],
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildPickerOption({required IconData icon, required String label, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.stone100,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.stone200),
            ),
            child: Icon(icon, color: AppColors.primary, size: 28),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.stone700),
          ),
        ],
      ),
    );
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
              Stack(
                children: [
                  Container(
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      color: AppColors.stone100,
                      borderRadius: BorderRadius.circular(35),
                      border: Border.all(color: AppColors.stone200),
                      image: pet.imageUrl != null
                          ? DecorationImage(
                              image: NetworkImage(pet.imageUrl!),
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    child: pet.imageUrl == null
                        ? Center(
                            child: Text(
                              pet.name.isNotEmpty ? pet.name[0].toUpperCase() : 'P',
                              style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: AppColors.stone400),
                            ),
                          )
                        : null,
                  ),
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: GestureDetector(
                      onTap: () => _showPetImagePickerSheet(pet),
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                        child: const Icon(Icons.camera_alt, color: Colors.white, size: 12),
                      ),
                    ),
                  ),
                ],
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
                    Text('${pet.species.displayName} • ${pet.breed}${pet.color != null ? ' • ${pet.color}' : ''}', style: const TextStyle(color: Colors.grey)),
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
            const Text(
              'ĐƠN THUỐC ĐIỀU TRỊ',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w900,
                color: AppColors.stone900,
                letterSpacing: 1,
              ),
            ),
            SizedBox(
              height: 44,
              child: ElevatedButton.icon(
                onPressed: () {
                  _addNewPrescriptionRow();
                  setState(() => _isEditingPrescription = true);
                },
                icon: const Icon(Icons.add_circle_outline, size: 20),
                label: const Text('KÊ ĐƠN', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0.5)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.white,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                ),
              ),
            ),
          ],
        ),
        if (_isEditingPrescription) ...[
          const SizedBox(height: 24),
          _buildPrescriptionEditForm(),
        ],
        const SizedBox(height: 16),
        const Divider(height: 1, color: AppColors.stone100),
        const SizedBox(height: 16),
        _buildPrescriptionSummary(),
      ],
    );
  }

  // Renamed from _buildNeobrutalistButton to reflect the new style
  Widget _buildPremiumConfirmButton({
    required String label,
    required IconData icon,
    required VoidCallback onPressed,
    required Color color,
  }) {
    return SizedBox(
      height: 44,
      child: ElevatedButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 20),
        label: Text(
          label.toUpperCase(),
          style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0.5),
        ),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: AppColors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: const EdgeInsets.symmetric(horizontal: 16),
        ),
      ),
    );
  }

  Widget _buildPrescriptionSummary() {
    if (_prescriptions.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.stone50,
          border: Border.all(color: AppColors.stone200),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: const [
            Icon(Icons.medication_liquid_outlined, size: 40, color: AppColors.stone300),
            SizedBox(height: 12),
            Text(
              'Chưa có đơn thuốc nào được kê.',
              style: TextStyle(
                color: AppColors.stone400,
                fontStyle: FontStyle.italic,
                fontSize: 13,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        ..._prescriptions.map((p) => Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.stone200),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.04),
                blurRadius: 10,
                offset: const Offset(0, 4)
              ),
            ],
          ),
          child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Medicine Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        p.medicineName.toUpperCase(),
                        style: const TextStyle(
                          fontWeight: FontWeight.w900,
                          fontSize: 15,
                          color: AppColors.stone900,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          _buildDetailLabel('${p.dosage ?? "0"} viên/lần'),
                          _buildDetailLabel('${p.frequency} lần/ngày'),
                          _buildDetailLabel('${p.durationDays ?? "0"} ngày', isHighlight: true),
                        ],
                      ),
                    ],
                  ),
                ),
                
                // Instructions box (if any)
                if (p.instructions != null && p.instructions!.isNotEmpty) ...[
                  const VerticalDivider(width: 24, thickness: 1, color: AppColors.stone200),
                  Container(
                    width: 80,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.stone50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.stone200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Hướng dẫn:',
                          style: TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w900,
                            color: AppColors.stone400,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          p.instructions!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.stone600,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
        )).toList(),
      ],
    );
  }

  Widget _buildDetailLabel(String text, {bool isHighlight = false}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 4,
          height: 4,
          decoration: BoxDecoration(
            color: isHighlight ? Colors.orange : AppColors.stone300,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          text.toUpperCase(),
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: isHighlight ? Colors.orange.shade800 : AppColors.stone500,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildPrescriptionEditForm() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.stone200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'DANH SÁCH THUỐC',
                style: TextStyle(fontWeight: FontWeight.w900, color: AppColors.stone500, fontSize: 13),
              ),
              _buildPremiumConfirmButton(
                label: 'Xong',
                icon: Icons.check_circle_outline,
                onPressed: () => setState(() => _isEditingPrescription = false),
                color: AppColors.success,
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(height: 32, color: AppColors.stone100),
          ..._prescriptions.asMap().entries.map((entry) => _buildInlinePrescriptionCard(entry.key)),
          
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _addNewPrescriptionRow(),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('THÊM THUỐC'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.stone700,
                side: BorderSide(color: AppColors.stone300),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          if (_prescriptions.isNotEmpty)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => _showDeleteAllPrescriptionsDialog(),
                child: const Text('XÓA TẤT CẢ', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w900, fontSize: 11)),
              ),
            ),
        ],
      ),
    );

  }

  void _showDeleteAllPrescriptionsDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.transparent,
        contentPadding: EdgeInsets.zero,
        content: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.delete_sweep_outlined, color: Colors.red, size: 32),
              ),
              const SizedBox(height: 20),
              const Text(
                'XÓA TẤT CẢ THUỐC?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                  color: AppColors.stone900,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Hành động này sẽ xóa toàn bộ danh sách thuốc hiện tại. Bạn có chắc chắn muốn thực hiện?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.stone500,
                  fontSize: 14,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Center(
                          child: Text(
                            'HỦY',
                            style: TextStyle(fontWeight: FontWeight.w900, color: AppColors.stone600),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: GestureDetector(
                      onTap: () {
                        setState(() {
                          _prescriptions.clear();
                          _isEditingPrescription = false;
                        });
                        Navigator.pop(context);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: Colors.red,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Center(
                          child: Text(
                            'XÓA HẾT',
                            style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Placeholder for old section if we ever need to refer back, but now removed.

  void _addNewPrescriptionRow() {
    setState(() {
      _prescriptions.add(Prescription(
        medicineName: '',
        frequency: '',
        durationDays: null,
        dosage: null,
        instructions: null,
      ));
    });
  }

  void _updatePrescriptionField(int index, String field, dynamic value) {
    setState(() {
      final p = _prescriptions[index];
      switch (field) {
        case 'medicineName':
          _prescriptions[index] = Prescription(
            medicineName: value as String,
            dosage: p.dosage,
            frequency: p.frequency,
            durationDays: p.durationDays,
            instructions: p.instructions,
          );
          break;
        case 'dosage':
          _prescriptions[index] = Prescription(
            medicineName: p.medicineName,
            dosage: value as String?,
            frequency: p.frequency,
            durationDays: p.durationDays,
            instructions: p.instructions,
          );
          break;
        case 'frequency':
          _prescriptions[index] = Prescription(
            medicineName: p.medicineName,
            dosage: p.dosage,
            frequency: value as String,
            durationDays: p.durationDays,
            instructions: p.instructions,
          );
          break;
        case 'durationDays':
          _prescriptions[index] = Prescription(
            medicineName: p.medicineName,
            dosage: p.dosage,
            frequency: p.frequency,
            durationDays: value as int?,
            instructions: p.instructions,
          );
          break;
        case 'instructions':
          _prescriptions[index] = Prescription(
            medicineName: p.medicineName,
            dosage: p.dosage,
            frequency: p.frequency,
            durationDays: p.durationDays,
            instructions: value as String?,
          );
          break;
      }
    });
  }

  Widget _buildInlinePrescriptionCard(int index) {
    final p = _prescriptions[index];
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row with medicine name and delete button
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.medication_outlined, size: 18, color: AppColors.primary),
              ),
              const SizedBox(width: 8),
              Text('Thuốc ${index + 1}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.stone600)),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 20, color: Colors.red),
                onPressed: () => setState(() => _prescriptions.removeAt(index)),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
          const SizedBox(height: 12),
          
          // Medicine Name (required)
          // Medicine Name (required) with Autocomplete
          LayoutBuilder(
            builder: (context, constraints) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Tên thuốc *',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.stone500),
                  ),
                  const SizedBox(height: 4),
                  Autocomplete<String>(
                    initialValue: TextEditingValue(text: p.medicineName),
                    optionsBuilder: (TextEditingValue textEditingValue) {
                      if (textEditingValue.text == '') {
                        return const Iterable<String>.empty();
                      }
                      return _medicineSuggestions.where((String option) {
                        return option.toLowerCase().contains(textEditingValue.text.toLowerCase());
                      });
                    },
                    onSelected: (String selection) {
                      _updatePrescriptionField(index, 'medicineName', selection);
                    },
                    fieldViewBuilder: (context, textEditingController, focusNode, onFieldSubmitted) {
                       return TextFormField(
                        controller: textEditingController,
                        focusNode: focusNode,
                        style: const TextStyle(fontSize: 14),
                        decoration: InputDecoration(
                          hintText: 'Amoxicillin 500mg',
                          hintStyle: TextStyle(color: AppColors.stone400, fontSize: 13),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          isDense: true,
                          filled: true,
                          fillColor: AppColors.stone50,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: AppColors.stone200),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: AppColors.stone200),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: BorderSide(color: AppColors.primary, width: 1.5),
                          ),
                        ),
                        onChanged: (v) => _updatePrescriptionField(index, 'medicineName', v),
                      );
                    },
                    optionsViewBuilder: (context, onSelected, options) {
                      return Align(
                        alignment: Alignment.topLeft,
                        child: Material(
                          elevation: 4.0,
                          child: SizedBox(
                            width: constraints.maxWidth,
                            child: ListView.builder(
                              padding: EdgeInsets.zero,
                              shrinkWrap: true,
                              itemCount: options.length,
                              itemBuilder: (BuildContext context, int index) {
                                final String option = options.elementAt(index);
                                return InkWell(
                                  onTap: () {
                                    onSelected(option);
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.all(16.0),
                                    child: Text(option),
                                  ),
                                );
                              },
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ],
              );
            }
          ),
          const SizedBox(height: 10),
          
          // Dosage and Frequency row
          Row(
            children: [
              Expanded(
                child: _buildPrescriptionInlineField(
                  label: 'Liều lượng',
                  value: p.dosage ?? '',
                  hint: '1 viên',
                  onChanged: (v) => _updatePrescriptionField(index, 'dosage', v.isEmpty ? null : v),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildPrescriptionInlineField(
                  label: 'Tần suất *',
                  value: p.frequency,
                  hint: '2 lần/ngày',
                  onChanged: (v) => _updatePrescriptionField(index, 'frequency', v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          
          // Duration and Instructions row
          Row(
            children: [
              SizedBox(
                width: 80,
                child: _buildPrescriptionInlineField(
                  label: 'Số ngày',
                  value: p.durationDays?.toString() ?? '',
                  hint: '7',
                  isNumber: true,
                  onChanged: (v) => _updatePrescriptionField(index, 'durationDays', int.tryParse(v)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildPrescriptionInlineField(
                  label: 'Hướng dẫn',
                  value: p.instructions ?? '',
                  hint: 'Uống sau ăn',
                  onChanged: (v) => _updatePrescriptionField(index, 'instructions', v.isEmpty ? null : v),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPrescriptionInlineField({
    required String label,
    required String value,
    required String hint,
    required ValueChanged<String> onChanged,
    bool isNumber = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.stone500),
        ),
        const SizedBox(height: 4),
        TextFormField(
          initialValue: value,
          keyboardType: isNumber ? TextInputType.number : TextInputType.text,
          style: const TextStyle(fontSize: 14),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: AppColors.stone400, fontSize: 13),
            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            isDense: true,
            filled: true,
            fillColor: AppColors.stone50,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: AppColors.stone200),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: AppColors.stone200),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: AppColors.primary, width: 1.5),
            ),
          ),
          onChanged: onChanged,
        ),
      ],
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
              onPressed: _showImageSourceOptions,
              icon: const Icon(Icons.add_a_photo_outlined, size: 18),
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

  Future<void> _pickImage(ImageSource source) async {
    final ImagePicker picker = ImagePicker();
    try {
      final XFile? image = await picker.pickImage(source: source, imageQuality: 70);
      if (image != null) {
        _uploadImage(image);
      }
    } catch (e) {
      debugPrint('Error picking image: $e');
    }
  }

  void _showImageSourceOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 8),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.stone300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Thêm hình ảnh',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone900,
                ),
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.blue100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.camera_alt, color: AppColors.blue600),
                ),
                title: const Text('Chụp ảnh mới', style: TextStyle(fontWeight: FontWeight.w600)),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.camera);
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.teal100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.photo_library, color: AppColors.teal600),
                ),
                title: const Text('Chọn từ thư viện', style: TextStyle(fontWeight: FontWeight.w600)),
                onTap: () {
                  Navigator.pop(context);
                  _pickImage(ImageSource.gallery);
                },
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
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
