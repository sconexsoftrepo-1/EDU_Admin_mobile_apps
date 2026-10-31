import 'dart:convert';
import 'package:edunexa_admin/app/edunexa_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  for (final screen in [(390.0, 1.0), (320.0, 1.8)]) {
    testWidgets(
      'Semester subjects, backlogs and actual fees at ${screen.$1}px scale ${screen.$2}',
      (tester) async {
        tester.view.physicalSize = Size(screen.$1, 900);
        tester.platformDispatcher.textScaleFactorTestValue = screen.$2;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final api = CollegeApi(
          baseUrl: 'http://localhost',
          clientId: 'parent-mobile',
          httpClient: MockClient(
            (request) async => http.Response(
              jsonEncode({
                'personal': true,
                'can_grade': false,
                'can_manage_calendar': false,
                'totals': {
                  'students': 1,
                  'backlog_students': 1,
                  'all_clear_semester_results': 0,
                },
                'courses': [
                  {'code': 'P', 'name': 'Intermediate BPC'},
                ],
                'academic_years': [
                  {'code': 'Y', 'name': '2025–2027', 'program_code': 'P'},
                ],
                'children': [],
                'course_comparison': [
                  {'code': 'P', 'name': 'Intermediate BPC', 'percentage': 62},
                ],
                'today_classes': [
                  {
                    'subject_name': 'Botany III',
                    'start_time': '09:00',
                    'end_time': '09:50',
                    'period': 1,
                    'state': 'ongoing',
                    'teacher_name': 'Teacher Rao',
                    'semester_number': 3,
                    'can_take_attendance': false,
                  },
                ],
                'batches': [
                  {
                    'code': 'Y',
                    'name': '2025–2027',
                    'course_name': 'Intermediate BPC',
                    'timeline': {'current': 3, 'semesters': []},
                    'semesters': [
                      for (final n in [1, 2, 3])
                        {
                          'semester_number': n,
                          'all_clear': 0,
                          'backlog_students': n == 1 ? 1 : 0,
                          'pending_students': n == 1 ? 0 : 1,
                          'percentage': n == 1 ? 28 : null,
                        },
                    ],
                    'subjects': [
                      {
                        'subject_code': 'S1',
                        'name': 'Botany I',
                        'semester_number': 1,
                        'subject_type': 'theory',
                        'credits': '3',
                        'faculty': [],
                      },
                      {
                        'subject_code': 'S3',
                        'name': 'Botany III',
                        'semester_number': 3,
                        'subject_type': 'theory',
                        'credits': '3',
                        'faculty': [
                          {'teacher_name': 'Teacher Rao'},
                        ],
                      },
                    ],
                    'students': [
                      {
                        'code': 'ST',
                        'name': 'Ananya Reddy',
                        'semester_number': 1,
                        'status': 'backlogs',
                        'pending_subjects': 0,
                        'backlogs': [
                          {'subject_name': 'Botany I'},
                        ],
                      },
                    ],
                    'results': [
                      {
                        'student_code': 'ST',
                        'subject_code': 'S1',
                        'semester_number': 1,
                        'marks': '28',
                        'max_marks': '100',
                        'pass_marks': '40',
                        'attempt': 1,
                      },
                    ],
                  },
                ],
                'fees': [
                  {
                    'code': 'CH',
                    'academic_year_code': 'Y',
                    'semester_number': 3,
                    'fee_head': 'Semester tuition',
                    'amount': '15000',
                    'paid': '7500',
                    'outstanding': '7500',
                    'due_date': '2026-11-05',
                    'reminder_state': 'due_soon',
                  },
                ],
                'payments': [],
              }),
              200,
              headers: {'content-type': 'application/json'},
            ),
          ),
        );
        await api.accept({'access_token': 'test', 'refresh_token': 'test'});
        await tester.pumpWidget(
          MaterialApp(
            home: AcademicHub(api: api, role: MobileRole.parent),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Current semester 3'), findsOneWidget);
        await tester.tap(find.text('Subjects', skipOffstage: false));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(find.text('Semester 3 subjects & labs'), 100);
        expect(find.text('Semester 3 subjects & labs'), findsOneWidget);
        expect(find.text('Botany I'), findsNothing);
        await tester.scrollUntilVisible(find.text('Semester 1'), -100);
        await tester.tap(find.text('Semester 1'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Results'));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(find.text('Ananya Reddy'), 100);
        expect(find.text('Ananya Reddy'), findsOneWidget);
        expect(find.textContaining('1 backlogs'), findsOneWidget);
        await tester.scrollUntilVisible(find.text('Semester 3'), -100);
        await tester.tap(find.text('Semester 3'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Fees', skipOffstage: false));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(find.text('Balance ₹7500'), 100);
        expect(find.text('Balance ₹7500'), findsOneWidget);
        expect(find.textContaining('due soon'), findsOneWidget);
        expect(find.text('Enter final results / reattempt'), findsNothing);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
}
