import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/models/emr.dart';
import '../../../data/models/pet.dart';
import '../../../data/services/emr_service.dart';
import '../../../data/services/pet_service.dart';

/// Create EMR Screen - Mobile version of web CreateEmrPage
class CreateEmrScreen extends StatefulWidget {
  final String petId;
  final String? petName;
  final String? petSpecies;
  final String? bookingId;
  final String? bookingCode;

  const CreateEmrScreen({
    super.key,
    required this.petId,
    this.petName,
    this.petSpecies,
    this.bookingId,
    this.bookingCode,
  });

  @override
  State<CreateEmrScreen> createState() => _CreateEmrScreenState();
}

class _CreateEmrScreenState extends State<CreateEmrScreen> {
  final _formKey = GlobalKey<FormState>();
  final EmrService _emrService = EmrService();
  final PetService _petService = PetService();

  // Pet info
  Pet? _petInfo;
  bool _isLoadingPet = true;
  List<EmrRecord> _medicalHistory = [];

  // Form fields
  final _subjectiveController = TextEditingController();
  final _assessmentController = TextEditingController();
  final _objectiveController = TextEditingController();
  final _planController = TextEditingController();
  final _weightController = TextEditingController();
  final _temperatureController = TextEditingController();
  final _heartRateController = TextEditingController();
  final _notesController = TextEditingController();
  final _allergiesController = TextEditingController();
  
  int? _bcs; // Body Condition Score 1-9
  DateTime? _reExaminationDate;

  // Re-examination Date
  bool _enableReExam = false;
  
  // Dynamic Re-exam Input
  final _reExamAmountController = TextEditingController(text: '1');
  String _reExamUnit = 'Tuần'; // Ngày, Tuần, Tháng, Năm
  List<Prescription> _prescriptions = [];
  List<EmrImage> _images = [];
  bool _isSubmitting = false;
  bool _isEditingPrescription = false;

  static const List<String> _medicineSuggestions = [
    'Amoxicillin 500mg',
    'Amoxicillin 250mg',
    'Metronidazole 250mg',
    'Doxycycline 100mg',
    'Prednisone 5mg',
    'Cephalexin 500mg',
    'Enrofloxacin 50mg',
  ];

  @override
  void initState() {
    super.initState();
    _loadPetInfo();
  }

  Future<void> _loadPetInfo() async {
    setState(() => _isLoadingPet = true);
    try {
      final pet = await _petService.getPetById(widget.petId);
      final emrs = await _emrService.getEmrsByPetId(widget.petId).catchError((_) => <EmrRecord>[]);
      setState(() {
        _petInfo = pet;
        _weightController.text = pet.weight.toString();
        _allergiesController.text = pet.allergies ?? '';
        _medicalHistory = emrs;
        _isLoadingPet = false;
      });
    } catch (e) {
      debugPrint('Error loading pet: $e');
      setState(() => _isLoadingPet = false);
    }
  }

  String _calculateAge(DateTime dateOfBirth) {
    final now = DateTime.now();
    final years = now.year - dateOfBirth.year;
    if (years < 1) {
      final months = (now.year - dateOfBirth.year) * 12 + now.month - dateOfBirth.month;
      return '$months tháng';
    }
    return '$years tuổi';
  }

