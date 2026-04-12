import 'ai_booking_tracker.dart';

List<String> buildAiChatAutocompleteSuggestions({
  required String query,
  required List<String> quickPrompts,
  required AiBookingTrackerSnapshot tracker,
}) {
  final normalizedQuery = _normalizeText(query);
  if (normalizedQuery.isEmpty) {
    return const <String>[];
  }

  final suggestions = <String>[];
  final queryTokens = normalizedQuery
      .split(' ')
      .where((token) => token.trim().isNotEmpty)
      .toList();

  void addSuggestion(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty || suggestions.contains(trimmed)) {
      return;
    }
    suggestions.add(trimmed);
  }

  final petName = tracker.petName?.trim();
  final clinicName = tracker.clinicName?.trim();
  final bookingDate = tracker.bookingDate?.trim();
  final startTime = tracker.startTime?.trim();
  final serviceName = tracker.serviceNames.isNotEmpty
      ? tracker.serviceNames.first.trim()
      : null;
  final bookingStatus = tracker.status?.trim().toUpperCase();

  final petPhrase = petName != null && petName.isNotEmpty
      ? 'cho $petName'
      : 'cho thú cưng của tôi';
  final clinicPhrase = clinicName != null && clinicName.isNotEmpty
      ? 'tại $clinicName'
      : 'ở phòng khám gần tôi';
  final servicePhrase = serviceName != null && serviceName.isNotEmpty
      ? serviceName
      : 'khám tổng quát';

  final candidates = <String>[
    ...quickPrompts,

    // Booking intent
    'Đặt lịch $servicePhrase $petPhrase $clinicPhrase vào sáng mai',
    'Đặt lịch tiêm phòng $petPhrase $clinicPhrase vào chiều mai',
    'Đặt lịch khám cho $petPhrase vào cuối tuần này',
    'Tìm phòng khám gần tôi rồi đặt lịch $servicePhrase',

    // Search / compare
    'Tìm phòng khám gần tôi có dịch vụ $servicePhrase',
    'Gợi ý phòng khám gần tôi còn lịch trống hôm nay',
    'So sánh giúp tôi vài phòng khám phù hợp để đặt lịch',

    // Tracker-aware revisions
    if (tracker.hasData) ...[
      if (clinicName != null && clinicName.isNotEmpty)
        'Giữ $clinicName nhưng đổi sang giờ khác trong ngày',
      if (clinicName != null && clinicName.isNotEmpty)
        'Giữ $clinicName nhưng đổi sang ngày mai',
      if (petName != null && petName.isNotEmpty)
        'Giữ thú cưng $petName nhưng đổi sang phòng khám gần hơn',
      if (serviceName != null && serviceName.isNotEmpty)
        'Giữ các thông tin hiện tại nhưng đổi dịch vụ sang $serviceName',
      if (bookingDate != null && bookingDate.isNotEmpty)
        'Giữ các thông tin hiện tại nhưng đổi sang ngày khác',
      if (startTime != null && startTime.isNotEmpty)
        'Giữ các thông tin hiện tại nhưng đổi sang giờ muộn hơn',
    ],

    // Session-aware follow-ups
    if (bookingStatus == 'SUSPENDED') 'Tiếp tục giúp tôi phần đặt lịch đang dở',
    if (bookingStatus == 'COLLECTING' || bookingStatus == 'REVIEWING')
      'Tóm tắt lại giúp tôi các thông tin đặt lịch hiện tại',
    if (bookingStatus == 'REVIEWING') 'Xác nhận giúp tôi để tạo lịch hẹn',

    // Non-booking variety
    'Cho tôi xem lịch hẹn của tôi',
    'Bé ${petName ?? 'nhà tôi'} cần tiêm mũi nào tiếp theo?',
    'Bé ${petName ?? 'nhà tôi'} có cần tái khám không?',
    'Tư vấn giúp tôi triệu chứng bất thường của thú cưng',
    'Nhắc tôi các bước cần chuẩn bị trước khi đưa bé đi khám',
  ];

  final scored = candidates
      .map((candidate) => _SuggestionScore(
            text: candidate,
            score: _scoreSuggestion(
              candidate: candidate,
              normalizedQuery: normalizedQuery,
              queryTokens: queryTokens,
              tracker: tracker,
            ),
          ))
      .where((item) => item.score > 0)
      .toList()
    ..sort((a, b) {
      final scoreCompare = b.score.compareTo(a.score);
      if (scoreCompare != 0) {
        return scoreCompare;
      }
      return a.text.length.compareTo(b.text.length);
    });

  final categorySeen = <String>{};
  for (final item in scored) {
    final category = _categorizeSuggestion(item.text);
    if (categorySeen.add(category) || suggestions.length < 3) {
      addSuggestion(item.text);
    }
    if (suggestions.length >= 5) {
      break;
    }
  }

  if (suggestions.length < 5) {
    for (final item in scored) {
      addSuggestion(item.text);
      if (suggestions.length >= 5) {
        break;
      }
    }
  }

  return suggestions.take(3).toList();
}

