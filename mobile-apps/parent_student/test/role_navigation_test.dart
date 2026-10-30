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
  for (final role in MobileRole.values) {
    testWidgets('${role.label} login, dashboard, navigation and logout', (
      tester,
    ) async {
      final pair = role == MobileRole.admin || role == MobileRole.teacher
          ? [MobileRole.admin, MobileRole.teacher]
          : [MobileRole.parent, MobileRole.student];
      await tester.pumpWidget(
        EdunexaApp(
          title: 'EduNexa',
          clientId: pair.first.clientId,
          roles: pair,
          apiFactory: (selected) => CollegeApi(
            baseUrl: 'http://localhost:8010',
            clientId: selected.clientId,
            httpClient: MockClient((request) async {
              if (request.url.path.endsWith('/login')) {
                expect(jsonDecode(request.body)['client'], role.clientId);
                return http.Response(
                  '{"access_token":"access","refresh_token":"refresh"}',
                  200,
                );
              }
              if (request.url.path.endsWith('/screens')) {
                expect(request.headers['Authorization'], 'Bearer access');
                return http.Response(
                  jsonEncode({
                    'screens': [
                      {'key': 'profile', 'title': '${role.label} profile'},
                    ],
                  }),
                  200,
                );
              }
              if (request.url.path.endsWith('/profile')) {
                return http.Response(
                  jsonEncode({
                    'title': '${role.label} details',
                    'items': [
                      {'name': 'College user'},
                    ],
                  }),
                  200,
                );
              }
              return http.Response('{}', 200);
            }),
          ),
        ),
      );
      await settleStartup(tester);
      await tester.tap(find.text(role.label));
      await settleStartup(tester);
      if (find.text('Continue').evaluate().isNotEmpty) {
        await tester.ensureVisible(find.text('Continue'));
        await tester.tap(find.text('Continue'));
        await settleStartup(tester);
      }
      await tester.enterText(find.byType(TextFormField).first, 'college-user');
      await tester.enterText(find.byType(TextFormField).last, 'password');
      await tester.tap(find.text('Sign in'));
      await settleStartup(tester);
      expect(find.text('${role.label} dashboard'), findsWidgets);
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text('More'),
        ),
      );
      await settleStartup(tester);
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('module-profile')),
        200,
        scrollable: find
            .descendant(
              of: find.byType(RefreshIndicator),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(find.byKey(const ValueKey('module-profile')), findsOneWidget);
      expect(
        await const FlutterSecureStorage().read(
          key: 'edunexa-role-${pair.first.clientId}',
        ),
        role.name,
      );
      await Scrollable.ensureVisible(
        tester.element(find.byKey(const ValueKey('module-profile'))),
        alignment: 0.3,
      );
      await settleStartup(tester);
      await tester.tap(find.byKey(const ValueKey('module-profile')));
      await settleStartup(tester);
      expect(find.text('College user'), findsOneWidget);
      await tester.tap(find.byTooltip('Open navigation menu'));
      await settleStartup(tester);
      await tester.tap(find.text('Dashboard'));
      await settleStartup(tester);
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text('More'),
        ),
      );
      await settleStartup(tester);
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('module-profile')),
        200,
        scrollable: find
            .descendant(
              of: find.byType(RefreshIndicator),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(find.byKey(const ValueKey('module-profile')), findsOneWidget);
      expect(find.text('College user'), findsNothing);
      await tester.tap(find.byTooltip('Sign out'));
      await settleStartup(tester);
      expect(find.text('Continue'), findsOneWidget);
      expect(
        await const FlutterSecureStorage().read(
          key: 'edunexa-refresh-${role.clientId}',
        ),
        isNull,
      );
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('restores teacher role in combined staff app', (tester) async {
    FlutterSecureStorage.setMockInitialValues({
      'edunexa-role-admin-mobile': 'teacher',
      'edunexa-refresh-teacher-mobile': 'refresh',
    });
    await tester.pumpWidget(
      EdunexaApp(
        title: 'Staff',
        clientId: 'admin-mobile',
        roles: const [MobileRole.admin, MobileRole.teacher],
        apiFactory: (role) => CollegeApi(
          baseUrl: 'http://localhost:8010',
          clientId: role.clientId,
          httpClient: MockClient((request) async {
            expect(role, MobileRole.teacher);
            if (request.url.path.endsWith('/refresh')) {
              expect(jsonDecode(request.body)['client'], 'teacher-mobile');
              return http.Response(
                '{"access_token":"restored","refresh_token":"rotated"}',
                200,
              );
            }
            return http.Response('{"screens":[]}', 200);
          }),
        ),
      ),
    );
    await settleStartup(tester);
    expect(find.text('Teacher dashboard'), findsWidgets);
    expect(find.text('Sign in'), findsNothing);
  });
  testWidgets('role switch clears password and authentication error', (
    tester,
  ) async {
    await tester.pumpWidget(
      EdunexaApp(
        title: 'Family',
        clientId: 'parent-mobile',
        roles: const [MobileRole.parent, MobileRole.student],
        apiFactory: (role) => CollegeApi(
          baseUrl: 'http://localhost:8010',
          clientId: role.clientId,
          httpClient: MockClient(
            (_) async => http.Response('{"detail":"Role is not allowed"}', 403),
          ),
        ),
      ),
    );
    await settleStartup(tester);
    await tester.tap(find.text('Continue'));
    await settleStartup(tester);
    await tester.enterText(find.byType(TextFormField).first, 'parent');
    await tester.enterText(find.byType(TextFormField).last, 'secret');
    await tester.tap(find.text('Sign in'));
    await settleStartup(tester);
    expect(find.text('Role is not allowed'), findsOneWidget);
    expect(find.byType(MobileWorkspace), findsNothing);
    await tester.tap(find.text('Student'));
    await settleStartup(tester);
    expect(find.text('Role is not allowed'), findsNothing);
    expect(
      tester
          .widget<TextFormField>(find.byType(TextFormField).last)
          .controller!
          .text,
      isEmpty,
    );
  });
  testWidgets('narrow layout supports enlarged text', (tester) async {
    tester.view.physicalSize = const Size(320, 844);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    for (final role in MobileRole.values) {
      FlutterSecureStorage.setMockInitialValues({});
      final staff = role == MobileRole.admin || role == MobileRole.teacher;
      await tester.pumpWidget(
        EdunexaApp(
          key: ValueKey(role),
          title: staff
              ? 'EduNexa Admin & Teachers'
              : 'EduNexa Parents & Students',
          clientId: staff ? 'admin-mobile' : 'parent-mobile',
          roles: staff
              ? const [MobileRole.admin, MobileRole.teacher]
              : const [MobileRole.parent, MobileRole.student],
          apiFactory: (r) => CollegeApi(
            baseUrl: 'http://localhost:8010',
            clientId: r.clientId,
            httpClient: MockClient((req) async {
              if (req.url.path.endsWith('/login')) {
                return http.Response(
                  '{"access_token":"token","refresh_token":"refresh"}',
                  200,
                );
              }
              return http.Response(
                '{"screens":[{"key":"timetable","title":"Timetable and period swap"},{"key":"assignments","title":"Assignments and submissions"}]}',
                200,
              );
            }),
          ),
        ),
      );
      await settleStartup(tester);
      await tester.ensureVisible(find.text(role.label));
      await tester.tap(find.text(role.label));
      await settleStartup(tester);
      if (find.text('Continue').evaluate().isNotEmpty) {
        await tester.ensureVisible(find.text('Continue'));
        await tester.tap(find.text('Continue'));
        await settleStartup(tester);
      }
      await tester.enterText(find.byType(TextFormField).first, 'college-user');
      await tester.enterText(find.byType(TextFormField).last, 'password');
      await tester.ensureVisible(find.text('Sign in'));
      await tester.tap(find.text('Sign in'));
      await settleStartup(tester);
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text('More'),
        ),
      );
      await settleStartup(tester);
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('module-assignments')),
        200,
        scrollable: find
            .descendant(
              of: find.byType(RefreshIndicator),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await settleStartup(tester);
      expect(tester.takeException(), isNull);
    }
  });
}
