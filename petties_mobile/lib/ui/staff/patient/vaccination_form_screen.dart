import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../data/models/vaccination.dart';
import '../../../data/models/vaccine_template.dart';
import '../../../data/services/vaccination_service.dart';
import '../../../data/services/vaccine_template_service.dart';
import '../../../data/services/service_service.dart';
import '../../../data/models/clinic_service.dart';
import '../../../config/constants/app_colors.dart';
import 'widgets/vaccination_roadmap_table.dart';

class VaccinationFormScreen extends StatefulWidget {
  final String petId;
  final String petName;
  final VaccinationRecord? initialRecord; // For editing or pre-filling from prediction
  final VaccineTemplate? initialTemplate;
  final String? bookingId;
  final String? bookingCode;
  final String? initialVaccineName;
  
  // Dependencies (Optional for injection)
  final VaccinationService? vaccinationService;
  final VaccineTemplateService? templateService;
  final ServiceService? serviceService;

  const VaccinationFormScreen({
    super.key,
    required this.petId,
    required this.petName,
    this.initialRecord,
    this.initialTemplate,
    this.bookingId,
    this.bookingCode,
    this.initialVaccineName,
    this.vaccinationService,
    this.templateService,
    this.serviceService,
  });

  @override
  State<VaccinationFormScreen> createState() => _VaccinationFormScreenState();
}

