import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:edunexa_teacher/main.dart';
void main(){
 setUp(()=>FlutterSecureStorage.setMockInitialValues({}));
 for(final width in [320.0,390.0,768.0]){
  testWidgets('Secure login fits at $width', (tester) async {
   tester.view.physicalSize=Size(width,844);tester.view.devicePixelRatio=1;
   addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
   await tester.pumpWidget(const EduNexaApp());await tester.pumpAndSettle();
   expect(find.text('EduNexa Teacher'),findsOneWidget);
   expect(find.text('Login ID'),findsOneWidget);expect(find.text('Password'),findsOneWidget);
   expect(find.textContaining('Planned module'),findsNothing);
   await tester.tap(find.text('Sign in'));await tester.pumpAndSettle();
   expect(find.text('Enter your login ID'),findsOneWidget);
   expect(tester.takeException(),isNull);
  });
 }
}