class _SuggestionScore {
  final String text;
  final int score;

  const _SuggestionScore({
    required this.text,
    required this.score,
  });
}

int _scoreSuggestion({
  required String candidate,
  required String normalizedQuery,
  required List<String> queryTokens,
  required AiBookingTrackerSnapshot tracker,
}) {
  final normalizedCandidate = _normalizeText(candidate);
  if (normalizedCandidate.isEmpty) {
    return 0;
  }

  var score = 0;

  if (normalizedCandidate.contains(normalizedQuery)) {
    score += 12;
  }

  for (final token in queryTokens) {
    if (token.length <= 1) {
      continue;
    }
    if (normalizedCandidate.contains(token)) {
      score += 4;
    }
  }

  final isBookingQuery = _containsAny(
    normalizedQuery,
    ['dat lich', 'lich hen', 'hen kham', 'kham', 'gio', 'ngay', 'phong kham'],
  );
  final isSearchQuery = _containsAny(
    normalizedQuery,
    ['tim', 'gan', 'goi y', 'so sanh', 'phong kham'],
  );
  final isHealthQuery = _containsAny(
    normalizedQuery,
    ['tiem', 'trieu chung', 'sot', 'oi', 'tieu chay', 'tai kham'],
  );

  final category = _categorizeSuggestion(candidate);
  if (isBookingQuery && category == 'booking') {
    score += 6;
  }
  if (isSearchQuery && category == 'search') {
    score += 6;
  }
  if (isHealthQuery && category == 'health') {
    score += 5;
  }

  if (tracker.hasData && category == 'booking') {
    score += 2;
  }
  if (_containsTrackerContext(normalizedCandidate, tracker)) {
    score += 3;
  }

  if (score == 0 && normalizedQuery.length >= 2) {
    score = 1;
  }

  return score;
}

String _categorizeSuggestion(String suggestion) {
  final normalized = _normalizeText(suggestion);
  if (_containsAny(normalized, ['tim', 'gan', 'goi y', 'so sanh'])) {
    return 'search';
  }
  if (_containsAny(normalized, ['tiem', 'trieu chung', 'tai kham'])) {
    return 'health';
  }
  if (_containsAny(
      normalized, ['lich hen', 'xac nhan', 'doi', 'giu', 'dat lich'])) {
    return 'booking';
  }
  return 'general';
}

bool _containsTrackerContext(
  String normalizedCandidate,
  AiBookingTrackerSnapshot tracker,
) {
  final fields = <String>[
    tracker.petName ?? '',
    tracker.clinicName ?? '',
    ...tracker.serviceNames,
  ].map(_normalizeText).where((value) => value.isNotEmpty);

  for (final field in fields) {
    if (normalizedCandidate.contains(field)) {
      return true;
    }
  }
  return false;
}

bool _containsAny(String value, List<String> keywords) {
  for (final keyword in keywords) {
    if (value.contains(keyword)) {
      return true;
    }
  }
  return false;
}

String _normalizeText(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll('đ', 'd')
      .replaceAll(RegExp(r'[àáạảãâầấậẩẫăằắặẳẵ]'), 'a')
      .replaceAll(RegExp(r'[èéẹẻẽêềếệểễ]'), 'e')
      .replaceAll(RegExp(r'[ìíịỉĩ]'), 'i')
      .replaceAll(RegExp(r'[òóọỏõôồốộổỗơờớợởỡ]'), 'o')
      .replaceAll(RegExp(r'[ùúụủũưừứựửữ]'), 'u')
      .replaceAll(RegExp(r'[ỳýỵỷỹ]'), 'y')
      .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}
