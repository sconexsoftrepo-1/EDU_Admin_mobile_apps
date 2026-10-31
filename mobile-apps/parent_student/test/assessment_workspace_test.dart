import 'dart:convert';
import 'package:edunexa_parent/app/edunexa_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  Json item(String code, String bucket, {bool staff = false}) => {
    'code': code,
    'title': bucket == 'completed'
        ? 'Completed mathematics'
        : 'Upcoming mathematics',
    'subject_name': 'Mathematics',
    'course_name': 'B.Sc.',
    'batch_name': '2026–2029',
    'scheduled_at': '2026-11-10T09:00:00Z',
    'bucket': bucket,
    'status': 'published',
    'description': 'Solve all questions.',
    'guidance': 'Bring a calculator.',
    'max_marks': '50',
    'revision': 1,
    'can_grade': staff && bucket == 'completed',
    'can_manage': staff,
    'attachments': [],
    'students': [
      {
        'code': 'ST1',
        'name': 'Ananya Rao',
        'mark': staff
            ? null
            : {'marks': '42', 'feedback': 'Good progress', 'absent': false},
      },
    ],
  };
  Future<CollegeApi> api(bool staff, List<Json> writes) async {
    final value = CollegeApi(
      clientId: staff ? "teacher-mobile" : "student-mobile",
      baseUrl: "http://localhost",
      httpClient: MockClient((request) async {
        Json result;
        if (request.method == 'PUT') {
          writes.add(
            Map<String, dynamic>.from(jsonDecode(request.body) as Map),
          );
          result = {...item('C', 'completed', staff: true), 'revision': 2};
        } else if (request.url.path.endsWith('/C')) {
          result = item('C', 'completed', staff: staff);
        } else if (request.url.path.endsWith('/U')) {
          result = item('U', 'upcoming', staff: staff);
        } else {
          result = {
            'items': [
              item('U', 'upcoming', staff: staff),
              item('C', 'completed', staff: staff),
            ],
            'can_create': staff,
            'students': staff
                ? []
                : [
                    {'code': 'ST1', 'name': 'Ananya Rao'},
                  ],
            'performance': {'percentage': 84, 'graded': 1},
            'batch_performance': [],
          };
        }
        return http.Response(
          jsonEncode(result),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );
    await value.accept({'access_token': 'test', 'refresh_token': 'test'});
    return value;
  }

  testWidgets(
    'Student sees date ordered tabs, assessment instructions and their published result',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          home: AssessmentHub(
            api: await api(false, []),
            role: MobileRole.student,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Upcoming mathematics'), findsOneWidget);
      expect(find.text('Completed mathematics'), findsNothing);
      expect(find.text('Add assessment'), findsNothing);
      await tester.tap(find.text('Completed'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Completed mathematics'));
      await tester.pumpAndSettle();
      expect(find.text('Solve all questions.'), findsOneWidget);
      expect(find.text('Bring a calculator.'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('42 / 50'),
        300,
        scrollable: find.byType(Scrollable).last,
      );
      expect(find.text('Good progress'), findsOneWidget);
      expect(find.text('Save & publish marks'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'Teacher enters marks only on completed assessments and sends revision',
    (tester) async {
      final writes = <Json>[];
      await tester.pumpWidget(
        MaterialApp(
          home: AssessmentDetails(api: await api(true, writes), code: 'C'),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.widgetWithText(TextField, 'Marks / 50'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Marks / 50'),
        '39',
      );
      await tester.scrollUntilVisible(
        find.text('Save & publish marks'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Save & publish marks'));
      await tester.pumpAndSettle();
      expect(writes.single['revision'], 1);
      expect((writes.single['students'] as List).single['marks'], '39');
      expect(tester.takeException(), isNull);
    },
  );
}
