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

  testWidgets('cash clerk home shows cash to deposit, not classes or teaching screens', (tester) async {
    tester.view.physicalSize = const Size(390, 1500);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
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
                ('cash', 'Cash deposits'),
                ('leave', 'Leave requests'),
                ('payslips', 'Salary and payslips'),
                ('tax-documents', 'Form 16 and tax documents'),
                ('calendar', 'Calendar and events'),
                ('announcements', 'Announcements'),
                ('notifications', 'Notifications'),
              ])
                {'key': k, 'title': t, 'resource': k},
            ],
          };
        } else if (key == 'cash') {
          body = {
            'screen': 'cash',
            'items': [
              {'code': 'T1', 'status': 'assigned', 'amount': '12500.00', 'with_clerk': '0.00', 'clerk_account': 'C', 'deposits': []},
              {'code': 'T2', 'status': 'collected', 'amount': '8000.00', 'with_clerk': '8000.00', 'clerk_account': 'C', 'deposits': []},
              {'code': 'T3', 'status': 'settled', 'amount': '5000.00', 'with_clerk': '0.00', 'clerk_account': 'C', 'deposits': []},
            ],
            'total': 3,
            'students': [],
            'actions': [],
            'lookups': {},
            'summary': {'in_hand': '8000.00', 'to_collect': 1, 'to_upload': 0},
          };
        }
        return http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json; charset=utf-8'});
      }),
    );
    await api.accept({'access_token': 't', 'refresh_token': 't'});
    await tester.pumpWidget(MaterialApp(
      theme: collegeTheme(MobileRole.teacher.accent),
      home: RepaintBoundary(
        key: const ValueKey('shot'),
        child: MobileWorkspace(title: 'Staff dashboard', role: MobileRole.teacher, api: api, onLogout: () {}),
      ),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Cash clerk'), findsOneWidget);
    expect(find.text('With me'), findsOneWidget);
    expect(find.text('Cash to deposit'), findsOneWidget);
    expect(find.text('Collect from accounts'), findsOneWidget);
    expect(find.text('Deposit in the bank'), findsOneWidget);
    for (final hidden in ['Today', 'My classes', 'Alerts', 'Today’s classes', 'Assignments & grading', 'Faculty']) {
      expect(find.text(hidden), findsNothing, reason: hidden);
    }
    expect(find.byKey(const ValueKey('quick-messages')), findsOneWidget);
    expect(find.byKey(const ValueKey('quick-cash')), findsOneWidget);
    expect(find.byKey(const ValueKey('quick-leave')), findsOneWidget);
    expect(find.byKey(const ValueKey('quick-payslips')), findsOneWidget);
    for (final hidden in ['attendance', 'assessments', 'assignments', 'submissions', 'results']) {
      expect(find.byKey(ValueKey('quick-$hidden')), findsNothing, reason: hidden);
    }
    expect(tester.takeException(), isNull);
  });
}
