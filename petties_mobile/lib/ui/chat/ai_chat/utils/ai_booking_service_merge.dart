import '../../../../data/models/ai_chat.dart';

/// Prefer rows that look like persisted backend ids over free-text / prompt ids.
int bookingServiceOptionCanonicalScore(AiBookingServiceOption s) {
  final id = s.id.trim();
  final name = s.name.trim();
  if (id.isEmpty) return 0;
  final uuid = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    caseSensitive: false,
  );
  if (uuid.hasMatch(id)) return 100;
  if (RegExp(r'^\d+$').hasMatch(id)) return 80;
  if (name.isNotEmpty && id.toLowerCase() != name.toLowerCase()) return 60;
  return 20;
}

String _serviceClinicPartition(AiBookingServiceOption s, String? scopeClinicId) {
  var clinic = (s.clinicId ?? '').trim().toLowerCase();
  final scope = (scopeClinicId ?? '').trim().toLowerCase();
  if (clinic.isEmpty && scope.isNotEmpty) {
    clinic = scope;
  }
  return clinic;
}

String _serviceNamePartitionKey(AiBookingServiceOption s) {
  final name = s.name.trim();
  if (name.isNotEmpty) return name.toLowerCase();
  return s.id.trim().toLowerCase();
}

/// Collapse duplicate rows that refer to the same clinic + service name (e.g. prompt id vs DB UUID).
List<AiBookingServiceOption> dedupeBookingServiceOptionsPreferCanonical(
  List<AiBookingServiceOption> options, {
  String? scopeClinicId,
}) {
  final groups = <String, List<AiBookingServiceOption>>{};
  for (final s in options) {
    if (s.id.trim().isEmpty && s.name.trim().isEmpty) continue;
    final clinic = _serviceClinicPartition(s, scopeClinicId);
    final nameKey = _serviceNamePartitionKey(s);
    final key = '$clinic|$nameKey';
    groups.putIfAbsent(key, () => []).add(s);
  }

  final out = <AiBookingServiceOption>[];
  for (final candidates in groups.values) {
    if (candidates.isEmpty) continue;
    if (candidates.length == 1) {
      out.add(candidates.first);
      continue;
    }
    final sorted = List<AiBookingServiceOption>.from(candidates)
      ..sort(
        (a, b) => bookingServiceOptionCanonicalScore(b)
            .compareTo(bookingServiceOptionCanonicalScore(a)),
      );
    out.add(sorted.first);
  }
  return out;
}

/// Maps ids that are actually labels from the user/prompt to the canonical service id from options.
Set<String> canonicalizeSelectedBookingServiceIds(
  Set<String> selectedIds,
  List<AiBookingServiceOption> options,
) {
  if (selectedIds.isEmpty) return selectedIds;

  final byId = <String, AiBookingServiceOption>{
    for (final s in options)
      if (s.id.trim().isNotEmpty) s.id.trim(): s,
  };

  final byNameLower = <String, AiBookingServiceOption>{};
  for (final s in options) {
    final n = s.name.trim().toLowerCase();
    if (n.isEmpty) continue;
    final existing = byNameLower[n];
    if (existing == null ||
        bookingServiceOptionCanonicalScore(s) >
            bookingServiceOptionCanonicalScore(existing)) {
      byNameLower[n] = s;
    }
  }

  final out = <String>{};
  for (final raw in selectedIds) {
    final id = raw.trim();
    if (id.isEmpty) continue;
    if (byId.containsKey(id)) {
      out.add(id);
      continue;
    }
    final match = byNameLower[id.toLowerCase()];
    if (match != null) {
      out.add(match.id.trim());
      continue;
    }
    out.add(id);
  }
  return out;
}
