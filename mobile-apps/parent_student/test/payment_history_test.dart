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

  testWidgets('Fees shows every payment with its details and receipt', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final payments = Map<String, dynamic>.from(routes['payments'] as Map);
    payments['items'] = [
      for (final p in payments['items'] as List)
        {
          ...Map<String, dynamic>.from(p as Map),
          'recorded_at': '2026-10-22T10:35:00Z',
          'allocations': [
            {
              'charge_code': 'CHARGE1',
              'amount': '10000.00',
              'fee_head': 'Tuition fees',
            },
          ],
        },
    ];
    final api = CollegeApi(
      baseUrl: 'http://localhost',
      clientId: 'parent-mobile',
      httpClient: MockClient((req) async {
        final key = req.url.pathSegments.last;
        return http.Response(
          jsonEncode(key == 'payments' ? payments : routes[key] ?? {}),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    await api.accept({'access_token': 't', 'refresh_token': 't'});
    await tester.pumpWidget(
      MaterialApp(
        theme: collegeTheme(MobileRole.parent.accent),
        home: MobileWorkspace(
          title: 'Parent dashboard',
          role: MobileRole.parent,
          api: api,
          onLogout: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('Fees'),
      ),
    );
    await tester.pumpAndSettle();

    // The middle tab is the payment history, including partial payments.
    await tester.tap(find.text('Payments (1)'));
    await tester.pumpAndSettle();
    expect(find.text('Txn DEMO-COLLECTION-1'), findsOneWidget);
    expect(find.text('Successful'), findsOneWidget);
    expect(find.textContaining('Cash · '), findsOneWidget);

    await tester.tap(find.text('Txn DEMO-COLLECTION-1'));
    await tester.pumpAndSettle();
    expect(find.text('Transaction no.'), findsOneWidget);
    expect(find.text('DEMO-COLLECTION-1'), findsOneWidget);
    expect(find.text('Payment mode'), findsOneWidget);
    expect(find.text('Paid for'), findsOneWidget);
    expect(find.textContaining('Download receipt'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
