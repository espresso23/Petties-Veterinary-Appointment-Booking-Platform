import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/models/emr.dart';
import '../../../data/models/pet.dart';
import '../../../data/services/emr_service.dart';
import '../../../data/services/pet_service.dart';
import '../../../data/services/auth_service.dart';

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
                    ],
                  ),
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
  late Pet _patient;
  String? _currentUserId;

  @override
  void initState() {
    super.initState();
    _patient = widget.patient;
    _tabController = TabController(length: 3, vsync: this);
    _loadCurrentUser();
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
                      image: NetworkImage(patient.imageUrl!),
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
                    _buildStatChip(patient.breed.isNotEmpty ? patient.breed : 'Giống: Không rõ'),
                    const SizedBox(width: 8),
                    _buildStatChip(patient.color?.isNotEmpty == true ? patient.color! : 'Màu: Không rõ'),
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
                            '/staff/emr/create/${widget.patient.id}?petName=${Uri.encodeComponent(widget.patient.name)}&petSpecies=${Uri.encodeComponent(widget.patient.species)}',
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
                                '/staff/emr/create/${widget.patient.id}?petName=${Uri.encodeComponent(widget.patient.name)}&petSpecies=${Uri.encodeComponent(widget.patient.species)}',
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
                  _buildSoapSection('S - CHỦ QUAN', emr.subjective!, Colors.orange),
                
                // A - Assessment
                if (emr.assessment != null)
                  _buildSoapSection('A - CHẨN ĐOÁN', emr.assessment!, Colors.orange),
                
                // O - Objective
                if (emr.objective != null && emr.objective!.isNotEmpty)
                  _buildSoapSection('O - KHÁCH QUAN', emr.objective!, Colors.orange),
                
                // P - Plan
                if (emr.plan != null)
                  _buildSoapSection('P - KẾ HOẠCH', emr.plan!, Colors.orange),
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
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.vaccines_outlined, size: 64, color: AppColors.stone300),
          const SizedBox(height: 16),
          Text(
            'Đang phát triển...',
            style: TextStyle(color: AppColors.stone500, fontSize: 16),
          ),
        ],
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
