import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../../config/constants/app_colors.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/user_provider.dart';
import '../../../routing/app_routes.dart';
import '../../widgets/profile/avatar_picker.dart';
import '../../widgets/profile/profile_info_card.dart';

/// Profile Screen - Main profile view
/// Displays user profile with Neobrutalism style
/// Available for PET_OWNER and VET roles
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    // Fetch profile on init
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<UserProvider>().fetchProfile();
    });
  }

  void _handleLogout() {
    showDialog(
      context: context,
      builder: (context) => _buildLogoutDialog(),
    );
  }

  Widget _buildLogoutDialog() {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.white,
          border: Border.all(color: AppColors.stone900, width: 4),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(6, 6)),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                border: Border.all(color: AppColors.stone900, width: 3),
              ),
              child: const Icon(
                Icons.logout,
                color: AppColors.error,
                size: 40,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'ĐĂNG XUẤT',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: AppColors.stone600,
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: _buildDialogButton(
                    label: 'HỦY',
                    onTap: () => Navigator.pop(context),
                    isPrimary: false,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildDialogButton(
                    label: 'ĐĂNG XUẤT',
                    onTap: () {
                      Navigator.pop(context);
                      context.read<AuthProvider>().logout();
                      context.read<UserProvider>().reset();
                      context.go(AppRoutes.login);
                    },
                    isPrimary: true,
                    isDestructive: true,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDialogButton({
    required String label,
    required VoidCallback onTap,
    bool isPrimary = true,
    bool isDestructive = false,
  }) {
    final bgColor = isPrimary
        ? (isDestructive ? AppColors.error : AppColors.primary)
        : AppColors.white;
    final textColor = isPrimary ? AppColors.white : AppColors.stone900;

    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: bgColor,
          border: Border.all(color: AppColors.stone900, width: 3),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
          ],
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: textColor,
            letterSpacing: 0.5,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: _buildAppBar(),
      body: Consumer<UserProvider>(
        builder: (context, userProvider, child) {
          if (userProvider.isLoading) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            );
          }

          if (userProvider.error != null && userProvider.profile == null) {
            return _buildErrorState(userProvider);
          }

          return _buildProfileContent(userProvider);
        },
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.primary,
      elevation: 0,
      centerTitle: true,
      title: const Text(
        'TÀI KHOẢN',
        style: TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: AppColors.white,
          letterSpacing: 2,
        ),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.settings_outlined),
          onPressed: () {
            // TODO: Navigate to settings
          },
        ),
      ],
    );
  }

  Widget _buildErrorState(UserProvider userProvider) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.error.withOpacity(0.1),
                border: Border.all(color: AppColors.stone900, width: 3),
              ),
              child: const Icon(
                Icons.error_outline,
                color: AppColors.error,
                size: 48,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              userProvider.error ?? 'Có lỗi xảy ra',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 16,
                color: AppColors.stone600,
              ),
            ),
            const SizedBox(height: 24),
            InkWell(
              onTap: () => userProvider.fetchProfile(),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  border: Border.all(color: AppColors.stone900, width: 3),
                  boxShadow: const [
                    BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
                  ],
                ),
                child: const Text(
                  'THỬ LẠI',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.white,
                    letterSpacing: 1,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileContent(UserProvider userProvider) {
    final profile = userProvider.profile;

    return RefreshIndicator(
      onRefresh: () => userProvider.fetchProfile(),
      color: AppColors.primary,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Profile header with avatar
            _buildProfileHeader(userProvider),

            // Personal info section
            const ProfileSectionHeader(title: 'Thông tin cá nhân'),
            ProfileInfoGroup(
              children: [
                ProfileInfoCard(
                  label: 'Họ và tên',
                  value: profile?.fullName,
                  icon: Icons.person_outline,
                  showBottomBorder: true,
                ),
                ProfileInfoCard(
                  label: 'Số điện thoại',
                  value: profile?.phone,
                  icon: Icons.phone_outlined,
                  showBottomBorder: true,
                ),
                ProfileInfoCard(
                  label: 'Email',
                  value: profile?.email,
                  icon: Icons.email_outlined,
                ),
              ],
            ),

            // Account info section
            const ProfileSectionHeader(title: 'Thông tin tài khoản'),
            ProfileInfoGroup(
              children: [
                ProfileInfoCard(
                  label: 'Tên đăng nhập',
                  value: profile?.username,
                  icon: Icons.account_circle_outlined,
                  showBottomBorder: true,
                ),
                ProfileInfoCard(
                  label: 'Vai trò',
                  value: profile?.roleDisplayText,
                  icon: Icons.badge_outlined,
                ),
              ],
            ),

            // Actions section
            const ProfileSectionHeader(title: 'Thao tác'),
            ProfileInfoGroup(
              children: [
                ProfileActionButton(
                  label: 'Chỉnh sửa thông tin',
                  icon: Icons.edit_outlined,
                  onTap: () => context.push(AppRoutes.editProfile),
                ),
                Container(height: 1, color: AppColors.stone200),
                ProfileActionButton(
                  label: 'Đổi mật khẩu',
                  icon: Icons.lock_outline,
                  onTap: () => context.push(AppRoutes.changePassword),
                ),
                Container(height: 1, color: AppColors.stone200),
                ProfileActionButton(
                  label: 'Đăng xuất',
                  icon: Icons.logout,
                  isDestructive: true,
                  onTap: _handleLogout,
                ),
              ],
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileHeader(UserProvider userProvider) {
    final profile = userProvider.profile;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        color: AppColors.primaryBackground,
        border: Border(
          bottom: BorderSide(color: AppColors.stone900, width: 4),
        ),
      ),
      child: Column(
        children: [
          // Avatar
          AvatarPicker(
            avatarUrl: profile?.avatar,
            isLoading: userProvider.isUploadingAvatar,
            size: 100,
            editable: true,
            onImageSelected: (file) => userProvider.uploadAvatar(file),
            onDelete: () => userProvider.deleteAvatar(),
          ),
          const SizedBox(height: 16),

          // Display name
          Text(
            profile?.displayName ?? 'Người dùng',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: AppColors.stone900,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),

          // Email
          Text(
            profile?.email ?? '',
            style: const TextStyle(
              fontSize: 14,
              color: AppColors.stone600,
            ),
          ),
          const SizedBox(height: 8),

          // Role badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.15),
              border: Border.all(color: AppColors.stone900, width: 2),
            ),
            child: Text(
              profile?.roleDisplayText.toUpperCase() ?? '',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
                letterSpacing: 1,
              ),
            ),
          ),

          // Profile completion hint
          if (profile != null && !profile.isProfileComplete) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.warning.withOpacity(0.1),
                border: Border.all(color: AppColors.stone900, width: 2),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.info_outline,
                    color: AppColors.warning,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Hoàn thành hồ sơ để sử dụng đầy đủ tính năng',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.stone700,
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
}
