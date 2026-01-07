import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../data/models/pet.dart';
import '../../data/services/pet_service.dart';
import '../../config/constants/app_colors.dart';
import '../core/widgets/custom_button.dart';
import '../../routing/app_routes.dart';

class PetListScreen extends StatefulWidget {
  const PetListScreen({super.key});

  @override
  State<PetListScreen> createState() => _PetListScreenState();
}

class _PetListScreenState extends State<PetListScreen> {
  final _petService = PetService();
  late Future<List<Pet>> _petsFuture;

  @override
  void initState() {
    super.initState();
    _refreshPets();
  }

  void _refreshPets() {
    setState(() {
      _petsFuture = _petService.getMyPets();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        title: const Text('THÚ CƯNG CỦA TÔI'),
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.add),
            onPressed: () async {
              final result = await context.push(AppRoutes.addPet);
              if (result == true) _refreshPets();
            },
          ),
        ],
      ),
      body: FutureBuilder<List<Pet>>(
        future: _petsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(child: Text('Lỗi: ${snapshot.error}'));
          }

          final pets = snapshot.data ?? [];

          if (pets.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.pets, size: 64, color: AppColors.stone400),
                  const SizedBox(height: 16),
                  const Text(
                    'Bạn chưa có thú cưng nào',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppColors.stone600,
                    ),
                  ),
                  const SizedBox(height: 24),
                  CustomButton(
                    text: 'Thêm Thú Cưng',
                    onPressed: () async {
                      final result = await context.push(AppRoutes.addPet);
                      if (result == true) _refreshPets();
                    },
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: pets.length,
            itemBuilder: (context, index) {
              final pet = pets[index];
              return _buildPetCard(pet);
            },
          );
        },
      ),
    );
  }

  Widget _buildPetCard(Pet pet) {
    return GestureDetector(
      onTap: () async {
        final result = await context.push(
          AppRoutes.petDetails.replaceAll(':id', pet.id),
        );
        if (result == true) _refreshPets();
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.stone900, width: 2),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: AppColors.stone200,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(12),
                  bottomLeft: Radius.circular(12),
                ),
                border: const Border(
                  right: BorderSide(color: AppColors.stone900, width: 2),
                ),
                image: pet.imageUrl != null
                    ? DecorationImage(
                        image: NetworkImage(pet.imageUrl!),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: pet.imageUrl == null
                  ? const Icon(Icons.pets, size: 40, color: AppColors.stone400)
                  : null,
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      pet.name.toUpperCase(),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: AppColors.stone900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${pet.species} • ${pet.breed}',
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.stone600,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color:
                            _getGenderColor(pet.gender).withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.stone900, width: 2),
                      ),
                      child: Text(
                        _getGenderText(pet.gender),
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: _getGenderColor(pet.gender),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const Padding(
              padding: EdgeInsets.all(12),
              child: Icon(Icons.arrow_forward_ios, size: 16),
            ),
          ],
        ),
      ),
    );
  }

  Color _getGenderColor(String gender) {
    if (gender == 'MALE') return Colors.blue[700]!;
    if (gender == 'FEMALE') return Colors.pink[700]!;
    return AppColors.stone600;
  }

  String _getGenderText(String gender) {
    if (gender == 'MALE') return 'ĐỰC';
    if (gender == 'FEMALE') return 'CÁI';
    return gender;
  }
}
