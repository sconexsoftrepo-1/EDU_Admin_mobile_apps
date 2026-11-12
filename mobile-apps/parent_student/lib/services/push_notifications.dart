// Device alerts (Firebase Cloud Messaging). Keep this file identical in both apps.
//
// Android pushes arrive as data messages and are drawn here: chat messages show the sender and a
// short preview with the app icon, grouped per conversation; tapping opens that chat. iOS shows
// the APNs alert (app icon, sender, preview) and tapping opens the same place.
import 'dart:async';
import 'dart:convert';
import 'dart:ui' show Color;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../constants/api_config.dart';

typedef PushData = Map<String, dynamic>;

Future<void> _initialize() async {
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp(
      options: FirebaseOptions(
        apiKey: PushConfig.apiKey,
        appId: PushConfig.appId,
        messagingSenderId: PushConfig.senderId,
        projectId: PushConfig.projectId,
        iosBundleId: PushConfig.iosBundleId,
      ),
    );
  }
}

bool get _android => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
final FlutterLocalNotificationsPlugin _local =
    FlutterLocalNotificationsPlugin();
bool _localReady = false;

const _chatChannel = AndroidNotificationChannel(
  'chat_messages',
  'Messages',
  description: 'New chat messages from teachers, students, parents and staff',
  importance: Importance.high,
);
const _updatesChannel = AndroidNotificationChannel(
  'college_updates',
  'College updates',
  description:
      'Leave, certificates, fees, assignments and other college alerts',
);

/// Android only: the plugin and its channels (safe to call more than once per isolate).
Future<void> _ensureLocal({void Function(NotificationResponse)? onTap}) async {
  if (!_android) return;
  if (_localReady && onTap == null) return;
  await _local.initialize(
    settings: const InitializationSettings(
      android: AndroidInitializationSettings('ic_notification'),
    ),
    onDidReceiveNotificationResponse: onTap,
  );
  final android = _local
      .resolvePlatformSpecificImplementation<
        AndroidFlutterLocalNotificationsPlugin
      >();
  await android?.createNotificationChannel(_chatChannel);
  await android?.createNotificationChannel(_updatesChannel);
  _localReady = true;
}

bool isChatPush(PushData data) =>
    data['kind'] == 'chat' || data['screen'] == 'messages';

/// Draws one push on Android: app icon, sender (title) and message preview, grouped per chat.
Future<void> showCollegeNotification(PushData data) async {
  if (!_android) return;
  await _ensureLocal();
  final chat = isChatPush(data);
  final title = '${data['title'] ?? 'College update'}';
  final body = '${data['body'] ?? ''}';
  final thread = data['thread_code']?.toString();
  final conversation = data['conversation_title']?.toString();
  final channel = chat ? _chatChannel : _updatesChannel;
  await _local.show(
    id:
        '${data['notification_code'] ?? DateTime.now().microsecondsSinceEpoch}'
            .hashCode &
        0x7fffffff,
    title: title,
    body: body,
    payload: jsonEncode(data),
    notificationDetails: NotificationDetails(
      android: AndroidNotificationDetails(
        channel.id,
        channel.name,
        channelDescription: channel.description,
        importance: channel.importance,
        priority: chat ? Priority.high : Priority.defaultPriority,
        icon: 'ic_notification',
        largeIcon: const DrawableResourceAndroidBitmap('ic_notification_large'),
        color: const Color(0xFFA46A27),
        category: chat
            ? AndroidNotificationCategory.message
            : AndroidNotificationCategory.reminder,
        groupKey: chat && thread != null ? 'chat-$thread' : 'college-updates',
        styleInformation: BigTextStyleInformation(
          body,
          contentTitle: title,
          summaryText:
              conversation == null ||
                  conversation.isEmpty ||
                  conversation == 'null'
              ? null
              : conversation,
        ),
        ticker: '$title: $body',
      ),
    ),
  );
}

PushData? _decode(String? payload) {
  if (payload == null || payload.isEmpty) return null;
  try {
    return Map<String, dynamic>.from(jsonDecode(payload) as Map);
  } catch (_) {
    return null;
  }
}

Future<void> initializeCollegePush() async {
  if (kIsWeb ||
      !{
        TargetPlatform.android,
        TargetPlatform.iOS,
      }.contains(defaultTargetPlatform) ||
      [
        PushConfig.apiKey,
        PushConfig.appId,
        PushConfig.projectId,
        PushConfig.senderId,
      ].any((v) => v.isEmpty)) {
    return;
  }
  try {
    await _initialize();
    FirebaseMessaging.onBackgroundMessage(collegeBackgroundMessage);
  } catch (_) {
    /* The inbox remains available if native push configuration is missing. */
  }
}

