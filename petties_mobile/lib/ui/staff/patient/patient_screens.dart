import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/models/emr.dart';
import '../../../data/models/pet.dart';
import '../../../data/models/vaccination.dart';
import '../../../data/services/emr_service.dart';
import '../../../data/services/pet_service.dart';
import '../../../data/services/auth_service.dart';
import '../../../data/services/vaccination_service.dart';
import '../../../data/models/vaccine_template.dart';
import '../../../data/services/vaccine_template_service.dart';
import './vaccination_form_screen.dart';
import 'widgets/vaccination_roadmap_table.dart';

/// Staff Patient List Screen - Fetches real data from API
class PatientListScreen extends StatefulWidget {
  const PatientListScreen({super.key});

  @override
  State<PatientListScreen> createState() => _PatientListScreenState();
}

class _PatientListScreenState extends State<PatientListScreen> {
  final PetService _petService = PetService();
  
  List<Pet> _patients = [];
  bool _isLoading = true;
  String _searchQuery = '';
  String _filter = 'all'; // all, dogs, cats
  String _sortBy = 'name-asc'; // name-asc, name-desc, exam-newest, exam-oldest
  int _currentPage = 0;
  int _totalPages = 1;
  int _totalElements = 0;
  final int _pageSize = 20;
  String? _currentUserId;

  @override
  void initState() {
    super.initState();
    _loadPatients();
  }

