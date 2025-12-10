import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../config/constants/app_colors.dart';
import '../../routing/app_routes.dart';

/// Onboarding Screen with Neobrutalism style
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<OnboardingData> _pages = [
    OnboardingData(
      icon: Icons.calendar_month_outlined,
      title: 'ĐẶT LỊCH KHÁM',
      subtitle: 'Đặt lịch hẹn với bác sĩ thú y\nchỉ với vài thao tác',
      color: AppColors.primary,
    ),
    OnboardingData(
      icon: Icons.smart_toy_outlined,
      title: 'AI TƯ VẤN 24/7',
      subtitle: 'Trợ lý AI thông minh\nsẵn sàng hỗ trợ bạn mọi lúc',
      color: AppColors.primary,
    ),
    OnboardingData(
      icon: Icons.folder_shared_outlined,
      title: 'HỒ SƠ SỨC KHỎE',
      subtitle: 'Quản lý hồ sơ sức khỏe\nđiện tử cho thú cưng',
      color: AppColors.primary,
    ),
  ];

  void _nextPage() {
    if (_currentPage < _pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    } else {
      _goToLogin();
    }
  }

  void _goToLogin() {
    context.go(AppRoutes.login);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      body: SafeArea(
        child: Column(
          children: [
            // Skip Button
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Align(
                alignment: Alignment.topRight,
                child: TextButton(
                  onPressed: _goToLogin,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.stone900,
                    textStyle: const TextStyle(
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                    ),
                  ),
                  child: const Text('BỎ QUA'),
                ),
              ),
            ),

            // Page View
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (index) {
                  setState(() => _currentPage = index);
                },
                itemCount: _pages.length,
                itemBuilder: (context, index) {
                  return _buildPage(_pages[index]);
                },
              ),
            ),

            // Page Indicators
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 32.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(_pages.length, (index) {
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    margin: const EdgeInsets.symmetric(horizontal: 6),
                    width: _currentPage == index ? 32 : 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: _currentPage == index
                          ? AppColors.primary
                          : AppColors.stone200,
                      border: Border.all(
                        color: AppColors.stone900,
                        width: 3,
                      ),
                      boxShadow: _currentPage == index
                          ? [
                              const BoxShadow(
                                color: AppColors.stone900,
                                offset: Offset(2, 2),
                              )
                            ]
                          : [],
                    ),
                  );
                }),
              ),
            ),

            // Bottom Buttons
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 48),
              child: Row(
                children: [
                  // Back button (visible after first page)
                  if (_currentPage > 0)
                    Expanded(
                      child: _BrutalButton(
                        onPressed: () {
                          _pageController.previousPage(
                            duration: const Duration(milliseconds: 300),
                            curve: Curves.easeInOut,
                          );
                        },
                        label: 'QUAY LẠI',
                        isOutlined: true,
                      ),
                    ),
                  if (_currentPage > 0) const SizedBox(width: 16),
                  // Next/Start button
                  Expanded(
                    flex: _currentPage > 0 ? 1 : 2,
                    child: _BrutalButton(
                      onPressed: _nextPage,
                      label: _currentPage == _pages.length - 1
                          ? 'BẮT ĐẦU'
                          : 'TIẾP THEO',
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

  Widget _buildPage(OnboardingData data) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Icon Card - Brutal Style
          Stack(
            children: [
              // Background decorative shape
              Transform.rotate(
                angle: -0.1,
                child: Container(
                  width: 180,
                  height: 180,
                  decoration: BoxDecoration(
                    color: AppColors.stone200,
                    border: Border.all(
                      color: AppColors.stone900,
                      width: 4,
                    ),
                  ),
                ),
              ),
              // Main Icon Container
              Container(
                width: 180,
                height: 180,
                decoration: BoxDecoration(
                  color: AppColors.white,
                  border: Border.all(
                    color: AppColors.stone900,
                    width: 4,
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: AppColors.stone900,
                      offset: Offset(8, 8),
                    ),
                  ],
                ),
                child: Center(
                  child: Icon(
                    data.icon,
                    size: 80,
                    color: AppColors.stone900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 64),

          // Title - Brutal Typography
          Text(
            data.title,
            style: const TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w900,
              color: AppColors.stone900,
              letterSpacing: 1.5,
              height: 1.1,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),

          // Subtitle
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.amber50,
              border: Border.all(
                color: AppColors.stone900,
                width: 3,
              ),
              boxShadow: const [
                BoxShadow(
                  color: AppColors.stone900,
                  offset: Offset(4, 4),
                ),
              ],
            ),
            child: Text(
              data.subtitle,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppColors.stone700,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

/// Onboarding page data model
class OnboardingData {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;

  OnboardingData({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
  });
}

/// Neobrutalism styled button
class _BrutalButton extends StatefulWidget {
  final VoidCallback onPressed;
  final String label;
  final bool isOutlined;

  const _BrutalButton({
    required this.onPressed,
    required this.label,
    this.isOutlined = false,
  });

  @override
  State<_BrutalButton> createState() => _BrutalButtonState();
}

class _BrutalButtonState extends State<_BrutalButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) => setState(() => _isPressed = false),
      onTapCancel: () => setState(() => _isPressed = false),
      onTap: widget.onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        transform: Matrix4.translationValues(
          _isPressed ? 4 : 0,
          _isPressed ? 4 : 0,
          0,
        ),
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: widget.isOutlined ? AppColors.white : AppColors.primary,
          border: Border.all(
            color: AppColors.stone900,
            width: 4,
          ),
          boxShadow: [
            BoxShadow(
              color: AppColors.stone900,
              offset: Offset(_isPressed ? 0 : 4, _isPressed ? 0 : 4),
            ),
          ],
        ),
        child: Center(
          child: Text(
            widget.label,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: widget.isOutlined ? AppColors.stone900 : AppColors.white,
              letterSpacing: 1.5,
            ),
          ),
        ),
      ),
    );
  }
}
