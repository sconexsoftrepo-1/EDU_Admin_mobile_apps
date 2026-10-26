import 'package:flutter/material.dart';
import 'src/edunexa_client.dart';
import 'services/push_notifications.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeCollegePush();
  runApp(const EduNexaApp());
}

class EduNexaApp extends StatelessWidget {
  const EduNexaApp({super.key});
  @override
  Widget build(BuildContext context) => const EdunexaApp(
    title: 'EduNexa Parents & Students',
    clientId: ApiConfig.parentClient,
    roles: [MobileRole.parent, MobileRole.student],
  );
}
