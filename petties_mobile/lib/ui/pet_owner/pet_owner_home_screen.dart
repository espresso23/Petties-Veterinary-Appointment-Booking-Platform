import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../config/constants/app_colors.dart';
import '../../routing/app_routes.dart';
import '../../data/services/pet_service.dart';
import '../../data/models/pet.dart';
import '../clinics/clinic_search_view.dart';
import '../booking/my_bookings_tab.dart';

/// Pet Owner Home Screen - Neobrutalism Style
class PetOwnerHomeScreen extends StatefulWidget {
  final int initialTabIndex;

  const PetOwnerHomeScreen({
    super.key,
    this.initialTabIndex = 0,
  });

  @override
  State<PetOwnerHomeScreen> createState() => _PetOwnerHomeScreenState();
}

class _PetOwnerHomeScreenState extends State<PetOwnerHomeScreen> {
  final PetService _petService = PetService();
  List<Pet> _pets = [];
  bool _isLoading = true;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialTabIndex;
    _fetchPets();
  }

  Future<void> _fetchPets() async {
    setState(() => _isLoading = true);
    try {
      final pets = await _petService.getMyPets();
      if (mounted) {
        setState(() {
          _pets = pets;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _onTabTapped(int index) {
    setState(() {
      _currentIndex = index;
    });

    switch (index) {
      case 0:
        // Home Tab
        break;
      case 1:
        // Explore Tab (switched via body)
        break;
      case 2:
        // Appointments Tab (switched via body)
        break;
      case 3:
        // Chat Tab - Navigate to chat list
        context.push(AppRoutes.chatList);
        break;
      case 4:
        // Profile - Navigate to profile screen
        context.push(AppRoutes.profile);
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    // Determine title based on tab
    String title = 'PETTIES';
    bool showActions = true;
    
    if (_currentIndex == 1) {
      title = 'KHÁM PHÁ';
      showActions = false;
    } else if (_currentIndex == 2) {
      title = 'LỊCH HẸN';
      showActions = false;
    }

    final authProvider = Provider.of<AuthProvider>(context);
    
    // Choose body widget
    Widget bodyContent;
    switch (_currentIndex) {
      case 1:
        bodyContent = const ClinicSearchView(embedMode: true);
        break;
      case 2:
        bodyContent = const MyBookingsTab();
        break;
      case 0:
      default:
        bodyContent = _buildHomeTab(context, authProvider);
        break;
    }

    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: _currentIndex == 1 ? null : AppBar( // Hide AppBar for Search Tab (it has its own header)
        backgroundColor: AppColors.primary,
        elevation: 0,
        title: Text(
          title,
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            letterSpacing: 2,
            color: AppColors.white,
          ),
        ),
        actions: showActions ? [
           IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () => context.push(AppRoutes.notifications),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              authProvider.logout();
              context.go(AppRoutes.login);
            },
          ),
        ] : [],
      ),
      body: bodyContent,
      bottomNavigationBar: _buildBrutalNavBar(context),
    );
  }

  Widget _buildHomeTab(BuildContext context, AuthProvider authProvider) {
    final user = authProvider.user;
    return RefreshIndicator(
      onRefresh: _fetchPets,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Welcome Header - Brutal Card
            _buildWelcomeCard(
                context, user?.fullName ?? user?.username ?? 'Pet Owner'),
            const SizedBox(height: 24),

            // Quick Actions
            _buildSectionTitle('HÀNH ĐỘNG NHANH'),
            const SizedBox(height: 12),
            _buildQuickActions(context),
            const SizedBox(height: 24),

            // My Pets Section
            _buildSectionHeader(context, 'THÚ CƯNG CỦA TÔI', 'Xem tất cả'),
            const SizedBox(height: 12),
            _buildMyPetsCard(context),
            const SizedBox(height: 24),

            // Upcoming Bookings
            _buildSectionHeader(context, 'LỊCH HẸN SẮP TỚI', 'Xem tất cả'),
            const SizedBox(height: 12),
            _buildBookingsCard(context),
          ],
        ),
      ),
    );
  }

  Widget _buildWelcomeCard(BuildContext context, String username) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'CHÀO MỪNG, $username!',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone900,
                    letterSpacing: 1,
                  ),
                ),
              ),
              const Icon(
                Icons.waving_hand,
                color: AppColors.primary,
                size: 24,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Hôm nay bạn muốn làm gì cho thú cưng?',
            style: TextStyle(
              fontSize: 14,
              color: AppColors.stone600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w800,
        color: AppColors.stone900,
        letterSpacing: 1.5,
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
            child: _buildActionCard(
                Icons.local_hospital, 'Đặt lịch\nkhám', AppColors.primary)),
        const SizedBox(width: 12),
        Expanded(
            child: _buildActionCard(
                Icons.home_work, 'Khám\ntại nhà', AppColors.primaryDark)),
        const SizedBox(width: 12),
        Expanded(
            child: GestureDetector(
          onTap: () async {
            await context.push(AppRoutes.addPet);
            _fetchPets(); // Refresh after returning
          },
          child:
              _buildActionCard(Icons.pets, 'Thêm\npet', AppColors.primaryLight),
        )),
        const SizedBox(width: 12),
        Expanded(
            child: GestureDetector(
          onTap: () => context.push(AppRoutes.myPets),
          child: _buildActionCard(
              Icons.medical_services, 'Sổ\ntiêm', AppColors.primary),
        )),
      ],
    );
  }

  Widget _buildActionCard(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              border: Border.all(color: AppColors.stone900, width: 2),
            ),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.stone900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(
      BuildContext context, String title, String actionText) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: AppColors.stone900,
            letterSpacing: 1.5,
          ),
        ),
        TextButton(
          onPressed: () async {
            if (title == 'THÚ CƯNG CỦA TÔI') {
              await context.push(AppRoutes.myPets);
              _fetchPets(); // Refresh when back from list
            }
          },
          child: Text(
            actionText,
            style: const TextStyle(
              color: AppColors.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMyPetsCard(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_pets.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.stone900, width: 2),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
          ],
        ),
        child: const Center(
          child: Column(
            children: [
              Icon(Icons.pets, size: 48, color: AppColors.stone400),
              SizedBox(height: 12),
              Text(
                'CHƯA CÓ THÚ CƯNG',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone900,
                  letterSpacing: 1,
                ),
              ),
              SizedBox(height: 4),
              Text(
                'Thêm thú cưng để bắt đầu',
                style: TextStyle(color: AppColors.stone500),
              ),
            ],
          ),
        ),
      );
    }

    // Horizontal List for Pets
    return SizedBox(
      height: 180,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _pets.length,
        separatorBuilder: (context, index) => const SizedBox(width: 16),
        itemBuilder: (context, index) {
          final pet = _pets[index];
          return GestureDetector(
            onTap: () {
              context.push('/pets/${pet.id}');
            },
            child: Container(
              width: 160,
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.stone900, width: 2),
                boxShadow: const [
                  BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: pet.imageUrl != null
                        ? Image.network(
                            pet.imageUrl!,
                            fit: BoxFit.cover,
                          )
                        : Container(
                            color: AppColors.stone200,
                            child: const Icon(Icons.pets,
                                size: 40, color: AppColors.stone500),
                          ),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          pet.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: AppColors.stone900,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          pet.breed,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppColors.stone600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildBookingsCard(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: const Center(
        child: Column(
          children: [
            Icon(Icons.calendar_today, size: 48, color: AppColors.stone400),
            SizedBox(height: 12),
            Text(
              'CHƯA CÓ LỊCH HẸN',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.stone900,
                letterSpacing: 1,
              ),
            ),
            SizedBox(height: 4),
            Text(
              'Đặt lịch khám cho thú cưng',
              style: TextStyle(color: AppColors.stone500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBrutalNavBar(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(
          top: BorderSide(color: AppColors.stone900, width: 2),
        ),
      ),
      child: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        backgroundColor: AppColors.white,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.stone400,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700),
        currentIndex: _currentIndex,
        elevation: 0,
        onTap: _onTabTapped,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'TRANG CHỦ'),
          BottomNavigationBarItem(
              icon: Icon(Icons.explore), label: 'KHÁM PHÁ'),
          BottomNavigationBarItem(
              icon: Icon(Icons.calendar_today), label: 'LỊCH HẸN'),
          BottomNavigationBarItem(
              icon: Icon(Icons.chat_bubble_outline), label: 'TIN NHẮN'),
          BottomNavigationBarItem(
              icon: Icon(Icons.person), label: 'TÀI KHOẢN'),
        ],
      ),
    );
  }
}
