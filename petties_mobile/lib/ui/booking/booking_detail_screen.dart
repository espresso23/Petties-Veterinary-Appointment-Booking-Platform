import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/booking.dart';
import '../../data/services/qr_payment_service.dart';
import '../../data/services/booking_service.dart';
import '../../data/services/voucher_service.dart';
import '../../utils/format_utils.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../routing/app_routes.dart';
import 'components/voucher_picker_bottom_sheet.dart';

class AppointmentDetailScreen extends StatefulWidget {
  final BookingResponse booking;

  const AppointmentDetailScreen({super.key, required this.booking});

  @override
  State<AppointmentDetailScreen> createState() =>
      _AppointmentDetailScreenState();
}

class _AppointmentDetailScreenState extends State<AppointmentDetailScreen> {
  final QrPaymentService _qrPaymentService = QrPaymentService();
  final BookingService _bookingService = BookingService();

  // Voucher state
  VoucherModel? _selectedVoucher;

  // Getter cũ thay thế bằng state property
  late BookingResponse _booking;
  bool _isLoadingVoucher = false;

  @override
  void initState() {
    super.initState();
    _booking = widget.booking;
  }

  // Getter để các method khác không phải sửa lại chữ booking
  BookingResponse get booking => _booking;

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
        onTap: () {
          if (context.canPop()) {
            context.pop();
          } else {
            context.go(AppRoutes.petOwnerHome);
          }
        },
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
        color = Colors.blue;
        label = 'Đà XÁC NHẬN';
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
        color = Colors.red;
        label = 'Đà HỦY';
        icon = Icons.cancel;
        break;
      case 'NO_SHOW':
        color = Colors.red;
        label = 'KHÔNG ĐẾN';
        icon = Icons.person_off;
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
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        label,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: color,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Wrap(
                        alignment: WrapAlignment.end,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          if (booking.paymentMethod != null)
                            _buildPaymentMethodText(booking.paymentMethod!),
                          if (booking.paymentStatus != null)
                            _buildPaymentBadge(booking.paymentStatus!),
                        ],
                      ),
                    ),
                  ],
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

    // Collect staff from services first (they have actual staffId)
    for (final service in booking.services) {
      if (service.assignedStaffId != null &&
          service.assignedStaffName != null &&
          service.assignedStaffName!.isNotEmpty) {
        staffMap[service.assignedStaffId!] = {
          'name': service.assignedStaffName,
          'avatarUrl': service.assignedStaffAvatarUrl,
        };
      }
    }

    // Only add main staff if no service-level staff found
    // OR if main staff is different from service staff (check by name)
    if (staffMap.isEmpty &&
        booking.assignedStaffName != null &&
        booking.assignedStaffName!.isNotEmpty) {
      staffMap['main'] = {
        'name': booking.assignedStaffName,
        'avatarUrl': booking.assignedStaffAvatarUrl,
      };
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
    final bool hasSosFee = (booking.sosFee ?? 0) > 0;
    final bool hasDistanceFee = (booking.distanceFee ?? 0) > 0;
    final double originalTotal = booking.totalPrice ?? 0;

    // Use selected voucher discount if available, otherwise use booking's discount
    final double discountAmount =
        _selectedVoucher?.discountAmount ?? booking.discountAmount ?? 0;
    final double finalTotal = _selectedVoucher != null
        ? (originalTotal - discountAmount).clamp(0, double.infinity)
        : (booking.finalPrice ?? originalTotal);

    final bool canUseVoucher = booking.clinicId != null &&
        originalTotal > 0 &&
        ['PENDING', 'CONFIRMED', 'IN_PROGRESS'].contains(booking.status) &&
        booking.paymentStatus != 'PAID';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        children: [
          if (hasSosFee || hasDistanceFee) ...[
            if (booking.services.isNotEmpty) ...[
              _buildFeeRow(
                'Phí dịch vụ',
                booking.services
                    .fold(0.0, (sum, item) => sum + (item.price ?? 0)),
              ),
              const SizedBox(height: 8),
            ],
            if (hasSosFee) ...[
              _buildFeeRow('Phí cấp cứu SOS', booking.sosFee!),
              const SizedBox(height: 8),
            ],
            if (hasDistanceFee) ...[
              _buildFeeRow('Phí di chuyển', booking.distanceFee!),
              const SizedBox(height: 8),
            ],
            const Divider(height: 24),
          ],
          // Voucher section
          if (canUseVoucher) ...[
            _buildVoucherRow(context, originalTotal),
            if (discountAmount > 0) ...[
              const SizedBox(height: 8),
              _buildFeeRow('Giảm voucher', -discountAmount),
            ],
            const Divider(height: 24),
          ],

          // Show voucher row even if canUseVoucher is false but booking has a voucher applied
          if (!canUseVoucher && discountAmount > 0) ...[
            _buildFeeRow('Giảm voucher', -discountAmount),
            const Divider(height: 24),
          ],
          Row(
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
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (discountAmount > 0) ...[
                    Text(
                      FormatUtils.formatCurrency(originalTotal),
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.stone400,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                    const SizedBox(height: 2),
                  ],
                  Text(
                    FormatUtils.formatCurrency(finalTotal),
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
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

  Widget _buildVoucherRow(BuildContext context, double orderAmount) {
    if (_isLoadingVoucher) {
      return const Center(
          child: Padding(
              padding: EdgeInsets.all(8.0),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )));
    }
    return GestureDetector(
      onTap: () async {
        if (booking.clinicId == null) return;
        // Lấy payment method + service categories để filter voucher phù hợp
        final paymentMethod = _resolvePaymentMethod(booking);
        final serviceCategories = booking.services
            .where((s) => s.serviceCategory != null)
            .map((s) => s.serviceCategory!)
            .toSet()
            .toList();
        final dynamic picked = await VoucherPickerBottomSheet.show(
          context: context,
          clinicId: booking.clinicId!,
          orderAmount: orderAmount,
          selectedVoucherId: _selectedVoucher?.voucherId ?? booking.voucherId,
          paymentMethod: paymentMethod,
          serviceCategories: serviceCategories,
        );

        if (!mounted || picked == null) return;

        bool shouldApply = false;
        String? targetVoucherId;

        if (picked == false) {
          // Explicit clear
          if (_selectedVoucher != null || booking.voucherId != null) {
            shouldApply = true;
            targetVoucherId = null;
          }
        } else if (picked is VoucherModel) {
          if (picked.voucherId !=
              (_selectedVoucher?.voucherId ?? booking.voucherId)) {
            shouldApply = true;
            targetVoucherId = picked.voucherId;
          }
        }

        if (shouldApply) {
          setState(() {
            _isLoadingVoucher = true;
          });
          try {
            final updatedBooking = await _bookingService.applyVoucher(
                booking.bookingId!, targetVoucherId);
            if (mounted) {
              setState(() {
                _selectedVoucher = picked is VoucherModel ? picked : null;
                _booking = updatedBooking;
              });
            }
          } catch (e) {
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Lỗi áp dụng voucher: ${e.toString()}')),
              );
            }
          } finally {
            if (mounted) {
              setState(() {
                _isLoadingVoucher = false;
              });
            }
          }
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: (_selectedVoucher != null || booking.voucherId != null)
              ? AppColors.primaryBackground
              : AppColors.stone50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: (_selectedVoucher != null || booking.voucherId != null)
                ? AppColors.primary
                : AppColors.stone300,
          ),
        ),
        child: Row(
          children: [
            Icon(
              Icons.local_offer_rounded,
              size: 18,
              color: (_selectedVoucher != null || booking.voucherId != null)
                  ? AppColors.primary
                  : AppColors.stone400,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                _selectedVoucher != null
                    ? '${_selectedVoucher!.code} - ${_selectedVoucher!.discountLabel}'
                    : (booking.voucherId != null
                        ? 'Voucher đã áp dụng'
                        : 'Chọn voucher giảm giá'),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _selectedVoucher != null
                      ? AppColors.primary
                      : AppColors.stone500,
                ),
              ),
            ),
            const Icon(Icons.chevron_right,
                size: 18, color: AppColors.stone400),
          ],
        ),
      ),
    );
  }

  Widget _buildFeeRow(String label, double amount) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            color: AppColors.stone600,
          ),
        ),
        Text(
          FormatUtils.formatCurrency(amount),
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: AppColors.stone900,
          ),
        ),
      ],
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
      final showQrButton = _shouldShowQrButton();
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(
          color: AppColors.white,
          border: Border(top: BorderSide(color: AppColors.stone200)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (showQrButton) ...[
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _handleQrPaymentTap(context),
                  icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
                  label: const Text(
                    'THANH TOÁN QR',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amber.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
            SizedBox(
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
          ],
        ),
      );
    } else if (booking.type == 'SOS' &&
        ['CONFIRMED', 'IN_PROGRESS'].contains(booking.status)) {
      // For SOS, if it's confirmed or in progress (moving), check if it can be cancelled
      // It can be cancelled if arrivedAt is null (still on the way)
      final bool canTrack = booking.arrivedAt == null;
      final bool canCancel =
          booking.status == 'CONFIRMED' || (booking.arrivedAt == null);

      return Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(
          color: AppColors.white,
          border: Border(top: BorderSide(color: AppColors.stone200)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (canTrack)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    context.push(
                      AppRoutes.sosTracking
                          .replaceFirst(':bookingId', booking.bookingId ?? ''),
                      extra: booking,
                    );
                  },
                  icon: const Icon(Icons.location_on, color: Colors.white),
                  label: const Text('THEO DÕI BÁC SĨ',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.coral,
                    foregroundColor: AppColors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              )
            else
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                decoration: BoxDecoration(
                  color: AppColors.successLight,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.successDark.withValues(alpha: 0.2),
                  ),
                ),
                child: const Text(
                  'Nhân viên đã đến nơi. Vui lòng theo dõi cập nhật trực tiếp trong chi tiết lịch hẹn.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.successDark,
                  ),
                ),
              ),
            if (canCancel) ...[
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () {
                    Navigator.pop(context, 'CANCEL');
                  },
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.stone500,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text(
                    'HỦY LỊCH HẸN KHẨN CẤP',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }
    // Hiển thị nút thanh toán (QR hoặc Tiền mặt) theo PAYMENT STATUS (PAID thì ẩn)
    final showQrButton = _shouldShowQrButton();
    final showCashButton = _shouldShowCashPaymentButton();

    if (showQrButton || showCashButton) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(
          color: AppColors.white,
          border: Border(top: BorderSide(color: AppColors.stone200)),
        ),
        child: Column(
          children: [
            if (showQrButton)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _handleQrPaymentTap(context),
                  icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
                  label: const Text(
                    'THANH TOÁN QR',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amber.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
            if (showQrButton && showCashButton) const SizedBox(height: 12),
            if (showCashButton)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _handleCashPaymentTap(context),
                  icon: const Icon(Icons.payments, color: Colors.white),
                  label: const Text(
                    'THANH TOÁN TIỀN MẶT',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
          ],
        ),
      );
    }
    return const SizedBox.shrink();
  }

  /// Kiểm tra xem có nên hiển thị nút tiền mặt không
  bool _shouldShowCashPaymentButton() {
    final status = booking.status?.trim().toUpperCase() ?? '';
    final paymentStatus = booking.paymentStatus?.trim().toUpperCase();
    final paymentMethod = _resolvePaymentMethod(booking);

    if (paymentStatus == 'PAID') {
      return false;
    }
    if (status == 'CANCELLED') {
      return false;
    }
    if (paymentMethod != 'CASH') {
      return false;
    }
    return true;
  }

  /// Xử lý khi người dùng click nút Thanh toán tiền mặt
  void _handleCashPaymentTap(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.payments, color: Colors.green),
            SizedBox(width: 8),
            Text('Thanh toán tiền mặt',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: const Text('Bạn đã thanh toán tiền mặt cho staff chưa?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('CHƯA'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Cảm ơn! Đã xác nhận thanh toán tiền mặt'),
                  backgroundColor: Colors.green,
                ),
              );
            },
            child: const Text('Đã THANH TOÁN'),
          ),
        ],
      ),
    );
  }

  /// Kiểm tra xem có nên hiển thị nút QR hay không
  /// Ẩn khi: đã paid, đã hủy, hoặc payment method là CASH
  bool _shouldShowQrButton() {
    final status = booking.status?.trim().toUpperCase() ?? '';
    final paymentStatus = booking.paymentStatus?.trim().toUpperCase();

    // Ẩn khi đã thanh toán
    if (paymentStatus == 'PAID') {
      return false;
    }
    // Ẩn khi đã hủy
    if (status == 'CANCELLED') {
      return false;
    }
    // Ẩn nút QR nếu booking chọn thanh toán tiền mặt
    final paymentMethod = _resolvePaymentMethod(booking);
    if (paymentMethod == 'CASH') {
      return false;
    }
    // Hiển thị QR cho cả IN_PROGRESS và COMPLETED (chưa thanh toán)
    return true;
  }

  /// Kiểm tra xem booking này có phải QR payment booking hay không
  bool _isQrPaymentBooking(BookingResponse booking) {
    // Kiểm tra flag từ backend
    if (booking.canShowQrPaymentButton == true) {
      return true;
    }

    // Fallback: kiểm tra phương thức thanh toán và trạng thái
    final paymentMethod = _resolvePaymentMethod(booking);
    final paymentStatus = booking.paymentStatus?.trim().toUpperCase();

    // QR payment booking: method = QR và chưa paid (PENDING hoặc COMPLETED với PENDING)
    return paymentMethod == 'QR' &&
        paymentStatus != 'PAID' &&
        ((booking.qrImageUrl?.trim().isNotEmpty ?? false) ||
            (booking.paymentDescription?.trim().isNotEmpty ?? false));
  }

  /// Xử lý khi người dùng click nút Thanh toán QR
  Future<void> _handleQrPaymentTap(BuildContext context) async {
    final bookingId = booking.bookingId;
    if (bookingId == null || bookingId.isEmpty) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không tìm thấy mã lịch hẹn.'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    try {
      // Refetch booking từ backend để lấy dữ liệu tươi
      final freshBooking = await _bookingService.getBookingById(bookingId);

      // Kiểm tra nếu đây có phải QR payment booking không
      if (_isQrPaymentBooking(freshBooking)) {
        if (context.mounted) {
          await _showQrDialog(context, freshBooking);
        }
      } else {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Lịch hẹn này không sử dụng thanh toán QR.'),
              backgroundColor: Colors.orange,
            ),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  String? _resolvePaymentMethod(BookingResponse booking) {
    final explicitMethod = booking.paymentMethod?.trim().toUpperCase();
    if (explicitMethod == 'QR' || explicitMethod == 'CASH') {
      return explicitMethod;
    }

    final notes = booking.notes?.toLowerCase() ?? '';
    if (notes.contains('phương thức thanh toán mong muốn: chuyển khoản qr') ||
        notes.contains('phuong thuc thanh toan mong muon: chuyen khoan qr') ||
        notes.contains('chuyển khoản qr') ||
        notes.contains('chuyen khoan qr') ||
        notes.contains('qr')) {
      return 'QR';
    }

    if (notes.contains('phương thức thanh toán mong muốn: tiền mặt') ||
        notes.contains('phuong thuc thanh toan mong muon: tien mat') ||
        notes.contains('tiền mặt') ||
        notes.contains('tien mat')) {
      return 'CASH';
    }

    return null;
  }

  Future<void> _showQrDialog(
      BuildContext context, BookingResponse qrBooking) async {
    final isPaid = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.qr_code_2, color: Colors.amber),
            SizedBox(width: 8),
            Text('Thanh toán QR',
                style: TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Quét mã QR để thanh toán lịch hẹn #${qrBooking.bookingCode ?? ""}',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 16),
            if (qrBooking.qrImageUrl != null &&
                qrBooking.qrImageUrl!.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.network(
                  qrBooking.qrImageUrl!,
                  width: 220,
                  height: 220,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Container(
                    width: 220,
                    height: 220,
                    color: Colors.grey.shade100,
                    child: const Icon(Icons.qr_code_2,
                        size: 80, color: Colors.grey),
                  ),
                ),
              )
            else
              Container(
                width: 220,
                height: 220,
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Center(
                  child: Icon(Icons.qr_code_2, size: 80, color: Colors.grey),
                ),
              ),
            const SizedBox(height: 16),
            Text(
              FormatUtils.formatCurrency(
                  qrBooking.finalPrice ?? qrBooking.totalPrice ?? 0),
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.amber.shade700,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () async {
              final bookingId = qrBooking.bookingId;
              if (bookingId == null || bookingId.isEmpty) {
                if (ctx.mounted) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(
                      content: Text(
                          'Không tìm thấy mã lịch hẹn để kiểm tra thanh toán.'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
                return;
              }

              try {
                final result = await _qrPaymentService.checkQrStatus(bookingId);
                final status =
                    (result['status'] ?? '').toString().trim().toUpperCase();

                if (status == 'PAID') {
                  if (ctx.mounted) Navigator.pop(ctx, true);
                  return;
                }

                final message =
                    (result['message'] ?? 'Chưa nhận được thanh toán.')
                        .toString();
                if (ctx.mounted) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    SnackBar(
                      content: Text(message),
                      backgroundColor: Colors.orange,
                    ),
                  );
                }
              } catch (_) {
                if (ctx.mounted) {
                  ScaffoldMessenger.of(ctx).showSnackBar(
                    const SnackBar(
                      content: Text(
                          'Không thể kiểm tra trạng thái thanh toán. Vui lòng thử lại.'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            child: const Text('KIỂM TRA TRẠNG THÁI'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('ĐÓNG'),
          ),
        ],
      ),
    );

    if (isPaid == true && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              'Thanh toán thành công! Đang cập nhật trạng thái thanh toán.'),
          backgroundColor: Colors.green,
        ),
      );

      // Pop detail screen và return 'PAID' để list refetch
      await Future.delayed(const Duration(milliseconds: 500));
      if (context.mounted) {
        Navigator.of(context).pop('PAID');
      }
    }
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

  Widget _buildPaymentMethodText(String method) {
    final isQr = method.toUpperCase() == 'QR';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isQr ? Colors.blue.shade100 : Colors.green.shade100,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isQr ? Colors.blue.shade400 : Colors.green.shade400,
          width: 1,
        ),
      ),
      child: Text(
        isQr ? 'QR' : 'Tiền mặt',
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w900,
          color: isQr ? Colors.blue.shade800 : Colors.green.shade800,
          letterSpacing: 0.4,
        ),
      ),
    );
  }

  Widget _buildPaymentBadge(String paymentStatus) {
    final normalized = paymentStatus.toUpperCase();
    final isPaid = normalized == 'PAID';
    final background = isPaid ? Colors.green.shade100 : Colors.orange.shade100;
    final border = isPaid ? Colors.green.shade400 : Colors.orange.shade400;
    final textColor = isPaid ? Colors.green.shade800 : Colors.orange.shade800;
    final label = isPaid ? 'Đà THANH TOÁN' : 'CHƯA THANH TOÁN';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border, width: 1),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: textColor,
          fontSize: 10,
          fontWeight: FontWeight.w900,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}
