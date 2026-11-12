import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// App-local environment and storage configuration. This app has no shared package.
abstract final class ApiConfig {
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    // The Azure App Service backend (HTTPS). Override with --dart-define=API_BASE_URL=...
    defaultValue: 'https://edunexa-api-pragathi-dpaafqe8ftbabxay.westus3-01.azurewebsites.net',
  );
  // Temporary: the current server has no TLS yet, so release builds accept
  // http:// too. Build with --dart-define=ALLOW_INSECURE_HTTP=false once the
  // API is served over HTTPS (and remove usesCleartextTraffic on Android).
  static const allowInsecureHttp = bool.fromEnvironment(
    'ALLOW_INSECURE_HTTP',
    defaultValue: true,
  );
  static const apiPrefix = '/api/v1';
  static const requestTimeout = Duration(seconds: 20);
  static const pageSize = 50;
  static const adminClient = 'admin-mobile';
  static const teacherClient = 'teacher-mobile';
  static const parentClient = 'parent-mobile';
  static const studentClient = 'student-mobile';
  static String refreshKey(String client) => 'edunexa-refresh-$client';
  static String roleKey(String client) => 'edunexa-role-$client';
  static String pushPreferenceKey(String client) =>
      'edunexa-push-enabled-$client';
}

abstract final class PushConfig {
  static const _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const _appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const _senderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
  );
  static const iosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');

  /// Android builds without `--dart-define-from-file` use this app's Android registration in the
  /// edu-pragathi Firebase project (same values as firebase-android.json; not secret), so a plain
  /// `flutter build apk` still receives pushes. iOS builds must pass firebase-ios.json.
  static bool get _androidDefaults =>
      _apiKey.isEmpty &&
      !kIsWeb &&
      defaultTargetPlatform == TargetPlatform.android &&
      !Platform.environment.containsKey('FLUTTER_TEST');
  static String get apiKey => _androidDefaults ? 'AIzaSyBqD1fmDMo88XOfAX6s7EAzfG7w_Rim-Ik' : _apiKey;
  static String get appId => _androidDefaults ? '1:836243265119:android:02a3af758999636fe82dea' : _appId;
  static String get projectId => _androidDefaults ? 'edu-pragathi' : _projectId;
  static String get senderId => _androidDefaults ? '836243265119' : _senderId;
  static bool get configured =>
      [apiKey, appId, projectId, senderId].every((v) => v.isNotEmpty);
}
