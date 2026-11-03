import 'dart:convert';
import 'dart:io';
import 'package:edunexa_parent/app/edunexa_client.dart';
import 'package:edunexa_parent/theme/mobile_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  final routes =
      (jsonDecode(File('test/fixtures/mobile_contract.json').readAsStringSync())
              as Map)['parent']
          as Map;

  testWidgets('Chats tab: unread badge, open a conversation and reply', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final messages = <Map<String, dynamic>>[
      {
        'code': 'M1',
        'kind': 'text',
        'sender_code': 'U-T1',
        'sender_name': 'Rohan Varma',
        'sender_role': 'teacher',
        'mine': false,
        'body': 'Please submit the lab record.',
        'sent_at': '2026-10-30T09:00:00Z',
      },
    ];
    final sent = <Map<String, dynamic>>[];
    var unread = 1;
    Map<String, dynamic> conversation() => {
      'code': 'T1',
      'kind': 'direct',
      'title': 'Rohan Varma',
      'subtitle': 'Lecturer · Physics',
      'role': 'teacher',
      'can_post': true,
      'members': 2,
      'last_message': messages.last['body'],
      'last_sender': '',
      'last_mine': messages.last['mine'],
      'last_at': messages.last['sent_at'],
      'unread': unread,
    };
    final api = CollegeApi(
      baseUrl: 'http://localhost',
      clientId: 'parent-mobile',
      httpClient: MockClient((req) async {
        final path = req.url.path;
        Object? body;
        if (path.endsWith('/chat/unread')) {
          body = {'unread': unread};
        } else if (path.endsWith('/chat/conversations')) {
          body = {
            'items': [conversation()],
            'unread': unread,
            'can_create_groups': false,
          };
        } else if (path.endsWith('/chat/conversations/T1')) {
          body = conversation();
        } else if (path.endsWith('/chat/conversations/T1/messages') &&
            req.method == 'POST') {
          final values = Map<String, dynamic>.from(jsonDecode(req.body) as Map);
          sent.add(values);
          final message = {
            'code': 'M2',
            'kind': 'text',
            'sender_code': 'U-P1',
            'sender_name': 'You',
            'mine': true,
            'status': 'delivered',
            'client_id': values['client_id'],
            'body': values['body'],
            'sent_at': '2026-10-30T10:00:00Z',
          };
          messages.add(message);
          return http.Response(jsonEncode(message), 201,
              headers: {'content-type': 'application/json'});
        } else if (path.endsWith('/chat/conversations/T1/messages')) {
          unread = 0;
          body = {'items': messages, 'has_more': false};
        } else {
          body = routes[req.url.pathSegments.last] ?? {};
        }
        return http.Response(jsonEncode(body), 200,
            headers: {'content-type': 'application/json; charset=utf-8'});
      }),
    );
    await api.accept({'access_token': 't', 'refresh_token': 't'});
    await tester.pumpWidget(
      MaterialApp(
        theme: collegeTheme(MobileRole.parent.accent),
        home: MobileWorkspace(
          title: 'Parent dashboard',
          role: MobileRole.parent,
          api: api,
          onLogout: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    // Home has a Chats quick action with the unread count; the bottom bar has a Chats tab.
    expect(find.text('Chats · 1 new'), findsOneWidget);
    await tester.tap(
      find.descendant(of: find.byType(NavigationBar), matching: find.text('Chats')),
    );
    await tester.pumpAndSettle();
    expect(find.text('Rohan Varma'), findsOneWidget);
    expect(find.text('Please submit the lab record.'), findsOneWidget);

    await tester.tap(find.text('Rohan Varma'));
    await tester.pumpAndSettle();
    expect(find.text('Lecturer · Physics'), findsOneWidget);
    expect(find.text('Please submit the lab record.'), findsOneWidget);
    expect(find.byTooltip('Record voice message'), findsOneWidget);

    await tester.enterText(find.byType(TextField).last, 'Will do.');
    await tester.pump();
    await tester.tap(find.byTooltip('Send'));
    await tester.pumpAndSettle();
    expect(sent.single['body'], 'Will do.');
    expect(find.text('Will do.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
