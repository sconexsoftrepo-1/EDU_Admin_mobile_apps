import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:edunexa_admin/app/edunexa_client.dart';
import 'package:edunexa_admin/theme/mobile_design.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  final fixtures =
      jsonDecode(File('test/fixtures/mobile_contract.json').readAsStringSync())
          as Json;
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  for (final failure in [false, true]) {
    testWidgets(
      'book refresh waits for actual ${failure ? 'failure' : 'success'} and reports it honestly',
      (tester) async {
        final completion = Completer<void>();
        var calls = 0;
        final semantics = tester.ensureSemantics();
        await tester.pumpWidget(
          MaterialApp(
            theme: collegeTheme(collegeCaramel),
            home: Scaffold(
              body: EduNexaAnimatedRefresh(
                onRefresh: () {
                  calls++;
                  return completion.future;
                },
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [Text('Existing records')],
                ),
              ),
            ),
          ),
        );
        final refresh = tester.state<RefreshIndicatorState>(
          find.byType(RefreshIndicator),
        );
        final future = refresh.show();
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 300));
        expect(calls, 1);
        expect(
          find.bySemanticsLabel('Refreshing college records'),
          findsOneWidget,
        );
        await tester.pump(const Duration(seconds: 2));
        expect(
          find.bySemanticsLabel('Refreshing college records'),
          findsOneWidget,
        );
        expect(find.bySemanticsLabel('Refresh complete'), findsNothing);
        if (failure) {
          completion.completeError(StateError('Network unavailable'));
        } else {
          completion.complete();
        }
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 50));
        expect(
          find.bySemanticsLabel(
            failure ? 'Refresh failed. Use retry.' : 'Refresh complete',
          ),
          findsOneWidget,
        );
        expect(find.text('Existing records'), findsOneWidget);
        await tester.pump(const Duration(milliseconds: 500));
        await tester.pumpAndSettle();
        await future;
        expect(tester.takeException(), isNull);
        semantics.dispose();
      },
    );
  }
  testWidgets('refresh can finish after its screen is disposed', (
    tester,
  ) async {
    final completion = Completer<void>();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: EduNexaAnimatedRefresh(
            onRefresh: () => completion.future,
            child: ListView(children: const [Text('Records')]),
          ),
        ),
      ),
    );
    tester.state<RefreshIndicatorState>(find.byType(RefreshIndicator)).show();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpWidget(const SizedBox());
    completion.complete();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
  testWidgets('reduced motion refresh settles without a persistent ticker', (
    tester,
  ) async {
    final completion = Completer<void>();
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: Scaffold(
            body: EduNexaAnimatedRefresh(
              onRefresh: () => completion.future,
              child: ListView(children: const [Text('Records')]),
            ),
          ),
        ),
      ),
    );
    final future = tester
        .state<RefreshIndicatorState>(find.byType(RefreshIndicator))
        .show();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    completion.complete();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    await future;
    expect(tester.takeException(), isNull);
    expect(tester.binding.hasScheduledFrame, isFalse);
  });
  testWidgets('every original SVG renders with the production renderer', (
    tester,
  ) async {
    for (final f
        in Directory('assets')
            .listSync(recursive: true)
            .whereType<File>()
            .where((f) => f.path.endsWith('.svg'))) {
      await tester.pumpWidget(
        MaterialApp(home: Scaffold(body: SvgPicture.asset(f.path))),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: f.path);
    }
  });
  for (final role in [MobileRole.admin, MobileRole.teacher]) {
    for (final layout in [
      (320.0, 844.0, 1.8),
      (768.0, 1024.0, 1.0),
      (844.0, 390.0, 1.0),
    ]) {
      testWidgets(
        '${role.name} responsive modules/forms ${layout.$1}x${layout.$2} scale ${layout.$3}',
        (tester) async {
          tester.view.physicalSize = Size(layout.$1, layout.$2);
          tester.view.devicePixelRatio = 1;
          tester.platformDispatcher.textScaleFactorTestValue = layout.$3;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
          final routes = fixtures[role.name] as Json;
          final api = CollegeApi(
            baseUrl: 'http://localhost',
            clientId: role.clientId,
            httpClient: MockClient(
              (req) async => http.Response(
                jsonEncode(routes[req.url.pathSegments.last] ?? {}),
                200,
                headers: {'content-type': 'application/json; charset=utf-8'},
              ),
            ),
          );
          await api.accept({'access_token': 'test', 'refresh_token': 'test'});
          await tester.pumpWidget(
            MaterialApp(
              theme: collegeTheme(role.accent),
              home: MobileWorkspace(
                role: role,
                title: '${role.label} dashboard',
                api: api,
                onLogout: () {},
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          for (final screen in routes['screens']['screens'] as List) {
            await tester.tap(find.byTooltip('Open navigation menu'));
            await tester.pumpAndSettle();
            final target = find.descendant(
              of: find.byType(Drawer),
              matching: find.text(screen['title']),
            );
            await tester.scrollUntilVisible(
              target,
              180,
              scrollable: find
                  .descendant(
                    of: find.byType(Drawer),
                    matching: find.byType(Scrollable),
                  )
                  .first,
            );
            await Scrollable.ensureVisible(
              tester.element(target),
              alignment: .4,
            );
            await tester.pumpAndSettle();
            await tester.tap(target);
            await tester.pumpAndSettle();
            expect(
              tester.takeException(),
              isNull,
              reason: '${role.name}/${screen['key']}',
            );
            final scroll = tester.state<ScrollableState>(
              find
                  .descendant(
                    of: find.byType(RefreshIndicator),
                    matching: find.byType(Scrollable),
                  )
                  .first,
            );
            var previous = -1.0;
            while (scroll.position.extentAfter > 1 &&
                previous != scroll.position.pixels) {
              previous = scroll.position.pixels;
              scroll.position.jumpTo(
                (previous + 250).clamp(0, scroll.position.maxScrollExtent),
              );
              await tester.pumpAndSettle();
              expect(
                tester.takeException(),
                isNull,
                reason: '${role.name}/${screen['key']} continuation',
              );
            }
          }
          await tester.pumpWidget(const SizedBox());
          for (final screen in routes['screens']['screens'] as List) {
            final d = routes[screen['key']] as Json;
            for (final action in d['actions'] as List? ?? []) {
              if (action['key'] == 'read_notification') continue;
              await tester.pumpWidget(
                MaterialApp(
                  theme: collegeTheme(role.accent),
                  home: ActionForm(
                    key: ValueKey(action['key']),
                    action: action,
                    lookups: d['lookups'] ?? {},
                  ),
                ),
              );
              await tester.pumpAndSettle();
              expect(
                tester.takeException(),
                isNull,
                reason: '${role.name}/${action['key']}',
              );
              final scroll = tester.state<ScrollableState>(
                find.byType(Scrollable).first,
              );
              scroll.position.jumpTo(scroll.position.maxScrollExtent);
              await tester.pumpAndSettle();
              expect(tester.takeException(), isNull);
            }
          }
        },
      );
    }
  }
  testWidgets(
    'switching child removes stale fees before the new request completes',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final routes = fixtures['parent'] as Json;
      final second = Completer<http.Response>();
      final children = [
        {'code': 'STU1', 'name': 'First child'},
        {'code': 'STU2', 'name': 'Second child'},
      ];
      final api = CollegeApi(
        baseUrl: 'http://localhost',
        clientId: 'parent-mobile',
        httpClient: MockClient((req) async {
          final key = req.url.pathSegments.last;
          if (key == 'screens') {
            return http.Response(jsonEncode(routes[key]), 200);
          }
          final d = Map<String, dynamic>.from(routes[key] ?? {});
          d['students'] = children;
          d['selected_student_code'] =
              req.url.queryParameters['student_code'] ?? 'STU1';
          if (key == 'fees' && d['selected_student_code'] == 'STU2') {
            return second.future;
          }
          return http.Response(
            jsonEncode(d),
            200,
            headers: {'content-type': 'application/json; charset=utf-8'},
          );
        }),
      );
      await api.accept({'access_token': 'test', 'refresh_token': 'test'});
      await tester.pumpWidget(
        MaterialApp(
          theme: collegeTheme(collegeCaramel),
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
      expect(find.text('₹40,000'), findsOneWidget);
      await tester.tap(find.byType(DropdownButtonFormField<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Second child').last);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('₹40,000'), findsNothing);
      expect(find.byType(EduLoadingSkeleton), findsOneWidget);
      final d = Map<String, dynamic>.from(routes['fees']);
      d['students'] = children;
      d['selected_student_code'] = 'STU2';
      d['summary'] = {
        'totals': {'outstanding': '2500', 'paid': '0', 'gross': '2500'},
      };
      second.complete(
        http.Response(
          jsonEncode(d),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('₹2,500'), findsWidgets);
      expect(tester.takeException(), isNull);
    },
  );
}
