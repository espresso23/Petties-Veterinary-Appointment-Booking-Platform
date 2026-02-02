import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../data/models/vaccination.dart';
import '../../../data/models/vaccine_template.dart';
import '../../../data/services/vaccination_service.dart';
import '../../../data/services/vaccine_template_service.dart';
import '../../../config/constants/app_colors.dart';
import 'widgets/vaccination_roadmap_table.dart';

class VaccinationFormScreen extends StatefulWidget {
  final String petId;
  final String petName;
  final VaccinationRecord? initialRecord; // For editing or pre-filling from prediction
  final VaccineTemplate? initialTemplate;
  final String? bookingId;
  final String? bookingCode;
  
  // Dependencies (Optional for injection)
  final VaccinationService? vaccinationService;
  final VaccineTemplateService? templateService;

  const VaccinationFormScreen({
    super.key,
    required this.petId,
    required this.petName,
    this.initialRecord,
    this.initialTemplate,
    this.bookingId,
    this.bookingCode,
    this.vaccinationService,
    this.templateService,
  });

  @override
  State<VaccinationFormScreen> createState() => _VaccinationFormScreenState();
}

class _VaccinationFormScreenState extends State<VaccinationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  
  // Services
  late final VaccinationService _vaccinationService;
  late final VaccineTemplateService _templateService;

  List<VaccineTemplate> _templates = [];
  VaccineTemplate? _selectedTemplate;
  
  final _vaccineNameController = TextEditingController();
  String _doseSequence = '1';
  final _notesController = TextEditingController();
  DateTime _vaccinationDate = DateTime.now();
  DateTime? _nextDueDate;
  
  bool _isLoadingTemplates = true;
  bool _isSubmitting = false;
  

