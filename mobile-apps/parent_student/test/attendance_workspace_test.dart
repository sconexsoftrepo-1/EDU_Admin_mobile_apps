import 'dart:convert';
import 'package:edunexa_parent/app/edunexa_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  Json options(bool personal) => {
    'personal': personal,
    'can_mark': !personal,
    'teacher': !personal,
    'courses': [
      {
        'code': 'P1',
        'name': 'B.Sc.',
        'branch': 'Computing',
        'course_level': 'degree',
      },
    ],
    'academic_years': [
      {
        'code': 'Y1',
        'name': '2020–2023',
        'program_code': 'P1',
        'batch_code': 'B1',
      },
    ],
    'sections': [
      {'code': 'S1', 'name': 'A', 'batch_code': 'B1'},
    ],
    'students': personal
        ? [
            {'code': 'ST1', 'name': 'Ananya Rao'},
          ]
        : [],
    'periods': [
      {'value': 0, 'label': 'Whole day'},
      {'value': 1, 'label': 'Period 1'},
    ],
  };
  Json payload() {
    final now = DateTime.now();
    final day =
        '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    final summary = {
      'present': 1,
      'late': 0,
      'absent': 0,
      'excused': 0,
      'recorded': 1,
      'attended': 1,
      'percentage': 100.0,
      'leave_days': 2,
      'absent_days': 0,
    };
    return {
      'date': day,
      'can_mark': true,
      'students': [
        {'code': 'ST1', 'name': 'Ananya Rao', 'admission_number': 'ADM1'},
      ],
      'summaries': {
        for (final range in ['period', 'day', 'week', 'month', 'year'])
          range: summary,
      },
      'calendar': [
        for (int i = 1; i <= DateTime(now.year, now.month + 1, 0).day; i++)
          {
            'date': '${day.substring(0, 7)}-${i.toString().padLeft(2, '0')}',
            ...summary,
          },
      ],
      'registers': [
        {
          'code': 'R1',
          'revision': 1,
          'session_date': day,
          'period': 1,
          'section_code': 'S1',
          'subject': 'Physics',
          'marks': {'ST1': 'present'},
        },
      ],
      'calculation': 'Unmarked sessions are excluded.',
    };
  }

  Future<CollegeApi> api(bool personal, List<Json> saves) async {
    final api = CollegeApi(
      baseUrl: 'http://localhost',
      clientId: personal ? 'student-mobile' : 'teacher-mobile',
      httpClient: MockClient((request) async {
        final body = request.url.path.endsWith('/options')
            ? options(personal)
            : payload();
        if (request.method == 'PUT') {
          saves.add(Map<String, dynamic>.from(jsonDecode(request.body) as Map));
        }
        return http.Response(
          jsonEncode(body),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );
    await api.accept({'access_token': 'test', 'refresh_token': 'test'});
    return api;
  }

  testWidgets(
    'Student attendance shows calendar, ranges and leave totals without marking controls',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          home: AttendanceHub(
            api: await api(true, []),
            role: MobileRole.student,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Student'), findsOneWidget);
      expect(find.text('Period'), findsOneWidget);
      expect(find.text('Week'), findsOneWidget);
      expect(find.text('Month'), findsOneWidget);
      expect(find.text('Year'), findsOneWidget);
      expect(find.text('100.0%'), findsWidgets);
      expect(find.textContaining('Week leave days: 2'), findsOneWidget);
      expect(find.text('Save attendance'), findsNothing);
      await tester.scrollUntilVisible(
        find.text('Periods on this day'),
        500,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('Physics'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Teacher selects enrollment cohort, marks roster and saves shared register',
    (tester) async {
      tester.view.physicalSize = const Size(390, 1000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final saves = <Json>[];
      await tester.pumpWidget(
        MaterialApp(
          home: AttendanceHub(
            api: await api(false, saves),
            role: MobileRole.teacher,
          ),
        ),
      );
      await tester.pumpAndSettle();
      Future<void> choose(String field, String value) async {
        await tester.ensureVisible(find.text(field).first);
        await tester.tap(
          find
              .ancestor(
                of: find.text(field).first,
                matching: find.byType(InputDecorator),
              )
              .first,
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text(value).last);
        await tester.pumpAndSettle();
      }

      await choose('Course level', 'Degree');
      await choose('Course', 'B.Sc.');
      await choose('Branch / specialization', 'Computing');
      await choose('Academic batch', '2020–2023');
      await choose('Section', 'A');
      await tester.scrollUntilVisible(
        find.text('Mark all present'),
        500,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mark all present'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save attendance'));
      await tester.pumpAndSettle();
      expect(saves, hasLength(1));
      expect(saves.single['program_code'], 'P1');
      expect(saves.single['section_code'], 'S1');
      expect(saves.single['revision'], 1);
      expect((saves.single['marks'] as List).single, {
        'student_code': 'ST1',
        'status': 'present',
      });
      expect(tester.takeException(), isNull);
    },
  );
}
