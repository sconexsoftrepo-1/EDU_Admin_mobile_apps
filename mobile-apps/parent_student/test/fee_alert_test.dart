import 'dart:convert';
import 'dart:io';
import 'package:edunexa_parent/app/edunexa_client.dart';
import 'package:edunexa_parent/theme/mobile_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  final routes =
      (jsonDecode(File('test/fixtures/mobile_contract.json').readAsStringSync())
              as Map)['parent']
          as Map;

  testWidgets('Last day of a semester fee pops up with the late fee and Pay now', (tester) async {
    tester.view.physicalSize = const Size(390, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = CollegeApi(
      baseUrl: 'http://localhost',
      clientId: 'parent-mobile',
      httpClient: MockClient((req) async {
        final key = req.url.pathSegments.last;
        final body = key == 'my-alert'
            ? {
                'alert': {
                  'student_code': null, 'student_name': 'Asha Rao', 'term': 'Semester 2',
                  'due_date': '2026-11-20', 'days_left': 0, 'balance': '12500.00',
                  'late_fee_amount': '2000.00', 'late_fee_added': false, 'level': 'last_day',
                },
              }
            : routes[key] ?? {};
        return http.Response(jsonEncode(body), 200,
            headers: {'content-type': 'application/json; charset=utf-8'});
      }),
    );
    await api.accept({'access_token': 't', 'refresh_token': 't'});
    await tester.pumpWidget(MaterialApp(
      theme: collegeTheme(MobileRole.parent.accent),
      home: MobileWorkspace(title: 'Parent dashboard', role: MobileRole.parent, api: api, onLogout: () {}),
    ));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('fee-due-alert')), findsOneWidget);
    expect(find.text('Last day to pay the Semester 2 fee'), findsOneWidget);
    expect(find.textContaining('Today is the last day to pay ₹12,500 for Asha Rao.'), findsOneWidget);
    expect(find.textContaining('late fee of ₹2,000 will be added after 20 November 2026'), findsOneWidget);
    await tester.tap(find.text('Pay now'));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('fee-due-alert')), findsNothing);
    final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
    final fees = bar.destinations.indexWhere((d) => d is NavigationDestination && d.label == 'Fees');
    expect(bar.selectedIndex, fees);
  });
}
