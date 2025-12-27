class Pet {
  final String id;
  final String name;
  final String species;
  final String breed;
  final DateTime dateOfBirth;
  final double weight;
  final String gender;
  final String? imageUrl;

  Pet({
    required this.id,
    required this.name,
    required this.species,
    required this.breed,
    required this.dateOfBirth,
    required this.weight,
    required this.gender,
    this.imageUrl,
  });

  factory Pet.fromJson(Map<String, dynamic> json) {
    return Pet(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      species: json['species'] ?? '',
      breed: json['breed'] ?? '',
      dateOfBirth: json['dateOfBirth'] != null 
        ? DateTime.parse(json['dateOfBirth']) 
        : DateTime.now(),
      weight: (json['weight'] as num?)?.toDouble() ?? 0.0,
      gender: json['gender'] ?? '',
      imageUrl: json['imageUrl'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'species': species,
      'breed': breed,
      'dateOfBirth': dateOfBirth.toIso8601String().split('T')[0],
      'weight': weight,
      'gender': gender,
      'imageUrl': imageUrl,
    };
  }
}
