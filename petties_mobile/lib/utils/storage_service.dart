import 'package:shared_preferences/shared_preferences.dart';

/// Service for local storage operations
class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  SharedPreferences? _prefs;

  /// Initialize SharedPreferences
  Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  /// Save string value
  Future<bool> setString(String key, String value) async {
    await init();
    return _prefs!.setString(key, value);
  }

  /// Get string value
  Future<String?> getString(String key) async {
    await init();
    return _prefs!.getString(key);
  }

  /// Save int value
  Future<bool> setInt(String key, int value) async {
    await init();
    return _prefs!.setInt(key, value);
  }

  /// Get int value
  Future<int?> getInt(String key) async {
    await init();
    return _prefs!.getInt(key);
  }

  /// Save bool value
  Future<bool> setBool(String key, bool value) async {
    await init();
    return _prefs!.setBool(key, value);
  }

  /// Get bool value
  Future<bool?> getBool(String key) async {
    await init();
    return _prefs!.getBool(key);
  }

  /// Save double value
  Future<bool> setDouble(String key, double value) async {
    await init();
    return _prefs!.setDouble(key, value);
  }

  /// Get double value
  Future<double?> getDouble(String key) async {
    await init();
    return _prefs!.getDouble(key);
  }

  /// Save string list
  Future<bool> setStringList(String key, List<String> value) async {
    await init();
    return _prefs!.setStringList(key, value);
  }

  /// Get string list
  Future<List<String>?> getStringList(String key) async {
    await init();
    return _prefs!.getStringList(key);
  }

  /// Remove value
  Future<bool> remove(String key) async {
    await init();
    return _prefs!.remove(key);
  }

  /// Clear all values
  Future<bool> clear() async {
    await init();
    return _prefs!.clear();
  }

  /// Check if key exists
  Future<bool> containsKey(String key) async {
    await init();
    return _prefs!.containsKey(key);
  }
}

