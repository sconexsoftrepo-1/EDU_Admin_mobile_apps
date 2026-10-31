import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/services.dart';
import 'package:edunexa_parent/app/edunexa_client.dart';
import 'package:edunexa_parent/theme/mobile_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  setUpAll(() async {
    if (!const bool.fromEnvironment('CAPTURE_MOBILE_UI')) return;
    for (final font in {
      'Roboto': 'assets/fonts/Roboto-Regular.ttf',
      'MaterialIcons': 'fonts/MaterialIcons-Regular.otf',
    }.entries) {
      final loader = FontLoader(font.key)..addFont(rootBundle.load(font.value));
      await loader.load();
    }
  });
  final fixtures =
      jsonDecode(File('test/fixtures/mobile_contract.json').readAsStringSync())
          as Json;
  Future<void> capture(WidgetTester tester, String name) async {
    if (!const bool.fromEnvironment('CAPTURE_MOBILE_UI')) return;
    final boundary = tester.renderObject<RenderRepaintBoundary>(
      find.byKey(const ValueKey('capture')),
    );
    await tester.runAsync(() async {
      final image = await boundary.toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await File(
        '/private/tmp/edunexa-$name.png',
      ).writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
  }

  for (final role in MobileRole.values) {
    testWidgets(
      '${role.name}: every API screen renders and all five tabs navigate',
      (tester) async {
        tester.view.physicalSize = const Size(390, 844);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final routes = fixtures[role.name] as Json;
        final api = CollegeApi(
          baseUrl: 'http://localhost',
          clientId: role.clientId,
          httpClient: MockClient((req) async {
            final key = req.url.pathSegments.last;
            return http.Response(
              jsonEncode(routes[key] ?? {}),
              200,
              headers: {'content-type': 'application/json; charset=utf-8'},
            );
          }),
        );
        await api.accept({
          'access_token': 'test',
          'refresh_token': 'test-refresh',
        });
        await tester.pumpWidget(
          MaterialApp(
            theme: collegeTheme(role.accent),
            home: RepaintBoundary(
              key: const ValueKey('capture'),
              child: MobileWorkspace(
                title: '${role.label} dashboard',
                role: role,
                api: api,
                onLogout: () {},
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byType(NavigationDestination), findsNWidgets(5));
        await capture(tester, '${role.name}-home');
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
            alignment: 0.4,
          );
          await tester.pumpAndSettle();
          await tester.tap(target);
          await tester.pumpAndSettle();
          expect(find.text(screen['title']), findsWidgets);
          expect(
            find.text('Couldn’t load this screen'),
            findsNothing,
            reason:
                '${role.name}/${screen['key']}: ${tester.widgetList<Text>(find.byType(Text)).map((t) => t.data).join(' | ')}',
          );
          expect(
            tester.takeException(),
            isNull,
            reason: '${role.name}/${screen['key']}',
          );
          if ([
            'fees',
            'overview',
            'calendar',
            'notifications',
            'assignments',
          ].contains(screen['key'])) {
            await capture(tester, '${role.name}-${screen['key']}');
          }
        }
        for (final label in [
          'Home',
          role == MobileRole.admin
              ? 'Finance'
              : role == MobileRole.teacher
              ? 'Classes'
              : role == MobileRole.parent
              ? 'Fees'
              : 'Study',
          'Calendar',
          'Inbox',
          'More',
        ]) {
          await tester.tap(
            find.descendant(
              of: find.byType(NavigationBar),
              matching: find.text(label),
            ),
          );
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
        }
        await tester.pumpWidget(const SizedBox());
      },
    );
  }
  testWidgets(
    'payment form validates amounts and uses fee lookup instead of typing codes',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: collegeTheme(collegeCaramel),
          home: ActionForm(
            action: {
              'key': 'make_payment',
              'label': 'Make payment',
              'fields': [
                {
                  'key': 'charge_code',
                  'label': 'Fee charge',
                  'type': 'text',
                  'required': true,
                },
                {
                  'key': 'amount',
                  'label': 'Amount',
                  'type': 'number',
                  'required': true,
                },
              ],
            },
            lookups: {
              'charges': [
                {'code': 'C1', 'name': 'Tuition — ₹40,000'},
              ],
            },
          ),
        ),
      );
      await tester.tap(find.text('Continue to secure payment'));
      await tester.pumpAndSettle();
      expect(find.text('Enter fee charge'), findsOneWidget);
      expect(find.text('Enter amount'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField), '-50');
      await tester.tap(find.text('Continue to secure payment'));
      await tester.pumpAndSettle();
      expect(find.text('Enter an amount greater than zero'), findsOneWidget);
    },
  );
  testWidgets(
    'leave form offers native date picker and validates reversed dates',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: collegeTheme(collegePine),
          home: ActionForm(
            action: {
              'key': 'request_leave',
              'label': 'Request leave',
              'fields': [
                {
                  'key': 'start_date',
                  'label': 'From',
                  'type': 'date',
                  'required': true,
                },
                {
                  'key': 'end_date',
                  'label': 'To',
                  'type': 'date',
                  'required': true,
                },
              ],
            },
            lookups: {},
            initial: {'start_date': '2026-11-02', 'end_date': '2026-11-01'},
          ),
        ),
      );
      await tester.tap(find.text('Save request leave'));
      await tester.pumpAndSettle();
      expect(find.text('Choose a date after the start'), findsOneWidget);
      await tester.tap(find.byType(TextFormField).first);
      await tester.pumpAndSettle();
      expect(find.byType(DatePickerDialog), findsOneWidget);
    },
  );
  testWidgets('calendar supports enlarged text at 320px', (tester) async {
    tester.view.physicalSize = const Size(320, 844);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 1.8;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpWidget(
      MaterialApp(
        theme: collegeTheme(collegePine),
        home: Scaffold(
          body: SingleChildScrollView(
            child: CampusCalendar(
              month: DateTime(2026, 10),
              selected: DateTime(2026, 10, 26),
              events: [],
              onMonth: (_) {},
              onDay: (_) {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
  testWidgets('parent child switch refreshes fees for the selected child', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final requests = <String>[];
    final routes = fixtures['parent'] as Json;
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
        final result = Map<String, dynamic>.from(routes[key] ?? {});
        result['students'] = children;
        result['selected_student_code'] =
            req.url.queryParameters['student_code'] ?? 'STU1';
        if (key == 'fees') {
          requests.add(result['selected_student_code']);
          result['summary'] = {
            'totals': {
              'outstanding': result['selected_student_code'] == 'STU2'
                  ? '2500'
                  : '40000',
              'paid': '0',
              'gross': '40000',
            },
          };
        }
        return http.Response(
          jsonEncode(result),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    await api.accept({'access_token': 'test', 'refresh_token': 'test-refresh'});
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
    expect(requests.last, 'STU1');
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Second child').last);
    await tester.pumpAndSettle();
    expect(requests.last, 'STU2');
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('Fees'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('₹2,500'), findsOneWidget);
  });
}