// ... existing imports

  // Vaccination history
  List<VaccinationRecord> _history = [];
  List<VaccinationRecord> _upcoming = []; // Add upcoming state
  bool _isLoadingHistory = true;
  String _viewMode = 'list'; // 'list' or 'roadmap'

  @override
  void initState() {
    super.initState();
    // Initialize services with injected values or default instances
    _vaccinationService = widget.vaccinationService ?? VaccinationService();
    _templateService = widget.templateService ?? VaccineTemplateService();
    
    _loadTemplates();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    try {
      debugPrint('DEBUG: Starting _loadHistory for petId: ${widget.petId}');
      final results = await Future.wait([
        _vaccinationService.getVaccinationsByPet(widget.petId).then((val) {
           debugPrint('DEBUG: Fetched history: ${val.length} records');
           return val;
        }),
        _vaccinationService.getUpcomingVaccinations(widget.petId).then((val) {
           debugPrint('DEBUG: Fetched upcoming: ${val.length} records');
           return val;
        }), 
      ]);
      
      final history = results[0] as List<VaccinationRecord>;
      final upcoming = results[1] as List<VaccinationRecord>;

      if (mounted) {
        setState(() {
          _history = history.where((r) => r.status == 'COMPLETED').toList();
          _upcoming = upcoming;
          _isLoadingHistory = false;
          if (_selectedTemplate != null && widget.initialRecord == null) {
            _updateDoseAndDateSuggestion();
          }
        });
      }
    } catch (e) {
      debugPrint('Error loading vaccination history: $e');
      if (mounted) setState(() => _isLoadingHistory = false);
    }
  }

  // ... existing methods

  Widget _buildViewToggle(String label, String mode, IconData icon) {
    bool isActive = _viewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isActive ? AppColors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          boxShadow: isActive ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))] : null,
        ),
        child: Row(
          children: [
            Icon(icon, size: 12, color: isActive ? AppColors.primary : AppColors.stone400),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: isActive ? AppColors.stone900 : AppColors.stone400,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistorySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'LỊCH SỬ TIÊM CHỦNG',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppColors.stone700, letterSpacing: 0.5),
            ),
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: AppColors.stone100,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  _buildViewToggle('LIST', 'list', Icons.list),
                  _buildViewToggle('ROADMAP', 'roadmap', Icons.grid_view),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_isLoadingHistory)
          const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator(color: AppColors.primary)))
        else if (_viewMode == 'roadmap')
          VaccinationRoadmapTable(records: _history, upcoming: _upcoming)
        else if (_history.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.stone50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone200),
            ),
            child: const Column(
              children: [
                Icon(Icons.vaccines_outlined, size: 40, color: AppColors.stone300),
                SizedBox(height: 8),
                Text('Chưa có lịch sử tiêm chủng', style: TextStyle(color: AppColors.stone400, fontWeight: FontWeight.w600)),
              ],
            ),
          )
        else
          ..._history.map((rec) => _buildHistoryCard(rec)),
      ],
    );
  }

  Future<void> _loadTemplates() async {
    try {
      debugPrint('DEBUG: Starting _loadTemplates');
      final templates = await _templateService.getTemplates();
      debugPrint('DEBUG: Fetched ${templates.length} templates');
      if (mounted) {
        setState(() {
          _templates = templates;
          _isLoadingTemplates = false;
          
          // Match initial template if provided
          if (widget.initialTemplate != null) {
            _selectedTemplate = _templates.firstWhere((t) => t.id == widget.initialTemplate!.id, orElse: () => widget.initialTemplate!);
            _vaccineNameController.text = _selectedTemplate!.name;
          } else if (widget.initialRecord?.vaccineTemplateId != null) {
             _selectedTemplate = _templates.firstWhere((t) => t.id == widget.initialRecord!.vaccineTemplateId, orElse: () => null as dynamic);
          }
          
          if (_selectedTemplate != null && widget.initialRecord == null) {
             _updateDoseAndDateSuggestion();
          }
        });
      }
    } catch (e) {
      debugPrint('Error loading templates: $e');
      if (mounted) setState(() => _isLoadingTemplates = false);
    }
  }

  void _updateDoseAndDateSuggestion() {
    if (_selectedTemplate == null) return;
    
    // 1. Auto-calculate Dose Sequence based on History
    if (_history.isNotEmpty) {
      final relatedRecords = _history.where((r) => 
        (r.vaccineName.toLowerCase().trim() == _selectedTemplate!.name.toLowerCase().trim()) ||
        (r.vaccineTemplateId != null && r.vaccineTemplateId == _selectedTemplate!.id)
      ).toList();

      if (relatedRecords.isNotEmpty) {
         int maxDose = 0;
         bool hasAnnual = false;
         
         for (var record in relatedRecords) {
           if (record.doseSequence == 'ANNUAL') {
              hasAnnual = true;
           } else {
              int dose = int.tryParse(record.doseSequence ?? record.doseNumber?.toString() ?? '0') ?? 0;
              if (dose > maxDose) maxDose = dose;
           }
         }
         
         // Logic: If last was dose 1 -> 2. If 2 -> 3. If 3 -> ANNUAL.
         if (hasAnnual) {
            _doseSequence = 'ANNUAL';
         } else if (maxDose >= 3) {
            _doseSequence = 'ANNUAL';
         } else {
            _doseSequence = (maxDose + 1).toString();
         }
      } else {
        _doseSequence = '1';
      }
    }

    // 2. Auto-calculate Next Due Date
    if (_vaccinationDate != null) {
      if (_selectedTemplate!.repeatIntervalDays != null && _selectedTemplate!.repeatIntervalDays! > 0) {
        _nextDueDate = _vaccinationDate.add(Duration(days: _selectedTemplate!.repeatIntervalDays!));
      } else if (_selectedTemplate!.isAnnualRepeat == true) {
        _nextDueDate = DateTime(_vaccinationDate.year + 1, _vaccinationDate.month, _vaccinationDate.day);
      }
    }
  }

  Future<void> _selectDate(BuildContext context, bool isNextDue) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: isNextDue ? (_nextDueDate ?? DateTime.now().add(const Duration(days: 21))) : _vaccinationDate,
      firstDate: isNextDue ? DateTime.now() : DateTime(2000),
      lastDate: isNextDue ? DateTime.now().add(const Duration(days: 365 * 2)) : DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        if (isNextDue) {
          _nextDueDate = picked;
        } else {
          _vaccinationDate = picked;
          // Auto-recalculate next due date based on vaccine template
          if (_selectedTemplate != null) {
            if (_selectedTemplate!.repeatIntervalDays != null && _selectedTemplate!.repeatIntervalDays! > 0) {
              _nextDueDate = picked.add(Duration(days: _selectedTemplate!.repeatIntervalDays!));
            } else if (_selectedTemplate!.isAnnualRepeat == true) {
              _nextDueDate = DateTime(picked.year + 1, picked.month, picked.day);
            }
          }
        }
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final request = CreateVaccinationRequest(
        petId: widget.petId,
        bookingId: widget.bookingId ?? widget.initialRecord?.bookingId,
        vaccineName: _selectedTemplate?.name ?? _vaccineNameController.text,
        vaccinationDate: _vaccinationDate,
        nextDueDate: _nextDueDate,
        notes: _notesController.text.isEmpty ? null : _notesController.text,
        vaccineTemplateId: _selectedTemplate?.id,
        doseSequence: _doseSequence,
        workflowStatus: 'COMPLETED', // Directly completing it from this form
      );

      await _vaccinationService.createVaccination(request);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lưu thông tin tiêm chủng thành công!'), backgroundColor: Colors.green),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        // Clean up error message
        String message = e.toString().replaceFirst('Exception: ', '');
        if (message.contains('Lỗi tham số không hợp lệ: ')) {
          message = message.split('Lỗi tham số không hợp lệ: ').last;
        }
        
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), backgroundColor: Colors.red),
        );
      }
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  void dispose() {
    _vaccineNameController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        backgroundColor: AppColors.white,
        foregroundColor: AppColors.stone900,
        elevation: 1,
        title: Text(
          'Ghi nhận Tiêm chủng - ${widget.petName}',
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
        ),
      ),
      body: _isLoadingTemplates
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Vaccine Selection Card
                    _buildSectionCard(
                      title: 'THÔNG TIN VẮC-XIN',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Chọn loại vắc-xin:', style: TextStyle(fontSize: 12, color: AppColors.stone500, fontWeight: FontWeight.bold)),
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
                          const SizedBox(height: 8),
                          DropdownButtonFormField<VaccineTemplate>(
                            value: _selectedTemplate,
                            decoration: InputDecoration(
                              filled: true,
                              fillColor: AppColors.stone100,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                            ),
                            items: _templates.map((t) => DropdownMenuItem(value: t, child: Text(t.name))).toList(),
                            onChanged: (val) {
                              setState(() {
                                _selectedTemplate = val;
                                if (val != null) {
                                  _vaccineNameController.text = val.name;
                                  _updateDoseAndDateSuggestion();
                                }
                              });
                            },
                            validator: (v) => v == null ? 'Vui lòng chọn vắc-xin' : null,
                          ),
                          const SizedBox(height: 16),
                          const SizedBox(height: 16),
                          const Text('Loại mũi tiêm:', style: TextStyle(fontSize: 12, color: AppColors.stone500, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 8),
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                              children: [
                                _buildDoseOption('MŨI 1', '1'),
                                const SizedBox(width: 8),
                                _buildDoseOption('MŨI 2', '2'),
                                const SizedBox(width: 8),
                                _buildDoseOption('MŨI 3', '3'),
                                const SizedBox(width: 8),
                                _buildDoseOption('HẰNG NĂM', 'ANNUAL'),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Date Selection Card
                    _buildSectionCard(
                      title: 'THỜI GIAN',
                      child: Column(
                        children: [
                          _buildDatePickerTile(
                            label: 'Ngày tiêm hiện tại:',
                            date: _vaccinationDate,
                            onTap: () => _selectDate(context, false),
                            icon: Icons.calendar_today,
                          ),
                          const Divider(height: 24),
                          _buildDatePickerTile(
                            label: 'Ngày hẹn mũi tiếp theo (tuỳ chọn):',
                            date: _nextDueDate,
                            onTap: () => _selectDate(context, true),
                            icon: Icons.event_repeat,
                            isNullable: true,
                            onClear: () => setState(() => _nextDueDate = null),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Notes
                    _buildSectionCard(
                      title: 'GHI CHÚ',
                      child: TextFormField(
                        controller: _notesController,
                        maxLines: 3,
                        decoration: InputDecoration(
                          hintText: 'Nhập ghi chú hoặc phản ứng sau tiêm (nếu có)...',
                          filled: true,
                          fillColor: AppColors.stone100,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                        ),
                      ),
                    ),

                    const SizedBox(height: 32),

                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _isSubmitting ? null : _handleSubmit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: AppColors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: _isSubmitting
                            ? const CircularProgressIndicator(color: AppColors.white)
                            : const Text('LƯU HỒ SƠ TIÊM CHỦNG', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                      ),
                    ),
                    
                    // Vaccination History Section
                    const SizedBox(height: 32),
                    _buildHistorySection(),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSectionCard({required String title, required Widget child}) {
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
          Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: AppColors.stone400, letterSpacing: 1.2)),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  Widget _buildDatePickerTile({
    required String label,
    required DateTime? date,
    required VoidCallback onTap,
    required IconData icon,
    bool isNullable = false,
    VoidCallback? onClear,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.stone50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.stone200),
        ),
        child: Row(
          children: [
            Icon(icon, color: AppColors.primary, size: 20),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: const TextStyle(fontSize: 11, color: AppColors.stone500)),
                  Text(
                    date != null ? DateFormat('dd/MM/yyyy').format(date) : 'Chưa chọn',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: date != null ? AppColors.stone900 : AppColors.stone400),
                  ),
                ],
              ),
            ),
            if (isNullable && date != null && onClear != null)
              IconButton(onPressed: onClear, icon: const Icon(Icons.close, size: 18, color: AppColors.stone400))
            else
              const Icon(Icons.chevron_right, color: AppColors.stone400),
          ],
        ),
      ),
    );
  }

  Widget _buildDoseOption(String label, String value) {
    bool isSelected = _doseSequence == value;
    return GestureDetector(
      onTap: () => setState(() => _doseSequence = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary.withOpacity(0.1) : AppColors.stone100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : Colors.transparent,
            width: 2,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w900,
            color: isSelected ? AppColors.primary : AppColors.stone500,
          ),
        ),
      ),
    );
  }




  Widget _buildHistoryCard(VaccinationRecord rec) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone200),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.check_circle, color: Colors.green.shade600, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  rec.vaccineName,
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: AppColors.stone900),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    if (rec.doseNumber != null)
                      Container(
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.orange.shade50,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'Mũi ${rec.doseNumber}',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.orange.shade700),
                        ),
                      ),
                    Icon(Icons.calendar_today, size: 12, color: AppColors.stone400),
                    const SizedBox(width: 4),
                    Text(
                      rec.vaccinationDate != null ? DateFormat('dd/MM/yyyy').format(rec.vaccinationDate!) : '-',
                      style: const TextStyle(fontSize: 12, color: AppColors.stone500),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (rec.nextDueDate != null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text('Tái chủng', style: TextStyle(fontSize: 9, color: AppColors.stone400)),
                Text(
                  DateFormat('dd/MM/yy').format(rec.nextDueDate!),
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.blue.shade600),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
