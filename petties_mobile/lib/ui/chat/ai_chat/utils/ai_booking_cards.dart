import 'package:flutter/material.dart';

import '../../../../config/constants/app_colors.dart';
import '../../../../data/models/ai_chat.dart';
import 'ai_chat_widgets.dart';

class AiServiceOptionCard extends StatelessWidget {
  final List<AiBookingServiceOption> services;
  final Set<String> selectedIds;
  final bool isBusy;
  final ValueChanged<AiBookingServiceOption> onToggleService;
  final VoidCallback onContinue;

  const AiServiceOptionCard({
    super.key,
    required this.services,
    required this.selectedIds,
    required this.isBusy,
    required this.onToggleService,
    required this.onContinue,
  });

  @override
  Widget build(BuildContext context) {
    if (services.isEmpty) return const SizedBox.shrink();

    final selectedCount = selectedIds.length;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            selectedCount > 0
                ? 'Đã chọn $selectedCount dịch vụ. Bạn có thể chọn nhiều dịch vụ trước khi tiếp tục.'
                : 'Bạn có thể chọn một hoặc nhiều dịch vụ rồi bấm tiếp tục.',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.stone700,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: services.map((service) {
              final serviceId = service.id.trim();
              final isSelected =
                  serviceId.isNotEmpty && selectedIds.contains(serviceId);

              return FilterChip(
                selected: isSelected,
                onSelected: isBusy ? null : (_) => onToggleService(service),
                backgroundColor: AppColors.white,
                selectedColor: AppColors.primary.withValues(alpha: 0.14),
                checkmarkColor: AppColors.primary,
                side: BorderSide(
                  color: isSelected ? AppColors.primary : AppColors.stone900,
                  width: 1.5,
                ),
                label: Text(
                  service.basePrice != null
                      ? '${service.name} (${service.basePrice!.toStringAsFixed(0)}đ)'
                      : service.name,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: isSelected ? AppColors.primary : AppColors.stone900,
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: isBusy || selectedCount == 0 ? null : onContinue,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
                disabledBackgroundColor: AppColors.stone200,
                disabledForegroundColor: AppColors.stone500,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: const BorderSide(
                    color: AppColors.stone900,
                    width: 2,
                  ),
                ),
              ),
              child: Text(
                selectedCount > 0
                    ? 'TIẾP TỤC VỚI $selectedCount DỊCH VỤ'
                    : 'CHỌN DỊCH VỤ ĐỂ TIẾP TỤC',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.2,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class AiSlotGridCard extends StatelessWidget {
  final AiSlotGridPayload slotGrid;
  final bool isBusy;
  final String Function(String? value) formatBookingDate;
  final ValueChanged<AiBookingSlotOption> onSelectSlot;

  const AiSlotGridCard({
    super.key,
    required this.slotGrid,
    required this.isBusy,
    required this.formatBookingDate,
    required this.onSelectSlot,
  });

  @override
  Widget build(BuildContext context) {
    final slots = <AiBookingSlotOption>[
      ...slotGrid.recommendedSlots,
      ...slotGrid.alternativeSlots,
    ];
    if (slots.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if ((slotGrid.bookingDate ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Ngày khám',
              value: formatBookingDate(slotGrid.bookingDate),
            ),
          if (slotGrid.serviceNames.isNotEmpty)
            _BookingInfoRow(
              label: 'Dịch vụ',
              value: slotGrid.serviceNames.join(', '),
            ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: slots.map((slot) {
              final endTime = slot.endTime?.trim();
              final label = endTime != null && endTime.isNotEmpty
                  ? '${slot.startTime} - $endTime'
                  : slot.startTime;

              return ActionChip(
                onPressed: isBusy ? null : () => onSelectSlot(slot),
                backgroundColor: AppColors.white,
                side: const BorderSide(color: AppColors.stone900, width: 1.5),
                label: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone900,
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class AiStructuredBookingSummaryCard extends StatefulWidget {
  final AiBookingSummaryPayload summary;
  final bool isConfirmed;
  final bool isBusy;
  final List<AiClinic> clinicOptions;
  final List<AiBookingServiceOption> serviceOptions;
  final List<String> bookingDateOptions;
  final List<String> startTimeOptions;
  final String Function(String? value) formatBookingDate;
  final void Function(AiBookingSummaryPayload summary, String field)?
      onFormChanged;
  final ValueChanged<AiBookingSummaryPayload> onConfirm;

  const AiStructuredBookingSummaryCard({
    super.key,
    required this.summary,
    required this.isConfirmed,
    required this.isBusy,
    required this.clinicOptions,
    required this.serviceOptions,
    required this.bookingDateOptions,
    required this.startTimeOptions,
    required this.formatBookingDate,
    this.onFormChanged,
    required this.onConfirm,
  });

  @override
  State<AiStructuredBookingSummaryCard> createState() =>
      _AiStructuredBookingSummaryCardState();
}

class _AiStructuredBookingSummaryCardState
    extends State<AiStructuredBookingSummaryCard> {
  String? _selectedClinicId;
  String? _selectedClinicName;
  String? _selectedBookingDate;
  String? _selectedStartTime;
  String? _selectedBookingType;
  String? _homeAddress;
  double? _homeLat;
  double? _homeLong;
  Set<String> _selectedServiceIds = <String>{};

  @override
  void initState() {
    super.initState();
    _syncFromSummary();
  }

  @override
  void didUpdateWidget(covariant AiStructuredBookingSummaryCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.summary != widget.summary ||
        oldWidget.serviceOptions != widget.serviceOptions ||
        oldWidget.clinicOptions != widget.clinicOptions) {
      _syncFromSummary();
    }
  }

  void _syncFromSummary() {
    final summary = widget.summary;
    final idsFromSummary = summary.serviceIds
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toSet();

    final idsByName = <String>{};
    if (idsFromSummary.isEmpty && summary.serviceNames.isNotEmpty) {
      final loweredNames = summary.serviceNames
          .map((item) => item.trim().toLowerCase())
          .where((item) => item.isNotEmpty)
          .toSet();
      for (final service in widget.serviceOptions) {
        final serviceId = service.id.trim();
        final serviceName = service.name.trim().toLowerCase();
        if (serviceId.isEmpty || serviceName.isEmpty) continue;
        if (loweredNames.contains(serviceName)) {
          idsByName.add(serviceId);
        }
      }
    }

    _selectedClinicId = _clean(summary.clinicId);
    _selectedClinicName = _clean(summary.clinicName);
    _selectedBookingDate = _clean(summary.bookingDate);
    _selectedStartTime = _clean(summary.startTime);
    _selectedBookingType =
        _normalizeBookingType(summary.bookingType) ?? bookingTypeInClinic;
    _homeAddress = _clean(summary.homeAddress);
    _homeLat = summary.homeLat;
    _homeLong = summary.homeLong;
    _selectedServiceIds =
        idsFromSummary.isNotEmpty ? idsFromSummary : idsByName;

    // Auto-bind mandatory fields when there is only one safe candidate.
    if ((_selectedClinicId ?? '').trim().isEmpty &&
        (_selectedClinicName ?? '').trim().isEmpty &&
        widget.clinicOptions.length == 1) {
      final clinic = widget.clinicOptions.first;
      final clinicId = clinic.id.trim();
      final clinicName = clinic.name.trim();
      if (clinicId.isNotEmpty || clinicName.isNotEmpty) {
        _selectedClinicId = clinicId.isNotEmpty ? clinicId : null;
        _selectedClinicName =
            clinicName.isNotEmpty ? clinicName : _fallbackClinicLabel(clinicId);
      }
    }

    if (_selectedServiceIds.isEmpty && widget.serviceOptions.length == 1) {
      final serviceId = widget.serviceOptions.first.id.trim();
      if (serviceId.isNotEmpty) {
        _selectedServiceIds = <String>{serviceId};
      }
    }

    if ((_selectedBookingDate ?? '').trim().isEmpty &&
        widget.bookingDateOptions.length == 1) {
      _selectedBookingDate = widget.bookingDateOptions.first.trim();
    }

    if ((_selectedStartTime ?? '').trim().isEmpty &&
        widget.startTimeOptions.length == 1) {
      _selectedStartTime = widget.startTimeOptions.first.trim();
    }
  }

  @override
  Widget build(BuildContext context) {
    final clinicItems = _buildClinicItems();
    final dateItems = _buildDateItems();
    final timeItems = _buildTimeItems();
    final selectedServiceLabels = _resolveSelectedServiceLabels();
    final bookingTypeItems = _buildBookingTypeItems();
    final bookingTypeValue = _resolveBookingTypeValue(bookingTypeItems);
    final isHomeVisit = _selectedBookingType == bookingTypeHomeVisit;
    final canConfirm = _canConfirm(
      hasClinic: _resolveClinicValue(clinicItems) != null,
      hasDate: _resolveDateValue(dateItems) != null,
      hasTime: _resolveTimeValue(timeItems) != null,
      isHomeVisit: isHomeVisit,
      hasServices: _selectedServiceIds.isNotEmpty,
    );
    final validationMessages = _buildValidationMessages(
      hasClinic: _resolveClinicValue(clinicItems) != null,
      hasDate: _resolveDateValue(dateItems) != null,
      hasTime: _resolveTimeValue(timeItems) != null,
      isHomeVisit: isHomeVisit,
      hasServices: _selectedServiceIds.isNotEmpty,
      hasBookingType: bookingTypeValue != null,
      hasLocationForHomeVisit: !_requiresLocationForHomeVisit(),
    );

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if ((widget.summary.petName ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Thú cưng',
              value: widget.summary.petName ?? '',
            ),
          const SizedBox(height: 4),
          _buildDropdownField(
            label: 'Phòng khám',
            value: _resolveClinicValue(clinicItems),
            items: clinicItems,
            isEnabled: !widget.isBusy && !widget.isConfirmed,
            hintText: 'Chọn phòng khám',
            emptyMessage: 'Chưa có danh sách phòng khám',
            onRequestOptions: null,
            onChanged: (nextValue) {
              if (nextValue == null) return;

              String? nextId;
              String? nextName;
              for (final item in clinicItems) {
                if (item.value == nextValue) {
                  nextId = item.id;
                  nextName = item.label;
                  break;
                }
              }

              setState(() {
                _selectedClinicId = nextId;
                _selectedClinicName = nextName;
                _selectedServiceIds.clear();
                _selectedStartTime = null;
              });
              _notifyFormChanged('clinic');
            },
          ),
          const SizedBox(height: 8),
          _buildDropdownField(
            label: 'Hình thức khám',
            value: bookingTypeValue,
            items: bookingTypeItems,
            isEnabled: !widget.isBusy && !widget.isConfirmed,
            hintText: 'Chọn hình thức khám',
            emptyMessage: 'Chưa có hình thức khám',
            onRequestOptions: null,
            onChanged: (nextValue) {
              setState(() {
                _selectedBookingType = nextValue;
                _selectedStartTime = null;
                _selectedServiceIds.clear();
              });
              _notifyFormChanged('booking_type');
            },
          ),
          const SizedBox(height: 8),
          _buildDropdownField(
            label: 'Ngày khám',
            value: _resolveDateValue(dateItems),
            items: dateItems,
            isEnabled: !widget.isBusy && !widget.isConfirmed,
            hintText: 'Chọn ngày khám',
            emptyMessage: 'Chưa có danh sách ngày khám',
            onRequestOptions: null,
            onChanged: (nextValue) {
              setState(() {
                _selectedBookingDate = nextValue;
                _selectedStartTime = null;
              });
              _notifyFormChanged('date');
            },
          ),
          const SizedBox(height: 8),
          _buildDropdownField(
            label: 'Giờ bắt đầu',
            value: _resolveTimeValue(timeItems),
            items: timeItems,
            isEnabled: !widget.isBusy && !widget.isConfirmed,
            hintText: 'Chọn giờ bắt đầu',
            emptyMessage: 'Chưa có danh sách khung giờ',
            onRequestOptions: null,
            onChanged: (nextValue) {
              setState(() {
                _selectedStartTime = nextValue;
              });
              _notifyFormChanged('time');
            },
          ),
          const SizedBox(height: 8),
          _buildServiceMultiSelect(
            selectedLabels: selectedServiceLabels,
            isEnabled: !widget.isBusy && !widget.isConfirmed,
            onRequestOptions: null,
          ),
          if (isHomeVisit) ...[
            const SizedBox(height: 8),
            _buildHomeVisitAddressField(),
          ],
          if (validationMessages.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...validationMessages.map(
              (message) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  '- $message',
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.coral,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: ElevatedButton(
              onPressed: widget.isConfirmed || widget.isBusy || !canConfirm
                  ? null
                  : _confirmWithCurrentForm,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
                elevation: 0,
                shadowColor: AppColors.transparent,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                  side: const BorderSide(
                    color: AppColors.stone900,
                    width: 2,
                  ),
                ),
              ),
              child: Text(
                widget.isConfirmed ? 'ĐÃ GỬI XÁC NHẬN' : 'XÁC NHẬN ĐẶT LỊCH',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _confirmWithCurrentForm() {
    final selectedServiceIds = _selectedServiceIds
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    final selectedServices = widget.serviceOptions
        .where((service) => selectedServiceIds.contains(service.id.trim()))
        .toList();
    final selectedServiceNames = selectedServices
        .map((service) => service.name.trim())
        .where((name) => name.isNotEmpty)
        .toList();

    widget.onConfirm(
      AiBookingSummaryPayload(
        petId: widget.summary.petId,
        petName: widget.summary.petName,
        clinicId: _selectedClinicId,
        clinicName: _selectedClinicName,
        bookingDate: _selectedBookingDate,
        startTime: _selectedStartTime,
        serviceIds: selectedServiceIds,
        serviceNames: selectedServiceNames,
        bookingType: _selectedBookingType,
        notes: widget.summary.notes,
        homeAddress: _homeAddress,
        homeLat: _homeLat,
        homeLong: _homeLong,
        distanceKm: widget.summary.distanceKm,
        message: widget.summary.message,
        missingFields: widget.summary.missingFields,
        readyToCreate: widget.summary.readyToCreate,
        nextBestAction: widget.summary.nextBestAction,
      ),
    );
  }

  Widget _buildServiceMultiSelect({
    required List<String> selectedLabels,
    required bool isEnabled,
    VoidCallback? onRequestOptions,
  }) {
    final hasOptions = widget.serviceOptions.isNotEmpty;
    final shouldShowReload = onRequestOptions != null &&
        isEnabled &&
        widget.serviceOptions.length <= 1;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Dịch vụ',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.stone600,
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: !isEnabled
                  ? null
                  : hasOptions
                      ? _openServicePicker
                      : onRequestOptions,
              icon: const Icon(Icons.playlist_add_check_outlined, size: 16),
              label: Text(
                hasOptions
                    ? 'Chọn một hoặc nhiều dịch vụ'
                    : 'Tải danh sách dịch vụ',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.stone900,
                side: const BorderSide(color: AppColors.stone900, width: 1.5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                backgroundColor: AppColors.white,
              ),
            ),
          ),
          const SizedBox(height: 8),
          if (selectedLabels.isEmpty)
            const Text(
              'Chưa chọn dịch vụ',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.stone500,
                fontWeight: FontWeight.w600,
              ),
            )
          else
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: selectedLabels
                  .map(
                    (label) => AiBookingMetaPill(
                      icon: Icons.medical_services_outlined,
                      label: label,
                      backgroundColor: AppColors.primarySurface,
                      foregroundColor: AppColors.primaryDark,
                    ),
                  )
                  .toList(),
            ),
          if (shouldShowReload) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: onRequestOptions,
                child: const Text(
                  'Tải thêm dịch vụ',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _openServicePicker() async {
    final tempSelected = Set<String>.from(_selectedServiceIds);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.white,
      shape: RoundedRectangleBorder(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
        side: const BorderSide(color: AppColors.stone900, width: 2),
      ),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Chọn một hoặc nhiều dịch vụ',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: AppColors.stone900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      height: MediaQuery.of(context).size.height * 0.42,
                      child: ListView.separated(
                        itemCount: widget.serviceOptions.length,
                        separatorBuilder: (_, __) =>
                            const Divider(height: 1, thickness: 1),
                        itemBuilder: (context, index) {
                          final service = widget.serviceOptions[index];
                          final serviceId = service.id.trim();
                          final selected = tempSelected.contains(serviceId);

                          return CheckboxListTile(
                            value: selected,
                            onChanged: (checked) {
                              if (serviceId.isEmpty) return;
                              setSheetState(() {
                                if (checked == true) {
                                  tempSelected.add(serviceId);
                                } else {
                                  tempSelected.remove(serviceId);
                                }
                              });
                            },
                            controlAffinity: ListTileControlAffinity.leading,
                            title: Text(
                              service.name,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.stone900,
                              ),
                            ),
                            subtitle: service.basePrice == null
                                ? null
                                : Text(
                                    '${service.basePrice!.toStringAsFixed(0)}đ',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.stone600,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                            dense: true,
                            contentPadding:
                                const EdgeInsets.symmetric(horizontal: 0),
                            activeColor: AppColors.primary,
                            checkColor: AppColors.white,
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          setState(() {
                            _selectedServiceIds =
                                Set<String>.from(tempSelected);
                          });
                          _notifyFormChanged('service');
                          Navigator.of(sheetContext).pop();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: AppColors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                            side: const BorderSide(
                              color: AppColors.stone900,
                              width: 2,
                            ),
                          ),
                        ),
                        child: const Text(
                          'ÁP DỤNG DỊCH VỤ ĐÃ CHỌN',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildDropdownField({
    required String label,
    required String? value,
    required List<_SummarySelectItem> items,
    required bool isEnabled,
    required String hintText,
    String emptyMessage = 'Chưa có dữ liệu',
    VoidCallback? onRequestOptions,
    required ValueChanged<String?> onChanged,
  }) {
    final hasItems = items.isNotEmpty;
    final shouldShowReload =
        onRequestOptions != null && isEnabled && items.length <= 1;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.stone600,
            ),
          ),
          const SizedBox(height: 6),
          if (hasItems)
            DropdownButtonFormField<String>(
              key: ValueKey<String>(
                '$label|${value ?? ''}|${items.length}',
              ),
              initialValue: value,
              isExpanded: true,
              items: items
                  .map(
                    (item) => DropdownMenuItem<String>(
                      value: item.value,
                      child: Text(
                        item.label,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.stone900,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                  .toList(),
              onChanged: isEnabled ? onChanged : null,
              iconEnabledColor: AppColors.stone900,
              iconDisabledColor: AppColors.stone400,
              decoration: InputDecoration(
                isDense: true,
                hintText: hintText,
                hintStyle: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.stone500,
                ),
                filled: true,
                fillColor: isEnabled ? AppColors.white : AppColors.stone100,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide:
                      const BorderSide(color: AppColors.stone900, width: 1.5),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide:
                      const BorderSide(color: AppColors.stone900, width: 1.5),
                ),
                disabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide:
                      const BorderSide(color: AppColors.stone300, width: 1.2),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide:
                      const BorderSide(color: AppColors.primary, width: 1.8),
                ),
              ),
            )
          else
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: !isEnabled
                    ? null
                    : (onRequestOptions == null
                        ? null
                        : () => onRequestOptions()),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.stone900,
                  side: const BorderSide(color: AppColors.stone900, width: 1.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  backgroundColor: AppColors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                ),
                child: Text(
                  emptyMessage,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          if (shouldShowReload) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: onRequestOptions,
                child: const Text(
                  'Xem thêm lựa chọn',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  List<_SummarySelectItem> _buildClinicItems() {
    final items = <_SummarySelectItem>[];
    final seen = <String>{};

    for (final clinic in widget.clinicOptions) {
      final id = clinic.id.trim();
      final name = clinic.name.trim();
      final label = name.isNotEmpty ? name : _fallbackClinicLabel(id);
      if (label == null || label.isEmpty) continue;
      final key = id.isNotEmpty ? id : name;
      if (!seen.add(key)) continue;
      items.add(_SummarySelectItem(value: key, label: label, id: id));
    }

    final currentName = _clean(_selectedClinicName);
    final currentId = _clean(_selectedClinicId);
    final currentLabel = currentName ?? _fallbackClinicLabel(currentId ?? '');
    if (currentLabel != null) {
      final key = currentId ?? currentLabel;
      if (!seen.contains(key)) {
        items.insert(
          0,
          _SummarySelectItem(value: key, label: currentLabel, id: currentId),
        );
      }
    }

    return items;
  }

  List<_SummarySelectItem> _buildDateItems() {
    final values = <String>{
      ...widget.bookingDateOptions
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty),
      if ((_selectedBookingDate ?? '').trim().isNotEmpty)
        _selectedBookingDate!.trim(),
    }.toList();

    values.sort();
    return values
        .map(
          (value) => _SummarySelectItem(
            value: value,
            label: widget.formatBookingDate(value),
          ),
        )
        .toList();
  }

  List<_SummarySelectItem> _buildTimeItems() {
    final shouldUseSlotOptionsOnly = _selectedBookingDate != null;
    final values = <String>{
      ...widget.startTimeOptions
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty),
      if ((_selectedStartTime ?? '').trim().isNotEmpty) _selectedStartTime!,
    }.toList();

    if (shouldUseSlotOptionsOnly) {
      values.removeWhere((value) => !_isValidTimeValue(value));
    }

    values.sort();
    return values
        .map((value) => _SummarySelectItem(value: value, label: value))
        .toList();
  }

  List<_SummarySelectItem> _buildBookingTypeItems() {
    return const <_SummarySelectItem>[
      _SummarySelectItem(
        value: bookingTypeInClinic,
        label: 'Tại phòng khám',
      ),
      _SummarySelectItem(
        value: bookingTypeHomeVisit,
        label: 'Khám tại nhà',
      ),
    ];
  }

  String? _resolveClinicValue(List<_SummarySelectItem> clinicItems) {
    final currentId = _clean(_selectedClinicId);
    final currentName = _clean(_selectedClinicName);

    for (final item in clinicItems) {
      if (currentId != null && item.value == currentId) {
        return item.value;
      }
      if (currentName != null && item.label == currentName) {
        return item.value;
      }
    }
    return null;
  }

  String? _resolveDateValue(List<_SummarySelectItem> dateItems) {
    final selected = _clean(_selectedBookingDate);
    if (selected == null) return null;
    return dateItems.any((item) => item.value == selected) ? selected : null;
  }

  String? _resolveTimeValue(List<_SummarySelectItem> timeItems) {
    final selected = _clean(_selectedStartTime);
    if (selected == null) return null;
    return timeItems.any((item) => item.value == selected) ? selected : null;
  }

  String? _resolveBookingTypeValue(List<_SummarySelectItem> items) {
    final selected = _normalizeBookingType(_selectedBookingType);
    if (selected == null) return null;
    return items.any((item) => item.value == selected) ? selected : null;
  }

  List<String> _resolveSelectedServiceLabels() {
    final byId = <String, String>{
      for (final service in widget.serviceOptions)
        if (service.id.trim().isNotEmpty && service.name.trim().isNotEmpty)
          service.id.trim(): service.name.trim(),
    };

    final labels = _selectedServiceIds
        .map((id) => byId[id.trim()] ?? '')
        .where((name) => name.isNotEmpty)
        .toList();

    if (labels.isNotEmpty) {
      return labels;
    }

    return widget.summary.serviceNames
        .map((name) => name.trim())
        .where((name) => name.isNotEmpty)
        .toList();
  }

  String? _clean(String? value) {
    final trimmed = value?.trim();
    if (trimmed == null || trimmed.isEmpty) {
      return null;
    }
    return trimmed;
  }

  String? _fallbackClinicLabel(String clinicId) {
    final normalized = clinicId.trim();
    if (normalized.isEmpty) {
      return null;
    }
    final shortId = normalized.length > 8
        ? normalized.substring(normalized.length - 8)
        : normalized;
    return 'Phòng khám $shortId';
  }

  String? _normalizeBookingType(String? value) {
    final normalized = (value ?? '').trim().toUpperCase();
    if (normalized == bookingTypeInClinic ||
        normalized == bookingTypeHomeVisit) {
      return normalized;
    }
    return null;
  }

  bool _isValidTimeValue(String value) {
    return RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(value.trim());
  }

  bool _requiresLocationForHomeVisit() {
    if (_selectedBookingType != bookingTypeHomeVisit) {
      return false;
    }
    final hasAddress = (_homeAddress ?? '').trim().isNotEmpty;
    return !hasAddress || _homeLat == null || _homeLong == null;
  }

  bool _canConfirm({
    required bool hasClinic,
    required bool hasDate,
    required bool hasTime,
    required bool isHomeVisit,
    required bool hasServices,
  }) {
    final hasBookingType = _selectedBookingType != null;
    final hasLocationForHomeVisit = !_requiresLocationForHomeVisit();
    if (!hasBookingType || !hasClinic || !hasDate || !hasTime || !hasServices) {
      return false;
    }
    if (isHomeVisit && !hasLocationForHomeVisit) {
      return false;
    }
    return true;
  }

  List<String> _buildValidationMessages({
    required bool hasBookingType,
    required bool hasClinic,
    required bool hasDate,
    required bool hasTime,
    required bool isHomeVisit,
    required bool hasServices,
    required bool hasLocationForHomeVisit,
  }) {
    if (widget.isConfirmed || widget.isBusy) {
      return const <String>[];
    }
    final messages = <String>[];
    if (!hasBookingType) messages.add('Vui lòng chọn hình thức khám');
    if (!hasClinic) messages.add('Vui lòng chọn phòng khám');
    if (!hasServices) messages.add('Vui lòng chọn ít nhất một dịch vụ');
    if (!hasDate) messages.add('Vui lòng chọn ngày khám');
    if (!hasTime) messages.add('Vui lòng chọn giờ khám từ slot rảnh');
    if (isHomeVisit && !hasLocationForHomeVisit) {
      messages.add('Khám tại nhà cần địa chỉ và vị trí hợp lệ');
    }
    return messages;
  }

  void _notifyFormChanged(String field) {
    final callback = widget.onFormChanged;
    if (callback == null) {
      return;
    }
    callback(
      AiBookingSummaryPayload(
        petId: widget.summary.petId,
        petName: widget.summary.petName,
        clinicId: _selectedClinicId,
        clinicName: _selectedClinicName,
        bookingDate: _selectedBookingDate,
        startTime: _selectedStartTime,
        serviceIds: _selectedServiceIds.toList(),
        serviceNames: _resolveSelectedServiceLabels(),
        bookingType: _selectedBookingType,
        notes: widget.summary.notes,
        homeAddress: _homeAddress,
        homeLat: _homeLat,
        homeLong: _homeLong,
        distanceKm: widget.summary.distanceKm,
        message: widget.summary.message,
        missingFields: widget.summary.missingFields,
        readyToCreate: widget.summary.readyToCreate,
        nextBestAction: widget.summary.nextBestAction,
      ),
      field,
    );
  }

  Widget _buildHomeVisitAddressField() {
    final initialText = (_homeAddress ?? '').trim();
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.stone200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Địa chỉ khám tại nhà',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.stone600,
            ),
          ),
          const SizedBox(height: 6),
          TextFormField(
            key: ValueKey<String>('home_address|$initialText'),
            initialValue: initialText,
            onChanged: (value) {
              _homeAddress = value.trim().isEmpty ? null : value.trim();
              _notifyFormChanged('home_address');
            },
            decoration: InputDecoration(
              isDense: true,
              hintText: 'Nhập địa chỉ khám tại nhà',
              hintStyle: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.stone500,
              ),
              filled: true,
              fillColor: AppColors.white,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide:
                    const BorderSide(color: AppColors.stone900, width: 1.5),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide:
                    const BorderSide(color: AppColors.stone900, width: 1.5),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide:
                    const BorderSide(color: AppColors.primary, width: 1.8),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            (_homeLat != null && _homeLong != null)
                ? 'Da co toa do GPS de tao booking tai nha'
                : 'Can bat vi tri de lay toa do GPS cho booking tai nha',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: (_homeLat != null && _homeLong != null)
                  ? AppColors.successDark
                  : AppColors.coral,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummarySelectItem {
  final String value;
  final String label;
  final String? id;

  const _SummarySelectItem({
    required this.value,
    required this.label,
    this.id,
  });
}

class AiBookingCreatedCard extends StatelessWidget {
  final AiBookingCreatedPayload bookingCreated;
  final String Function(String? value) formatBookingDate;
  final VoidCallback? onViewBooking;

  const AiBookingCreatedCard({
    super.key,
    required this.bookingCreated,
    required this.formatBookingDate,
    this.onViewBooking,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.successLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.successDark, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.successDark, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if ((bookingCreated.bookingCode ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Mã booking',
              value: bookingCreated.bookingCode ?? '',
            ),
          if ((bookingCreated.petName ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Thú cưng',
              value: bookingCreated.petName ?? '',
            ),
          if ((bookingCreated.clinicName ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Phòng khám',
              value: bookingCreated.clinicName ?? '',
            ),
          if ((bookingCreated.date ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Ngày khám',
              value: formatBookingDate(bookingCreated.date),
            ),
          if ((bookingCreated.time ?? '').trim().isNotEmpty)
            _BookingInfoRow(
              label: 'Giờ bắt đầu',
              value: bookingCreated.time ?? '',
            ),
          if (bookingCreated.services.isNotEmpty)
            _BookingInfoRow(
              label: 'Dịch Vụ',
              value: bookingCreated.services.join(', '),
            ),
          const SizedBox(height: 6),
          Text(
            bookingCreated.managerWillConfirm
                ? 'Yêu cầu đã được tạo. Clinic manager sẽ xác nhận sau.'
                : 'Booking đã được tạo thành công.',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.successDark,
            ),
          ),
          if (onViewBooking != null) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 42,
              child: ElevatedButton(
                onPressed: onViewBooking,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.white,
                  foregroundColor: AppColors.successDark,
                  elevation: 0,
                  shadowColor: AppColors.transparent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(
                      color: AppColors.successDark,
                      width: 2,
                    ),
                  ),
                ),
                child: const Text(
                  'Xem lịch hẹn của tôi',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class AiMultiPetBookingCreatedCard extends StatelessWidget {
  final AiBookingCreatedPayload multiPetBooking;
  final String Function(String? value) formatBookingDate;
  final VoidCallback? onViewBooking;

  const AiMultiPetBookingCreatedCard({
    super.key,
    required this.multiPetBooking,
    required this.formatBookingDate,
    this.onViewBooking,
  });

  @override
  Widget build(BuildContext context) {
    final bookings = multiPetBooking.bookings ?? [];
    final totalBookings =
        multiPetBooking.multiPetSummary?['total_bookings'] as int? ??
            bookings.length;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.successLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.successDark, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.successDark, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.check_circle,
                  color: AppColors.successDark, size: 20),
              const SizedBox(width: 8),
              Text(
                'Đã tạo $totalBookings yêu cầu đặt lịch',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: AppColors.successDark,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...bookings.take(3).map((booking) {
            final petName = booking['pet_name']?.toString() ?? '';
            final clinicName = booking['clinic_name']?.toString() ?? '';
            final date = booking['date']?.toString() ?? '';
            return Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                children: [
                  const Icon(Icons.pets, size: 14, color: AppColors.stone600),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${petName.isNotEmpty ? '$petName - ' : ''}${clinicName.isNotEmpty ? clinicName : ''}${date.isNotEmpty ? ' (${formatBookingDate(date)})' : ''}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.stone700,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
          if (bookings.length > 3)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '...và ${bookings.length - 3} booking khác',
                style: const TextStyle(
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                  color: AppColors.stone500,
                ),
              ),
            ),
          const SizedBox(height: 6),
          Text(
            'Clinic manager sẽ xác nhận từng booking sau.',
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.successDark,
            ),
          ),
          if (onViewBooking != null) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              height: 42,
              child: ElevatedButton(
                onPressed: onViewBooking,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.white,
                  foregroundColor: AppColors.successDark,
                  elevation: 0,
                  shadowColor: AppColors.transparent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(
                      color: AppColors.successDark,
                      width: 2,
                    ),
                  ),
                ),
                child: const Text(
                  'Xem lịch hẹn của tôi',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _BookingInfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _BookingInfoRow({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: AppColors.white.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.stone200),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              _iconForBookingLabel(label),
              size: 15,
              color: AppColors.primary,
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 80,
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone600,
                ),
              ),
            ),
            Expanded(
              child: Text(
                value,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone900,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

IconData _iconForBookingLabel(String label) {
  switch (label) {
    case 'Ngày khám':
      return Icons.calendar_month;
    case 'Giờ bắt đầu':
      return Icons.schedule;
    case 'Phòng khám':
      return Icons.local_hospital_outlined;
    case 'Thú cưng':
      return Icons.pets_outlined;
    case 'Dịch vụ':
      return Icons.medical_services_outlined;
    default:
      return Icons.info_outline;
  }
}