class _VaccinationFormScreenState extends State<VaccinationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  
  // Services
  late final VaccinationService _vaccinationService;
  late final VaccineTemplateService _templateService;
  late final ServiceService _serviceService;

  List<VaccineTemplate> _templates = [];
  VaccineTemplate? _selectedTemplate;
  
  final _vaccineNameController = TextEditingController();
  String _doseSequence = '1';
  final _notesController = TextEditingController();
  DateTime _vaccinationDate = DateTime.now();
  DateTime? _nextDueDate;
  
  bool _isLoadingTemplates = true;
  bool _isSubmitting = false;
  
  // Edit mode
  VaccinationRecord? _editingRecord;
  final _scrollController = ScrollController();

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
    _serviceService = widget.serviceService ?? ServiceService();
    
    // Pre-fill vaccine name if provided from booking or other sources
    if (widget.initialVaccineName != null && widget.initialVaccineName!.isNotEmpty) {
      _vaccineNameController.text = widget.initialVaccineName!;
    }
    
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



  void _fillFormFromSuggestion(VaccinationRecord rec) {
    setState(() {
      // 1. Set Vaccine Template/Name
      if (rec.vaccineTemplateId != null && _templates.isNotEmpty) {
        try {
          _selectedTemplate = _templates.firstWhere((t) => t.id == rec.vaccineTemplateId);
          _vaccineNameController.text = _selectedTemplate!.name;
        } catch (e) {
          // If template not found (maybe disabled/deleted), fallback to name
          _selectedTemplate = null;
          _vaccineNameController.text = rec.vaccineName;
        }
      } else {
        // Try to match by name if template ID missing
        try {
          _selectedTemplate = _templates.firstWhere(
            (t) => t.name.toLowerCase().trim() == rec.vaccineName.toLowerCase().trim()
          );
          _vaccineNameController.text = _selectedTemplate!.name;
        } catch (e) {
          _selectedTemplate = null;
          _vaccineNameController.text = rec.vaccineName;
        }
      }

      // 2. Set Dose sequence
      _doseSequence = rec.doseNumber?.toString() ?? '1';

      // 3. Set Vaccination Date (Default to today for 'performing now')
      _vaccinationDate = DateTime.now();

      // 4. Set Next Due Date (Suggestion might have a calculated next due, or we recalc)
      if (rec.nextDueDate != null) {
         // If borrowing from a suggestion, usually the suggestion IS the next due.
         // But here we are creating a record for "Today".
         // So we should recalc next due based on THIS vaccine's template logic.
         _updateDoseAndDateSuggestion(); 
      } else {
         _updateDoseAndDateSuggestion();
      }

      // 5. Notes
      if (rec.notes != null) {
        _notesController.text = rec.notes!;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đã điền thông tin: ${rec.vaccineName} - Mũi $_doseSequence'),
          backgroundColor: Colors.blue.shade700,
          duration: const Duration(seconds: 1),
        ),
      );
    });
  }

  void _fillFormFromRecord(VaccinationRecord rec) {
    setState(() {
      _editingRecord = rec;
      _vaccineNameController.text = rec.vaccineName;
      _doseSequence = rec.doseSequence ?? (rec.doseNumber?.toString() ?? '1');
      _notesController.text = rec.notes ?? '';
      _vaccinationDate = rec.vaccinationDate ?? DateTime.now();
      _nextDueDate = rec.nextDueDate;
      
      // Try to match template
      if (rec.vaccineTemplateId != null) {
        try {
          _selectedTemplate = _templates.firstWhere((t) => t.id == rec.vaccineTemplateId);
        } catch (_) {
          _selectedTemplate = null;
        }
      } else {
        // Fallback fuzzy match
        final normalizedInput = rec.vaccineName.toLowerCase().trim();
        try {
          _selectedTemplate = _templates.firstWhere(
            (t) {
              final tName = t.name.toLowerCase().trim();
              return normalizedInput == tName || normalizedInput.contains(tName) || tName.contains(normalizedInput);
            }
          );
        } catch (_) {
          _selectedTemplate = null;
        }
      }
    });

    // Scroll to top
    _scrollController.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
  }

  void _cancelEdit() {
    setState(() {
      _editingRecord = null;
      _vaccineNameController.clear();
      _doseSequence = '1';
      _notesController.clear();
      _vaccinationDate = DateTime.now();
      _nextDueDate = null;
      _selectedTemplate = null;
    });
  }


  void _showServiceCatalog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _buildServiceCatalogModal(),
    );
  }

  Widget _buildServiceCatalogModal() {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.only(topLeft: Radius.circular(32), topRight: Radius.circular(32)),
      ),
      child: Column(
        children: [
          // Drag Handle
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.stone300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(24, 16, 16, 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('DANH MỤC DỊCH VỤ CLINIC', 
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppColors.stone900, letterSpacing: -0.5)),
                    SizedBox(height: 4),
                    Text('Chọn từ danh sách dịch vụ tiêm phòng', 
                      style: TextStyle(fontSize: 13, color: AppColors.stone500, fontWeight: FontWeight.w500)),
                  ],
                ),
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.stone100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close, color: AppColors.stone600, size: 20),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ],
            ),
          ),
          
          const Divider(height: 1, color: AppColors.stone100),
          
          // Content
          Expanded(
            child: FutureBuilder<List<ClinicServiceModel>>(
              future: _serviceService.getServices(category: 'VACCINATION'),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: AppColors.primary));
                }
                if (snapshot.hasError) {
                  return Center(child: Text('Lỗi tải dữ liệu: ${snapshot.error}', style: const TextStyle(color: Colors.red)));
                }
                
                // Extra local filter to ensure only vaccination services appear as requested
                final allServices = snapshot.data ?? [];
                final services = allServices.where((s) {
                  final name = s.name.toLowerCase();
                  final category = (s.serviceCategory ?? '').toLowerCase();
                  return category == 'vaccination' || name.contains('vắc-xin') || name.contains('vaccine') || name.contains('tiêm phòng');
                }).toList();

                if (services.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.search_off_outlined, size: 64, color: AppColors.stone300),
                        const SizedBox(height: 16),
                        const Text('Không tìm thấy dịch vụ tiêm chủng nào.', 
                          style: TextStyle(color: AppColors.stone500, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(20),
                  itemCount: services.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 14),
                  itemBuilder: (context, index) {
                    final service = services[index];
                    return InkWell(
                      onTap: () {
                        _fillFormFromService(service);
                        Navigator.pop(context);
                      },
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          border: Border.all(color: AppColors.stone200.withOpacity(0.8)),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.03), 
                              blurRadius: 10, 
                              offset: const Offset(0, 4)
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            // Icon Container - Blue Styled
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6FF), // blue-50
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: const Icon(Icons.vaccines_outlined, color: Color(0xFF2563EB), size: 28), // blue-600
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    service.name,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800, 
                                      fontSize: 15, 
                                      color: AppColors.stone900,
                                      letterSpacing: -0.3
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      Text(
                                        service.formattedPrice,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w900, 
                                          fontSize: 14, 
                                          color: Color(0xFFEA580C) // orange-600
                                        ),
                                      ),
                                      if (service.dosePrices.isNotEmpty) ...[
                                         const SizedBox(width: 10),
                                         Container(
                                           padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                           decoration: BoxDecoration(
                                             color: AppColors.stone100,
                                             borderRadius: BorderRadius.circular(6),
                                           ),
                                           child: Text(
                                             '${service.dosePrices.length} lựa chọn',
                                             style: const TextStyle(
                                               fontSize: 11, 
                                               color: AppColors.stone500,
                                               fontWeight: FontWeight.w600
                                             ),
                                           ),
                                         ),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            // Trailing Arrow
                            Icon(Icons.chevron_right_rounded, color: AppColors.stone400, size: 24),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          // Bottom Button - Close
          Padding(
            padding: EdgeInsets.fromLTRB(24, 16, 24, MediaQuery.of(context).padding.bottom + 16),
            child: SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.stone100,
                  foregroundColor: AppColors.stone600,
                  elevation: 0,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: const Text('ĐÓNG DANH MỤC', 
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 1.2)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _fillFormFromService(ClinicServiceModel service) {
    setState(() {
      // 1. Set Name
      _vaccineNameController.text = service.name;
      
      // 2. Try to match Template
      if (service.vaccineTemplateId != null) {
        try {
          _selectedTemplate = _templates.firstWhere((t) => t.id == service.vaccineTemplateId);
        } catch (_) {
          _selectedTemplate = null;
        }
      } else {
        _selectedTemplate = null;
      }

      // 3. Logic to predict next step based on history (similar to suggestion logic)
      _updateDoseAndDateSuggestion();
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đã chọn: ${service.name}'),
          backgroundColor: Colors.blue.shade700,
          duration: const Duration(seconds: 1),
        ),
      );
    });
  }
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
          } else if (_vaccineNameController.text.isNotEmpty) {
             // Match by Name if pre-filled from booking
             final normalizedInput = _vaccineNameController.text.toLowerCase().trim();
             try {
               _selectedTemplate = _templates.firstWhere(
                 (t) {
                   final tName = t.name.toLowerCase().trim();
                   return normalizedInput == tName || normalizedInput.contains(tName) || tName.contains(normalizedInput);
                 }
               );
             } catch (_) {
               _selectedTemplate = null;
             }
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
      if (_editingRecord != null) {
        // UPDATE MODE
        final updateData = {
          'vaccineName': _selectedTemplate?.name ?? _vaccineNameController.text,
          'vaccinationDate': _vaccinationDate.toIso8601String().split('T')[0],
          'nextDueDate': _nextDueDate?.toIso8601String().split('T')[0],
          'notes': _notesController.text.isEmpty ? null : _notesController.text,
          'vaccineTemplateId': _selectedTemplate?.id,
          'doseSequence': _doseSequence,
        };
        await _vaccinationService.updateVaccination(_editingRecord!.id, updateData);
      } else {
        // CREATE MODE
        final request = CreateVaccinationRequest(
          petId: widget.petId,
          bookingId: widget.bookingId ?? widget.initialRecord?.bookingId,
          vaccineName: _selectedTemplate?.name ?? _vaccineNameController.text,
          vaccinationDate: _vaccinationDate,
          nextDueDate: _nextDueDate,
          notes: _notesController.text.isEmpty ? null : _notesController.text,
          vaccineTemplateId: _selectedTemplate?.id,
          doseSequence: _doseSequence,
          workflowStatus: 'COMPLETED',
        );
        await _vaccinationService.createVaccination(request);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_editingRecord != null ? 'Cập nhật thành công!' : 'Lưu thông tin thành công!'), 
            backgroundColor: Colors.green
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        String message = e.toString().replaceFirst('Exception: ', '');
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
    _scrollController.dispose();
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
          _editingRecord != null ? 'Chỉnh sửa Tiêm chủng' : 'Ghi nhận Tiêm chủng - ${widget.petName}',
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
        ),
      ),
      body: _isLoadingTemplates
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
          : SingleChildScrollView(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Suggestions Section


                    // Vaccine Selection Card
                    _buildSectionCard(
                      title: 'THÔNG TIN VẮC-XIN',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Loại mũi tiêm (Trình tự):', style: TextStyle(fontSize: 12, color: AppColors.stone500, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: AppColors.stone100,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: [
                                  _buildDoseOption('MŨI 1', '1'),
                                  const SizedBox(width: 4),
                                  _buildDoseOption('MŨI 2', '2'),
                                  const SizedBox(width: 4),
                                  _buildDoseOption('MŨI 3', '3'),
                                  const SizedBox(width: 4),
                                  _buildDoseOption('HẰNG NĂM', 'ANNUAL'),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          
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
                          Row(
                            children: [
                              Expanded(
                                child: TextFormField(
                                  controller: _vaccineNameController,
                                  decoration: InputDecoration(
                                    labelText: 'Tên vắc-xin',
                                    hintText: 'Nhập hoặc chọn từ danh mục...',
                                    filled: true,
                                    fillColor: AppColors.stone100,
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                                    suffixIcon: _vaccineNameController.text.isNotEmpty
                                        ? IconButton(
                                            icon: const Icon(Icons.close, size: 18),
                                            onPressed: () {
                                              setState(() {
                                                _vaccineNameController.clear();
                                                _selectedTemplate = null;
                                              });
                                            },
                                          )
                                        : null,
                                  ),
                                  validator: (v) => v == null || v.isEmpty ? 'Vui lòng nhập tên vắc-xin' : null,
                                  onChanged: (val) {
                                     // Optional: try to auto-match template by name
                                  },
                                ),
                              ),
                              const SizedBox(width: 12),
                              InkWell(
                                onTap: _showServiceCatalog,
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: AppColors.primary,
                                    borderRadius: BorderRadius.circular(12),
                                    boxShadow: [
                                      BoxShadow(
                                        color: AppColors.primary.withOpacity(0.35), 
                                        blurRadius: 12, 
                                        offset: const Offset(0, 6)
                                      ),
                                    ],
                                  ),
                                  child: const Icon(Icons.list_alt, color: Colors.white, size: 24),
                                ),
                              ),
                            ],
                          ),
                          // Hidden or Optional Template Dropdown (Debug/Expert mode)
                          if (_selectedTemplate != null)
                             Padding(
                               padding: const EdgeInsets.only(top: 8),
                               child: Container(
                                 padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                 decoration: BoxDecoration(
                                   color: Colors.green.shade50,
                                   borderRadius: BorderRadius.circular(8),
                                   border: Border.all(color: Colors.green.shade100),
                                 ),
                                 child: Row(
                                   children: [
                                     Icon(Icons.link, size: 16, color: Colors.green.shade700),
                                     const SizedBox(width: 8),
                                     Expanded(
                                       child: Text(
                                         'Đã liên kết: ${_selectedTemplate!.name}',
                                         style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.green.shade800),
                                         overflow: TextOverflow.ellipsis,
                                       ),
                                     ),
                                     InkWell(
                                       onTap: () => setState(() => _selectedTemplate = null),
                                       child: Icon(Icons.close, size: 16, color: Colors.green.shade700),
                                     )
                                   ],
                                 ),
                               ),
                             ),
                          const SizedBox(height: 16),

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

                    if (_editingRecord != null) 
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: OutlinedButton.icon(
                            onPressed: _cancelEdit,
                            icon: const Icon(Icons.close_rounded, size: 20),
                            label: const Text('HỦY CHỈNH SỬA', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5)),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.stone600,
                              side: BorderSide(color: AppColors.stone300),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                          ),
                        ),
                      ),

                    SizedBox(
                      width: double.infinity,
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _isSubmitting ? null : _handleSubmit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _editingRecord != null ? const Color(0xFF2563EB) : AppColors.primary,
                          foregroundColor: AppColors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: _isSubmitting
                            ? const CircularProgressIndicator(color: AppColors.white)
                            : Text(
                                _editingRecord != null ? 'CẬP NHẬT TIÊM CHỦNG' : 'LƯU HỒ SƠ TIÊM CHỦNG', 
                                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)
                              ),
                      ),
                    ),
                    
                    // Suggestions Section (Moved to Bottom)
                    if (_upcoming.isNotEmpty) ...[
                       const SizedBox(height: 32),
                       _buildSectionCard(
                         title: 'MŨI TIÊM GỢI Ý / ĐẾN HẠN',
                         child: SingleChildScrollView(
                           scrollDirection: Axis.horizontal,
                           child: Row(
                             children: _upcoming.map((rec) => _buildSuggestionPill(rec)).toList(),
                           ),
                         ),
                       ),
                    ],
                    
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
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary.withOpacity(0.2) : Colors.transparent,
            width: 1,
          ),
          boxShadow: isSelected 
            ? [BoxShadow(color: AppColors.primary.withOpacity(0.1), blurRadius: 8, offset: const Offset(0, 4))] 
            : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w900,
            color: isSelected ? AppColors.primary : AppColors.stone400,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }




  Widget _buildHistoryCard(VaccinationRecord rec) {
    return InkWell(
      onTap: () => _fillFormFromRecord(rec),
      borderRadius: BorderRadius.circular(20),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: _editingRecord?.id == rec.id 
                ? const Color(0xFF2563EB).withOpacity(0.5) 
                : AppColors.stone200.withOpacity(0.8)
          ),
          boxShadow: [
            BoxShadow(
              color: _editingRecord?.id == rec.id 
                  ? const Color(0xFF2563EB).withOpacity(0.05) 
                  : Colors.black.withOpacity(0.03), 
              blurRadius: 10, 
              offset: const Offset(0, 4)
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Section: Title & Trash
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 8, 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          rec.vaccineName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w900, 
                            fontSize: 16, 
                            color: AppColors.stone900,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 6),
                        // Dose Badge
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7), // amber-100
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            'Mũi ${rec.doseNumber ?? 1} / ${rec.totalDoses ?? 1}',
                            style: const TextStyle(
                              fontSize: 11, 
                              fontWeight: FontWeight.w900, 
                              color: Color(0xFFD97706), // amber-600
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () {
                      // Trigger delete logic if available or just feedback
                    },
                    icon: Icon(Icons.delete_outline_rounded, color: AppColors.stone300, size: 22),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
            ),
            
            const Divider(height: 1, color: AppColors.stone100),
            
            // Middle Section: Date & Status Circle
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('NGÀY TIÊM', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.stone400, letterSpacing: 0.5)),
                      const SizedBox(height: 4),
                      Text(
                        rec.vaccinationDate != null ? DateFormat('dd/MM/yyyy').format(rec.vaccinationDate!) : '-',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: AppColors.stone800),
                      ),
                    ],
                  ),
                  // Status Circle
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7), // amber-100
                      shape: BoxShape.circle,
                      border: _editingRecord?.id == rec.id 
                          ? Border.all(color: const Color(0xFF2563EB), width: 2) 
                          : null,
                    ),
                    child: Center(
                      child: Text(
                        _editingRecord?.id == rec.id ? 'EDIT' : 'N', 
                        style: TextStyle(
                          fontWeight: FontWeight.w900, 
                          color: _editingRecord?.id == rec.id ? const Color(0xFF2563EB) : const Color(0xFFD97706), 
                          fontSize: _editingRecord?.id == rec.id ? 10 : 16
                        )
                      ),
                    ),
                  ),
                ],
              ),
            ),
            
            // Bottom Section: Note (Removed automatic source note)
            if (rec.notes != null && rec.notes!.isNotEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                margin: const EdgeInsets.all(16).copyWith(top: 0),
                decoration: BoxDecoration(
                  color: AppColors.stone50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  children: [
                    Icon(Icons.notes_rounded, size: 14, color: AppColors.stone400),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        rec.notes!,
                        style: const TextStyle(fontSize: 12, color: AppColors.stone500, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuggestionPill(VaccinationRecord rec) {
    bool isOverdue = rec.nextDueDate != null && rec.nextDueDate!.isBefore(DateTime.now());
    return GestureDetector(
      onTap: () => _fillFormFromSuggestion(rec),
      child: Container(
        margin: const EdgeInsets.only(right: 12),
        padding: const EdgeInsets.all(12),
        width: 160,
        decoration: BoxDecoration(
          color: isOverdue ? AppColors.errorLight : AppColors.infoLight,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isOverdue ? AppColors.error.withOpacity(0.2) : AppColors.info.withOpacity(0.2),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: (isOverdue ? AppColors.error : AppColors.info).withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isOverdue ? AppColors.error : AppColors.info,
                    borderRadius: BorderRadius.circular(6),
                    boxShadow: [
                      BoxShadow(
                        color: (isOverdue ? AppColors.error : AppColors.info).withOpacity(0.3),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Text(
                    'MŨI ${rec.doseNumber ?? 1}',
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                  ),
                ),
                if (rec.nextDueDate != null)
                  Text(
                    DateFormat('dd/MM').format(rec.nextDueDate!),
                    style: TextStyle(
                      color: isOverdue ? AppColors.errorDark : AppColors.info,
                      fontFamily: 'SF Pro Display',
                      fontWeight: FontWeight.w900,
                      fontSize: 12
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              rec.vaccineName,
              style: TextStyle(
                fontWeight: FontWeight.w700, 
                fontSize: 13, 
                color: isOverdue ? Colors.red.shade900 : Colors.blue.shade900
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.touch_app, size: 10, color: isOverdue ? Colors.red.shade400 : Colors.blue.shade400),
                const SizedBox(width: 4),
                Text(
                  'Bấm để chọn',
                  style: TextStyle(
                    fontSize: 10, 
                    color: isOverdue ? Colors.red.shade400 : Colors.blue.shade400,
                    fontStyle: FontStyle.italic
                  ),
                ),
              ],
            )
          ],
        ),
      ),
    );
  }
}
