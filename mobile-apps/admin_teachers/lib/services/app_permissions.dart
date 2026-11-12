import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:permission_handler/permission_handler.dart';

/// Device permissions the app uses, asked together when the signed-in app opens:
/// notifications (alerts in the notification bar), camera (bank slips, photos and documents)
/// and microphone (voice messages in chats). Choosing photos needs no permission on
/// Android 13+ (the system photo picker) and storage is not a runtime permission there.
abstract final class AppPermissions {
  static bool _askedThisLaunch = false;

  static bool get _mobile =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  /// Shows the system permission prompts that have not been answered yet, once per launch.
  /// When notifications stay blocked, explains why and offers the app's settings page.
  static Future<void> requestAtStartup(BuildContext context) async {
    if (!_mobile || _askedThisLaunch) return;
    _askedThisLaunch = true;
    final statuses = await [
      Permission.notification,
      Permission.camera,
      Permission.microphone,
    ].request();
    final notifications = statuses[Permission.notification];
    if (notifications != null && !notifications.isGranted && !notifications.isLimited && context.mounted) {
      await explainBlockedNotifications(context);
    } else if (context.mounted) {
      await keepAlertsWhenClosed(context);
    }
  }

  static const _backgroundAskedKey = 'background_alerts_asked_at';

  /// Android: alerts must also arrive after the app is swiped away or closed. Battery savers
  /// (Realme/OPPO/OnePlus, Xiaomi, Vivo, ...) can stop a closed app, and a stopped app gets no
  /// pushes, so ask to let the app run in the background. Asked at most once a week.
  static Future<void> keepAlertsWhenClosed(BuildContext context) async {
    if (defaultTargetPlatform != TargetPlatform.android) return;
    if (await Permission.ignoreBatteryOptimizations.isGranted) return;
    const storage = FlutterSecureStorage();
    try {
      final asked = DateTime.tryParse(await storage.read(key: _backgroundAskedKey) ?? '');
      if (asked != null && DateTime.now().difference(asked).inDays < 7) return;
      await storage.write(key: _backgroundAskedKey, value: DateTime.now().toIso8601String());
    } catch (_) {}
    if (!context.mounted) return;
    final allow = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        key: const ValueKey('background-alerts'),
        icon: const Icon(Icons.notifications_active_outlined),
        title: const Text('Get alerts when EduDesk is closed'),
        content: const Text(
          'Let EduDesk run in the background so cash handovers, approvals, chat messages and college '
          'alerts reach you even after you close the app.\n\n'
          'Tap Allow on the next screen. On Realme, OPPO, OnePlus, Xiaomi or Vivo phones also open '
          'App info > Battery and turn on "Allow background activity" (or Autostart / No restrictions).',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Not now')),
          FilledButton(onPressed: () => Navigator.pop(dialog, true), child: const Text('Allow')),
        ],
      ),
    );
    if (allow != true) return;
    final status = await Permission.ignoreBatteryOptimizations.request();
    if (!status.isGranted) await openAppSettings();
  }

  /// Notifications are off: tell the user what they miss and open the app's settings page.
  static Future<void> explainBlockedNotifications(BuildContext context) async {
    final open = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        key: const ValueKey('notifications-blocked'),
        icon: const Icon(Icons.notifications_off_outlined),
        title: const Text('Turn on notifications'),
        content: const Text(
          'Notifications are off for this app, so cash handovers, approvals, chat messages and '
          'college alerts will not appear in your notification bar.\n\n'
          'Open settings, tap Notifications and turn them on.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Not now')),
          FilledButton(onPressed: () => Navigator.pop(dialog, true), child: const Text('Open settings')),
        ],
      ),
    );
    if (open == true) await openAppSettings();
  }
}
