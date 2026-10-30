import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:edunexa_parent/splash/splash_screen.dart';
import 'package:edunexa_parent/splash/splash_assets.dart';

/// Real asset decoding runs outside fake time. Test pumps alone control the
/// introduction clock; the helper never sleeps to simulate startup readiness.
Future<void> warmSplashAssets(WidgetTester tester) async {
  final finder = find.byType(CinematicSplashScreen);
  if (finder.evaluate().isEmpty) return;
  final context = tester.element(finder);
  final config = tester.widget<CinematicSplashScreen>(finder).configuration;
  await tester.runAsync(() async {
    await Future.wait<void>([
      precacheImage(ResizeImage(AssetImage(config.icon), width: 768), context),
      precacheImage(const AssetImage(SplashAssets.company), context),
      for (final name in SplashAssets.illustrations)
        SvgAssetLoader(
          SplashAssets.svg(name),
        ).loadBytes(context).then<void>((_) {}),
    ]);
  });
  await tester.pump();
  await tester.pump();
}

Future<void> settleStartup(WidgetTester tester) async {
  if (find.byType(CinematicSplashScreen).evaluate().isNotEmpty) {
    await warmSplashAssets(tester);
    await tester.pump(const Duration(milliseconds: 3000));
  }
  await tester.pumpAndSettle();
}
