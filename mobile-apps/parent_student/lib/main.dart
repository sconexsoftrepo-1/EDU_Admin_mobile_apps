import 'package:flutter/material.dart';
import 'app/edunexa_client.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const EduNexaApp());
}

class EduNexaApp extends StatelessWidget {
  const EduNexaApp({super.key});
  @override
  Widget build(BuildContext context) => const EdunexaApp(
    title: 'Edu-Pragathi Parents & Students',
    clientId: ApiConfig.parentClient,
    roles: [MobileRole.parent, MobileRole.student],
  );
}
