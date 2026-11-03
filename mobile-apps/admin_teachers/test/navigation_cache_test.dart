import 'dart:convert';
import 'dart:io';
import 'package:edunexa_admin/app/edunexa_client.dart';
import 'package:edunexa_admin/theme/mobile_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('home shows finance on first load, screens reuse loaded data and Back keeps the scroll position', (tester) async {
    tester.view.physicalSize = const Size(390, 760);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final routes = (jsonDecode(File('test/fixtures/mobile_contract.json').readAsStringSync()) as Map)['admin'] as Map;
    final calls = <String, int>{};
    final api = CollegeApi(
      baseUrl: 'http://localhost',
      clientId: 'admin-mobile',
      httpClient: MockClient((req) async {
        final key = req.url.pathSegments.last;
        calls[key] = (calls[key] ?? 0) + 1;
        return http.Response(jsonEncode(routes[key] ?? {}), 200, headers: {'content-type': 'application/json; charset=utf-8'});
      }),
    );
    await api.accept({'access_token': 't', 'refresh_token': 't'});
    await tester.pumpWidget(MaterialApp(
      theme: collegeTheme(MobileRole.admin.accent),
      home: MobileWorkspace(title: 'Admin dashboard', role: MobileRole.admin, api: api, onLogout: () {}),
    ));
    await tester.pumpAndSettle();

    // The home dashboard loads the finance overview itself (no need to open Finance first).
    expect(calls['overview'], 1);
    final nav = find.byType(NavigationBar);

    // Opening Finance and coming back reuses the loaded data: no new requests.
    await tester.tap(find.descendant(of: nav, matching: find.text('Finance')));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: nav, matching: find.text('Home')));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: nav, matching: find.text('Finance')));
    await tester.pumpAndSettle();
    expect(calls['overview'], 1);

    // Back returns to where you were on Home.
    await tester.tap(find.descendant(of: nav, matching: find.text('Home')));
    await tester.pumpAndSettle();
    final home = find.byKey(const ValueKey('page-home'));
    await tester.drag(home, const Offset(0, -500));
    await tester.pumpAndSettle();
    double offset() => tester.state<ScrollableState>(find.descendant(of: find.byKey(const ValueKey('page-home')), matching: find.byType(Scrollable)).first).position.pixels;
    final before = offset();
    expect(before, greaterThan(100));
    await tester.tap(find.descendant(of: nav, matching: find.text('Finance')));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();
    expect(offset(), closeTo(before, 1));

    // Choosing Home from the bottom bar starts at the top.
    await tester.tap(find.descendant(of: nav, matching: find.text('Finance')));
    await tester.pumpAndSettle();
    await tester.tap(find.descendant(of: nav, matching: find.text('Home')));
    await tester.pumpAndSettle();
    expect(offset(), 0);

    // Pull-to-refresh reads fresh data from the server.
    await tester.tap(find.descendant(of: nav, matching: find.text('Finance')));
    await tester.pumpAndSettle();
    await tester.fling(find.byKey(const ValueKey('page-overview')), const Offset(0, 500), 1200);
    await tester.pumpAndSettle();
    expect(calls['overview'], 2);
    expect(tester.takeException(), isNull);
    await tester.pump(const Duration(seconds: 5)); // let the refresh badge hide
    await tester.pumpWidget(const SizedBox());
  });
}
