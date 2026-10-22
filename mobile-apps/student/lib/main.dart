import 'package:flutter/material.dart';

void main() => runApp(const EduNexaApp());

class EduNexaApp extends StatelessWidget {
  const EduNexaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'EduNexa Student',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF18344B),
        useMaterial3: true,
      ),
      home: Scaffold(
        appBar: AppBar(title: Text('EduNexa Student')),
        body: ListView(
          children: const [
            ListTile(
              title: Text('Student app development starter'),
              subtitle: Text(
                'Native Flutter scaffold. Connect these modules to the future Python backend.',
              ),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Profile and timetable'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Attendance'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Assignments and resources'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Exam results'),
              subtitle: Text('Planned module'),
            ),
            ListTile(
              leading: Icon(Icons.chevron_right),
              title: Text('Fees, library, hostel and transport'),
              subtitle: Text('Planned module'),
            ),
          ],
        ),
      ),
    );
  }
}
