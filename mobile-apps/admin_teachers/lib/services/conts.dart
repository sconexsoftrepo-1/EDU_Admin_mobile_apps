/// App-local environment and storage configuration. This app has no shared package.
abstract final class ApiConfig {
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://185.193.19.156:8010',
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
  static const apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const senderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
  );
  static const iosBundleId = String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');
  static bool get configured =>
      [apiKey, appId, projectId, senderId].every((v) => v.isNotEmpty);
}
