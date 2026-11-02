import 'dart:convert';
import 'package:edunexa_admin/app/edunexa_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  Future<CollegeApi> api({bool review = false}) async {
    final value = CollegeApi(
      baseUrl: 'http://localhost',
      clientId: 'admin-mobile',
      httpClient: MockClient((request) async {
        await Future<void>.delayed(const Duration(milliseconds: 10));
        final item = {
          'code': 'A1',
          'title': 'Botany revision',
          'description': 'Read chapter one.',
          'due_at': '2030-06-01T09:00:00Z',
          'course_name': 'Intermediate BPC',
          'batch_name': '2026–2028',
          'teacher_name': 'Teacher Rao',
          'max_marks': '20',
          'can_review': review,
          'can_grade': review,
          'can_submit': false,
          'attachments': [],
          'students': review
              ? [
                  {
                    'code': 'ST1',
                    'name': 'Ananya Rao',
                    'admission_number': 'ADM1',
                    'submission': {
                      'submitted_at': '2030-05-30T09:00:00Z',
                      'completed': false,
                      'attachments': [],
                    },
                  },
                ]
              : [],
          'bucket': 'upcoming',
        };
        return http.Response(
          jsonEncode(
            request.url.path.endsWith('/A1')
                ? item
                : {
                    'items': [item],
                    'can_create': false,
                    'students': [],
                    'can_review': false,
                  },
          ),
          200,
          headers: {'content-type': 'application/json'},
        );
      }),
    );
    await value.accept({'access_token': 'test', 'refresh_token': 'test'});
    return value;
  }

  testWidgets('Assignment list awaits the API before decoding its map', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AssignmentHub(api: await api(), role: MobileRole.admin),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Botany revision'), findsOneWidget);
    expect(find.textContaining('Future<dynamic>'), findsNothing);
    expect(find.text('Retry'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'Assignment details awaits the API before displaying instructions',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: AssignmentReview(api: await api(), code: 'A1'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Read chapter one.'), findsOneWidget);
      expect(find.textContaining('Future<dynamic>'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('Teacher review cards mark completion without ink errors', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AssignmentReview(api: await api(review: true), code: 'A1'),
      ),
    );
    await tester.pumpAndSettle();
    final completed = find.text('Completed');
    await tester.scrollUntilVisible(
      completed,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(completed);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
