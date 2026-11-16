import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Staff sign in with a code emailed to them: login ID -> "Send code" -> code -> "Verify and sign in".
bool isCodeRequest(Uri url) => url.path.endsWith('/otp/request');
bool isCodeVerify(Uri url) => url.path.endsWith('/otp/verify');

Future<void> sendCode(WidgetTester tester, String login) async {
  await tester.enterText(find.byType(TextFormField).first, login);
  await tester.ensureVisible(find.text('Send code'));
  await tester.tap(find.text('Send code'));
  await tester.pumpAndSettle();
}

Future<void> verifyCode(WidgetTester tester, [String code = '123456']) async {
  await tester.enterText(find.byType(TextFormField).last, code);
  await tester.ensureVisible(find.text('Verify and sign in'));
  await tester.tap(find.text('Verify and sign in'));
  await tester.pumpAndSettle();
}

Future<void> signInWithCode(WidgetTester tester, String login, [String code = '123456']) async {
  await sendCode(tester, login);
  await verifyCode(tester, code);
}
