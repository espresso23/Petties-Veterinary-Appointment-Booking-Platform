import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../utils/storage_service.dart';

/// Data class for EMR draft
class EmrDraft {
  final String petId;
  final String? bookingId;
  final String subjective;
  final String objective;
  final String assessment;
  final String plan;
  final List<Map<String, dynamic>> images;
  final DateTime savedAt;

  EmrDraft({
    required this.petId,
    this.bookingId,
    this.subjective = '',
    this.objective = '',
    this.assessment = '',
    this.plan = '',
    this.images = const [],
    DateTime? savedAt,
  }) : savedAt = savedAt ?? DateTime.now();

  String get draftKey => bookingId != null ? '${petId}_$bookingId' : petId;

  Map<String, dynamic> toJson() => {
        'petId': petId,
        'bookingId': bookingId,
        'subjective': subjective,
        'objective': objective,
        'assessment': assessment,
        'plan': plan,
        'images': images,
        'savedAt': savedAt.toIso8601String(),
      };

  factory EmrDraft.fromJson(Map<String, dynamic> json) => EmrDraft(
        petId: json['petId'] as String,
        bookingId: json['bookingId'] as String?,
        subjective: json['subjective'] as String? ?? '',
        objective: json['objective'] as String? ?? '',
        assessment: json['assessment'] as String? ?? '',
        plan: json['plan'] as String? ?? '',
        images: (json['images'] as List<dynamic>?)
                ?.map((e) => Map<String, dynamic>.from(e as Map))
                .toList() ??
            [],
        savedAt: json['savedAt'] != null
            ? DateTime.parse(json['savedAt'] as String)
            : DateTime.now(),
      );

  EmrDraft copyWith({
    String? petId,
    String? bookingId,
    String? subjective,
    String? objective,
    String? assessment,
    String? plan,
    List<Map<String, dynamic>>? images,
    DateTime? savedAt,
  }) =>
      EmrDraft(
        petId: petId ?? this.petId,
        bookingId: bookingId ?? this.bookingId,
        subjective: subjective ?? this.subjective,
        objective: objective ?? this.objective,
        assessment: assessment ?? this.assessment,
        plan: plan ?? this.plan,
        images: images ?? this.images,
        savedAt: savedAt ?? this.savedAt,
      );
}

/// Provider for EMR draft state management with SharedPreferences persistence
class EmrDraftProvider extends ChangeNotifier {
  static const String _draftPrefix = 'emr_draft_';

  final StorageService _storage = StorageService();

  final Map<String, EmrDraft> _drafts = {};

  /// Get draft by key
  EmrDraft? getDraft(String key) => _drafts[key];

  /// Check if draft exists
  bool hasDraft(String key) => _drafts.containsKey(key);

  /// Get all draft keys
  List<String> get draftKeys => _drafts.keys.toList();

  /// Load draft from SharedPreferences
  Future<void> loadDraft(String key) async {
    try {
      final jsonStr = await _storage.getString('$_draftPrefix$key');
      if (jsonStr != null && jsonStr.isNotEmpty) {
        final json = jsonDecode(jsonStr) as Map<String, dynamic>;
        _drafts[key] = EmrDraft.fromJson(json);
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Failed to load EMR draft: $e');
    }
  }

  /// Save draft to SharedPreferences
  Future<void> saveDraft(EmrDraft draft) async {
    try {
      final key = draft.draftKey;
      _drafts[key] = draft;
      await _storage.setString(
        '$_draftPrefix$key',
        jsonEncode(draft.toJson()),
      );
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to save EMR draft: $e');
    }
  }

  /// Delete draft from SharedPreferences
  Future<void> deleteDraft(String key) async {
    try {
      _drafts.remove(key);
      await _storage.remove('$_draftPrefix$key');
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to delete EMR draft: $e');
    }
  }

  /// Clear all drafts
  Future<void> clearAllDrafts() async {
    try {
      for (final key in _drafts.keys.toList()) {
        await _storage.remove('$_draftPrefix$key');
      }
      _drafts.clear();
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to clear EMR drafts: $e');
    }
  }

  /// Get draft age in minutes
  int? getDraftAgeMinutes(String key) {
    final draft = _drafts[key];
    if (draft == null) return null;
    return DateTime.now().difference(draft.savedAt).inMinutes;
  }
}
