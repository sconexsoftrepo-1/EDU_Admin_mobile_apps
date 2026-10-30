import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:edunexa_parent/src/edunexa_client.dart';
import 'package:edunexa_parent/src/mobile_design.dart';
import 'package:edunexa_parent/splash/splash_screen.dart';
import 'package:edunexa_parent/splash/splash_assets.dart';
import 'package:edunexa_parent/splash/splash_timeline.dart';
import 'helpers/splash_test_support.dart';

void main() {
  const ownConfig = SplashConfiguration.students;
  const ownRoles = [MobileRole.parent, MobileRole.student];
  const primaryClient = 'parent-mobile';
  final fixture =
      jsonDecode(File('test/fixtures/mobile_contract.json').readAsStringSync())
          as Json;
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  setUpAll(() async {
    if (!const bool.fromEnvironment('CAPTURE_SPLASH')) return;
    final fonts = {
      'Roboto': [
        'assets/fonts/Roboto-Regular.ttf',
        'assets/fonts/Roboto-Medium.ttf',
        'assets/fonts/Roboto-Bold.ttf',
      ],
      'MaterialIcons': ['fonts/MaterialIcons-Regular.otf'],
    };
    for (final font in fonts.entries) {
      final loader = FontLoader(font.key);
      for (final asset in font.value) {
        loader.addFont(rootBundle.load(asset));
      }
      await loader.load();
    }
  });
  CollegeApi api(MobileRole role, {bool expired = false}) => CollegeApi(
    baseUrl: 'http://localhost',
    clientId: role.clientId,
    httpClient: MockClient((req) async {
      if (req.url.path.endsWith('/refresh')) {
        return http.Response(
          expired
              ? '{}'
              : '{"access_token":"restored","refresh_token":"rotated"}',
          expired ? 401 : 200,
        );
      }
      return http.Response(
        jsonEncode(fixture[role.name][req.url.pathSegments.last] ?? {}),
        200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );
    }),
  );
  Widget app({Future<void> Function()? initialize, bool expired = false}) =>
      EdunexaApp(
        title: 'EduNexa',
        clientId: primaryClient,
        roles: ownRoles,
        initialize: initialize ?? () async {},
        apiFactory: (role) => api(role, expired: expired),
      );
  AnimationController clock(WidgetTester tester) =>
      tester
              .widget<AnimatedBuilder>(
                find
                    .descendant(
                      of: find.byType(CinematicSplashScreen),
                      matching: find.byType(AnimatedBuilder),
                    )
                    .first,
              )
              .animation
          as AnimationController;

  testWidgets('fast initialization cannot navigate before exactly 3000ms', (
    tester,
  ) async {
    await tester.pumpWidget(app());
    await warmSplashAssets(tester);
    expect(clock(tester).duration, SplashTimeline.duration);
    await tester.pump(const Duration(milliseconds: 2999));
    expect(find.byType(CinematicSplashScreen), findsOneWidget);
    expect(find.text('Your college, connected.'), findsNothing);
    await tester.pump(const Duration(milliseconds: 1));
    await tester.pump();
    expect(find.byType(CinematicSplashScreen), findsNothing);
    expect(find.text('Your college, connected.'), findsOneWidget);
    // The splash is already gone at exactly 3000ms. Let the independent auth
    // entrance settle before tapping its Continue control.
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Continue'));
    // Ordinary navigation and a lifecycle resume never replay the introduction.
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    expect(find.byType(CinematicSplashScreen), findsNothing);
    expect(find.text('Sign in'), findsOneWidget);
  });
  testWidgets(
    'slow initialization holds the completed artwork without restarting',
    (tester) async {
      final pending = Completer<void>();
      var starts = 0;
      await tester.pumpWidget(
        app(
          initialize: () {
            starts++;
            return pending.future;
          },
        ),
      );
      await warmSplashAssets(tester);
      await tester.pump(const Duration(milliseconds: 3000));
      expect(clock(tester).value, 1);
      expect(clock(tester).isAnimating, isFalse);
      expect(find.text('Preparing your workspace…'), findsOneWidget);
      await tester.pump(const Duration(seconds: 7));
      expect(clock(tester).value, 1);
      expect(starts, 1);
      pending.complete();
      await tester.pumpAndSettle();
      expect(find.byType(CinematicSplashScreen), findsNothing);
      expect(starts, 1);
    },
  );
  testWidgets(
    'startup failure offers retry and retry does not replay the intro',
    (tester) async {
      var calls = 0;
      await tester.pumpWidget(
        app(
          initialize: () async {
            calls++;
            if (calls == 1) throw StateError('Startup connection unavailable');
          },
        ),
      );
      await warmSplashAssets(tester);
      await tester.pump(const Duration(milliseconds: 3000));
      await tester.pump();
      expect(find.text('Couldn’t prepare your workspace'), findsOneWidget);
      expect(find.byType(MobileWorkspace), findsNothing);
      await tester.ensureVisible(find.text('Try again'));
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(calls, 2);
      expect(find.byType(CinematicSplashScreen), findsNothing);
      expect(find.text('Continue'), findsOneWidget);
    },
  );
  for (final role in ownRoles) {
    testWidgets(
      '${role.label}: restored session opens its existing dashboard after the intro',
      (tester) async {
        FlutterSecureStorage.setMockInitialValues({
          'edunexa-role-$primaryClient': role.name,
          'edunexa-refresh-${role.clientId}': 'refresh',
        });
        await tester.pumpWidget(app());
        await settleStartup(tester);
        expect(find.text('${role.label} dashboard'), findsWidgets);
        expect(find.byType(MobileWorkspace), findsOneWidget);
        expect(find.byType(CinematicSplashScreen), findsNothing);
      },
    );
  }
  testWidgets(
    'expired session returns to authentication instead of a dashboard',
    (tester) async {
      final role = ownRoles.last;
      FlutterSecureStorage.setMockInitialValues({
        'edunexa-role-$primaryClient': role.name,
        'edunexa-refresh-${role.clientId}': 'expired',
      });
      await tester.pumpWidget(app(expired: true));
      await settleStartup(tester);
      expect(find.byType(MobileWorkspace), findsNothing);
      expect(find.text('Continue'), findsOneWidget);
      expect(
        await const FlutterSecureStorage().read(
          key: 'edunexa-refresh-${role.clientId}',
        ),
        isNull,
      );
    },
  );
  testWidgets(
    'reduced motion shows the final brand and still waits for readiness',
    (tester) async {
      tester.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
        tester.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      final pending = Completer<void>();
      await tester.pumpWidget(app(initialize: () => pending.future));
      await warmSplashAssets(tester);
      expect(clock(tester).value, 1);
      expect(clock(tester).isAnimating, isFalse);
      expect(find.text('Pragathi College'), findsOneWidget);
      pending.complete();
      await tester.pumpAndSettle();
      expect(find.byType(CinematicSplashScreen), findsNothing);
    },
  );
  testWidgets('disposing during startup releases the animation controller', (
    tester,
  ) async {
    final pending = Completer<void>();
    await tester.pumpWidget(app(initialize: () => pending.future));
    await warmSplashAssets(tester);
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpWidget(const SizedBox());
    pending.complete();
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  for (final layout in [
    (320.0, 568.0, 1.0),
    (390.0, 844.0, 1.0),
    (768.0, 1024.0, 1.0),
    (844.0, 390.0, 1.0),
    (320.0, 568.0, 1.8),
  ]) {
    testWidgets(
      'five splash phases render at ${layout.$1}x${layout.$2} scale ${layout.$3}',
      (tester) async {
        tester.view.physicalSize = Size(layout.$1, layout.$2);
        tester.view.devicePixelRatio = 1;
        tester.platformDispatcher.textScaleFactorTestValue = layout.$3;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        await tester.pumpWidget(
          RepaintBoundary(
            key: const ValueKey('capture-splash'),
            child: MaterialApp(
              debugShowCheckedModeBanner: false,
              theme: collegeTheme(ownConfig.accent),
              home: CinematicSplashScreen(
                configuration: ownConfig,
                ready: false,
                onComplete: () {},
                onRetry: () async {},
              ),
            ),
          ),
        );
        await warmSplashAssets(tester);
        var previous = 0;
        for (final time in [300, 900, 1500, 2100, 2700, 3000]) {
          await tester.pump(Duration(milliseconds: time - previous));
          previous = time;
          expect(
            tester.takeException(),
            isNull,
            reason: '$time ms at ${layout.$1}x${layout.$2}',
          );
          if (const bool.fromEnvironment('CAPTURE_SPLASH') &&
              layout.$1 == 390) {
            final boundary = tester.renderObject<RenderRepaintBoundary>(
              find.byKey(const ValueKey('capture-splash')),
            );
            await tester.runAsync(() async {
              final image = await boundary.toImage(pixelRatio: 2);
              final bytes = await image.toByteData(
                format: ui.ImageByteFormat.png,
              );
              final file = File(
                '../../artifacts/cinematic-splash/captures/parent_student/splash-${time.toString().padLeft(4, '0')}ms.png',
              );
              await file.parent.create(recursive: true);
              await file.writeAsBytes(bytes!.buffer.asUint8List());
              image.dispose();
            });
          }
        }
        expect(clock(tester).isCompleted, isTrue);
        expect(clock(tester).isAnimating, isFalse);
        // Large text can scroll, but the footer remains reachable within SafeArea.
        await tester.ensureVisible(find.text('Sconex Soft'));
        await tester.pump();
        expect(tester.takeException(), isNull);
      },
    );
  }
}
