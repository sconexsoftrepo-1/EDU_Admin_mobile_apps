import 'helpers/splash_test_support.dart';
import 'dart:convert';
import 'package:edunexa_parent/app/edunexa_client.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  testWidgets('first-time: ID + email -> code -> password -> signed in', (tester) async {
    final calls = <String, Map<String, dynamic>>{};
    await tester.pumpWidget(
      EdunexaApp(
        title: 'EduNest',
        clientId: 'student-mobile',
        roles: const [MobileRole.parent, MobileRole.student],
        apiFactory: (role) => CollegeApi(
          baseUrl: 'http://localhost:8010',
          clientId: role.clientId,
          httpClient: MockClient((r) async {
            if (r.url.path.contains('/first-time/')) {
              calls[r.url.pathSegments.last] = jsonDecode(r.body) as Map<String, dynamic>;
              return r.url.path.endsWith('/request')
                  ? http.Response('{"sent":true,"message":"sent"}', 200)
                  : http.Response('{"access_token":"a","refresh_token":"r"}', 200);
            }
            return http.Response(
              jsonEncode({'screens': [{'key': 'profile', 'title': 'Student profile'}]}),
              200,
            );
          }),
        ),
      ),
    );
    await settleStartup(tester);
    await tester.tap(find.text('Student'));
    await settleStartup(tester);
    if (find.text('Continue').evaluate().isNotEmpty) {
      await tester.ensureVisible(find.text('Continue'));
      await tester.tap(find.text('Continue'));
      await settleStartup(tester);
    }
    await tester.ensureVisible(find.text('First time? Create your password'));
    await tester.tap(find.text('First time? Create your password'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const ValueKey('setup-login')).first, 'PRA-2026-001');
    await tester.enterText(find.byKey(const ValueKey('setup-email')).first, 'ravi@student.example');
    await tester.tap(find.text('Send code'));
    await tester.pumpAndSettle();
    expect(calls['request']!['client'], 'student-mobile');
    expect(calls['request']!['login_id'], 'PRA-2026-001');
    await tester.enterText(find.byKey(const ValueKey('setup-code')).first, '123456');
    await tester.enterText(find.byKey(const ValueKey('setup-password')).first, 'Ravi2026pass');
    await tester.enterText(find.byKey(const ValueKey('setup-confirm')).first, 'Different99');
    await tester.ensureVisible(find.text('Create password'));
    await tester.tap(find.text('Create password'));
    await tester.pumpAndSettle();
    expect(find.text('The passwords do not match'), findsOneWidget);
    expect(calls.containsKey('verify'), isFalse);
    await tester.enterText(find.byKey(const ValueKey('setup-confirm')).first, 'Ravi2026pass');
    await tester.ensureVisible(find.text('Create password'));
    await tester.tap(find.text('Create password'));
    await settleStartup(tester);
    expect(calls['verify']!['code'], '123456');
    expect(calls['verify']!['password'], 'Ravi2026pass');
    expect(find.byType(FirstTimeSetupScreen), findsNothing);
    expect(find.byType(MobileWorkspace), findsOneWidget);
    // Let the resend timer stop.
    await tester.pump(const Duration(seconds: 61));
    expect(tester.takeException(), isNull);
  });
}
