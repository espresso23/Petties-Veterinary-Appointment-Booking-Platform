/// Abstract class for remote data sources
abstract class RemoteDataSource {
  // Define common remote data source methods
}

/// Example: Auth remote data source
class AuthRemoteDataSource extends RemoteDataSource {
  // Implement authentication-related API calls
  // final ApiClient _apiClient;
  
  // AuthRemoteDataSource(this._apiClient);
  
  // Future<UserModel> login(String email, String password) async {
  //   final response = await _apiClient.post('/auth/login', data: {
  //     'email': email,
  //     'password': password,
  //   });
  //   return UserModel.fromJson(response.data['data']);
  // }
}
