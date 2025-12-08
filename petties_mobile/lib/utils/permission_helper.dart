import 'package:permission_handler/permission_handler.dart';
import 'dart:io';

/// Helper class for requesting and checking permissions
class PermissionHelper {
  /// Check and request location permission
  static Future<bool> requestLocationPermission() async {
    final status = await Permission.location.status;
    
    if (status.isGranted) {
      return true;
    }
    
    if (status.isDenied) {
      final result = await Permission.location.request();
      return result.isGranted;
    }
    
    if (status.isPermanentlyDenied) {
      // Open app settings
      await openAppSettingsPage();
      return false;
    }
    
    return false;
  }
  
  /// Check location permission status
  static Future<bool> isLocationGranted() async {
    final status = await Permission.location.status;
    return status.isGranted;
  }
  
  /// Check and request camera permission
  static Future<bool> requestCameraPermission() async {
    final status = await Permission.camera.status;
    
    if (status.isGranted) {
      return true;
    }
    
    if (status.isDenied) {
      final result = await Permission.camera.request();
      return result.isGranted;
    }
    
    if (status.isPermanentlyDenied) {
      await openAppSettings();
      return false;
    }
    
    return false;
  }
  
  /// Check camera permission status
  static Future<bool> isCameraGranted() async {
    final status = await Permission.camera.status;
    return status.isGranted;
  }
  
  /// Check and request storage/photo permission
  static Future<bool> requestStoragePermission() async {
    if (Platform.isAndroid) {
      // Android 13+ uses photos permission
      if (await Permission.photos.isGranted) {
        return true;
      }
      
      final status = await Permission.photos.status;
      if (status.isDenied) {
        final result = await Permission.photos.request();
        return result.isGranted;
      }
      
      if (status.isPermanentlyDenied) {
        await openAppSettings();
        return false;
      }
      
      return false;
    } else {
      // iOS uses photos permission
      final status = await Permission.photos.status;
      
      if (status.isGranted) {
        return true;
      }
      
      if (status.isDenied) {
        final result = await Permission.photos.request();
        return result.isGranted;
      }
      
      if (status.isPermanentlyDenied) {
        await openAppSettings();
        return false;
      }
      
      return false;
    }
  }
  
  /// Check storage/photo permission status
  static Future<bool> isStorageGranted() async {
    if (Platform.isAndroid) {
      return await Permission.photos.isGranted;
    } else {
      return await Permission.photos.isGranted;
    }
  }
  
  /// Request all permissions needed for the app
  static Future<Map<String, bool>> requestAllPermissions() async {
    return {
      'location': await requestLocationPermission(),
      'camera': await requestCameraPermission(),
      'storage': await requestStoragePermission(),
    };
  }
  
  /// Check all permissions status
  static Future<Map<String, bool>> checkAllPermissions() async {
    return {
      'location': await isLocationGranted(),
      'camera': await isCameraGranted(),
      'storage': await isStorageGranted(),
    };
  }
  
  /// Open app settings
  static Future<bool> openAppSettingsPage() async {
    return await openAppSettings();
  }
}

