import 'dart:convert';
import 'dart:io';
import 'package:edunexa_parent/app/edunexa_client.dart';
import 'package:edunexa_parent/theme/mobile_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'helpers/workspace_navigation.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets(
    'student sees the weekly timetable that repeats for the semester',
    (tester) async {
      tester.view.physicalSize = const Size(390, 1400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final student =
          (jsonDecode(
                    File(
                      'test/fixtures/mobile_contract.json',
                    ).readAsStringSync(),
                  )
                  as Map)['student']
              as Map;
      final base = {
        'valid_from': '2026-07-01',
        'valid_to': '2026-11-30',
        'semester': 3,
        'course_name': 'BCA',
        'section_name': 'A',
      };
      final week = [
        for (var day = 1; day <= 6; day++) ...[
          {
            ...base,
            'code': 'c$day',
            'weekday': day,
            'start_time': '09:00',
            'end_time': '10:00',
            'kind': 'theory',
            'title': 'Data structures',
            'faculty': 'Meera Rao',
            'room': '201',
          },
          {
            ...base,
            'code': 'b$day',
            'weekday': day,
            'start_time': '10:00',
            'end_time': '10:15',
            'kind': 'break',
            'title': 'Short break',
          },
          {
            ...base,
            'code': 'l$day',
            'weekday': day,
            'start_time': '10:15',
            'end_time': '12:15',
            'kind': 'lab',
            'title': 'Programming lab',
          },
          {
            ...base,
            'code': 'u$day',
            'weekday': day,
            'start_time': '12:15',
            'end_time': '13:00',
            'kind': 'lunch',
            'title': 'Lunch',
          },
          {
            ...base,
            'code': 's$day',
            'weekday': day,
            'start_time': '13:00',
            'end_time': '14:00',
            'kind': day.isEven ? 'sports' : 'library',
            'title': day.isEven ? 'Games' : 'Library hour',
          },
        ],
      ];
      final api = CollegeApi(
        baseUrl: 'http://localhost',
        clientId: 'student-mobile',
        httpClient: MockClient((req) async {
          final key = req.url.pathSegments.last;
          final body = key == 'timetable'
              ? {
                  ...Map<String, dynamic>.from(student['timetable'] as Map),
                  'items': week,
                  'total': week.length,
                }
              : student[key] ?? {};
          return http.Response(
            jsonEncode(body),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      await api.accept({'access_token': 't', 'refresh_token': 't'});
      await tester.pumpWidget(
        MaterialApp(
          theme: collegeTheme(MobileRole.student.accent),
          home: MobileWorkspace(
            title: 'Student dashboard',
            role: MobileRole.student,
            api: api,
            onLogout: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      await openModule(tester, 'timetable');
      expect(find.text('Weekly timetable'), findsOneWidget);
      expect(find.textContaining('Repeats every week'), findsOneWidget);
      // Monday: class, break, lab, lunch and library.
      await tester.tap(find.text('Mon'));
      await tester.pumpAndSettle();
      expect(find.text('Data structures'), findsOneWidget);
      expect(find.text('Short break'), findsOneWidget);
      expect(find.text('Programming lab'), findsOneWidget);
      expect(find.text('Lunch'), findsOneWidget);
      expect(find.text('Library hour'), findsOneWidget);
      await tester.tap(find.text('Tue'));
      await tester.pumpAndSettle();
      expect(find.text('Games'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
