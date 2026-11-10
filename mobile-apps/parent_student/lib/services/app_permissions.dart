import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
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
    }
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
