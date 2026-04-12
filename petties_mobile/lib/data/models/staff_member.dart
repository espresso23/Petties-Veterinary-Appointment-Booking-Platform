/// Staff Member model for public clinic staff display
class StaffMember {
  final String userId;
  final String? fullName;
  final String? avatar;
  final String? specialty;
  final String? specialtyLabel;
  final String? role;

  StaffMember({
    required this.userId,
    this.fullName,
    this.avatar,
    this.specialty,
    this.specialtyLabel,
    this.role,
  });

  factory StaffMember.fromJson(Map<String, dynamic> json) {
    // Handle specialty - could be string or null
    String? specialty;
    if (json['specialty'] != null) {
      specialty = json['specialty'].toString();
    }

    return StaffMember(
      userId: json['userId']?.toString() ?? '',
      fullName: json['fullName'],
      avatar: json['avatar'],
      specialty: specialty,
      specialtyLabel: json['specialtyLabel'],
      role: json['role']?.toString(),
    );
  }

  /// Get display name (fallback to 'Nhân viên' if no name)
  String get displayName => fullName ?? 'Nhân viên';

  /// Get display specialty label
  String get displaySpecialty => specialtyLabel ?? _getSpecialtyLabel();

  String _getSpecialtyLabel() {
    switch (specialty) {
      case 'VET':
        return 'Bác sĩ thú y';
      case 'GROOMER':
        return 'Nhân viên chăm sóc thú cưng';
      default:
        // Legacy (VET_GENERAL, VET_SURGERY...) hoặc null
        if (specialty != null && specialty!.startsWith('VET')) return 'Bác sĩ thú y';
        return 'Nhân viên';
    }
  }

  /// Check if this staff is a Vet (not Groomer)
  bool get isVet => specialty != null && (specialty == 'VET' || specialty!.startsWith('VET_'));

  /// Check if this staff is a Groomer
  bool get isGroomer => specialty == 'GROOMER';
}
