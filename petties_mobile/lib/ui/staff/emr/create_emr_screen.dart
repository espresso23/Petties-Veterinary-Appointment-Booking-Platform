import 'package:flutter/material.dart';
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

  const CreateEmrScreen({
    super.key,
    required this.petId,
    this.petName,
    this.petSpecies,
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
      child: Row(
        children: [
          Container(
            width: 70,
            height: 70,
            decoration: BoxDecoration(
              color: AppColors.stone100,
              borderRadius: BorderRadius.circular(35),
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
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                    ),
                  )
                : null,
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
          const Text(
            'Biểu mẫu SOAP',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: AppColors.stone900,
            ),
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
              'Kê đơn Thuốc',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
              ),
            ),
            TextButton.icon(
              onPressed: () => _showAddPrescriptionDialog(),
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Thêm thuốc'),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primary,
              ),
            ),
          ],
        ),
        if (_prescriptions.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.stone50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Center(
              child: Text(
                'Chưa có thuốc nào',
                style: TextStyle(color: AppColors.stone400),
              ),
            ),
          )
        else
          ...(_prescriptions.asMap().entries.map((entry) {
            final idx = entry.key;
            final p = entry.value;
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: AppColors.stone50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: ListTile(
                title: Text(p.medicineName, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (p.dosage != null && p.dosage!.isNotEmpty)
                      Text('Hàm lượng: ${p.dosage}', style: const TextStyle(color: AppColors.stone500, fontSize: 13)),
                    Text('${p.frequency} - ${p.durationDays ?? 0} ngày', style: const TextStyle(color: AppColors.stone600, fontSize: 13)),
                    if (p.instructions != null && p.instructions!.isNotEmpty)
                      Text(
                        'HDSD: ${p.instructions}',
                        style: const TextStyle(color: AppColors.stone500, fontStyle: FontStyle.italic, fontSize: 13),
                      ),
                  ],
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.close, color: Colors.red),
                  onPressed: () => setState(() => _prescriptions.removeAt(idx)),
                ),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                onTap: () => _showAddPrescriptionDialog(item: p, index: idx),
              ),
            );
          })),
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

  void _showAddPrescriptionDialog({Prescription? item, int? index}) {
    final nameController = TextEditingController(text: item?.medicineName ?? '');
    final contentController = TextEditingController(text: item?.dosage ?? ''); // Dosage (Hàm lượng)
    final usageController = TextEditingController(text: item?.frequency ?? ''); // Frequency (Liều dùng)
    final daysController = TextEditingController(text: item?.durationDays?.toString() ?? '');
    final instructionsController = TextEditingController(text: item?.instructions ?? '');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(item == null ? 'THÊM ĐƠN THUỐC' : 'CẬP NHẬT THUỐC', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Row 1: Name and Content
              _buildDialogField('Tên thuốc *', nameController, 'Amoxicillin 250mg'),
              const SizedBox(height: 12),
              _buildDialogField('Hàm lượng', contentController, 'VD: 1 viên'),
              const SizedBox(height: 12),
              
              // Row 2: Usage and Days
              Row(
                children: [
                  Expanded(child: _buildDialogField('Liều dùng *', usageController, 'VD: 2 lần/ngày')),
                  const SizedBox(width: 12),
                  Expanded(child: _buildDialogField('Số ngày dùng', daysController, 'VD: 7', isNumber: true)),
                ],
              ),
              const SizedBox(height: 12),
              
              // Instructions
              _buildDialogField('Hướng dẫn sử dụng', instructionsController, 'Ghi chú, lưu ý đặc biệt...', maxLines: 3),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.stone600,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(color: AppColors.stone300),
              ),
            ),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () {
              if (nameController.text.isNotEmpty && usageController.text.isNotEmpty) {
                setState(() {
                  final newItem = Prescription(
                    medicineName: nameController.text,
                    dosage: contentController.text.isEmpty ? null : contentController.text,
                    frequency: usageController.text,
                    durationDays: int.tryParse(daysController.text),
                    instructions: instructionsController.text.isEmpty ? null : instructionsController.text,
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
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text(item == null ? 'Thêm thuốc' : 'Lưu'),
          ),
        ],
        actionsPadding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }

  Widget _buildDialogField(String label, TextEditingController controller, String hint, {bool isNumber = false, int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.stone700),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: isNumber ? TextInputType.number : TextInputType.text,
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: AppColors.stone400, fontSize: 13),
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: AppColors.stone300),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: AppColors.stone300),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColors.primary, width: 2),
            ),
          ),
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
