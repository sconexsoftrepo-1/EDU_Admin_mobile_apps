import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Opens a workspace module the way people do: the More tab, then the module's tile.
Future<void> openModule(
  WidgetTester tester,
  String key, {
  Future<void> Function(WidgetTester tester)? settle,
}) async {
  Future<void> pump() async =>
      settle == null ? await tester.pumpAndSettle() : await settle(tester);
  await tester.tap(
    find.descendant(of: find.byType(NavigationBar), matching: find.text('More')),
  );
  await pump();
  final tile = find.byKey(ValueKey('module-$key'));
  await tester.scrollUntilVisible(
    tile,
    180,
    scrollable: find
        .descendant(
          of: find.byType(RefreshIndicator),
          matching: find.byType(Scrollable),
        )
        .first,
  );
  await Scrollable.ensureVisible(tester.element(tile), alignment: 0.4);
  await pump();
  await tester.tap(tile);
  await pump();
}
