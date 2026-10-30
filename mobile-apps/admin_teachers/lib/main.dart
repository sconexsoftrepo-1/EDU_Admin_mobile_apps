import 'package:flutter/material.dart';
import 'app/edunexa_client.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
