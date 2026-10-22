import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:edunexa_admin/main.dart';

void main() {
  test('Sample balances reconcile independently', () {
    final total = students.fold(0.0, (n, s) => n + s.fee - s.scholarship);
    final collected = receipts.fold(0.0, (n, p) => n + p.amount);
    expect(total, 345000);
    expect(collected, 200000);
    expect(total - collected, 145000);
    expect(money(145000), '₹1,45,000.00');
  });
  testWidgets('Admin can navigate dues and view report details', (
    tester,
  ) async {
    await tester.pumpWidget(const EduNexaAdminApp());
    expect(find.text('EduNexa Admin'), findsOneWidget);
    expect(find.text('₹2,00,000.00'), findsOneWidget);
    await tester.tap(find.text('Dues'));
    await tester.pumpAndSettle();
    expect(find.text('Outstanding fees'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Ananya');
    await tester.pumpAndSettle();
    expect(find.text('Ananya Rao'), findsOneWidget);
    expect(find.text('Rahul Sharma'), findsNothing);
    await tester.tap(find.text('Reports'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('View report').first);
    await tester.tap(find.text('View report').first);
    await tester.pumpAndSettle();
    expect(find.text('Collections report'), findsOneWidget);
    expect(find.text('RCT-001'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  for (final width in [320.0, 390.0]) {
    testWidgets('No text overflow at width $width', (tester) async {
      tester.view.physicalSize = Size(width, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(const EduNexaAdminApp());
      for (final label in ['Overview', 'Dues', 'Reports', 'Activity']) {
        await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text(label)));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: label);
      }
    });
  }
}
