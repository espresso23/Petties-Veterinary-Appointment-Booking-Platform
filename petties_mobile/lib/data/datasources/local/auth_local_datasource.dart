/// Abstract class for local data sources
abstract class LocalDataSource {
  // Define common local data source methods
}

/// Example: Auth local data source
class AuthLocalDataSource extends LocalDataSource {
  // Implement local storage operations for auth
  // final StorageService _storage;
  
  // AuthLocalDataSource(this._storage);
  
  // Future<void> saveAccessToken(String token) async {
  //   await _storage.setString(AppConstants.accessTokenKey, token);
  // }
  
  // Future<String?> getAccessToken() async {
  //   return await _storage.getString(AppConstants.accessTokenKey);
  // }
  
  // Future<void> clearAuthData() async {
  //   await _storage.remove(AppConstants.accessTokenKey);
  //   await _storage.remove(AppConstants.refreshTokenKey);
  // }
}
