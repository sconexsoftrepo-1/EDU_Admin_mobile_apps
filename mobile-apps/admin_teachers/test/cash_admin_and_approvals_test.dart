import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:edunexa_admin/app/edunexa_client.dart';
import 'package:edunexa_admin/services/api_service.dart';
import 'package:edunexa_admin/theme/mobile_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

// An 8x8 PNG used as the bank slip photo.
final slip = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGO4c2IVVsQwtCQArp+Tgb1ibwMAAAAASUVORK5CYII=',
);

/// Set CAPTURE_DIR to save screenshots of each screen (with real fonts) for a visual check.
final capture = Platform.environment['CAPTURE_DIR'];

Future<void> loadFonts() async {
  final fonts = Platform.environment['FONT_DIR'];
  if (fonts == null) return;
  for (final (family, files) in [
    ('Roboto', ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Bold.ttf']),
    ('MaterialIcons', ['MaterialIcons-Regular.otf']),
  ]) {
    final loader = FontLoader(family);
    for (final f in files) {
      loader.addFont(Future.value(ByteData.view(File('$fonts/$f').readAsBytesSync().buffer)));
    }
    await loader.load();
  }
}

Future<void> shot(WidgetTester tester, String name) async {
  if (capture == null) return;
  await tester.runAsync(() async {
    final boundary = tester.renderObject<RenderRepaintBoundary>(find.byKey(const ValueKey('shot')));
    final image = await boundary.toImage(pixelRatio: 2);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    File('$capture/$name.png').writeAsBytesSync(bytes!.buffer.asUint8List());
  });
}

Future<CollegeApi> api(Object Function(http.Request req) respond) async {
  final client = CollegeApi(
    baseUrl: 'http://localhost',
    clientId: 'teacher-mobile',
    httpClient: MockClient((req) async {
      final body = respond(req);
      if (body is List<int>) return http.Response.bytes(body, 200, headers: {'content-type': 'image/png'});
      return http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json; charset=utf-8'});
    }),
  );
  await client.accept({'access_token': 't', 'refresh_token': 't'});
  return client;
}

Future<void> show(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(390, 1400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.runAsync(loadFonts);
  await tester.pumpWidget(MaterialApp(
    theme: collegeTheme(MobileRole.teacher.accent),
    home: RepaintBoundary(
      key: const ValueKey('shot'),
      child: Scaffold(body: SingleChildScrollView(padding: const EdgeInsets.all(16), child: child)),
    ),
  ));
  await tester.pumpAndSettle();
}

Json transfer(String status, List<Json> deposits) => {
      'code': 'T1', 'clerk_account': 'CLERK', 'clerk_name': 'Clerk 01', 'amount': '12500.00', 'status': status,
      'assigned_at': '2026-11-07T09:00:00Z', 'assigned_by_name': 'Akhil', 'with_clerk': '12500.00',
      'accepted_amount': '0.00', 'can_deposit': '0.00', 'deposits': deposits,
    };

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('clerk sees the slip before submitting it', (tester) async {
    final dir = Directory.systemTemp.createTempSync('slip');
    final file = File('${dir.path}/slip.png')..writeAsBytesSync(slip);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/image_picker'),
      (call) async => file.path,
    );
    Json? sent;
    final client = await api((req) {
      if (req.url.path.endsWith('/proof') && req.method == 'POST') {
        sent = jsonDecode(req.body) as Json;
      }
      return {
        'account_code': 'CLERK',
        'my_in_hand': '12500.00',
        'transfers': [
          transfer('deposited', [
            {'code': 'D1', 'amount': '12500.00', 'deposited_on': '2026-11-07', 'status': 'awaiting_proof', 'has_proof': false},
          ]),
        ],
      };
    });
    await show(tester, CashDepositWorkspace(api: client));
    await tester.tap(find.byKey(const ValueKey('upload-slip-D1')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Choose from gallery'));
    // Reading the picked file is real I/O: let it finish before looking for the preview.
    for (var i = 0; i < 20 && find.byKey(const ValueKey('slip-preview')).evaluate().isEmpty; i++) {
      await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 50)));
      await tester.pump(const Duration(milliseconds: 100));
    }
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('slip-preview')), findsOneWidget);
    expect(sent, isNull, reason: 'nothing is sent before Submit');
    await shot(tester, 'clerk-slip-preview');
    await tester.tap(find.byKey(const ValueKey('submit-slip')));
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 200)));
    await tester.pumpAndSettle();
    expect(sent?['content_base64'], base64Encode(slip));
  });

  testWidgets('admin hands cash over, sees the slip and accepts the deposit', (tester) async {
    final posts = <String>[];
    final client = await api((req) {
      if (req.method == 'POST') posts.add(req.url.path);
      if (req.url.path.endsWith('/proof')) return slip;
      return {
        'with_admin': '40000.00',
        'with_clerks': '12500.00',
        'clerks': [
          {'account_code': 'CLERK', 'name': 'Clerk 01'},
        ],
        'transfers': [
          transfer('awaiting_review', [
            {'code': 'D1', 'amount': '12500.00', 'deposited_on': '2026-11-07', 'status': 'awaiting_review', 'has_proof': true,
             'proof_mime': 'image/jpeg', 'bank_reference': 'SBI-4471'},
          ]),
        ],
      };
    });
    await show(tester, AdminCashWorkspace(api: client));
    expect(find.text('Slips to review (1)'), findsOneWidget);
    expect(find.text('Reference SBI-4471'), findsOneWidget);
    await shot(tester, 'admin-cash');
    await tester.tap(find.byKey(const ValueKey('accept-D1')));
    await tester.pumpAndSettle();
    expect(posts.last, endsWith('/transfers/T1/deposits/D1/review'));
  });

  testWidgets('admin accepts a change request from the app', (tester) async {
    final posts = <String>[];
    final client = await api((req) {
      if (req.method == 'POST') posts.add(req.url.path);
      return {
        'can_decide': true,
        'items': [
          {'code': 'E1', 'status': 'pending', 'target_title': 'Fee payment', 'target_label': 'Sai Kumar', 'requester_name': 'Kiran',
           'requester_role': 'Accountant', 'requested_at': '2026-11-07T09:15:00Z',
           'changes': [
             {'field': 'amount', 'label': 'Amount', 'from': '500.00', 'to': '900.00'},
           ]},
          {'code': 'E2', 'status': 'rejected', 'target_title': 'Students', 'target_label': 'Asha Rao', 'changes': []},
        ],
      };
    });
    await show(tester, ChangeRequestsWorkspace(api: client));
    expect(find.text('Pending (1)'), findsOneWidget);
    expect(find.text('Sai Kumar'), findsOneWidget);
    await shot(tester, 'admin-change-requests');
    await tester.tap(find.byKey(const ValueKey('accept-change-E1')));
    await tester.pumpAndSettle();
    expect(posts.last, endsWith('/edit-requests/E1/accept'));
  });

  testWidgets('collection analytics shows totals, methods and semesters', (tester) async {
    final client = await api((req) => {
          'summary': {'amount': '17500.00', 'payments': 3, 'payers': 2},
          'daily': [
            {'date': '2026-11-06', 'amount': '5000.00'},
            {'date': '2026-11-07', 'amount': '12500.00'},
          ],
          'by_method': [
            {'method': 'cash', 'label': 'Cash', 'amount': '12500.00', 'payments': 2},
            {'method': 'upi', 'label': 'UPI', 'amount': '5000.00', 'payments': 1},
          ],
          'by_semester': [
            {'label': 'Semester 1', 'amount': '17500.00', 'payments': 3, 'payers': 2},
          ],
          'by_head': [
            {'name': 'Tuition fee', 'amount': '17500.00'},
          ],
        });
    await show(tester, CollectionAnalyticsWorkspace(api: client));
    expect(find.text('By payment method'), findsOneWidget);
    expect(find.text('2 students paid · 3 payments'), findsOneWidget);
    await shot(tester, 'admin-analytics');
    expect(tester.takeException(), isNull);
  });

  testWidgets('deposit history shows what was deposited and opens the details screen', (tester) async {
    final finished = {
      ...transfer('settled', [
        {'code': 'D1', 'amount': '80000.00', 'deposited_on': '2026-11-08', 'status': 'accepted', 'has_proof': true,
         'proof_mime': 'image/jpeg', 'recorded_at': '2026-11-08T05:30:00Z', 'proof_uploaded_at': '2026-11-08T05:40:00Z',
         'reviewed_at': '2026-11-08T07:00:00Z', 'reviewed_by_name': 'Akhil'},
      ]),
      'amount': '100000.00', 'accepted_amount': '80000.00', 'returned_amount': '20000.00', 'with_clerk': '0.00',
      'returns': [
        {'amount': '20000.00', 'returned_on': '2026-11-08', 'recorded_at': '2026-11-08T08:00:00Z'},
      ],
    };
    final client = await api((req) {
      if (req.url.path.endsWith('/proof')) return slip;
      return {'account_code': 'CLERK', 'my_in_hand': '0.00', 'transfers': [finished]};
    });
    await show(tester, CashDepositWorkspace(api: client));
    // The history card leads with the ₹80,000 deposited, not the ₹1,00,000 handed over.
    expect(find.text('₹80,000 deposited'), findsOneWidget);
    expect(find.text('of ₹1,00,000 handed over · ₹20,000 refunded to admin'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('transfer-T1')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('deposit-history-details')), findsOneWidget);
    expect(find.text('Deposited & accepted'), findsOneWidget);
    expect(find.text('Cash remaining in hand'), findsOneWidget);
    expect(find.text('Refunded to admin'), findsOneWidget);
    expect(find.text('Proof of deposit'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
