/// Response from POST /bookings/public/estimated-completion
class EstimatedCompletionResponse {
  final String startTime;
  final String estimatedEndTime;
  final int totalDurationMinutes;
  final int totalSlotsRequired;

  const EstimatedCompletionResponse({
    required this.startTime,
    required this.estimatedEndTime,
    required this.totalDurationMinutes,
    required this.totalSlotsRequired,
  });

  factory EstimatedCompletionResponse.fromJson(Map<String, dynamic> json) {
    return EstimatedCompletionResponse(
      startTime: json['startTime'] as String? ?? '',
      estimatedEndTime: (json['estimatedEndTime'] ?? json['estimated_end_time']) as String? ?? '',
      totalDurationMinutes: (json['totalDurationMinutes'] as num?)?.toInt() ?? 0,
      totalSlotsRequired: (json['totalSlotsRequired'] as num?)?.toInt() ?? 0,
    );
  }
}