@pragma('vm:entry-point')
Future<void> collegeBackgroundMessage(RemoteMessage message) async {
  await _initialize();
  // Android data messages are drawn by the app; iOS (and notification payloads) by the system.
  if (_android &&
      message.notification == null &&
      message.data['title'] != null) {
    await showCollegeNotification(Map<String, dynamic>.from(message.data));
  }
}

class PushNotifications {
  /// Called with the push data when a notification is tapped (thread_code opens that chat).
  final void Function(PushData) onOpen;

  /// A push that arrived while the app is open (title, body, data).
  final void Function(String, String, PushData) onForeground;
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  String? _token;
  bool _disposed = false;

  /// The conversation on screen; its new messages do not pop a notification.
  static String? activeThread;

  PushNotifications({required this.onOpen, required this.onForeground});

  /// Signed out, or the session ended: this phone stops receiving the previous account's pushes
  /// (its push token is retired; the next sign-in registers a new one for the new account) and
  /// that account's notifications are removed from the notification bar.
  static Future<void> forgetDevice() => _forgetting = _forget();
  static Future<void>? _forgetting;

  static Future<void> _forget() async {
    if (kIsWeb) return;
    try {
      if (_android) {
        await _ensureLocal();
        await _local.cancelAll();
      }
    } catch (_) {}
    if (Firebase.apps.isEmpty) return;
    try {
      await FirebaseMessaging.instance.unregister();
    } catch (_) {}
  }

  Future<String> enable({
    required Future<void> Function(String, String) register,
  }) async {
    if (kIsWeb ||
        !{
          TargetPlatform.android,
          TargetPlatform.iOS,
        }.contains(defaultTargetPlatform)) {
      return 'Device alerts are available in the Android and iOS apps.';
    }
    if ([
      PushConfig.apiKey,
      PushConfig.appId,
      PushConfig.projectId,
      PushConfig.senderId,
    ].any((v) => v.isEmpty)) {
      return 'Device alerts will be available when the college enables push delivery. Your inbox works here.';
    }
    // A sign-out that is still retiring the old token finishes first, so it cannot remove this one.
    await _forgetting;
    await _initialize();
    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return 'Notifications are blocked. Enable them in your device settings.';
    }
    if (settings.authorizationStatus == AuthorizationStatus.notDetermined) {
      return 'Notification permission has not been granted.';
    }
    // Pushes also appear in the notification bar while the app is open.
    await messaging.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
    await _ensureLocal(
      onTap: (response) {
        final data = _decode(response.payload);
        if (data != null && !_disposed) onOpen(data);
      },
    );
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    _subscriptions.clear();
    if (_disposed) return 'Device alerts disconnected';
    final registered = Completer<void>();
    _subscriptions.add(
      messaging.onRegistered.listen((value) async {
        try {
          await register(
            value,
            defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
          );
          _token = value;
          if (!registered.isCompleted) registered.complete();
        } catch (error, stack) {
          if (!registered.isCompleted) registered.completeError(error, stack);
        }
      }),
    );
    await Future.wait([
      messaging.register(),
      registered.future.timeout(const Duration(seconds: 20)),
    ]);
    FirebaseMessaging.onBackgroundMessage(collegeBackgroundMessage);
    _subscriptions.add(
      FirebaseMessaging.onMessage.listen((message) {
        if (_disposed) return;
        final data = Map<String, dynamic>.from(message.data);
        final title =
            message.notification?.title ??
            data['title']?.toString() ??
            'College update';
        final body =
            message.notification?.body ??
            data['body']?.toString() ??
            'Open your inbox for details.';
        final thread = data['thread_code']?.toString();
        // Every push goes to the notification bar while the app is open too, except a chat
        // message for the conversation already on screen.
        if (_android && !(isChatPush(data) && thread != null && thread == activeThread)) {
          unawaited(
            showCollegeNotification({...data, 'title': title, 'body': body}),
          );
        }
        onForeground(title, body, data);
      }),
    );
    _subscriptions.add(
      FirebaseMessaging.onMessageOpenedApp.listen((message) {
        if (!_disposed) onOpen(Map<String, dynamic>.from(message.data));
      }),
    );
    final initial = await messaging.getInitialMessage();
    if (initial != null && !_disposed) {
      onOpen(Map<String, dynamic>.from(initial.data));
    } else if (_android) {
      // The app was started by tapping one of the notifications drawn above.
      final launch = await _local.getNotificationAppLaunchDetails();
      final data = launch?.didNotificationLaunchApp == true
          ? _decode(launch?.notificationResponse?.payload)
          : null;
      if (data != null && !_disposed) onOpen(data);
    }
    return 'Device alerts enabled';
  }

  Future<void> unregister(Future<dynamic> Function(String) remove) async {
    if (_token != null) {
      await remove(_token!);
      await FirebaseMessaging.instance.unregister();
      _token = null;
    }
  }

  Future<void> dispose() async {
    _disposed = true;
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    _subscriptions.clear();
  }
}
