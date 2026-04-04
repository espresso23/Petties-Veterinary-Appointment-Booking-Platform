import 'ai_booking_tracker.dart';

List<String> buildAiChatAutocompleteSuggestions({
  required String query,
  required List<String> quickPrompts,
  required AiBookingTrackerSnapshot tracker,
}) {
  final normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.isEmpty) {
    // Chỉ hiển thị autocomplete khi người dùng đang gõ.
    return const <String>[];
  }

  final suggestions = <String>[];

  void addSuggestion(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty || suggestions.contains(trimmed)) {
      return;
    }
    suggestions.add(trimmed);
  }

  final petName = tracker.petName;
  final clinicName = tracker.clinicName;
  final petPhrase = petName != null ? 'cho $petName' : 'cho thú cưng của tôi';
  final clinicPhrase = clinicName != null ? 'tại $clinicName ' : '';

  for (final prompt in quickPrompts) {
    addSuggestion(prompt);
  }

  addSuggestion('Đặt lịch khám $petPhrase ${clinicPhrase}vào sáng thứ bảy này');
  addSuggestion('Đặt lịch tiêm phòng $petPhrase ${clinicPhrase}vào sáng mai');
  addSuggestion('Đặt lịch $petPhrase ${clinicPhrase}vào chiều mai');
  addSuggestion('Cho tôi xem lịch hẹn của tôi');
  addSuggestion('Bé ${petName ?? "nhà tôi"} cần tiêm mũi nào tiếp theo?');

  if (tracker.hasData) {
    if (tracker.clinicName != null) {
      addSuggestion('Giữ ${tracker.clinicName}, đổi sang chiều cùng ngày');
    }
    if (tracker.petName != null) {
      addSuggestion('Giữ thú cưng ${tracker.petName}, đổi sang phòng khám gần hơn');
    }
    if (tracker.bookingDate != null) {
      addSuggestion('Giữ các thông tin hiện tại, đổi sang ngày mai');
    }
  }

  final filtered = suggestions
      .where((item) => item.toLowerCase().contains(normalizedQuery))
      .toList();

  return (filtered.isNotEmpty ? filtered : suggestions).take(5).toList();
}
