import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:edunexa_admin/app/edunexa_client.dart';
import 'helpers/splash_test_support.dart';

void main() {
  const roles = [MobileRole.admin, MobileRole.teacher];
  const client = 'admin-mobile';
  final fixtures =
      jsonDecode(File('test/fixtures/mobile_contract.json').readAsStringSync())
          as Json;
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  setUpAll(() async {
    if (!const bool.fromEnvironment('CAPTURE_AUTH')) return;
    for (final entry in {
      'Roboto': [
        'assets/fonts/Roboto-Regular.ttf',
        'assets/fonts/Roboto-Medium.ttf',
        'assets/fonts/Roboto-Bold.ttf',
      ],
      'MaterialIcons': ['fonts/MaterialIcons-Regular.otf'],
    }.entries) {
      final font = FontLoader(entry.key);
      for (final asset in entry.value) {
        font.addFont(rootBundle.load(asset));
      }
      await font.load();
    }
  });
  Widget app(
    Future<http.Response> Function(http.Request, MobileRole) respond,
  ) => RepaintBoundary(
    key: const ValueKey('auth-capture'),
    child: EdunexaApp(
      title: 'EduNexa',
      clientId: client,
      roles: roles,
      initialize: () async {},
      apiFactory: (role) => CollegeApi(
        baseUrl: 'http://localhost',
        clientId: role.clientId,
        httpClient: MockClient((r) => respond(r, role)),
      ),
    ),
  );
  Future<http.Response> records(http.Request req, MobileRole role) async =>
      http.Response(
        jsonEncode(fixtures[role.name][req.url.pathSegments.last] ?? {}),
        200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );
  Future<void> warmAuth(WidgetTester tester) async {
    final context = tester.element(find.byType(LoginScreen));
    final files = Directory(
      'assets/illustrations/auth',
    ).listSync().whereType<File>().where((f) => f.path.endsWith('.svg'));
    await tester.runAsync(() async {
      await Future.wait<void>([
        precacheImage(
          const ResizeImage(AssetImage('assets/icons/image.png'), width: 384),
          context,
        ),
        precacheImage(
          const AssetImage('assets/branding/sconexlogo.webp'),
          context,
        ),
        for (final file in files)
          SvgAssetLoader(file.path).loadBytes(context).then<void>((_) {}),
      ]);
    });
    await tester.pumpAndSettle();
  }

  Future<void> capture(WidgetTester tester, String name) async {
    if (!const bool.fromEnvironment('CAPTURE_AUTH')) return;
    final boundary = tester.renderObject<RenderRepaintBoundary>(
      find.byKey(const ValueKey('auth-capture')),
    );
    await tester.runAsync(() async {
      final image = await boundary.toImage(pixelRatio: 2);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      final file = File(
        '../../artifacts/auth-redesign/captures/admin_teachers/$name.png',
      );
      await file.parent.create(recursive: true);
      await file.writeAsBytes(data!.buffer.asUint8List());
      image.dispose();
    });
  }

  Future<void> openLogin(WidgetTester tester) async {
    await tester.ensureVisible(find.text('Continue'));
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
  }

  for (final role in roles) {
    testWidgets(
      '${role.label}: illustrated selection, original branding, validation, errors and authenticated routing',
      (tester) async {
        tester.view.physicalSize = const Size(390, 844);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        var allow = false;
        final payloads = <Json>[];
        await tester.pumpWidget(
          app((request, selected) async {
            if (request.url.path.endsWith('/login')) {
              payloads.add(jsonDecode(request.body) as Json);
              return http.Response(
                allow
                    ? ' {"access_token":"test","refresh_token":"test-refresh"}'
                    : '{"detail":"College account access denied"}',
                allow ? 200 : 403,
              );
            }
            return records(request, selected);
          }),
        );
        await settleStartup(tester);
        await warmAuth(tester);
        await tester.tap(find.text(role.label));
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<AnimatedRoleTile>(
                find.byWidgetPredicate(
                  (w) => w is AnimatedRoleTile && w.role == role,
                ),
              )
              .selected,
          isTrue,
        );
        expect(find.text('Designed & Developed by'), findsOneWidget);
        expect(find.text('Sconex Soft'), findsOneWidget);
        final branded = tester.widget<Image>(
          find.byKey(const ValueKey('auth-original-icon')),
        );
        expect(
          ((branded.image as ResizeImage).imageProvider as AssetImage)
              .assetName,
          'assets/icons/image.png',
        );
        await capture(tester, 'role-selection-${role.name}');
        await openLogin(tester);
        await capture(tester, 'login-${role.name}');
        expect(
          tester
              .widget<AnimatedRoleSwitcher>(find.byType(AnimatedRoleSwitcher))
              .selected,
          role,
        );
        await tester.ensureVisible(find.text('Sign in'));
        await tester.tap(find.text('Sign in'));
        await tester.pumpAndSettle();
        expect(find.text('Enter your login ID'), findsOneWidget);
        expect(find.text('Enter your password'), findsOneWidget);
        expect(payloads, isEmpty);
        await tester.enterText(
          find.byType(TextFormField).first,
          'test-${role.name}',
        );
        await tester.enterText(
          find.byType(TextFormField).last,
          'test-password',
        );
        await tester.tap(find.byTooltip('Show password'));
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<TextField>(
                find.descendant(
                  of: find.byType(TextFormField).last,
                  matching: find.byType(TextField),
                ),
              )
              .obscureText,
          isFalse,
        );
        await tester.tap(find.byTooltip('Hide password'));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.text('Sign in'));
        await tester.tap(find.text('Sign in'));
        await tester.pumpAndSettle();
        expect(find.text('College account access denied'), findsOneWidget);
        expect(find.byType(MobileWorkspace), findsNothing);
        expect(payloads.single['client'], role.clientId);
        allow = true;
        await tester.tap(find.text('Sign in'));
        await tester.pumpAndSettle();
        expect(find.text('${role.label} dashboard'), findsWidgets);
        expect(
          await const FlutterSecureStorage().read(key: 'edunexa-role-$client'),
          role.name,
        );
        expect(payloads.length, 2);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'role switching keeps Login ID, explains password clearing, and supports reverse navigation',
    (tester) async {
      await tester.pumpWidget(app(records));
      await settleStartup(tester);
      await warmAuth(tester);
      await openLogin(tester);
      await tester.enterText(find.byType(TextFormField).first, 'college-user');
      await tester.enterText(
        find.byType(TextFormField).last,
        'private-test-input',
      );
      await tester.tap(find.text(roles.last.label));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).first)
            .controller!
            .text,
        'college-user',
      );
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).last)
            .controller!
            .text,
        isEmpty,
      );
      expect(
        find.text('Login ID kept. Re-enter the password for this role.'),
        findsOneWidget,
      );
      await tester.ensureVisible(find.text('Choose another role'));
      await tester.tap(find.text('Choose another role'));
      await tester.pumpAndSettle();
      expect(find.byType(AnimatedRoleTile), findsNWidgets(2));
      await openLogin(tester);
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).first)
            .controller!
            .text,
        'college-user',
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('pending sign-in disables repeat submissions and role changes', (
    tester,
  ) async {
    final pending = Completer<http.Response>();
    var attempts = 0;
    await tester.pumpWidget(
      app((r, role) async {
        if (r.url.path.endsWith('/login')) {
          attempts++;
          return pending.future;
        }
        return records(r, role);
      }),
    );
    await settleStartup(tester);
    await warmAuth(tester);
    await openLogin(tester);
    await tester.enterText(find.byType(TextFormField).first, 'college-user');
    await tester.enterText(find.byType(TextFormField).last, 'test-password');
    await tester.ensureVisible(find.text('Sign in'));
    await tester.tap(find.text('Sign in'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Signing in…'), findsOneWidget);
    expect(
      tester
          .widget<AnimatedRoleSwitcher>(find.byType(AnimatedRoleSwitcher))
          .enabled,
      isFalse,
    );
    expect(
      tester.widget<TextFormField>(find.byType(TextFormField).first).enabled,
      isFalse,
    );
    await tester.tap(find.text('Signing in…'));
    await tester.pump();
    expect(attempts, 1);
    pending.complete(http.Response('{"detail":"Network test completed"}', 403));
    await tester.pumpAndSettle();
    expect(find.text('Network test completed'), findsOneWidget);
    expect(attempts, 1);
    expect(tester.takeException(), isNull);
  });
  for (final size in [
    (320.0, 568.0, 1.0),
    (390.0, 844.0, 1.0),
    (430.0, 932.0, 1.0),
    (768.0, 1024.0, 1.0),
    (320.0, 568.0, 1.8),
  ]) {
    testWidgets(
      'auth responsive and keyboard-open ${size.$1}x${size.$2} scale ${size.$3}',
      (tester) async {
        tester.view.physicalSize = Size(size.$1, size.$2);
        tester.view.devicePixelRatio = 1;
        tester.platformDispatcher.textScaleFactorTestValue = size.$3;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetViewInsets);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        await tester.pumpWidget(app(records));
        await settleStartup(tester);
        await warmAuth(tester);
        await tester.ensureVisible(find.text('Sconex Soft'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await openLogin(tester);
        expect(find.text('Welcome back'), findsOneWidget);
        await tester.ensureVisible(find.byType(TextFormField).last);
        await tester.tap(find.byType(TextFormField).last);
        tester.view.viewInsets = const FakeViewPadding(bottom: 260);
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.text('Sign in'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        tester.view.resetViewInsets();
        tester.testTextInput.hide();
        FocusManager.instance.primaryFocus?.unfocus();
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.text('Sconex Soft'));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'reduced-motion authentication remains interactive without idle animation',
    (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      await tester.pumpWidget(app(records));
      await settleStartup(tester);
      await warmAuth(tester);
      await tester.tap(find.text(roles.last.label));
      await tester.pumpAndSettle();
      await openLogin(tester);
      expect(find.text('Welcome back'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
