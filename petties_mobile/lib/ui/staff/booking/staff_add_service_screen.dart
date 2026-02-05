import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/services/booking_service.dart';
import '../../../data/models/clinic_service.dart';

class StaffAddServiceScreen extends StatefulWidget {
  final String bookingId;
  final String clinicId;

  const StaffAddServiceScreen({
    super.key,
    required this.bookingId,
    required this.clinicId,
  });

  @override
  State<StaffAddServiceScreen> createState() => _StaffAddServiceScreenState();
}

class _StaffAddServiceScreenState extends State<StaffAddServiceScreen> {
  final BookingService _bookingService = BookingService();
  List<ClinicServiceModel> _services = [];
  List<ClinicServiceModel> _filteredServices = [];
  bool _isLoading = true;
  String? _error;
  String _searchQuery = '';
  String _selectedCategory = 'Tất cả';

  final _currencyFormat = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: 'đ',
    decimalDigits: 0,
  );

  @override
  void initState() {
    super.initState();
    _fetchServices();
  }

  Future<void> _fetchServices() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final services =
          await _bookingService.getAvailableServicesForAddOn(widget.clinicId);
      setState(() {
        _services = services;
        _applyFilters();
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Không thể tải danh sách dịch vụ: $e';
        _isLoading = false;
      });
    }
  }

  void _applyFilters() {
    setState(() {
      _filteredServices = _services.where((service) {
        final matchesSearch =
            service.name.toLowerCase().contains(_searchQuery.toLowerCase());
        final matchesCategory = _selectedCategory == 'Tất cả' ||
            service.serviceCategory == _selectedCategory;
        return matchesSearch && matchesCategory;
      }).toList();
    });
  }

  Future<void> _handleAddService(ClinicServiceModel service) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Xác nhận thêm'),
        content: Text(
            'Bạn có chắc chắn muốn thêm dịch vụ "${service.name}" vào lịch hẹn này không?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Thêm'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isLoading = true);
    try {
      await _bookingService.addServiceToBooking(
          widget.bookingId, service.serviceId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã thêm dịch vụ thành công'),
            backgroundColor: Colors.green,
          ),
        );
        context.pop(true); // Return to detail screen and signal refresh
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi khi thêm dịch vụ: $e'),
            backgroundColor: Colors.red,
          ),
        );
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Get unique categories
    final categories = [
      'Tất cả',
      ..._services.map((s) => s.serviceCategory ?? 'Khác').toSet()
    ];

    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        title: const Text('Thêm dịch vụ phát sinh',
            style: TextStyle(
                color: AppColors.stone900, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.stone900),
          onPressed: () => context.pop(),
        ),
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              onChanged: (value) {
                _searchQuery = value;
                _applyFilters();
              },
              decoration: InputDecoration(
                hintText: 'Tìm kiếm dịch vụ...',
                prefixIcon: const Icon(Icons.search),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.stone200),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.stone200),
                ),
              ),
            ),
          ),

          // Category Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: categories.map((cat) {
                final isSelected = _selectedCategory == cat;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(cat),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() {
                        _selectedCategory = cat;
                        _applyFilters();
                      });
                    },
                    selectedColor: AppColors.primarySurface,
                    checkmarkColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color:
                          isSelected ? AppColors.primary : AppColors.stone600,
                      fontWeight:
                          isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          const SizedBox(height: 16),

          // Services List
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.primary))
                : _error != null
                    ? Center(
                        child: Text(_error!,
                            style: const TextStyle(color: Colors.red)))
                    : _filteredServices.isEmpty
                        ? const Center(
                            child: Text('Không tìm thấy dịch vụ nào'))
                        : ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _filteredServices.length,
                            itemBuilder: (context, index) {
                              final service = _filteredServices[index];
                              return Card(
                                margin: const EdgeInsets.only(bottom: 12),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12)),
                                child: ListTile(
                                  contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 16, vertical: 8),
                                  title: Text(service.name,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold)),
                                  subtitle: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(service.serviceCategory ?? 'Khác',
                                          style: const TextStyle(fontSize: 12)),
                                      const SizedBox(height: 4),
                                      Text('${service.durationMinutes} phút',
                                          style: TextStyle(
                                              color: AppColors.stone500,
                                              fontSize: 12)),
                                    ],
                                  ),
                                  trailing: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                          _currencyFormat
                                              .format(service.basePrice),
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              color: AppColors.primary)),
                                      const SizedBox(height: 4),
                                      const Icon(Icons.add_circle_outline,
                                          color: AppColors.primary),
                                    ],
                                  ),
                                  onTap: () => _handleAddService(service),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