  String _translateGender(String gender) {
    switch (gender.toUpperCase()) {
      case 'MALE':
        return 'Đực';
      case 'FEMALE':
        return 'Cái';
      default:
        return gender;
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final objectiveParts = <String>[];
      if (_objectiveController.text.isNotEmpty) {
        objectiveParts.add(_objectiveController.text);
      }

      final request = CreateEmrRequest(
        petId: widget.petId,
        bookingId: widget.bookingId,
        subjective: _subjectiveController.text.isEmpty ? null : _subjectiveController.text,
        objective: objectiveParts.isEmpty ? null : objectiveParts.join('. '),
        assessment: _assessmentController.text,
        plan: _planController.text,
        notes: _notesController.text.isEmpty ? null : _notesController.text,
        weightKg: double.tryParse(_weightController.text) ?? _petInfo?.weight,
        temperatureC: double.tryParse(_temperatureController.text),
        heartRate: int.tryParse(_heartRateController.text),
        bcs: _bcs,
        prescriptions: _prescriptions.isEmpty ? null : _prescriptions,
        images: _images.isEmpty ? null : _images,
        reExaminationDate: _enableReExam ? _reExaminationDate : null,
      );

      await _emrService.createEmr(request);

      // Update allergies if changed
      if (_petInfo != null && _allergiesController.text != (_petInfo!.allergies ?? '')) {
         try {
           await _petService.updateAllergies(widget.petId, _allergiesController.text);
         } catch (e) {
            debugPrint('Error updating allergies: $e');
         }
      }
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Lưu Bệnh án thành công!'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      debugPrint('Error creating EMR: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi: $e'),
            backgroundColor: Colors.red,
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
          species: pet.species,
          breed: pet.breed,
          dateOfBirth: pet.dateOfBirth,
          weight: pet.weight,
          gender: pet.gender,
          color: pet.color,
          allergies: pet.allergies,
          image: image,
        );
        // Refresh local state by fetching booking again (which contains the pet)
        _loadPetInfo();
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
    _notesController.dispose();
    _temperatureController.dispose();
    _heartRateController.dispose();
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
        title: Text(
          'Tạo Bệnh án - ${widget.petName ?? 'Pet'}',
          style: const TextStyle(fontWeight: FontWeight.w800),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          TextButton(
            onPressed: _isSubmitting ? null : _handleSubmit,
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
      body: _isLoadingPet
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildPetInfoCard(),
                    const SizedBox(height: 16),

                    if (_medicalHistory.isNotEmpty) ...[
                      _buildMedicalHistorySummary(),
                      const SizedBox(height: 16),
                    ],

                    _buildSoapForm(),
                    
                    const SizedBox(height: 100),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildPetInfoCard() {
    final pet = _petInfo;
    if (pet == null) return const SizedBox();

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
                    Text(
                      pet.name,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: AppColors.stone900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${pet.species} ${pet.breed}${pet.color != null ? ' • ${pet.color}' : ''} • ${_translateGender(pet.gender)} • ${_calculateAge(pet.dateOfBirth)}',
                      style: const TextStyle(color: AppColors.stone500, fontSize: 13),
                    ),
                    Text(
                      'Cân nặng: ${pet.weight} kg',
                      style: const TextStyle(color: AppColors.stone500, fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Chủ: ${pet.ownerName ?? 'N/A'} • ${pet.ownerPhone ?? ''}',
                      style: const TextStyle(color: AppColors.stone400, fontSize: 12),
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
      ),
    );
  }

  Widget _buildMedicalHistorySummary() {
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
            'Tóm tắt Bệnh sử',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: AppColors.stone900,
            ),
          ),
          const SizedBox(height: 12),
          ...(_medicalHistory.take(3).map((emr) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '${DateFormat('dd/MM/yyyy').format(emr.examinationDate)}: ${emr.assessment ?? 'N/A'}',
                  style: const TextStyle(color: AppColors.stone600, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ))),
        ],
      ),
    );
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Biểu mẫu SOAP',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: AppColors.stone900,
                ),
              ),
              if (widget.bookingCode != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.blue.shade100),
                  ),
                  child: Text(
                    'Booking #${widget.bookingCode}',
                    style: TextStyle(
                      color: Colors.blue.shade700,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 20),

          // S - Subjective
          _buildSectionHeader('S - Chủ quan (Subjective)', Colors.blue, false),
          TextFormField(
            controller: _subjectiveController,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'VD: Chó bỏ ăn 2 ngày, nôn 3 lần, đi tiểu lỏng...',
              hintStyle: TextStyle(color: AppColors.stone400),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.stone300),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.stone300),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // O - Objective (Vital signs)
          _buildSectionHeader('O - Khách quan (Objective)', Colors.teal, false),
          const SizedBox(height: 12),
          
          Row(
            children: [
              Expanded(
                child: _buildVitalField('Cân nặng (kg)', _weightController, '0.0'),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildVitalField('Nhiệt độ (°C)', _temperatureController, '38.5'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildVitalField('Nhịp tim', _heartRateController, '120'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          
          const Text(
            'BCS (Điểm thể trạng 1-9):',
            style: TextStyle(fontSize: 13, color: AppColors.stone600),
          ),
          const SizedBox(height: 8),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: List.generate(9, (i) {
                final score = i + 1;
                final isSelected = _bcs == score;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: GestureDetector(
                    onTap: () => setState(() => _bcs = score),
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: isSelected ? AppColors.primary : AppColors.stone100,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected ? AppColors.primary : AppColors.stone300,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          '$score',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: isSelected ? AppColors.white : AppColors.stone600,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
          const SizedBox(height: 12),
          
          TextFormField(
            controller: _objectiveController,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: 'Kết quả khám lâm sàng...',
              hintStyle: TextStyle(color: AppColors.stone400),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.stone300),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // A - Assessment
          _buildSectionHeader('A - Đánh giá (Assessment)', Colors.purple, true),
          TextFormField(
            controller: _assessmentController,
            maxLines: 3,
            validator: (v) => v == null || v.isEmpty ? 'Không được bỏ trống' : null,
            decoration: InputDecoration(
              hintText: 'Chẩn đoán sơ bộ và đánh giá tình trạng bệnh...',
              hintStyle: TextStyle(color: AppColors.stone400),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.stone300),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // P - Plan
          _buildSectionHeader('P - Kế hoạch (Plan)', Colors.orange, true),
          TextFormField(
            controller: _planController,
            maxLines: 3,
            validator: (v) => v == null || v.isEmpty ? 'Không được bỏ trống' : null,
            decoration: InputDecoration(
              hintText: 'Kế hoạch điều trị, xét nghiệm đề xuất, hướng dẫn chăm sóc...',
              hintStyle: TextStyle(color: AppColors.stone400),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.stone300),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Notes / Ghi chú
          _buildSectionHeader('Ghi chú (Tuỳ chọn)', Colors.grey, false),
          TextFormField(
            controller: _notesController,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: 'Ghi chú thêm cho bác sĩ hoặc chủ nuôi...',
              hintStyle: TextStyle(color: AppColors.stone400),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: AppColors.stone300),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Re-examination Date
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Flexible(child: _buildSectionHeader('Hẹn tái khám (Tuỳ chọn)', Colors.blue, false)),
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
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.timer_outlined, color: Colors.blue, size: 20),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'Tái khám sau:',
                      style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                Row(
                  children: [
                    // Amount Input
                    Expanded(
                      flex: 2,
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.stone100,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: TextField(
                          controller: _reExamAmountController,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                           decoration: const InputDecoration(
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.symmetric(vertical: 12),
                            hintText: '0',
                          ),
                          onChanged: (v) => _updateReExamDate(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    
                    // Unit Dropdown
                    Expanded(
                      flex: 3,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: AppColors.stone100,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _reExamUnit,
                            isExpanded: true,
                            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.grey),
                            items: ['Ngày', 'Tuần', 'Tháng', 'Năm'].map((String value) {
                              return DropdownMenuItem<String>(
                                value: value,
                                child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
                              );
                            }).toList(),
                            onChanged: (newValue) {
                              setState(() {
                                _reExamUnit = newValue!;
                                _updateReExamDate();
                              });
                            },
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Divider(height: 1),
                ),
                
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
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                    decoration: BoxDecoration(
                      color: _reExaminationDate != null ? Colors.blue.shade50 : Colors.transparent,
                      border: Border.all(
                        color: _reExaminationDate != null ? Colors.blue.shade200 : Colors.grey.shade300
                      ),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                         Icon(
                           Icons.calendar_month_rounded, 
                           size: 20, 
                           color: _reExaminationDate != null ? Colors.blue : Colors.grey
                         ),
                         const SizedBox(width: 12),
                         Text(
                           _reExaminationDate != null
                               ? 'Ngày: ${DateFormat('dd/MM/yyyy').format(_reExaminationDate!)}'
                               : 'Chọn ngày thủ công...',
                           style: TextStyle(
                             color: _reExaminationDate != null ? Colors.blue.shade700 : Colors.grey,
                             fontWeight: FontWeight.bold,
                             fontSize: 15,
                           ),
                         ),
                         const Spacer(),
                         Icon(Icons.edit_outlined, size: 18, color: Colors.grey.shade400),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Prescriptions
          _buildPrescriptionSection(),
          const SizedBox(height: 20),

          // Images section placeholder
          _buildImagesSection(),
        ],
      ),
    );
  }


  Widget _buildSectionHeader(String title, Color color, bool required) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          if (required)
            Text(
              ' *',
              style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
            ),
        ],
      ),
    );
  }

  Widget _buildVitalField(String label, TextEditingController controller, String hint) {
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
            hintStyle: TextStyle(color: AppColors.stone400, fontSize: 14),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: AppColors.stone300),
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
                      // Sync controller with state if needed, though initialValue handles start
                      // We need to ensure onChanged updates state
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
                child: _buildInlineField(
                  label: 'Liều lượng',
                  value: p.dosage ?? '',
                  hint: '1 viên',
                  onChanged: (v) => _updatePrescriptionField(index, 'dosage', v.isEmpty ? null : v),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildInlineField(
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
                child: _buildInlineField(
                  label: 'Số ngày',
                  value: p.durationDays?.toString() ?? '',
                  hint: '7',
                  isNumber: true,
                  onChanged: (v) => _updatePrescriptionField(index, 'durationDays', int.tryParse(v)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildInlineField(
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

  Widget _buildInlineField({
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

  void _updateReExamDate() {
    int amount = int.tryParse(_reExamAmountController.text) ?? 0;
    if (amount <= 0) {
      // Don't clear date, just don't update if invalid
      return;
    }
    
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
        // Simple month addition (approx 30 days or calendar month)
        // DateTime in Dart doesn't have addMonths easily without package, but we can do rough.
        // Or better:
        int newMonth = now.month + amount;
        int yearsToAdd = (newMonth - 1) ~/ 12;
        int monthInYear = (newMonth - 1) % 12 + 1;
        // Fix day overflow (e.g. 31 Jan + 1 month -> 28 Feb)
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
              childAspectRatio: 0.75,
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
                    decoration: const InputDecoration(
                      hintText: 'Mô tả hình ảnh...',
                      isDense: true,
                      contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      border: OutlineInputBorder(),
                    ),
                    style: const TextStyle(fontSize: 11),
                    onChanged: (value) {
                      setState(() {
                        _images[index] = EmrImage(url: img.url, description: value);
                      });
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
          SnackBar(content: Text('Lỗi upload ảnh: $e'), backgroundColor: Colors.red),
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
