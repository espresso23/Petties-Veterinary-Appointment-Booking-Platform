import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../data/models/pet.dart';
import '../../data/services/pet_service.dart';
import '../../config/constants/app_colors.dart';
import '../../routing/app_routes.dart';

class PetDetailScreen extends StatefulWidget {
  final String id;

  const PetDetailScreen({super.key, required this.id});

  @override
  State<PetDetailScreen> createState() => _PetDetailScreenState();
}

class _PetDetailScreenState extends State<PetDetailScreen> {
  final _petService = PetService();
  late Future<Pet> _petFuture;

  @override
  void initState() {
    super.initState();
    _refreshPet();
  }

  void _refreshPet() {
    setState(() {
      _petFuture = _petService.getPet(widget.id);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () async {
              final result = await context.push(
                AppRoutes.editPet.replaceAll(':id', widget.id),
              );
              if (result == true) _refreshPet();
            },
          ),
          IconButton(
            icon: const Icon(Icons.delete),
            onPressed: _confirmDelete,
          ),
        ],
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.white,
        title: const Text('CHI TIẾT THÚ CƯNG'),
      ),
      body: FutureBuilder<Pet>(
        future: _petFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(child: Text('Lỗi: ${snapshot.error}'));
          }

          final pet = snapshot.data!;
          return SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header Image
                Container(
                  height: 250,
                  decoration: BoxDecoration(
                    color: AppColors.stone200,
                    border: const Border(
                      bottom: BorderSide(color: AppColors.stone900, width: 4),
                    ),
                    image: pet.imageUrl != null
                        ? DecorationImage(
                            image: NetworkImage(pet.imageUrl!),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: pet.imageUrl == null
                      ? const Icon(Icons.pets, size: 80, color: AppColors.stone400)
                      : null,
                ),

                // Info
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      // Name Card
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: AppColors.white,
                          border: Border.all(color: AppColors.stone900, width: 3),
                          boxShadow: const [
                            BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
                          ],
                        ),
                        child: Column(
                          children: [
                            Text(
                              pet.name.toUpperCase(),
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w900,
                                color: AppColors.stone900,
                                letterSpacing: 1.5,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                border: Border.all(color: AppColors.stone900, width: 2),
                              ),
                              child: Text(
                                '${pet.species} • ${pet.breed}'.toUpperCase(),
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.white,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Details Grid
                      Row(
                        children: [
                          _buildDetailItem(
                              'NGÀY SINH', DateFormat('dd/MM/yyyy').format(pet.dateOfBirth)),
                          const SizedBox(width: 16),
                          _buildDetailItem('CÂN NẶNG', '${pet.weight} kg'),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          _buildDetailItem(
                              'GIỚI TÍNH', pet.gender == 'MALE' ? 'Đực' : 'Cái'),
                          const SizedBox(width: 16),
                          _buildDetailItem('TUỔI', _calculateAge(pet.dateOfBirth)),
                        ],
                      ),

                      const SizedBox(height: 32),
                      // Actions
                      _buildActionButton(
                        icon: Icons.history,
                        label: 'LỊCH SỬ KHÁM',
                        color: AppColors.primary,
                        onTap: () {},
                      ),
                      const SizedBox(height: 16),
                      _buildActionButton(
                        icon: Icons.vaccines,
                        label: 'SỔ TIÊM CHỦNG',
                        color: AppColors.stone200,
                        onTap: () {},
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  String _calculateAge(DateTime birthDate) {
    final now = DateTime.now();
    int years = now.year - birthDate.year;
    int months = now.month - birthDate.month;
    
    if (months < 0 || (months == 0 && now.day < birthDate.day)) {
      years--;
      months += 12;
    }
    
    if (now.day < birthDate.day) {
      months--;
    }
    
    if (years > 0) {
      return '$years tuổi ${months > 0 ? "$months tháng" : ""}';
    } else {
      return '$months tháng';
    }
  }

  Widget _buildDetailItem(String label, String value) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.white,
          border: Border.all(color: AppColors.stone900, width: 2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.stone500,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color,
          border: Border.all(color: AppColors.stone900, width: 3),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
          ],
        ),
        child: Row(
          children: [
            Icon(icon, color: AppColors.stone900),
            const SizedBox(width: 12),
            Text(
              label,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
                letterSpacing: 1,
              ),
            ),
            const Spacer(),
            const Icon(Icons.arrow_forward, color: AppColors.stone900),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.white,
        shape: const RoundedRectangleBorder(
            side: BorderSide(color: AppColors.stone900, width: 3)),
        title: const Text('XÓA THÚ CƯNG?'),
        content: const Text('Hành động này không thể hoàn tác.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('HỦY', style: TextStyle(color: AppColors.stone900)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              shape: const RoundedRectangleBorder(),
            ),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('XÓA'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        await _petService.deletePet(widget.id);
        if (mounted) {
          context.pop(true); // Return true to refresh list
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Lỗi xóa: $e')),
          );
        }
      }
    }
  }
}
