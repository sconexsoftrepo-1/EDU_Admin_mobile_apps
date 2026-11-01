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

  for (final role in [MobileRole.student, MobileRole.parent]) {
    testWidgets('${role.name} picks a date on the home attendance card', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 1200);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final dates = <String?>[];
      final routes =
          (jsonDecode(
                    File(
                      'test/fixtures/mobile_contract.json',
                    ).readAsStringSync(),
                  )
                  as Map)[role.name]
              as Map;
      final api = CollegeApi(
        baseUrl: 'http://localhost',
        clientId: '${role.name}-mobile',
        httpClient: MockClient((req) async {
          final key = req.url.pathSegments.last;
          if (req.url.path.endsWith('/attendance-workspace')) {
            dates.add(req.url.queryParameters['on']);
          }
          return http.Response(
            jsonEncode(routes[key] ?? {}),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      await api.accept({'access_token': 't', 'refresh_token': 't'});
      await tester.pumpWidget(
        MaterialApp(
          theme: collegeTheme(role.accent),
          home: MobileWorkspace(
            title: 'Dashboard',
            role: role,
            api: api,
            onLogout: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      final chip = find.byKey(const ValueKey('home-attendance-date'));
      expect(chip, findsOneWidget);
      await tester.tap(chip);
      await tester.pumpAndSettle();
      expect(find.byType(DatePickerDialog), findsOneWidget);
      // Type a past date (the 15th of last month) in the picker's text mode.
      final now = DateTime.now();
      final past = DateTime(now.year, now.month - 1, 15);
      await tester.tap(find.byIcon(Icons.edit_outlined));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField).last,
        '${past.month.toString().padLeft(2, '0')}/15/${past.year}',
      );
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      expect(
        dates.whereType<String>().last,
        '${past.year}-${past.month.toString().padLeft(2, '0')}-15',
      );
      expect(tester.takeException(), isNull);
    });
  }
}
