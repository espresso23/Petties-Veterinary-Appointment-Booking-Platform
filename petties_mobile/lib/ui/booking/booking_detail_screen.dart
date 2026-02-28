import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/booking.dart';
import '../../utils/format_utils.dart';
import 'package:url_launcher/url_launcher.dart';

class AppointmentDetailScreen extends StatelessWidget {
  final BookingResponse booking;

  const AppointmentDetailScreen({super.key, required this.booking});

  Future<void> _makePhoneCall(String phoneNumber) async {
    final Uri launchUri = Uri(
      scheme: 'tel',
      path: phoneNumber,
    );
    if (await canLaunchUrl(launchUri)) {
      await launchUrl(launchUri);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: _buildAppBar(context),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildStatusHeader(booking.status),
                  const SizedBox(height: 20),
                  _buildClinicCard(context),
                  const SizedBox(height: 16),
                  // Show staff info if any staff is assigned (from booking or services)
                  if (_hasAssignedStaff()) ...[
                    _buildStaffCard(),
                    const SizedBox(height: 16),
                  ],
                  _buildTimeCard(),
                  const SizedBox(height: 16),
                  _buildPetsList(),
                  const SizedBox(height: 16),
                  if (booking.notes != null && booking.notes!.isNotEmpty) ...[
                    _buildNotesCard(),
                    const SizedBox(height: 16),
                  ],
                  _buildTotalCard(),
                ],
              ),
            ),
          ),
          _buildBottomBar(context),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: AppColors.white,
      elevation: 0,
      leading: GestureDetector(
        onTap: () => Navigator.of(context).pop(),
        child: Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            border: Border.all(color: AppColors.stone300),
            borderRadius: BorderRadius.circular(8),
          ),
          child:
              const Icon(Icons.arrow_back, color: AppColors.stone900, size: 20),
        ),
      ),
      title: const Text(
        'CHI TIẾT LỊCH HẸN',
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w800,
          color: AppColors.stone900,
          letterSpacing: 0.5,
        ),
      ),
      centerTitle: true,
    );
  }

  Widget _buildStatusHeader(String? status) {
    Color color;
    String label;
    IconData icon;

    switch (status) {
      case 'PENDING':
        color = Colors.orange;
        label = 'CHỜ XÁC NHẬN';
        icon = Icons.hourglass_top;
        break;
      case 'CONFIRMED':
      case 'ASSIGNED':
        color = Colors.blue;
        label = 'ĐÃ XÁC NHẬN';
        icon = Icons.check_circle;
        break;
      case 'IN_PROGRESS':
        color = Colors.purple;
        label = 'ĐANG DIỄN RA';
        icon = Icons.play_circle_filled;
        break;
      case 'COMPLETED':
        color = Colors.green;
        label = 'HOÀN THÀNH';
        icon = Icons.task_alt;
        break;
      case 'CANCELLED':
      case 'REJECTED':
      case 'NO_SHOW':
        color = Colors.red;
        label = 'ĐÃ HỦY';
        icon = Icons.cancel;
        break;
      default:
        color = Colors.grey;
        label = status ?? 'UNKNOWN';
        icon = Icons.info;
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: color,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Mã: ${booking.bookingCode ?? "---"}',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.stone600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClinicCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'PHÒNG KHÁM',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.stone500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.stone100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child:
                    const Icon(Icons.local_hospital, color: AppColors.stone500),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      booking.clinicName ?? '',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.stone900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    // Contact button if phone is available
                    if (booking.clinicPhone != null)
                      GestureDetector(
                        onTap: () => _makePhoneCall(booking.clinicPhone!),
                        child: Row(
                          children: [
                            const Icon(Icons.phone,
                                size: 14, color: AppColors.info),
                            const SizedBox(width: 4),
                            Text(
                              booking.clinicPhone!,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.info,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(width: 16),
                            // Chat options
                            GestureDetector(
                              onTap: () {
                                if (booking.clinicId != null) {
                                  context.push(Uri(
                                      path: '/chat/detail',
                                      queryParameters: {
                                        'clinicId': booking.clinicId
                                      }).toString());
                                }
                              },
                              child: Row(
                                children: [
                                  const Icon(Icons.chat_bubble_rounded,
                                      size: 14, color: AppColors.primary),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Nhắn tin',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Check if any staff is assigned to this booking
  bool _hasAssignedStaff() {
    // Check main booking staff
    if (booking.assignedStaffName != null &&
        booking.assignedStaffName!.isNotEmpty) {
      return true;
    }
    // Check service-level staff
    return booking.services.any((s) =>
        s.assignedStaffId != null &&
        s.assignedStaffName != null &&
        s.assignedStaffName!.isNotEmpty);
  }

  /// Get unique staff from all services
  List<Map<String, String?>> _getUniqueStaff() {
    final Map<String, Map<String, String?>> staffMap = {};

    // First, add the main assigned staff if exists
    if (booking.assignedStaffName != null &&
        booking.assignedStaffName!.isNotEmpty) {
      final staffId = 'main'; // placeholder for main staff
      staffMap[staffId] = {
        'name': booking.assignedStaffName,
        'avatarUrl': booking.assignedStaffAvatarUrl,
      };
    }

    // Then add staff from services (they may override or add new staff)
    for (final service in booking.services) {
      if (service.assignedStaffId != null &&
          service.assignedStaffName != null) {
        staffMap[service.assignedStaffId!] = {
          'name': service.assignedStaffName,
          'avatarUrl': service.assignedStaffAvatarUrl,
        };
      }
    }

    return staffMap.values.toList();
  }

  Widget _buildStaffCard() {
    final staffList = _getUniqueStaff();

    if (staffList.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            staffList.length > 1
                ? 'NHÂN VIÊN PHỤ TRÁCH'
                : 'NHÂN VIÊN PHỤ TRÁCH',
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.stone500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),
          ...staffList.map((staff) => Padding(
                padding:
                    EdgeInsets.only(bottom: staffList.last == staff ? 0 : 12),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundImage: staff['avatarUrl'] != null
                          ? NetworkImage(staff['avatarUrl']!)
                          : null,
                      backgroundColor: AppColors.infoLight,
                      child: staff['avatarUrl'] == null
                          ? const Icon(Icons.medical_services,
                              color: AppColors.info, size: 20)
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        staff['name'] ?? '',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: AppColors.stone900,
                        ),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildTimeCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'THỜI GIAN',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.stone500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.calendar_today,
                      size: 18, color: AppColors.stone500),
                  const SizedBox(width: 8),
                  Text(
                    _formatDateString(booking.bookingDate),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.stone900,
                    ),
                  ),
                ],
              ),
              Container(height: 20, width: 1, color: AppColors.stone200),
              Row(
                children: [
                  const Icon(Icons.access_time,
                      size: 18, color: AppColors.stone500),
                  const SizedBox(width: 8),
                  Text(
                    _formatTime(booking.bookingTime),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.stone900,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPetsList() {
    if (booking.pets.isEmpty) {
      // Fallback for old data or if pets list is empty but pet info is in root
      return Column(
        children: [
          _buildPetCard(
            booking.petName,
            booking.petSpecies,
            booking.petWeight,
            booking.petPhotoUrl,
          ),
          const SizedBox(height: 16),
          _buildServicesCard(booking.services),
        ],
      );
    }

    return Column(
      children: booking.pets.map((pet) {
        // Try to get details from root if this is the primary pet
        String? species;
        double? weight;
        String? photoUrl;

        if (pet.petId == booking.petId) {
          species = booking.petSpecies;
          weight = booking.petWeight;
          photoUrl = booking.petPhotoUrl;
        }

        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
            children: [
              _buildPetCard(
                pet.petName,
                species,
                weight,
                photoUrl,
              ),
              const SizedBox(height: 8),
              _buildServicesCard(pet.services),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildPetCard(
      String? name, String? species, double? weight, String? photoUrl) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundImage: photoUrl != null ? NetworkImage(photoUrl) : null,
            backgroundColor: AppColors.stone200,
            child: photoUrl == null
                ? const Icon(Icons.pets, color: AppColors.stone400)
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'THÚ CƯNG',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone500,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  name ?? '',
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone900,
                  ),
                ),
                if (species != null || weight != null)
                  Text(
                    '${species ?? ''} ${species != null && weight != null ? '•' : ''} ${weight != null ? '$weight kg' : ''}',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.stone500,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildServicesCard(List<BookingServiceItem> services) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'DỊCH VỤ',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone500,
                  letterSpacing: 0.5,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.teal600,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${services.length} dịch vụ',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (services.isEmpty)
            const Text('Chưa có dịch vụ',
                style: TextStyle(color: AppColors.stone500)),
          ...services.map((service) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            service.serviceName ?? '',
                            style: const TextStyle(
                              fontSize: 14,
                              color: AppColors.stone700,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Text(
                          FormatUtils.formatCurrency(service.price ?? 0),
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.stone900,
                          ),
                        ),
                      ],
                    ),
                    if (service.scheduledStartTime != null &&
                        service.scheduledEndTime != null)
                      Text(
                        '${_formatTime(service.scheduledStartTime)} - ${_formatTime(service.scheduledEndTime)}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.stone500,
                        ),
                      ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildNotesCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'GHI CHÚ',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.stone500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            booking.notes!,
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.stone700,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'TỔNG CỘNG',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.stone700,
            ),
          ),
          Text(
            FormatUtils.formatCurrency(booking.totalPrice ?? 0),
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppColors.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar(BuildContext context) {
    if (booking.status == 'PENDING') {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(
          color: AppColors.white,
          border: Border(top: BorderSide(color: AppColors.stone200)),
        ),
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () {
              Navigator.pop(context, 'CANCEL');
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.white,
              foregroundColor: AppColors.coral,
              side: const BorderSide(color: AppColors.coral, width: 2),
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: const Text('HỦY LỊCH HẸN',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ),
      );
    } else if (['CANCELLED', 'REJECTED', 'NO_SHOW', 'COMPLETED']
        .contains(booking.status)) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(
          color: AppColors.white,
          border: Border(top: BorderSide(color: AppColors.stone200)),
        ),
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () {
              if (booking.clinicId != null) {
                context.push('/booking/${booking.clinicId}/pet');
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: AppColors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: const Text('ĐẶT LẠI',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  String _formatDateString(String? dateStr) {
    if (dateStr == null) return '-';
    try {
      final date = DateTime.parse(dateStr);
      return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
    } catch (e) {
      return dateStr;
    }
  }

  String _formatTime(String? timeStr) {
    if (timeStr == null) return '';
    if (timeStr.length >= 5) {
      return timeStr.substring(0, 5);
    }
    return timeStr;
  }
}
