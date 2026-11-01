import 'dart:convert';
import 'dart:io';
import 'package:edunexa_admin/app/edunexa_client.dart';
import 'package:edunexa_admin/theme/mobile_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import 'helpers/workspace_navigation.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  final routes =
      (jsonDecode(File('test/fixtures/mobile_contract.json').readAsStringSync())
              as Map)['teacher']
          as Map;

  testWidgets('teacher reads a parent conversation and replies', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 1200);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final messages = <Map<String, dynamic>>[
      {
        'code': 'M1',
        'thread_code': 'T1',
        'thread_subject': 'Lab record',
        'sender_name': 'Meera Rao',
        'mine': false,
        'with': ['Meera Rao'],
        'body': 'Please submit the lab record.',
        'sent_at': '2026-10-30T09:00:00Z',
      },
    ];
    final sent = <Map<String, dynamic>>[];
    final api = CollegeApi(
      baseUrl: 'http://localhost',
      clientId: 'teacher-mobile',
      httpClient: MockClient((req) async {
        final key = req.url.pathSegments.last;
        if (key == 'send_message') {
          final values = Map<String, dynamic>.from(
            (jsonDecode(req.body) as Map)['values'] as Map,
          );
          sent.add(values);
          messages.add({
            'code': 'M2',
            'thread_code': values['thread_code'],
            'thread_subject': 'Lab record',
            'sender_name': 'Teacher',
            'mine': true,
            'with': ['Meera Rao'],
            'body': values['body'],
            'sent_at': '2026-10-30T10:00:00Z',
          });
          return http.Response(
            jsonEncode({
              'record': {'code': 'M2'},
            }),
            201,
            headers: {'content-type': 'application/json'},
          );
        }
        final body = key == 'messages'
            ? {
                ...Map<String, dynamic>.from(routes['messages'] as Map),
                'items': messages,
                'total': messages.length,
              }
            : routes[key] ?? {};
        return http.Response(
          jsonEncode(body),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    await api.accept({'access_token': 't', 'refresh_token': 't'});
    await tester.pumpWidget(
      MaterialApp(
        theme: collegeTheme(MobileRole.teacher.accent),
        home: MobileWorkspace(
          title: 'Teacher dashboard',
          role: MobileRole.teacher,
          api: api,
          onLogout: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    await openModule(tester, 'messages');

    expect(find.text('Meera Rao'), findsOneWidget);
    expect(find.text('Lab record'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('thread-T1')));
    await tester.pumpAndSettle();
    expect(find.text('Please submit the lab record.'), findsOneWidget);

    await tester.enterText(
      find.byKey(const ValueKey('reply-field')),
      'Will do.',
    );
    await tester.tap(find.byKey(const ValueKey('send-reply')));
    await tester.pumpAndSettle();
    expect(sent.single, {'thread_code': 'T1', 'body': 'Will do.'});
    expect(find.text('Will do.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
