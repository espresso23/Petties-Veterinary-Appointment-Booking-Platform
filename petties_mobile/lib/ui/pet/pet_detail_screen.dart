import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
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

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final image = await picker.pickImage(
      source: source,
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 85,
    );
    if (image != null) {
      try {
        final pet = await _petFuture;
        await _petService.updatePet(
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          dateOfBirth: pet.dateOfBirth,
          weight: pet.weight,
          gender: pet.gender,
          color: pet.color,
          allergies: pet.allergies,
          image: image,
        );
        _refreshPet();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Lỗi cập nhật ảnh: $e')),
          );
        }
      }
    }
  }

  void _showImagePickerSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.stone300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Cập nhật ảnh thú cưng',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppColors.stone900),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildPickerOption(
                  icon: Icons.camera_alt_rounded,
                  label: 'Chụp ảnh',
                  onTap: () {
                    Navigator.pop(context);
                    _pickImage(ImageSource.camera);
                  },
                ),
                _buildPickerOption(
                  icon: Icons.photo_library_rounded,
                  label: 'Thư viện',
                  onTap: () {
                    Navigator.pop(context);
                    _pickImage(ImageSource.gallery);
                  },
                ),
              ],
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildPickerOption({required IconData icon, required String label, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.stone100,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.stone200),
            ),
            child: Icon(icon, color: AppColors.primary, size: 28),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.stone700),
          ),
        ],
      ),
    );
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
                Stack(
                  children: [
                    Container(
                      height: 250,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: AppColors.stone200,
                        image: pet.imageUrl != null
                            ? DecorationImage(
                                image: NetworkImage(pet.imageUrl!),
                                fit: BoxFit.cover,
                                colorFilter: ColorFilter.mode(
                                  Colors.black.withOpacity(0.1),
                                  BlendMode.darken,
                                ),
                              )
                            : null,
                      ),
                      child: pet.imageUrl == null
                          ? const Icon(Icons.pets,
                              size: 80, color: AppColors.stone400)
                          : null,
                    ),
                    Positioned(
                      bottom: 16,
                      right: 16,
                      child: FloatingActionButton.small(
                        heroTag: 'change_avatar',
                        onPressed: _showImagePickerSheet,
                        backgroundColor: AppColors.primary,
                        child: const Icon(Icons.camera_alt, color: Colors.white),
                      ),
                    ),
                  ],
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
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.stone200),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.stone900.withOpacity(0.05),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
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
                                  horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: AppColors.stone50,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(color: AppColors.stone200),
                              ),
                              child: Text(
                                '${pet.species} • ${pet.breed}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.stone700,
                                  fontSize: 12,
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
                          _buildDetailItem('NGÀY SINH',
                              DateFormat('dd/MM/yyyy').format(pet.dateOfBirth)),
                          const SizedBox(width: 16),
                          _buildDetailItem('CÂN NẶNG', '${pet.weight} kg'),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          _buildDetailItem('GIỚI TÍNH',
                              pet.gender == 'MALE' ? 'Đực' : 'Cái'),
                          const SizedBox(width: 16),
                          _buildDetailItem(
                              'TUỔI', _calculateAge(pet.dateOfBirth)),
                        ],
                      ),

                      const SizedBox(height: 32),
                      // Actions
                      _buildActionButton(
                        icon: Icons.history,
                        label: 'LỊCH SỬ KHÁM',
                        color: AppColors.primary,
                        onTap: () {
                          context.push(
                            '${AppRoutes.petHealthRecord.replaceAll(':id', widget.id)}?tab=1',
                          );
                        },
                      ),
                      const SizedBox(height: 16),
                      _buildActionButton(
                        icon: Icons.vaccines,
                        label: 'SỔ TIÊM CHỦNG',
                        color: AppColors.stone200,
                        onTap: () {
                          context.push(
                            '${AppRoutes.petHealthRecord.replaceAll(':id', widget.id)}?tab=0',
                          );
                        },
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
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.stone200),
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
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color == AppColors.primary ? Colors.transparent : AppColors.stone200),
          boxShadow: [
            BoxShadow(
              color: color.withOpacity(0.2),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
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
            child:
                const Text('HỦY', style: TextStyle(color: AppColors.stone900)),
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
