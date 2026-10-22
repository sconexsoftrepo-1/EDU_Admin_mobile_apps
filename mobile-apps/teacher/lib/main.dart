import 'package:flutter/material.dart';

void main() => runApp(const EduNexaApp());

class EduNexaApp extends StatelessWidget {
  const EduNexaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EduNexa Teacher',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF18344B),
        useMaterial3: true,
      ),
      home: Scaffold(
        appBar: AppBar(title: Text('EduNexa Teacher')),
        body: ListView(
          children: const [
            ListTile(
              title: Text('Teacher app development starter'),
              subtitle: Text(
                'Native Flutter scaffold. Connect these modules to the future Python backend.',
              ),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Assigned classes and timetable'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Attendance entry'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Assignments and grading'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Exam marks'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Leave and announcements'),
              subtitle: Text('Planned module'),
            ),
          ],
        ),
      ),
    );
  }
}
