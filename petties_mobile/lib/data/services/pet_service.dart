import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import '../models/pet.dart';
import 'api_client.dart';

class PetService {
  final ApiClient _apiClient;

  PetService({ApiClient? apiClient}) : _apiClient = apiClient ?? ApiClient();

  /// Get current user's pets
  Future<List<Pet>> getMyPets() async {
    try {
      final response = await _apiClient.get('/pets/me');
      final List<dynamic> data = response.data;
      return data.map((json) => Pet.fromJson(json)).toList();
    } catch (e) {
      rethrow;
    }
  }

  /// Get pets with pagination and filtering
  Future<Map<String, dynamic>> getPets({
    int page = 0,
    int size = 10,
    String? species,
    String? breed,
  }) async {
    try {
      final response = await _apiClient.get(
        '/pets',
        queryParameters: {
          'page': page,
          'size': size,
          if (species != null) 'species': species,
          if (breed != null) 'breed': breed,
        },
      );
      return response.data; // Returns Page object (content, pageable, etc.)
    } catch (e) {
      rethrow;
    }
  }

  /// Get pet details
  Future<Pet> getPet(String id) async {
    try {
      final response = await _apiClient.get('/pets/$id');
      return Pet.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Alias for getPet
  Future<Pet> getPetById(String id) => getPet(id);

  /// Create new pet
  Future<Pet> createPet({
    required String name,
    required String species,
    required String breed,
    required DateTime dateOfBirth,
    required double weight,
    required String gender,
    String? color,
    String? allergies,
    XFile? image,
  }) async {
    try {
      final formData = FormData.fromMap({
        'name': name,
        'species': species,
        'breed': breed,
        'dateOfBirth': dateOfBirth.toIso8601String().split('T')[0],
        'weight': weight.toString(),
        'gender': gender,
        if (color != null && color.isNotEmpty) 'color': color,
        if (allergies != null && allergies.isNotEmpty) 'allergies': allergies,
      });

      if (image != null) {
        formData.files.add(MapEntry(
          'image',
          await MultipartFile.fromFile(image.path, filename: image.name),
        ));
      }

      final response = await _apiClient.post(
        '/pets',
        data: formData,
      );

      return Pet.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Update pet
  Future<Pet> updatePet({
    required String id,
    required String name,
    required String species,
    required String breed,
    required DateTime dateOfBirth,
    required double weight,
    required String gender,
    String? color,
    String? allergies,
    XFile? image,
  }) async {
    try {
      final formData = FormData.fromMap({
        'name': name,
        'species': species,
        'breed': breed,
        'dateOfBirth': dateOfBirth.toIso8601String().split('T')[0],
        'weight': weight.toString(),
        'gender': gender,
        if (color != null && color.isNotEmpty) 'color': color,
        if (allergies != null && allergies.isNotEmpty) 'allergies': allergies,
      });

      if (image != null) {
        formData.files.add(MapEntry(
          'image',
          await MultipartFile.fromFile(image.path, filename: image.name),
        ));
      }

      final response = await _apiClient.put(
        '/pets/$id',
        data: formData,
      );

      return Pet.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }

  /// Delete pet
  Future<void> deletePet(String id) async {
    try {
      await _apiClient.delete('/pets/$id');
    } catch (e) {
      rethrow;
    }
  }

  /// STAFF: Update only pet allergies
  Future<Pet> updateAllergies(String petId, String? allergies) async {
    try {
      final response = await _apiClient.patch(
        '/pets/$petId/allergies',
        data: {'allergies': allergies ?? ''},
      );
      return Pet.fromJson(response.data);
    } catch (e) {
      rethrow;
    }
  }
}
