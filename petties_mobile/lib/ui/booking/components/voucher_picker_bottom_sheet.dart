import 'package:flutter/material.dart';
import '../../../config/constants/app_colors.dart';
import '../../../data/services/voucher_service.dart';
import '../../../utils/format_utils.dart';

/// Bottom sheet hiển thị danh sách voucher cho pet owner chọn
class VoucherPickerBottomSheet extends StatefulWidget {
  final String clinicId;
  final double orderAmount;
  final String? selectedVoucherId;
  final String? paymentMethod;
  final List<String>? serviceCategories;
  final Function(VoucherModel? voucher) onVoucherSelected;

  const VoucherPickerBottomSheet({
    super.key,
    required this.clinicId,
    required this.orderAmount,
    this.selectedVoucherId,
    this.paymentMethod,
    this.serviceCategories,
    required this.onVoucherSelected,
  });

  static Future<dynamic> show({
    required BuildContext context,
    required String clinicId,
    required double orderAmount,
    String? selectedVoucherId,
    String? paymentMethod,
    List<String>? serviceCategories,
  }) async {
    dynamic result;
    bool chosen = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        side: BorderSide(color: AppColors.stone900, width: 2),
      ),
      builder: (ctx) => VoucherPickerBottomSheet(
        clinicId: clinicId,
        orderAmount: orderAmount,
        selectedVoucherId: selectedVoucherId,
        paymentMethod: paymentMethod,
        serviceCategories: serviceCategories,
        onVoucherSelected: (v) {
          result = v;
          chosen = true;
        },
      ),
    );
    
    if (chosen) {
      if (result == null) return false; // Explicit clear
      return result; // Selected a voucher
    }
    return null; // Dismissed without choice
  }

  @override
  State<VoucherPickerBottomSheet> createState() =>
      _VoucherPickerBottomSheetState();
}

class _VoucherPickerBottomSheetState extends State<VoucherPickerBottomSheet> {
  final VoucherService _service = VoucherService();
  List<VoucherModel> _vouchers = [];
  bool _isLoading = true;
  String? _selectedId;

  @override
  void initState() {
    super.initState();
    _selectedId = widget.selectedVoucherId;
    _load();
  }

  Future<void> _load() async {
    try {
      final result = await _service.getAvailableVouchers(
        clinicId: widget.clinicId,
        orderAmount: widget.orderAmount,
        paymentMethod: widget.paymentMethod,
        serviceCategories: widget.serviceCategories,
      );
      if (mounted) {
        setState(() {
          _vouchers = result;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (_, controller) => Column(
        children: [
          _buildHandle(),
          _buildHeader(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: AppColors.primary))
                : _vouchers.isEmpty
                    ? _buildEmpty()
                    : ListView.separated(
                        controller: controller,
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        itemCount: _vouchers.length + 1, // +1 for "Không dùng"
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (_, i) {
                          if (i == 0) return _buildNoVoucherOption();
                          return _buildVoucherTile(_vouchers[i - 1]);
                        },
                      ),
          ),
          _buildApplyButton(),
        ],
      ),
    );
  }

  Widget _buildHandle() => Container(
        margin: const EdgeInsets.only(top: 12, bottom: 4),
        width: 40,
        height: 4,
        decoration: BoxDecoration(
          color: AppColors.stone300,
          borderRadius: BorderRadius.circular(2),
        ),
      );

  Widget _buildHeader() => Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: AppColors.stone200)),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.primaryBackground,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.stone200),
              ),
              child: const Icon(Icons.local_offer_rounded,
                  color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'CHỌN VOUCHER',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone900,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  'Đơn hàng: ${FormatUtils.formatCurrency(widget.orderAmount)}',
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.stone500),
                ),
              ],
            ),
          ],
        ),
      );

  Widget _buildEmpty() => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.local_offer_outlined,
                  size: 56, color: AppColors.stone300),
              const SizedBox(height: 12),
              const Text(
                'Không có voucher nào',
                style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone700),
              ),
              const SizedBox(height: 6),
              const Text(
                'Hiện không có voucher phù hợp với đơn hàng này',
                textAlign: TextAlign.center,
                style:
                    TextStyle(fontSize: 13, color: AppColors.stone500),
              ),
            ],
          ),
        ),
      );

  Widget _buildNoVoucherOption() {
    final isSelected = _selectedId == null;
    return InkWell(
      onTap: () => setState(() => _selectedId = null),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryBackground : AppColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.stone200,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(Icons.do_not_touch_rounded,
                color: isSelected ? AppColors.primary : AppColors.stone400,
                size: 22),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                'Không dùng voucher',
                style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.stone700),
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle,
                  color: AppColors.primary, size: 22),
          ],
        ),
      ),
    );
  }

  Widget _buildVoucherTile(VoucherModel v) {
    final isSelected = _selectedId == v.voucherId;
    final hasDiscount = v.discountAmount != null && v.discountAmount! > 0;
    return InkWell(
      onTap: () => setState(() => _selectedId = v.voucherId),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primaryBackground : AppColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.stone200,
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            // Left accent bar
            Container(
              width: 6,
              height: 90,
              decoration: BoxDecoration(
                color:
                    isSelected ? AppColors.primary : AppColors.stone200,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(12),
                  bottomLeft: Radius.circular(12),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Code badge
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppColors.stone900,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              v.code,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: AppColors.white,
                                fontFamily: 'monospace',
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            v.name,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.stone900,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            v.discountLabel,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isSelected
                                  ? AppColors.primary
                                  : AppColors.stone500,
                            ),
                          ),
                          if (v.minOrderAmount > 0)
                            Text(
                              'Tối thiểu ${FormatUtils.formatCurrency(v.minOrderAmount)}',
                              style: const TextStyle(
                                  fontSize: 11, color: AppColors.stone400),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        if (hasDiscount) ...[
                          Text(
                            '-${FormatUtils.formatCurrency(v.discountAmount!)}',
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: AppColors.coral,
                            ),
                          ),
                          const SizedBox(height: 4),
                        ],
                        if (isSelected)
                          const Icon(Icons.check_circle,
                              color: AppColors.primary, size: 22)
                        else
                          const Icon(Icons.radio_button_unchecked,
                              color: AppColors.stone300, size: 22),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildApplyButton() {
    final selected =
        _selectedId != null ? _vouchers.where((v) => v.voucherId == _selectedId).firstOrNull : null;
    final discount = selected?.discountAmount ?? 0;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        child: GestureDetector(
          onTap: () {
            widget.onVoucherSelected(selected);
            Navigator.of(context).pop();
          },
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 16),
            decoration: BoxDecoration(
              color: AppColors.teal600,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.stone900, width: 2),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(4, 4))
              ],
            ),
            child: Center(
              child: Text(
                _selectedId == null
                    ? 'KHÔNG DÙNG VOUCHER'
                    : 'ÁP DỤNG · TIẾT KIỆM ${FormatUtils.formatCurrency(discount)}',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.white,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
