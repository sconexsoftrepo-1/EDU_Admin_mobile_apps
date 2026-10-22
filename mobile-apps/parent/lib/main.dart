import 'package:flutter/material.dart';

void main() => runApp(const EduNexaApp());

class EduNexaApp extends StatelessWidget {
  const EduNexaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EduNexa Parent',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF18344B),
        useMaterial3: true,
      ),
      home: Scaffold(
        appBar: AppBar(title: Text('EduNexa Parent')),
        body: ListView(
          children: const [
            ListTile(
              title: Text('Parent app development starter'),
              subtitle: Text(
                'Native Flutter scaffold. Connect these modules to the future Python backend.',
              ),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Linked children'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Attendance and leave requests'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Fees and receipts'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Results and timetable'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Announcements and teacher messages'),
              subtitle: Text('Planned module'),
            ),
          ],
        ),
      ),
    );
  }
}
