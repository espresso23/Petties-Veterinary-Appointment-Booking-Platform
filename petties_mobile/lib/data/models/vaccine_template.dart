class VaccineTemplate {
  final String id;
  final String name;
  final String? manufacturer;
  final String? description;
  final int? minAgeWeeks;
  final int? repeatIntervalDays;
  final int? seriesDoses;
  final bool? isAnnualRepeat;
  final double? defaultPrice;
  final String targetSpecies;
  final int? minIntervalDays;

  VaccineTemplate({
    required this.id,
    required this.name,
    this.manufacturer,
    this.description,
    this.minAgeWeeks,
    this.repeatIntervalDays,
    this.seriesDoses,
    this.isAnnualRepeat,
    this.defaultPrice,
    required this.targetSpecies,
    this.minIntervalDays,
  });

  factory VaccineTemplate.fromJson(Map<String, dynamic> json) {
    return VaccineTemplate(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      manufacturer: json['manufacturer'],
      description: json['description'],
      minAgeWeeks: json['minAgeWeeks'],
      repeatIntervalDays: json['repeatIntervalDays'],
      seriesDoses: json['seriesDoses'],
      isAnnualRepeat: json['isAnnualRepeat'],
      defaultPrice: (json['defaultPrice'] as num?)?.toDouble(),
      targetSpecies: json['targetSpecies'] ?? 'BOTH',
      minIntervalDays: json['minIntervalDays'],
    );
  }
}
