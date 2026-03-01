/// Thông tin người được đặt hộ (booking for others)
class BeneficiaryInfo {
  final String fullName;
  final String phone;
  final String address;
  final double? latitude;
  final double? longitude;
  final String bookingTypeApi; // IN_CLINIC | HOME_VISIT

  const BeneficiaryInfo({
    required this.fullName,
    required this.phone,
    required this.address,
    this.latitude,
    this.longitude,
    required this.bookingTypeApi,
  });
}
