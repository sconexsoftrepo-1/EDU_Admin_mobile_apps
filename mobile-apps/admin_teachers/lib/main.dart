import 'package:flutter/material.dart';
import 'src/edunexa_client.dart';
import 'services/push_notifications.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeCollegePush();
  runApp(const EduNexaAdminApp());
}

class EduNexaAdminApp extends StatelessWidget {
  const EduNexaAdminApp({super.key});
  @override
  Widget build(BuildContext context) => const EdunexaApp(
    title: 'EduNexa Admin & Teachers',
    clientId: ApiConfig.adminClient,
    roles: [MobileRole.admin, MobileRole.teacher],
  );
}
