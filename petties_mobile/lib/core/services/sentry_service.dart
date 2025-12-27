import 'package:sentry_flutter/sentry_flutter.dart';
import 'package:flutter/foundation.dart';

/// Sentry Error Tracking Configuration for Petties Mobile
///
/// Auto-reports errors to Discord via Sentry integration
///
/// Usage:
/// ```dart
/// // In main.dart
/// await SentryService.init(() => runApp(MyApp()));
/// ```
class SentryService {
  // Get DSN from dart-define or use empty for dev
  static const String _dsn = String.fromEnvironment(
    'SENTRY_DSN',
    defaultValue: '',
  );

  // Get environment from dart-define
  static const String _environment = String.fromEnvironment(
    'ENVIRONMENT',
    defaultValue: 'development',
  );

  /// Initialize Sentry SDK
  ///
  /// Call this in main() before runApp()
  ///
  /// Example:
  /// ```dart
  /// void main() async {
  ///   await SentryService.init(() => runApp(MyApp()));
  /// }
  /// ```
  static Future<void> init(AppRunner appRunner) async {
    // Skip if no DSN (development mode)
    if (_dsn.isEmpty) {
      debugPrint('⚠️ Sentry DSN not configured, error tracking disabled');
      appRunner();
      return;
    }

    await SentryFlutter.init(
      (options) {
        options.dsn = _dsn;
        options.environment = _environment;

        // Sample rate for performance monitoring (10%)
        options.tracesSampleRate = 0.1;

        // Enable auto breadcrumbs
        options.enableAutoNativeBreadcrumbs = true;
        options.enableAutoPerformanceTracing = true;

        // Attach stack trace to messages
        options.attachStacktrace = true;

        // Only capture errors in production
        options.beforeSend = _beforeSend;

        // Filter sensitive data
        options.beforeSendTransaction = _beforeSendTransaction;

        // Debug mode (only in development)
        options.debug = kDebugMode;

        // Release version
        options.release = 'petties-mobile@1.0.0';
      },
      appRunner: appRunner,
    );

    debugPrint('✅ Sentry initialized - Environment: $_environment');
  }

  /// Filter events before sending
  static SentryEvent? _beforeSend(SentryEvent event, Hint hint) {
    // Don't send events in development
    if (_environment == 'development') {
      return null;
    }

    // Filter out certain errors if needed
    // Example: ignore network timeouts
    // if (event.throwable is SocketException) {
    //   return null;
    // }

    return event;
  }

  /// Filter transactions before sending
  static SentryTransaction? _beforeSendTransaction(
    SentryTransaction transaction,
    Hint hint,
  ) {
    // Don't send transactions in development
    if (_environment == 'development') {
      return null;
    }
    return transaction;
  }

  /// Set user context after login
  ///
  /// Call this after user successfully logs in
  ///
  /// Example:
  /// ```dart
  /// SentryService.setUser(
  ///   id: user.id,
  ///   email: user.email,
  ///   role: 'PET_OWNER',
  /// );
  /// ```
  static void setUser({
    required String id,
    String? email,
    String? role,
  }) {
    Sentry.configureScope((scope) {
      scope.setUser(SentryUser(
        id: id,
        email: email,
        data: role != null ? {'role': role} : null,
      ));
    });
  }

  /// Clear user context on logout
  static void clearUser() {
    Sentry.configureScope((scope) => scope.setUser(null));
  }

  /// Manually capture exception
  ///
  /// Use for caught errors that should be reported
  ///
  /// Example:
  /// ```dart
  /// try {
  ///   await riskyOperation();
  /// } catch (e, stackTrace) {
  ///   await SentryService.captureException(e, stackTrace: stackTrace);
  /// }
  /// ```
  static Future<void> captureException(
    dynamic exception, {
    dynamic stackTrace,
    Map<String, dynamic>? extra,
  }) async {
    await Sentry.captureException(
      exception,
      stackTrace: stackTrace,
      withScope: (scope) {
        if (extra != null) {
          extra.forEach((key, value) {
            scope.setExtra(key, value);
          });
        }
      },
    );
  }

  /// Manually capture message
  ///
  /// Use for important events that aren't errors
  static Future<void> captureMessage(
    String message, {
    SentryLevel level = SentryLevel.info,
    Map<String, dynamic>? extra,
  }) async {
    await Sentry.captureMessage(
      message,
      level: level,
      withScope: (scope) {
        if (extra != null) {
          extra.forEach((key, value) {
            scope.setExtra(key, value);
          });
        }
      },
    );
  }

  /// Add breadcrumb for debugging
  ///
  /// Creates a trail of events leading up to an error
  static void addBreadcrumb({
    required String message,
    String? category,
    Map<String, dynamic>? data,
    SentryLevel level = SentryLevel.info,
  }) {
    Sentry.addBreadcrumb(Breadcrumb(
      message: message,
      category: category,
      data: data,
      level: level,
    ));
  }
}
