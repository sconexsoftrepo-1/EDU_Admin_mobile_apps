import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'conts.dart';

Future<void> _initialize() async {
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp(
      options: const FirebaseOptions(
        apiKey: PushConfig.apiKey,
        appId: PushConfig.appId,
        messagingSenderId: PushConfig.senderId,
        projectId: PushConfig.projectId,
        iosBundleId: PushConfig.iosBundleId,
      ),
    );
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
  // The OS displays notification payloads. Authenticated inbox records stay on the server.
}

class PushNotifications {
  final void Function(String?) onOpen;
  final void Function(String, String) onForeground;
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  String? _token;
  bool _disposed = false;
  PushNotifications({required this.onOpen, required this.onForeground});
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
    await messaging.setForegroundNotificationPresentationOptions(
      alert: false,
      badge: true,
      sound: true,
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
        if (!_disposed) {
          onForeground(
            message.notification?.title ?? 'College update',
            message.notification?.body ?? 'Open your inbox for details.',
          );
        }
      }),
    );
    _subscriptions.add(
      FirebaseMessaging.onMessageOpenedApp.listen((message) {
        if (!_disposed) onOpen(message.data['notification_code']);
      }),
    );
    final initial = await messaging.getInitialMessage();
    if (initial != null && !_disposed) {
      onOpen(initial.data['notification_code']);
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
