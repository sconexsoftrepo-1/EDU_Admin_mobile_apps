import 'helpers/splash_test_support.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:edunexa_parent/main.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  for (final width in [320.0, 390.0, 768.0]) {
    testWidgets('Secure login fits at $width', (tester) async {
      tester.view.physicalSize = Size(width, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(const EduNexaApp());
      await settleStartup(tester);
      expect(find.text('Your college, connected.'), findsOneWidget);
      expect(find.text('Parent'), findsOneWidget);
      expect(find.text('Student'), findsOneWidget);
      await tester.tap(find.text('Student'));
      await settleStartup(tester);
      await tester.ensureVisible(find.text('Continue'));
      await tester.tap(find.text('Continue'));
      await settleStartup(tester);
      expect(find.text('Login ID'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      expect(find.textContaining('Planned module'), findsNothing);
      await tester.tap(find.text('Sign in'));
      await settleStartup(tester);
      expect(find.text('Enter your login ID'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }
}