  Future<void> _loadPatients() async {
    setState(() => _isLoading = true);
    try {
      final userResponse = await AuthService().getCurrentUser();
      
      if (userResponse.workingClinicId != null) {
        final patients = await _petService.getStaffPatients(
          userResponse.workingClinicId!,
          userResponse.userId,
        );

        setState(() {
          _patients = patients;
          _totalPages = 1; // getStaffPatients currently returns a simple list
          _totalElements = patients.length;
          _isLoading = false;
        });
      } else {
        // Fallback or if clinic not assigned
        final response = await _petService.getPets(
          page: _currentPage,
          size: _pageSize,
        );
        
        final List<dynamic> content = response['content'] ?? [];
        final pets = content.map((json) => Pet.fromJson(json)).toList();
        
        setState(() {
          _patients = pets;
          _totalPages = response['totalPages'] ?? 1;
          _totalElements = response['totalElements'] ?? 0;
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading patients: $e');
      setState(() {
        _patients = [];
        _isLoading = false;
      });
    }
  }

  List<Pet> get filteredPatients {
    var list = _patients.where((p) {
      final matchesSearch = p.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          (p.ownerName?.toLowerCase().contains(_searchQuery.toLowerCase()) ?? false);
      final matchesFilter = _filter == 'all' ||
          (_filter == 'dogs' && (p.species.toLowerCase().contains('chó') || p.species.toLowerCase() == 'dog')) ||
          (_filter == 'cats' && (p.species.toLowerCase().contains('mèo') || p.species.toLowerCase() == 'cat'));
      return matchesSearch && matchesFilter;
    }).toList();

    // Apply sorting
    switch (_sortBy) {
      case 'name-asc':
        list.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
        break;
      case 'name-desc':
        list.sort((a, b) => b.name.toLowerCase().compareTo(a.name.toLowerCase()));
        break;
      case 'exam-newest':
        // Sort by last exam date if available (placeholder - needs lastExamDate field)
        list.sort((a, b) => a.name.compareTo(b.name)); // Fallback to name
        break;
      case 'exam-oldest':
        list.sort((a, b) => b.name.compareTo(a.name)); // Fallback to name
        break;
    }
    return list;
  }

  IconData _getSpeciesIcon(String species) {
    final s = species.toLowerCase();
    if (s.contains('chó') || s == 'dog') return Icons.pets;
    if (s.contains('mèo') || s == 'cat') return Icons.pets;
    if (s.contains('thỏ') || s == 'rabbit') return Icons.cruelty_free;
    return Icons.pets;
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

  Widget _buildStatusBadge(String? status) {
    if (status == null || status.isEmpty) {
      return const Text(
        'Không có lịch',
        style: TextStyle(
          color: AppColors.stone400,
          fontSize: 11,
          fontStyle: FontStyle.italic,
        ),
      );
    }

    Color color;
    Color bgColor;
    String text = status;

    switch (status) {
      case 'IN_PROGRESS':
        color = Colors.blue;
        bgColor = Colors.blue.withOpacity(0.1);
        text = 'Đang khám';
        break;
      case 'CONFIRMED':
      case 'ASSIGNED': // Vet assigned, waiting for exam
        color = Colors.orange;
        bgColor = Colors.orange.withOpacity(0.1);
        text = 'Chờ khám';
        break;
      case 'COMPLETED':
        color = Colors.green;
        bgColor = Colors.green.withOpacity(0.1);
        text = 'Đã khám';
        break;
      // Other statuses fall through - vets don't see them
      default:
        color = AppColors.stone500;
        bgColor = AppColors.stone100;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.white,
        title: const Text(
          'DANH SÁCH BỆNH NHÂN',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        elevation: 0,
      ),
      body: Column(
        children: [
          // Search & Filter
          Container(
            padding: const EdgeInsets.all(16),
            color: AppColors.white,
            child: Column(
              children: [
                // Search bar
                TextField(
                  onChanged: (v) => setState(() => _searchQuery = v),
                  decoration: InputDecoration(
                    hintText: 'Tìm pet, chủ nuôi...',
                    prefixIcon: const Icon(Icons.search, color: AppColors.stone400),
                    filled: true,
                    fillColor: AppColors.stone100,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
                const SizedBox(height: 12),
                // Filter chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _buildFilterChip('Tất cả', 'all'),
                      const SizedBox(width: 8),
                      _buildFilterChip('Chó', 'dogs'),
                      const SizedBox(width: 8),
                      _buildFilterChip('Mèo', 'cats'),
                      const SizedBox(width: 16),
                      Container(width: 1, height: 24, color: AppColors.stone300),
                      const SizedBox(width: 16),
                      _buildSortChip('Tên A-Z', 'name-asc'),
                      const SizedBox(width: 8),
                      _buildSortChip('Tên Z-A', 'name-desc'),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Patient list
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : filteredPatients.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.pets, size: 64, color: AppColors.stone300),
                            const SizedBox(height: 16),
                            Text(
                              'Chưa có bệnh nhân nào',
                              style: TextStyle(color: AppColors.stone500, fontSize: 16),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadPatients,
                        color: AppColors.primary,
                        child: ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: filteredPatients.length,
                          itemBuilder: (context, index) {
                            final patient = filteredPatients[index];
                            return _buildPatientCard(patient);
                          },
                        ),
                      ),
          ),

          // Pagination info
          if (!_isLoading && _patients.isNotEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.white,
                border: Border(top: BorderSide(color: AppColors.stone200)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Hiển thị ${filteredPatients.length} / $_totalElements bệnh nhân',
                    style: TextStyle(color: AppColors.stone500, fontSize: 13),
                  ),
                  Row(
                    children: [
                      IconButton(
                        onPressed: _currentPage > 0
                            ? () {
                                setState(() => _currentPage--);
                                _loadPatients();
                              }
                            : null,
                        icon: const Icon(Icons.chevron_left),
                        iconSize: 20,
                      ),
                      Text('${_currentPage + 1}/$_totalPages'),
                      IconButton(
                        onPressed: _currentPage < _totalPages - 1
                            ? () {
                                setState(() => _currentPage++);
                                _loadPatients();
                              }
                            : null,
                        icon: const Icon(Icons.chevron_right),
                        iconSize: 20,
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, String value) {
    final isActive = _filter == value;
    return GestureDetector(
      onTap: () => setState(() => _filter = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? AppColors.primary : AppColors.stone100,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? AppColors.stone900 : AppColors.stone200,
            width: 2,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isActive ? AppColors.white : AppColors.stone600,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _buildSortChip(String label, String value) {
    final isActive = _sortBy == value;
    return GestureDetector(
      onTap: () => setState(() => _sortBy = value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? AppColors.primarySurface : AppColors.stone100,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? AppColors.primaryLight : AppColors.stone200,
            width: 2,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.sort,
              size: 14,
              color: isActive ? AppColors.primaryDark : AppColors.stone500,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                color: isActive ? AppColors.primaryDark : AppColors.stone600,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPatientCard(Pet patient) {
    return GestureDetector(
      onTap: () async {
        await Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => PatientDetailScreen(patient: patient),
          ),
        );
        _loadPatients(); // Refresh after returning
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.stone900, width: 2),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
          ],
        ),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: AppColors.stone100,
                borderRadius: BorderRadius.circular(25),
                image: patient.imageUrl != null
                    ? DecorationImage(
                        image: NetworkImage(patient.imageUrl!),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: patient.imageUrl == null
                  ? Center(
                      child: Icon(
                        _getSpeciesIcon(patient.species),
                        size: 24,
                        color: AppColors.stone500,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        patient.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          color: AppColors.stone900,
                        ),
                      ),
                      if (patient.isAssignedToMe) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.blue.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(4),
                            border: Border.all(color: Colors.blue.withOpacity(0.3)),
                          ),
                          child: const Text(
                            'CỦA TÔI',
                            style: TextStyle(
                              color: Colors.blue,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  _buildStatusBadge(patient.bookingStatus),
                  const SizedBox(height: 4),
                  Text(
                    '${patient.species} ${patient.breed} • ${_calculateAge(patient.dateOfBirth)}',
                    style: const TextStyle(
                      color: AppColors.stone500,
                      fontSize: 13,
                    ),
                  ),
                  Text(
                    'Chủ: ${patient.ownerName ?? 'N/A'}',
                    style: const TextStyle(
                      color: AppColors.stone400,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (patient.weight > 0)
                  Text(
                    '${patient.weight} kg',
                    style: const TextStyle(
                      color: AppColors.stone600,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                const Icon(Icons.chevron_right, color: AppColors.stone400),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Staff Patient Detail Screen - With Tabs like Web
class PatientDetailScreen extends StatefulWidget {
  final Pet patient;

  const PatientDetailScreen({super.key, required this.patient});

  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  
  // Future for caching vaccination data
  Future<List<dynamic>>? _vaccinationFuture;
  late Pet _patient;
  String? _currentUserId;

  // Vaccination Form State
  final _vaccinationFormKey = GlobalKey<FormState>();
  final _vaccinationService = VaccinationService();
  final _templateService = VaccineTemplateService();
  List<VaccineTemplate> _templates = [];
  VaccineTemplate? _selectedTemplate;
  final _vaccineDetailNameController = TextEditingController(); // Renamed to avoid conflicts
  String _doseSequence = '1';
  final _notesDetailController = TextEditingController(); // Renamed to avoid conflicts
  DateTime _vaccinationDate = DateTime.now();
  DateTime? _nextDueDate;
  bool _isLoadingTemplates = true;
  bool _isSubmittingVaccination = false;
  bool _showVaccinationForm = true; // Default to true to show management form
  String _vaccinationViewMode = 'list'; // 'list' or 'grid'

  @override
  void initState() {
    super.initState();
    _patient = widget.patient;
    _refreshVaccinationData();
    _tabController = TabController(length: 3, vsync: this);
    _loadCurrentUser();
    _loadTemplates();
  }

  void _refreshVaccinationData() {
    setState(() {
      _vaccinationFuture = Future.wait([
        VaccinationService().getVaccinationsByPet(widget.patient.id),
        VaccinationService().getUpcomingVaccinations(widget.patient.id),
      ]);
    });
  }

  void _showDeleteVaccinationDialog(VaccinationRecord record) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xác nhận xóa'),
        content: Text('Bạn có chắc muốn xóa hồ sơ tiêm "${record.vaccineName}" không?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await _deleteVaccination(record);
            },
            child: const Text('Xóa', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteVaccination(VaccinationRecord record) async {
    try {
      await _vaccinationService.deleteVaccination(record.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã xóa hồ sơ tiêm chủng'), backgroundColor: Colors.green),
        );
        _refreshVaccinationData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _loadCurrentUser() async {
    try {
      final user = await AuthService().getCurrentUser();
      if (mounted) {
        setState(() => _currentUserId = user.userId);
      }
    } catch (e) {
      debugPrint('Error loading user: $e');
    }
  }

  Future<void> _loadTemplates() async {
    try {
      final templates = await _templateService.getTemplates();
      if (mounted) {
        setState(() {
          _templates = templates;
          _isLoadingTemplates = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading templates: $e');
      if (mounted) {
        setState(() => _isLoadingTemplates = false);
      }
    }
  }

  Future<void> _handleSubmitVaccination() async {
    if (_vaccinationFormKey.currentState?.validate() != true) return;

    setState(() => _isSubmittingVaccination = true);

    try {
      final request = CreateVaccinationRequest(
        petId: _patient.id,
        bookingId: _patient.bookingId,
        vaccineName: _selectedTemplate?.name ?? _vaccineDetailNameController.text, // Safe
        vaccinationDate: _vaccinationDate,
        nextDueDate: _nextDueDate,
        notes: _notesDetailController.text.isEmpty ? null : _notesDetailController.text,
        vaccineTemplateId: _selectedTemplate?.id,
        doseSequence: _doseSequence,
        workflowStatus: 'COMPLETED',
      );

      await _vaccinationService.createVaccination(request);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Lưu thông tin tiêm chủng thành công!'), backgroundColor: Colors.green),
        );
        _resetVaccinationForm();
        setState(() {
          _showVaccinationForm = false;
        });
        _refreshVaccinationData();
      }
    } catch (e) {
      if (mounted) {
        String message = e.toString().replaceFirst('Exception: ', '');
        if (message.contains('Lỗi tham số không hợp lệ: ')) {
          message = message.split('Lỗi tham số không hợp lệ: ').last;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi: $message'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSubmittingVaccination = false);
      }
    }
  }

  void _resetVaccinationForm() {
    _selectedTemplate = null;
    _vaccineDetailNameController.clear();
    _notesDetailController.clear();
    _doseSequence = '1';
    _vaccinationDate = DateTime.now();
    _nextDueDate = null;
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
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

  String _getSpeciesLabel(String species) {
    final s = species.toLowerCase();
    if (s.contains('chó') || s == 'dog') return 'Chó';
    if (s.contains('mèo') || s == 'cat') return 'Mèo';
    return species;
  }

  IconData _getSpeciesIconForDetail(String species) {
    final s = species.toLowerCase();
    if (s.contains('chó') || s == 'dog') return Icons.pets;
    if (s.contains('mèo') || s == 'cat') return Icons.pets;
    if (s.contains('thỏ') || s == 'rabbit') return Icons.cruelty_free;
    return Icons.pets;
  }

  String _getGenderVietnamese(String gender) {
    if (gender == 'MALE') return 'Đực';
    if (gender == 'FEMALE') return 'Cái';
    return gender;
  }

  final PetService _petService = PetService();

  void _showEditAllergiesDialog(Pet patient) {
    final controller = TextEditingController(text: patient.allergies ?? '');
    
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cập nhật dị ứng'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Thông tin dị ứng',
            hintText: 'Ví dụ: Dị ứng thuốc kháng sinh...',
            border: OutlineInputBorder(),
          ),
          maxLines: 3,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await _petService.updateAllergies(patient.id, controller.text);
                final updatedPet = await _petService.getPetById(patient.id);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Đã cập nhật thông tin dị ứng!'),
                      backgroundColor: Colors.green,
                    ),
                  );
                  // Refresh page to show update
                  setState(() {
                    _patient = updatedPet;
                  });
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Lỗi: $e'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final patient = _patient;
    
    return Scaffold(
      backgroundColor: AppColors.stone50,
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) => [
          // App Bar
          SliverAppBar(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.white,
            expandedHeight: 290,
            pinned: true,
            flexibleSpace: FlexibleSpaceBar(
              background: _buildHeader(patient),
            ),
            title: innerBoxIsScrolled 
                ? Text(patient.name, style: const TextStyle(fontWeight: FontWeight.w900))
                : null,
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(48),
              child: Container(
                color: AppColors.white,
                child: TabBar(
                  controller: _tabController,
                  isScrollable: true,
                  labelColor: AppColors.primary,
                  unselectedLabelColor: AppColors.stone500,
                  indicatorColor: AppColors.primary,
                  indicatorWeight: 3,
                  labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  tabs: const [
                    Tab(text: 'Lịch sử bệnh án'),
                    Tab(text: 'Tiêm phòng'),
                    Tab(text: 'Tài liệu'),
                  ],
                ),
              ),
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            _buildEmrTab(),
            _buildVaccinationTab(),
            _buildDocumentsTab(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(Pet patient) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 80, 16, 20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.primary, AppColors.primary.withOpacity(0.9)],
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.white, width: 3),
              image: patient.imageUrl != null
                  ? DecorationImage(
                      image: NetworkImage(patient.imageUrl ?? ''),
                      fit: BoxFit.cover,
                    )
                  : null,
            ),
            child: patient.imageUrl == null
                ? Center(
                    child: Icon(
                      _getSpeciesIconForDetail(patient.species),
                      size: 48,
                      color: AppColors.stone500,
                    ),
                  )
                : null,
          ),
          const SizedBox(width: 16),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  patient.name,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: AppColors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Chủ nuôi: ${patient.ownerName ?? 'N/A'}',
                  style: TextStyle(
                    color: AppColors.white.withOpacity(0.9),
                    fontSize: 14,
                  ),
                ),
                if (patient.ownerPhone != null) ...[
                  Text(
                    'SĐT: ${patient.ownerPhone}',
                    style: TextStyle(
                      color: AppColors.white.withOpacity(0.8),
                      fontSize: 13,
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                // Stats row
                Row(
                  children: [
                    _buildStatChip('${patient.species}'),
                    const SizedBox(width: 8),
                    _buildStatChip('${_calculateAge(patient.dateOfBirth)} / ${_getGenderVietnamese(patient.gender)}'),
                    const SizedBox(width: 8),
                    _buildStatChip('${patient.weight} kg'),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _buildStatChip('Giống: ${patient.breed.isNotEmpty ? patient.breed : 'Không rõ'}'),
                    const SizedBox(width: 8),
                    _buildStatChip('Màu: ${patient.color?.isNotEmpty == true ? patient.color! : 'Không rõ'}'),
                  ],
                ),
                if (patient.allergies != null && patient.allergies!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () => _showEditAllergiesDialog(patient),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.red.shade400,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Dị ứng: ${patient.allergies}',
                            style: const TextStyle(
                              color: AppColors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Icon(Icons.edit, size: 12, color: AppColors.white),
                        ],
                      ),
                    ),
                  ),
                ] else ...[
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () => _showEditAllergiesDialog(patient),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.white.withOpacity(0.4)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Thêm dị ứng',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatChip(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: AppColors.white,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildOverviewTab() {
    final patient = widget.patient;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Info cards
          _buildInfoCard('Thông tin thú cưng', [
            _buildInfoRow('Tên', patient.name),
            _buildInfoRow('Loài', patient.species),
            _buildInfoRow('Giống', patient.breed),
            _buildInfoRow('Tuổi', _calculateAge(patient.dateOfBirth)),
            _buildInfoRow('Giới tính', _getGenderVietnamese(patient.gender)),
            _buildInfoRow('Cân nặng', '${patient.weight} kg'),
            _buildInfoRow('Màu lông', patient.color ?? 'N/A'),
          ]),
          
          const SizedBox(height: 16),
          
          _buildInfoCard('Thông tin chủ nuôi', [
            _buildInfoRow('Họ tên', patient.ownerName ?? 'N/A'),
            _buildInfoRow('Số điện thoại', patient.ownerPhone ?? 'N/A'),
          ]),
          
          if (patient.allergies != null && patient.allergies!.isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.red.shade700),
                      const SizedBox(width: 8),
                      Text(
                        'Dị ứng',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                          color: Colors.red.shade700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    patient.allergies!,
                    style: TextStyle(
                      color: Colors.red.shade700,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoCard(String title, List<Widget> children) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 12,
              color: AppColors.stone500,
            ),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: AppColors.stone500,
              fontSize: 14,
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              color: AppColors.stone900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmrTab() {
    return FutureBuilder<List<EmrRecord>>(
      future: EmrService().getEmrsByPetId(widget.patient.id),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          );
        }

        if (snapshot.hasError) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline, size: 48, color: AppColors.stone300),
                const SizedBox(height: 12),
                Text(
                  'Lỗi tải dữ liệu',
                  style: TextStyle(color: AppColors.stone500),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => setState(() {}),
                  child: const Text('Thử lại'),
                ),
              ],
            ),
          );
        }

        final emrs = snapshot.data ?? [];

        return Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Lịch sử bệnh án',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.stone900,
                    ),
                  ),
                  Row(
                    children: [

                      const SizedBox(width: 8),
                      FilledButton.icon(
                        onPressed: () async {
                          final result = await context.push<bool>(
                            '/staff/emr/create/${widget.patient.id}?petName=${Uri.encodeComponent(widget.patient.name)}&petSpecies=${Uri.encodeComponent(widget.patient.species)}${widget.patient.bookingId != null ? '&bookingId=${widget.patient.bookingId}' : ''}${widget.patient.bookingCode != null ? '&bookingCode=${widget.patient.bookingCode}' : ''}',
                          );
                          if (result == true) {
                            setState(() {}); // Refresh EMR list
                          }
                        },
                        icon: const Icon(Icons.add, size: 18),
                        label: const Text('Thêm mới', style: TextStyle(fontWeight: FontWeight.w600)),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary,
                        ),
                      ),

                    ],
                  ),
                ],
              ),
            ),

            // EMR List
            Expanded(
              child: emrs.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.description_outlined,
                            size: 64,
                            color: AppColors.stone300,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Chưa có bệnh án nào',
                            style: TextStyle(
                              color: AppColors.stone500,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton.icon(
                            onPressed: () async {
                              final result = await context.push<bool>(
                                '/staff/emr/create/${widget.patient.id}?petName=${Uri.encodeComponent(widget.patient.name)}&petSpecies=${Uri.encodeComponent(widget.patient.species)}${widget.patient.bookingId != null ? '&bookingId=${widget.patient.bookingId}' : ''}${widget.patient.bookingCode != null ? '&bookingCode=${widget.patient.bookingCode}' : ''}',
                              );
                              if (result == true) {
                                setState(() {}); // Refresh EMR list
                              }
                            },
                            icon: const Icon(Icons.add),
                            label: const Text('Tạo Bệnh án Đầu tiên'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: emrs.length,
                      itemBuilder: (context, index) {
                        return _buildEmrCard(emrs[index]);
                      },
                    ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildEmrCard(EmrRecord emr) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone200),
      ),
      child: InkWell(
        onTap: () {
            context.push('/staff/emr/${emr.id}');
        },
        borderRadius: BorderRadius.circular(16),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.stone50,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              border: Border(bottom: BorderSide(color: AppColors.stone200)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        emr.assessment ?? 'Không có chẩn đoán',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                          color: AppColors.stone900,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${DateFormat('dd/MM/yyyy').format(emr.examinationDate)} • BS. ${emr.staffName ?? 'N/A'}',
                        style: const TextStyle(
                          color: AppColors.stone500,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),

                // Badges Column
                Column(
                   crossAxisAlignment: CrossAxisAlignment.end,
                   children: [
                     // Booking code badge
                     if (emr.bookingCode != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 4),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
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
                              emr.bookingCode ?? '',
                              style: TextStyle(
                                color: Colors.orange.shade700,
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                      ),
                     if (emr.clinicName != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 4),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.primary.withOpacity(0.3)),
                        ),
                        child: Text(
                          'Nguồn: ${emr.clinicName}',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      // Edit/View status
                      // Edit/View status
                // Check 24h lock
                if ((!emr.isLocked && emr.staffId == _currentUserId) && 
                    (DateTime.now().difference(emr.createdAt.isUtc ? emr.createdAt.toLocal() : emr.createdAt).inHours < 24))
                  const SizedBox.shrink() // Editable, no badge needed

                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.stone100,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.stone300),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.lock_outline, size: 10, color: AppColors.stone500),
                        const SizedBox(width: 4),
                        Text('Chỉ được xem', style: TextStyle(fontSize: 10, color: AppColors.stone500, fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                   ],
                ),
              ],
            ),
          ),

          // SOAP Content
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // S - Subjective
                if (emr.subjective != null && emr.subjective!.isNotEmpty)
                  _buildSoapSection('S - CHỦ QUAN', emr.subjective ?? '', Colors.orange),
                
                // A - Assessment
                if (emr.assessment != null)
                  _buildSoapSection('A - CHẨN ĐOÁN', emr.assessment ?? '', Colors.orange),
                
                // O - Objective
                if (emr.objective != null && emr.objective!.isNotEmpty)
                  _buildSoapSection('O - KHÁCH QUAN', emr.objective ?? '', Colors.orange),
                
                // P - Plan
                if (emr.plan != null)
                  _buildSoapSection('P - KẾ HOẠCH', emr.plan ?? '', Colors.orange),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _buildSoapSection(String title, String content, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            content,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.stone700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVaccinationTab() {
    return FutureBuilder<List<dynamic>>(
      future: _vaccinationFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: AppColors.primary));
        }

        if (snapshot.hasError) {
          return Center(child: Text('Lỗi tải dữ liệu: ${snapshot.error}'));
        }

        if (!snapshot.hasData || snapshot.data == null) {
          return const Center(child: Text('Không có dữ liệu'));
        }

        final history = (snapshot.data?[0] as List?)?.cast<VaccinationRecord>() ?? <VaccinationRecord>[];
        final upcoming = (snapshot.data?[1] as List?)?.cast<VaccinationRecord>() ?? <VaccinationRecord>[];



        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Management Form
            _buildEmbeddedVaccinationForm(),
            
            const SizedBox(height: 32),
            

            
            // History Header with Toggle
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Expanded(
                  child: Text(
                    'Lịch Sử Tiêm Chủng',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.stone900),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: AppColors.stone100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      _buildViewToggle('DANH SÁCH', 'list', Icons.list),
                      _buildViewToggle('LỘ TRÌNH (GRID)', 'grid', Icons.grid_view),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // SUGGESTION / UPCOMING SECTION (Placed after Header like Web)
            if (upcoming.isNotEmpty) ...[
              Container(
                margin: const EdgeInsets.only(bottom: 24),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.schedule, size: 20, color: Colors.orange.shade800),
                        const SizedBox(width: 8),
                        Text(
                          'MŨI TIÊM GỢI Ý (DỰ KIẾN)',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            color: Colors.orange.shade900,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: upcoming.map((rec) => _buildSuggestionCard(rec)).toList(),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            if (_vaccinationViewMode == 'grid') ...[
               // Roadmap Header matching Web
               const Padding(
                 padding: EdgeInsets.only(bottom: 12),
                 child: Text(
                   'LỘ TRÌNH TIÊM CHỦNG (ROADMAP)',
                   style: TextStyle(
                     fontSize: 12,
                     fontWeight: FontWeight.w900,
                     color: AppColors.stone500,
                     letterSpacing: 1.0,
                   ),
                 ),
               ),
               VaccinationRoadmapTable(records: history, upcoming: upcoming)
            ] else ...[
              if (history.isEmpty)
                const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('Chưa có lịch sử tiêm chủng', style: TextStyle(color: AppColors.stone400))))
              else
                ...history.reversed.map((rec) => _buildVaccinationHistoryCard(rec)),
            ],
            
            const SizedBox(height: 32),
          ],
        );
      },
    );
  }

  Widget _buildViewToggle(String label, String mode, IconData icon) {
    bool isActive = _vaccinationViewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _vaccinationViewMode = mode),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? AppColors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          boxShadow: isActive ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))] : null,
        ),
        child: Row(
          children: [
            Icon(icon, size: 14, color: isActive ? AppColors.primary : AppColors.stone400),
            const SizedBox(width: 6),
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



  Widget _buildSuggestionCard(VaccinationRecord sug) {
    return GestureDetector(
      onTap: () {
        setState(() {
          _showVaccinationForm = true;
          _doseSequence = sug.doseNumber?.toString() ?? '1';
          if (sug.vaccineTemplateId != null && _templates.isNotEmpty) {
            try {
              _selectedTemplate = _templates.firstWhere((t) => t.id == sug.vaccineTemplateId);
              _vaccineDetailNameController.text = _selectedTemplate!.name;
            } catch (e) {
              _vaccineDetailNameController.text = sug.vaccineName;
            }
          } else {
            _vaccineDetailNameController.text = sug.vaccineName;
          }
          _nextDueDate = sug.nextDueDate;
          _notesDetailController.text = sug.notes ?? '';
        });
        // Optional: Scroll to top of tab to see the form
      },
      child: Container(
        width: 220,
        margin: const EdgeInsets.only(right: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.orange.withOpacity(0.04),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.orange.withOpacity(0.15)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.orange,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'MŨI ${sug.doseNumber ?? 1}',
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                  ),
                ),
                if (sug.nextDueDate != null)
                  Text(
                    DateFormat('dd/MM/yyyy').format(sug.nextDueDate!),
                    style: TextStyle(color: Colors.orange.shade800, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              sug.vaccineName,
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: AppColors.stone900),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (sug.doseNumber != null && sug.doseNumber! > 1)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Dự kiến: Mũi ${sug.doseNumber} (Sau mũi ${(sug.doseNumber ?? 1) - 1})',
                  style: const TextStyle(fontSize: 10, color: AppColors.stone500, fontWeight: FontWeight.normal),
                ),
              ),
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.touch_app_outlined, size: 12, color: AppColors.stone400),
                const SizedBox(width: 4),
                const Text(
                  'Bấm để ghi nhận',
                  style: TextStyle(fontSize: 10, color: AppColors.stone400, fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }



  Widget _buildVaccinationHistoryCard(VaccinationRecord rec) {
    final bool isCompleted = rec.status == 'COMPLETED';
    
    // Calculate validity for "HIỆU LỰC" badge
    bool isValid = isCompleted;
    if (isCompleted && rec.nextDueDate != null) {
      isValid = DateTime.now().isBefore(rec.nextDueDate!);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.stone200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 15,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          // Top Row: Vaccine Info & Status Badge
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            rec.vaccineName,
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: AppColors.stone900),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (isValid)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.green.shade50,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: const BoxDecoration(color: Colors.green, shape: BoxShape.circle),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'HIỆU LỰC',
                                  style: TextStyle(color: Colors.green.shade700, fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    if (rec.doseNumber != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.orange.shade50,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'Mũi ${rec.doseNumber} / ${rec.totalDoses ?? 3}',
                          style: TextStyle(color: Colors.orange.shade800, fontSize: 10, fontWeight: FontWeight.w900),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          
          // Delete Button Row
          Align(
            alignment: Alignment.centerRight,
            child: IconButton(
              icon: const Icon(Icons.delete_outline, color: AppColors.stone400, size: 20),
              onPressed: () => _showDeleteVaccinationDialog(rec),
              tooltip: 'Xóa hồ sơ tiêm',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ),
          
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Divider(height: 1, color: AppColors.stone100),
          ),

          // Middle Row: Dates & Doctor
          Row(
            children: [
              // Dates Info
              Expanded(
                flex: 3,
                child: Row(
                  children: [
                    _buildDateInfo('NGÀY TIÊM', rec.vaccinationDate),
                    const SizedBox(width: 24),
                    if (rec.nextDueDate != null)
                      _buildDateInfo('TÁI CHỦNG', rec.nextDueDate, isProminent: true),
                  ],
                ),
              ),
              // Doctor Bubble
              Expanded(
                flex: 2,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: Colors.orange.shade100,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          rec.staffName.isNotEmpty ? rec.staffName[0].toUpperCase() : '?',
                          style: TextStyle(color: Colors.orange.shade900, fontWeight: FontWeight.w900, fontSize: 14),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        rec.staffName,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.stone700),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          if (rec.notes != null && rec.notes!.isNotEmpty) ...[
             const SizedBox(height: 16),
             Container(
               width: double.infinity,
               padding: const EdgeInsets.all(12),
               decoration: BoxDecoration(
                 color: AppColors.stone50,
                 borderRadius: BorderRadius.circular(12),
               ),
               child: Row(
                 crossAxisAlignment: CrossAxisAlignment.start,
                 children: [
                   const Icon(Icons.notes, size: 14, color: AppColors.stone400),
                   const SizedBox(width: 8),
                   Expanded(
                     child: Text(
                       rec.notes!,
                       style: const TextStyle(fontSize: 12, color: AppColors.stone600, fontStyle: FontStyle.italic),
                     ),
                   ),
                 ],
               ),
             ),
          ],
        ],
      ),
    );
  }

  Widget _buildDateInfo(String label, DateTime? date, {bool isProminent = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: AppColors.stone400, letterSpacing: 0.5),
        ),
        const SizedBox(height: 4),
        Text(
          date != null ? DateFormat('d/M/yyyy').format(date) : '-',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w900,
            color: isProminent ? Colors.orange.shade800 : AppColors.stone800,
          ),
        ),
      ],
    );
  }

  Widget _buildEmbeddedVaccinationForm() {
    if (_isLoadingTemplates) {
      return const Center(child: Padding(
        padding: EdgeInsets.all(20),
        child: CircularProgressIndicator(color: AppColors.primary),
      ));
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.orange.withOpacity(0.15)),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 15, offset: const Offset(0, 8)),
        ],
      ),
      child: Form(
        key: _vaccinationFormKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Form Header with Booking Badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.03),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.add_circle_outline, size: 18, color: Colors.orange),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Ghi Nhận Mũi Tiêm Mới',
                      style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Colors.orange),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (_patient.bookingCode != null)
                    Flexible(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.orange.shade50,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.orange.shade100),
                        ),
                        child: Text(
                          '#${_patient.bookingCode}',
                          style: TextStyle(color: Colors.orange.shade800, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 0.2),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Section 1: Thông tin mũi tiêm
                  const Text('THÔNG TIN MŨI TIÊM', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.stone400, letterSpacing: 0.8)),
                  const SizedBox(height: 12),
                  
                  // Dose Selector Tabs
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: AppColors.stone100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        _buildDoseTab('MŨI 1', '1'),
                        _buildDoseTab('MŨI 2', '2'),
                        _buildDoseTab('MŨI 3', '3'),
                        _buildDoseTab('HÀNG NĂM', 'ANNUAL'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Fields: Vaccine Name + Icon
                  const Text('LOẠI VACCINE *', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.stone600)),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: _showVaccineSelectionSheet,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      decoration: BoxDecoration(
                        color: AppColors.stone50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.stone200),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              _selectedTemplate?.name ?? 'Nhấn để chọn loại vắc-xin',
                              style: TextStyle(
                                fontSize: 14,
                                color: _selectedTemplate != null ? AppColors.stone900 : AppColors.stone400,
                                fontWeight: _selectedTemplate != null ? FontWeight.w600 : FontWeight.normal,
                              ),
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Colors.orange.shade50,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.list_alt, color: Colors.orange, size: 18),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Fields: Ngày tiêm & Tái chủng (Row)
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('NGÀY TIÊM *', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.stone600)),
                            const SizedBox(height: 8),
                            _buildFieldDatePickerTile(
                              date: _vaccinationDate,
                              onTap: () => _selectEmbeddedDate(context, false),
                              icon: Icons.calendar_today,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('TÁI CHỦNG (DỰ KIẾN)', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.stone600)),
                            const SizedBox(height: 8),
                            _buildFieldDatePickerTile(
                              date: _nextDueDate,
                              onTap: () => _selectEmbeddedDate(context, true),
                              icon: Icons.history,
                              placeholder: 'dd/mm/yyyy',
                              isNullable: true,
                              onClear: () => setState(() => _nextDueDate = null),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Notes
                  const Text('GHI CHÚ / PHẢN ỨNG', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppColors.stone600)),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _notesDetailController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'Ghi chú thêm về phản ứng sau tiêm, số lô thuốc...',
                      hintStyle: const TextStyle(fontSize: 12, color: AppColors.stone400),
                      filled: true,
                      fillColor: AppColors.stone50,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.stone200)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.stone200)),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Submit Button (Aligned Right like web)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      ElevatedButton(
                        onPressed: _isSubmittingVaccination ? null : _handleSubmitVaccination,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.orange.shade800,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        child: _isSubmittingVaccination
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: AppColors.white, strokeWidth: 2))
                            : const Text('LƯU HỒ SƠ', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDoseTab(String label, String value) {
    bool isSelected = _doseSequence == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _doseSequence = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            boxShadow: isSelected ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 2))] : null,
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: isSelected ? Colors.orange.shade800 : AppColors.stone500,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFieldDatePickerTile({
    required DateTime? date,
    required VoidCallback onTap,
    required IconData icon,
    String? placeholder,
    bool isNullable = false,
    VoidCallback? onClear,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: AppColors.stone50,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.stone200),
        ),
        child: Row(
          children: [
            Icon(icon, color: AppColors.stone400, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                date != null ? DateFormat('dd/MM/yyyy').format(date) : (placeholder ?? 'Chọn ngày'),
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: date != null ? FontWeight.w900 : FontWeight.normal,
                  color: date != null ? AppColors.stone900 : AppColors.stone400,
                ),
              ),
            ),
            if (isNullable && date != null && onClear != null)
              GestureDetector(
                onTap: () {
                   onClear();
                },
                child: const Icon(Icons.close, size: 16, color: AppColors.stone400)
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _selectEmbeddedDate(BuildContext context, bool isNextDue) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: isNextDue ? (_nextDueDate ?? DateTime.now().add(const Duration(days: 21))) : _vaccinationDate,
      firstDate: isNextDue ? DateTime.now() : DateTime(2000),
      lastDate: isNextDue ? DateTime.now().add(const Duration(days: 365 * 2)) : DateTime.now().add(const Duration(days: 30)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(primary: AppColors.primary),
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
          final template = _selectedTemplate;
          if (template != null) {
            final days = template.repeatIntervalDays;
            if (days != null && days > 0) {
              _nextDueDate = picked.add(Duration(days: days));
            } else if (template.isAnnualRepeat == true) {
              _nextDueDate = DateTime(picked.year + 1, picked.month, picked.day);
            }
          }
        }
      });
    }
  }

  void _showVaccineSelectionSheet() {
    if (_templates.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Danh sách vắc-xin trống. Đang tải lại...')),
      );
      _loadTemplates();
      return;
    }

    String searchQuery = '';
    
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final filteredTemplates = _templates.where((t) => 
            t.name.toLowerCase().contains(searchQuery.toLowerCase()) ||
            (t.description?.toLowerCase().contains(searchQuery.toLowerCase()) ?? false)
          ).toList();

          return Container(
            height: MediaQuery.of(context).size.height * 0.8,
            decoration: const BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: AppColors.stone200, borderRadius: BorderRadius.circular(2)),
                ),
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('DANH SÁCH VẮC-XIN', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: AppColors.stone900, letterSpacing: 0.5)),
                      Text('${filteredTemplates.length} loại', style: const TextStyle(fontSize: 11, color: AppColors.stone400)),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 0),
                  child: TextFormField(
                    decoration: InputDecoration(
                      hintText: 'Tìm kiếm tên vắc-xin...',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      filled: true,
                      fillColor: AppColors.stone50,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(vertical: 0),
                    ),
                    onChanged: (val) {
                      setSheetState(() => searchQuery = val);
                    },
                  ),
                ),
                const SizedBox(height: 16),
                const Divider(height: 1),
                Expanded(
                  child: filteredTemplates.isEmpty 
                    ? const Center(child: Text('Không tìm thấy vắc-xin phù hợp', style: TextStyle(color: AppColors.stone400)))
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: filteredTemplates.length,
                        separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.stone100),
                        itemBuilder: (context, index) {
                          final t = filteredTemplates[index];
                          bool isSelected = _selectedTemplate?.id == t.id;
                          return ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            title: Text(t.name, style: TextStyle(fontSize: 14, fontWeight: isSelected ? FontWeight.w900 : FontWeight.normal, color: isSelected ? Colors.orange.shade800 : AppColors.stone900)),
                            subtitle: Text(t.description ?? 'Thông tin vắc-xin', style: const TextStyle(fontSize: 11, color: AppColors.stone400)),
                            trailing: isSelected ? const Icon(Icons.check_circle, color: Colors.orange, size: 20) : const Icon(Icons.chevron_right, size: 18, color: AppColors.stone300),
                            onTap: () {
                              setState(() {
                                _selectedTemplate = t;
                                _vaccineDetailNameController.text = t.name;
                                // Auto-calculate next due date
                                if (t.repeatIntervalDays != null && t.repeatIntervalDays! > 0) {
                                  _nextDueDate = _vaccinationDate.add(Duration(days: t.repeatIntervalDays!));
                                } else if (t.isAnnualRepeat == true) {
                                  _nextDueDate = DateTime(_vaccinationDate.year + 1, _vaccinationDate.month, _vaccinationDate.day);
                                }
                              });
                              Navigator.pop(context);
                            },
                          );
                        },
                      ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildLabTab() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.science_outlined, size: 64, color: AppColors.stone300),
          const SizedBox(height: 16),
          Text(
            'Đang phát triển...',
            style: TextStyle(color: AppColors.stone500, fontSize: 16),
          ),
        ],
      ),
    );
  }

  Widget _buildDocumentsTab() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.folder_outlined, size: 64, color: AppColors.stone300),
          const SizedBox(height: 16),
          Text(
            'Đang phát triển...',
            style: TextStyle(color: AppColors.stone500, fontSize: 16),
          ),
        ],
      ),
    );
  }
}
