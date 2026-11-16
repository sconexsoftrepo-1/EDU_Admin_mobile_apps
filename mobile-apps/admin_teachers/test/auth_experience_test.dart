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
import 'helpers/code_sign_in.dart';

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
      title: 'Edu-Pragathi',
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
            if (isCodeRequest(request.url)) {
              return http.Response('{"sent":true,"message":"sent"}', 200);
            }
            if (isCodeVerify(request.url)) {
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
        // Staff sign in with a code emailed to them: no password field.
        expect(find.text('Password'), findsNothing);
        await tester.ensureVisible(find.text('Send code'));
        await tester.tap(find.text('Send code'));
        await tester.pumpAndSettle();
        expect(find.text('Enter your login ID or email'), findsOneWidget);
        expect(payloads, isEmpty);
        await sendCode(tester, 'test-${role.name}');
        await tester.ensureVisible(find.text('Verify and sign in'));
        await tester.tap(find.text('Verify and sign in'));
        await tester.pumpAndSettle();
        expect(find.text('Enter the 6-digit code'), findsOneWidget);
        expect(payloads, isEmpty);
        await verifyCode(tester);
        expect(find.text('College account access denied'), findsOneWidget);
        expect(find.byType(MobileWorkspace), findsNothing);
        expect(payloads.single['client'], role.clientId);
        expect(payloads.single['login'], 'test-${role.name}');
        allow = true;
        await tester.tap(find.text('Verify and sign in'));
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
    'role switching keeps Login ID, resets the code step, and supports reverse navigation',
    (tester) async {
      await tester.pumpWidget(app(records));
      await settleStartup(tester);
      await warmAuth(tester);
      await openLogin(tester);
      await tester.enterText(find.byType(TextFormField).first, 'college-user');
      await tester.tap(find.text(roles.last.label));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextFormField>(find.byType(TextFormField).first)
            .controller!
            .text,
        'college-user',
      );
      // A new role asks for a new code: the code step resets.
      expect(find.text('Send code'), findsOneWidget);
      expect(find.text('6-digit code from your email'), findsNothing);
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
        if (isCodeRequest(r.url)) {
          return http.Response('{"sent":true,"message":"sent"}', 200);
        }
        if (isCodeVerify(r.url)) {
          attempts++;
          return pending.future;
        }
        return records(r, role);
      }),
    );
    await settleStartup(tester);
    await warmAuth(tester);
    await openLogin(tester);
    await sendCode(tester, 'college-user');
    await tester.enterText(find.byType(TextFormField).last, '123456');
    await tester.ensureVisible(find.text('Verify and sign in'));
    await tester.tap(find.text('Verify and sign in'));
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
      tester.widget<TextFormField>(find.byType(TextFormField).last).enabled,
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
        await tester.ensureVisible(find.text('Send code'));
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

  testWidgets('staff can sign in with a code sent to their email', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final calls = <String, Json>{};
    await tester.pumpWidget(
      app((request, selected) async {
        final path = request.url.path;
        if (path.endsWith('/otp/request')) {
          calls['request'] = jsonDecode(request.body) as Json;
          return http.Response('{"sent":true,"message":"sent"}', 200);
        }
        if (path.endsWith('/otp/verify')) {
          calls['verify'] = jsonDecode(request.body) as Json;
          final good = (jsonDecode(request.body) as Json)['code'] == '482915';
          return http.Response(
            good
                ? '{"access_token":"test","refresh_token":"test-refresh"}'
                : '{"detail":"The code is wrong or has expired. Request a new code."}',
            good ? 200 : 401,
          );
        }
        return records(request, selected);
      }),
    );
    await settleStartup(tester);
    await warmAuth(tester);
    await tester.tap(find.text(MobileRole.admin.label));
    await tester.pumpAndSettle();
    await openLogin(tester);
    expect(find.text('Login ID or email'), findsOneWidget);
    expect(find.text('Password'), findsNothing);
    await tester.enterText(find.byType(TextFormField).first, 'akhil@pragathiews.org');
    await tester.ensureVisible(find.text('Send code'));
    await tester.tap(find.text('Send code'));
    await tester.pumpAndSettle();
    expect(calls['request'], {'login': 'akhil@pragathiews.org', 'client': MobileRole.admin.clientId});
    expect(find.text('6-digit code from your email'), findsOneWidget);
    expect(find.textContaining('Resend in'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).last, '111111');
    await tester.ensureVisible(find.text('Verify and sign in'));
    await tester.tap(find.text('Verify and sign in'));
    await tester.pumpAndSettle();
    expect(find.text('The code is wrong or has expired. Request a new code.'), findsOneWidget);
    await tester.enterText(find.byType(TextFormField).last, '482915');
    await tester.tap(find.text('Verify and sign in'));
    await tester.pumpAndSettle();
    expect(calls['verify']!['code'], '482915');
    expect(find.text('${MobileRole.admin.label} dashboard'), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}
