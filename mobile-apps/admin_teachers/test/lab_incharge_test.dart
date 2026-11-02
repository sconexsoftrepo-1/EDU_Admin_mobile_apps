import 'dart:convert';
import 'package:edunexa_admin/app/edunexa_client.dart';
import 'package:edunexa_admin/theme/mobile_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('lab in-charge sees lab sessions with batch, time, students and attendance', (tester) async {
    tester.view.physicalSize = const Size(390, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final now = DateTime.now();
    final session = {
      'code': 'LAB1:S1:BOT:1:10:00',
      'lab_name': 'Biology Lab 1',
      'floor': '1st',
      'room_number': '104',
      'subject_name': 'Botany lab 1',
      'program_name': 'Intermediate BPC',
      'academic_year_name': '2026–2028',
      'section_name': 'A',
      'faculty_name': 'Rohan Varma',
      'weekday': now.weekday,
      'start_time': '10:00',
      'end_time': '11:40',
      'attendance_marked': true,
      'counts': {'present': 1, 'late': 0, 'absent': 1, 'excused': 0, 'total': 2, 'unmarked': 0},
      'students': [
        {'code': 'S1', 'name': 'Ananya Rao', 'admission_number': 'ADM1', 'status': 'present'},
        {'code': 'S2', 'name': 'Vikram Shah', 'admission_number': 'ADM2', 'status': 'absent'},
      ],
    };
    final days = <String?>[];
    final api = CollegeApi(
      baseUrl: 'http://localhost',
      clientId: 'teacher-mobile',
      httpClient: MockClient((req) async {
        final key = req.url.pathSegments.last;
        Object body = {'items': [], 'total': 0};
        if (key == 'screens') {
          body = {
            'screens': [
              for (final (k, t) in [
                ('profile', 'My profile'),
                ('labs', 'My labs and sessions'),
                ('timetable', 'Lab timetable'),
                ('leave', 'Leave requests'),
                ('payslips', 'Salary and payslips'),
                ('tax-documents', 'Form 16 and tax documents'),
                ('calendar', 'Calendar and events'),
                ('notifications', 'Notifications'),
              ])
                {'key': k, 'title': t, 'resource': k},
            ],
          };
        } else if (key == 'labs') {
          days.add(req.url.queryParameters['from_date']);
          body = {
            'screen': 'labs',
            'items': [session],
            'total': 1,
            'students': [],
            'actions': [],
            'lookups': {
              'labs': [
                {'code': 'LAB1', 'name': 'Biology Lab 1', 'floor': '1st', 'room_number': '104'},
              ],
            },
            'summary': {'sessions': 1, 'students': 2, 'present': 1, 'absent': 1},
          };
        } else if (key == 'timetable') {
          body = {'items': [session], 'total': 1};
        }
        return http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json; charset=utf-8'});
      }),
    );
    await api.accept({'access_token': 't', 'refresh_token': 't'});
    await tester.pumpWidget(MaterialApp(
      theme: collegeTheme(MobileRole.teacher.accent),
      home: MobileWorkspace(title: 'Staff dashboard', role: MobileRole.teacher, api: api, onLogout: () {}),
    ));
    await tester.pumpAndSettle();
    // Home: today's lab sessions; the bottom bar offers Labs instead of Classes.
    expect(find.text('Today’s lab sessions'), findsOneWidget);
    expect(find.descendant(of: find.byType(NavigationBar), matching: find.text('Labs')), findsOneWidget);
    await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('Labs')));
    await tester.pumpAndSettle();
    expect(find.text('Biology Lab 1'), findsWidgets);
    expect(find.text('Intermediate BPC · 2026–2028 · Section A'), findsOneWidget);
    expect(find.text('Faculty: Rohan Varma'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Show 2 students'), 200, scrollable: find.byType(Scrollable).first);
    await tester.tap(find.text('Show 2 students'));
    await tester.pumpAndSettle();
    expect(find.text('Vikram Shah'), findsOneWidget);
    expect(find.text('Absent'), findsWidgets);
    // Next day reloads the sessions for that date.
    await tester.scrollUntilVisible(find.byTooltip('Next day'), -200, scrollable: find.byType(Scrollable).first);
    await tester.tap(find.byTooltip('Next day'));
    await tester.pumpAndSettle();
    final tomorrow = DateUtils.dateOnly(now).add(const Duration(days: 1));
    expect(days.last, startsWith('${tomorrow.year}-${tomorrow.month.toString().padLeft(2, '0')}-${tomorrow.day.toString().padLeft(2, '0')}'));
    expect(tester.takeException(), isNull);
  });
}
