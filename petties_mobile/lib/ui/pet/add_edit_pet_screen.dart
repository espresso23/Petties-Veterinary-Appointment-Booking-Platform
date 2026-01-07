import 'dart:io';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../data/models/pet.dart';
import '../../data/services/pet_service.dart';
import '../../config/constants/app_colors.dart';
import '../core/widgets/custom_button.dart';
import '../core/widgets/custom_text_field.dart';

class AddEditPetScreen extends StatefulWidget {
  final String? id; // If null, it's Add mode. If not, Edit mode.

  const AddEditPetScreen({super.key, this.id});

  @override
  State<AddEditPetScreen> createState() => _AddEditPetScreenState();
}

class _AddEditPetScreenState extends State<AddEditPetScreen> {
  final _formKey = GlobalKey<FormState>();
  final _petService = PetService();
  bool _isLoading = false;

  // Controllers
  final _nameController = TextEditingController();
  final _speciesController = TextEditingController();
  final _breedController = TextEditingController();
  final _weightController = TextEditingController();

  DateTime? _selectedDateOfBirth;
  String _selectedGender = 'MALE';
  XFile? _selectedImage;
  String? _currentImageUrl;

  @override
  void initState() {
    super.initState();
    if (widget.id != null) {
      _loadPetData(widget.id!);
    }
  }

  Future<void> _loadPetData(String id) async {
    setState(() => _isLoading = true);
    try {
      final pet = await _petService.getPet(id);
      _nameController.text = pet.name;
      _speciesController.text = pet.species;
      _breedController.text = pet.breed;
      _weightController.text = pet.weight.toString();
      _selectedDateOfBirth = pet.dateOfBirth;
      _selectedGender = pet.gender;
      _currentImageUrl = pet.imageUrl;
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi tải thông tin: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery);
    if (image != null) {
      setState(() {
        _selectedImage = image;
      });
    }
  }

  Future<void> _selectDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDateOfBirth ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              onPrimary: AppColors.white,
              onSurface: AppColors.stone900,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _selectedDateOfBirth) {
      setState(() {
        _selectedDateOfBirth = picked;
      });
    }
  }

  Future<void> _savePet() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedDateOfBirth == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng chọn ngày sinh')),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      if (widget.id == null) {
        // Create
        await _petService.createPet(
          name: _nameController.text,
          species: _speciesController.text,
          breed: _breedController.text,
          dateOfBirth: _selectedDateOfBirth!,
          weight: double.parse(_weightController.text),
          gender: _selectedGender,
          image: _selectedImage,
        );
      } else {
        // Update
        await _petService.updatePet(
          id: widget.id!,
          name: _nameController.text,
          species: _speciesController.text,
          breed: _breedController.text,
          dateOfBirth: _selectedDateOfBirth!,
          weight: double.parse(_weightController.text),
          gender: _selectedGender,
          image: _selectedImage,
        );
      }
      if (mounted) {
        context.pop(true); // Return true to refresh list
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Lỗi lưu thông tin: $e')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: AppBar(
        title: Text(widget.id == null ? 'THÊM THÚ CƯNG' : 'SỬA THÚ CƯNG'),
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Image Picker
                    Center(
                      child: GestureDetector(
                        onTap: _pickImage,
                        child: Stack(
                          children: [
                            Container(
                              width: 120,
                              height: 120,
                              decoration: BoxDecoration(
                                color: AppColors.stone200,
                                border: Border.all(
                                    color: AppColors.stone900, width: 2),
                                shape: BoxShape.circle,
                                boxShadow: const [
                                  BoxShadow(
                                      color: AppColors.stone900,
                                      offset: Offset(2, 2)),
                                ],
                                image: _selectedImage != null
                                    ? DecorationImage(
                                        image: FileImage(
                                            File(_selectedImage!.path)),
                                        fit: BoxFit.cover,
                                      )
                                    : (_currentImageUrl != null
                                        ? DecorationImage(
                                            image:
                                                NetworkImage(_currentImageUrl!),
                                            fit: BoxFit.cover,
                                          )
                                        : null),
                              ),
                              child: (_selectedImage == null &&
                                      _currentImageUrl == null)
                                  ? const Icon(Icons.add_a_photo,
                                      size: 40, color: AppColors.stone400)
                                  : null,
                            ),
                            Positioned(
                              bottom: 0,
                              right: 0,
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: AppColors.stone200,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                      color: AppColors.stone900, width: 2),
                                ),
                                child: const Icon(
                                  Icons.camera_alt,
                                  size: 18,
                                  color: AppColors.stone900,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Fields
                    CustomTextField(
                      controller: _nameController,
                      label: 'Tên thú cưng',
                      validator: (value) =>
                          value?.isEmpty ?? true ? 'Vui lòng nhập tên' : null,
                    ),
                    const SizedBox(height: 16),

                    // Species & Breed
                    Row(
                      children: [
                        Expanded(
                          child: CustomTextField(
                            controller: _speciesController,
                            label: 'Loài (Chó/Mèo...)',
                            validator: (value) => value?.isEmpty ?? true
                                ? 'Vui lòng nhập loài'
                                : null,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: CustomTextField(
                            controller: _breedController,
                            label: 'Giống',
                            validator: (value) => value?.isEmpty ?? true
                                ? 'Vui lòng nhập giống'
                                : null,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Date of Birth & Weight
                    Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            onTap: () => _selectDate(context),
                            child: AbsorbPointer(
                              child: CustomTextField(
                                controller: TextEditingController(
                                  text: _selectedDateOfBirth == null
                                      ? ''
                                      : DateFormat('dd/MM/yyyy')
                                          .format(_selectedDateOfBirth!),
                                ),
                                label: 'Ngày sinh',
                                suffixIcon: const Icon(Icons.calendar_today),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: CustomTextField(
                            controller: _weightController,
                            label: 'Cân nặng (kg)',
                            keyboardType: TextInputType.number,
                            validator: (value) {
                              if (value == null || value.isEmpty)
                                return 'Vui lòng nhập cân nặng';
                              if (double.tryParse(value) == null)
                                return 'Cân nặng không hợp lệ';
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Gender
                    const Text(
                      'Giới tính',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppColors.stone900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _buildGenderOption('MALE', 'Đực'),
                        const SizedBox(width: 16),
                        _buildGenderOption('FEMALE', 'Cái'),
                      ],
                    ),
                    const SizedBox(height: 32),

                    // Submit Button
                    CustomButton(
                      text:
                          widget.id == null ? 'THÊM THÚ CƯNG' : 'LƯU THAY ĐỔI',
                      onPressed: _savePet,
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildGenderOption(String value, String label) {
    final isSelected = _selectedGender == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedGender = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.stone900 : AppColors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.stone900, width: 2),
            boxShadow: isSelected
                ? []
                : const [
                    BoxShadow(color: AppColors.stone900, offset: Offset(2, 2))
                  ],
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: isSelected ? AppColors.white : AppColors.stone900,
            ),
          ),
        ),
      ),
    );
  }
}
