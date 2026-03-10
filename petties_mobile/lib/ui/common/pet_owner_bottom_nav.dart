import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../config/constants/app_colors.dart';
import '../../routing/app_routes.dart';
import '../../utils/storage_service.dart';
import '../chat/ai_chat_bubble.dart';

/// Bottom navigation bar dùng chung cho Pet Owner
class PetOwnerBottomNav extends StatefulWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;
  final bool showAiBubble;
  final bool showAiNotificationDot;

  const PetOwnerBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.showAiBubble = true,
    this.showAiNotificationDot = false,
  });

  @override
  State<PetOwnerBottomNav> createState() => _PetOwnerBottomNavState();
}

class _PetOwnerBottomNavState extends State<PetOwnerBottomNav> {
  static const double _bubbleWidth = 168;
  static const double _minLeft = 12;
  static const double _horizontalMargin = 16;
  static const double _defaultTop = -84;
  static const double _minTop = -132;
  static const double _maxTop = -10;
  static const String _bubbleXRatioKey = 'pet_owner_ai_bubble_x_ratio';
  static const String _bubbleTopKey = 'pet_owner_ai_bubble_top';

  final StorageService _storage = StorageService();

  double? _bubbleXRatio;
  double? _bubbleTop;

  @override
  void initState() {
    super.initState();
    _restoreBubblePosition();
  }

  Future<void> _restoreBubblePosition() async {
    final storedRatio = await _storage.getDouble(_bubbleXRatioKey);
    final storedTop = await _storage.getDouble(_bubbleTopKey);

    if (!mounted) return;

    setState(() {
      _bubbleXRatio = storedRatio;
      _bubbleTop = storedTop;
    });
  }

  Future<void> _persistBubblePosition({
    required double left,
    required double maxLeft,
    required double top,
  }) async {
    final range = (maxLeft - _minLeft).clamp(1, double.infinity);
    final ratio = ((left - _minLeft) / range).clamp(0.0, 1.0);

    _bubbleXRatio = ratio;
    _bubbleTop = top;

    await _storage.setDouble(_bubbleXRatioKey, ratio);
    await _storage.setDouble(_bubbleTopKey, top);
  }

  double _resolveBubbleLeft(double maxLeft) {
    final defaultLeft = maxLeft - (_horizontalMargin - _minLeft);
    final ratio = _bubbleXRatio;

    if (ratio == null) {
      return defaultLeft.clamp(_minLeft, maxLeft);
    }

    return (_minLeft + (maxLeft - _minLeft) * ratio).clamp(_minLeft, maxLeft);
  }

  double _resolveBubbleTop() {
    return (_bubbleTop ?? _defaultTop).clamp(_minTop, _maxTop);
  }

  Future<void> _snapBubble({
    required double currentLeft,
    required double maxLeft,
    required double currentTop,
  }) async {
    final middle = (_minLeft + maxLeft) / 2;
    final snappedLeft = currentLeft < middle ? _minLeft : maxLeft;

    if (!mounted) return;

    setState(() {
      _bubbleXRatio = snappedLeft <= _minLeft ? 0 : 1;
      _bubbleTop = currentTop.clamp(_minTop, _maxTop);
    });

    await _persistBubblePosition(
      left: snappedLeft,
      maxLeft: maxLeft,
      top: currentTop.clamp(_minTop, _maxTop),
    );
  }

  @override
  Widget build(BuildContext context) {
    final bottomPadding = MediaQuery.of(context).padding.bottom;

    return SizedBox(
      height: 56 + bottomPadding,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final maxLeft = (constraints.maxWidth - _bubbleWidth - 12).clamp(_minLeft, double.infinity);
          final currentOffset = Offset(
            _resolveBubbleLeft(maxLeft),
            _resolveBubbleTop(),
          );

          return Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                child: Container(
                  decoration: const BoxDecoration(
                    color: AppColors.white,
                    border: Border(
                      top: BorderSide(color: AppColors.stone900, width: 2),
                    ),
                  ),
                  padding: EdgeInsets.only(
                    left: MediaQuery.of(context).padding.left,
                    right: MediaQuery.of(context).padding.right,
                    bottom: bottomPadding,
                  ),
                  child: MediaQuery(
                    data: MediaQuery.of(context).copyWith(
                      textScaler: TextScaler.noScaling,
                    ),
                    child: BottomNavigationBar(
                      type: BottomNavigationBarType.fixed,
                      backgroundColor: AppColors.white,
                      selectedItemColor: AppColors.primary,
                      unselectedItemColor: AppColors.stone400,
                      selectedLabelStyle: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 10,
                      ),
                      unselectedLabelStyle: const TextStyle(fontSize: 10),
                      currentIndex: widget.currentIndex,
                      elevation: 0,
                      onTap: widget.onTap,
                      items: const [
                        BottomNavigationBarItem(icon: Icon(Icons.home), label: 'TRANG CHỦ'),
                        BottomNavigationBarItem(icon: Icon(Icons.explore), label: 'KHÁM PHÁ'),
                        BottomNavigationBarItem(icon: Icon(Icons.calendar_today), label: 'LỊCH HẸN'),
                        BottomNavigationBarItem(icon: Icon(Icons.chat_bubble_outline), label: 'TIN NHẮN'),
                        BottomNavigationBarItem(icon: Icon(Icons.person), label: 'TÀI KHOẢN'),
                      ],
                    ),
                  ),
                ),
              ),
              if (widget.showAiBubble)
                Positioned(
                  left: currentOffset.dx,
                  top: currentOffset.dy,
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onPanUpdate: (details) {
                      setState(() {
                        _bubbleXRatio = ((currentOffset.dx + details.delta.dx - _minLeft) /
                                (maxLeft - _minLeft).clamp(1, double.infinity))
                            .clamp(0.0, 1.0);
                        _bubbleTop = (currentOffset.dy + details.delta.dy).clamp(_minTop, _maxTop);
                      });
                    },
                    onPanEnd: (_) => _snapBubble(
                      currentLeft: currentOffset.dx,
                      maxLeft: maxLeft,
                      currentTop: currentOffset.dy,
                    ),
                    child: AiChatBubble(
                      showNotificationDot: widget.showAiNotificationDot,
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// Hàm điều hướng mặc định dùng lại logic như Home
void handlePetOwnerNavTap(BuildContext context, int index) {
  switch (index) {
    case 0:
      context.go(AppRoutes.petOwnerHome);
      break;
    case 1:
      context.go('${AppRoutes.petOwnerHome}?tab=1');
      break;
    case 2:
      context.go('${AppRoutes.petOwnerHome}?tab=2');
      break;
    case 3:
      context.go(AppRoutes.chatList);
      break;
    case 4:
      context.go(AppRoutes.profile);
      break;
  }
}
