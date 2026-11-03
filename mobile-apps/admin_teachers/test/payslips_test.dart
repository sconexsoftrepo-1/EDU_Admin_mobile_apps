import 'dart:convert';
import 'dart:io';
import 'package:edunexa_admin/app/edunexa_client.dart';
import 'package:edunexa_admin/theme/mobile_design.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  testWidgets('teacher sees the salary structure and opens a monthly payslip', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final routes =
        (jsonDecode(
                  File('test/fixtures/mobile_contract.json').readAsStringSync(),
                )
                as Map)['teacher']
            as Map;
    final requested = <String>[];
    final api = CollegeApi(
      baseUrl: 'http://localhost',
      clientId: 'teacher-mobile',
      httpClient: MockClient((req) async {
        requested.add(req.url.path);
        final key = req.url.pathSegments.last;
        if (key == 'download') {
          return http.Response.bytes(
            utf8.encode('%PDF-1.4'),
            200,
            headers: {'content-type': 'application/pdf'},
          );
        }
        final body = key == 'payslips'
            ? {
                ...Map<String, dynamic>.from(routes['payslips'] as Map),
                'summary': {
                  'structure': {
                    'earnings': [
                      {'component': 'Basic pay', 'amount': '40000.00'},
                      {'component': 'HRA', 'amount': '12000.00'},
                    ],
                    'deductions': [
                      {'component': 'Provident fund', 'amount': '4800.00'},
                    ],
                    'gross_monthly': '52000.00',
                    'deductions_monthly': '4800.00',
                    'net_monthly': '47200.00',
                    'in_hand_monthly': '47200.00',
                    'ctc_annual': '624000.00',
                  },
                },
                'items': [
                  {
                    'code': 'PS10',
                    'period': 'October 2026',
                    'period_start': '2026-10-01',
                    'gross_amount': '52000.00',
                    'deduction_amount': '4800.00',
                    'net_amount': '47200.00',
                    'net_in_words':
                        'Forty-seven thousand two hundred rupees only',
                    'earnings': [
                      {'component': 'Basic pay', 'amount': '40000.00'},
                    ],
                    'deductions': [
                      {'component': 'Provident fund', 'amount': '4800.00'},
                    ],
                  },
                ],
                'total': 1,
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
    await tester.tap(
      find.descendant(
        of: find.byType(NavigationBar),
        matching: find.text('More'),
      ),
    );
    await tester.pumpAndSettle();
    final tile = find.byKey(const ValueKey('module-payslips'));
    await tester.scrollUntilVisible(
      tile,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(tile);
    await tester.pumpAndSettle();
    expect(find.text('Salary structure'), findsOneWidget);
    expect(find.text('Basic pay'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('payslip-PS10')));
    await tester.pumpAndSettle();
    expect(find.text('PAYSLIP'), findsOneWidget);
    expect(
      find.text('Forty-seven thousand two hundred rupees only'),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey('download-payslip')));
    // The PDF then opens the share sheet (save / export), which never settles in tests.
    await tester.pump(const Duration(milliseconds: 500));
    expect(requested.any((p) => p.contains('payslip/PS10')), isTrue);
  });

  testWidgets('staff see leave balances, bonuses, paid payslips and a detailed Form 16', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final routes =
        (jsonDecode(
                  File('test/fixtures/mobile_contract.json').readAsStringSync(),
                )
                as Map)['teacher']
            as Map;
    final api = CollegeApi(
      baseUrl: 'http://localhost',
      clientId: 'teacher-mobile',
      httpClient: MockClient((req) async {
        final key = req.url.pathSegments.last;
        final body = switch (key) {
          'leave' => {
            ...Map<String, dynamic>.from(routes['leave'] as Map? ?? {}),
            'items': [],
            'summary': {
              'leave_balances': [
                {'code': 'PAID-LEAVE', 'name': 'Paid leave', 'allowed': 12, 'taken': 4, 'pending': 2, 'remaining': 8},
                {'code': 'SICK-LEAVE', 'name': 'Sick leave', 'allowed': 8, 'taken': 3, 'pending': 0, 'remaining': 5},
              ],
              'attendance': {'label': 'November 2026', 'percent': 96, 'working_days': 25, 'present': 23, 'half_day': 1,
                'leave': 1, 'absent': 0, 'holiday': 5},
            },
          },
          'payslips' => {
            ...Map<String, dynamic>.from(routes['payslips'] as Map),
            'summary': {
              'structure': {'employee_code': 'E9', 'earnings': [], 'deductions': [], 'gross_monthly': '52000', 'deductions_monthly': '4800',
                'net_monthly': '47200', 'ctc_annual': '624000'},
              'adjustments': [
                {'code': 'A1', 'component': 'Festival bonus (Dussehra)', 'category': 'Bonus', 'amount': '8000', 'status': 'approved',
                  'period': 'October 2026'},
              ],
            },
            'items': [
              {'code': 'PS10', 'period': 'October 2026', 'gross_amount': '60000', 'deduction_amount': '4800', 'net_amount': '55200',
                'paid_on': '2026-10-31', 'receipt_number': 'SAL-202610-0001', 'earnings': [], 'deductions': []},
            ],
            'total': 1,
          },
          'tax-documents' => {
            ...Map<String, dynamic>.from(routes['tax-documents'] as Map? ?? {}),
            'items': [
              {'code': 'TAX1', 'document_type': 'form_16', 'financial_year': '2025-2026', 'revision': 1,
                'statement': {'assessment_year': '2026-2027', 'months': 12, 'gross': '709000', 'tax': '21600',
                  'other_deductions': '54240', 'net': '633160',
                  'earnings': [{'component': 'Basic pay', 'amount': '432000'}],
                  'quarters': [{'quarter': 'Q1 (Apr–Jun)', 'amount': '5400'}]}},
            ],
            'total': 1,
            'downloads': 'tax-document',
          },
          _ => routes[key] ?? {},
        };
        return http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json; charset=utf-8'});
      }),
    );
    await api.accept({'access_token': 't', 'refresh_token': 't'});
    await tester.pumpWidget(MaterialApp(
      theme: collegeTheme(MobileRole.teacher.accent),
      home: MobileWorkspace(title: 'Teacher dashboard', role: MobileRole.teacher, api: api, onLogout: () {}),
    ));
    await tester.pumpAndSettle();
    Future<void> openModule(String key) async {
      await tester.tap(find.descendant(of: find.byType(NavigationBar), matching: find.text('More')));
      await tester.pumpAndSettle();
      final tile = find.byKey(ValueKey('module-$key'));
      await tester.scrollUntilVisible(tile, 200, scrollable: find.byType(Scrollable).first);
      await tester.tap(tile);
      await tester.pumpAndSettle();
    }

    await openModule('leave');
    expect(find.text('Paid leave'), findsOneWidget);
    expect(find.text('8 of 12 left'), findsOneWidget);
    expect(find.text('5 of 8 left'), findsOneWidget);
    expect(find.text('96% attendance'), findsOneWidget);

    await openModule('payslips');
    expect(find.text('Bonuses & incentives'), findsOneWidget);
    expect(find.text('Festival bonus (Dussehra)'), findsOneWidget);
    expect(find.text('Paid'), findsOneWidget);
    expect(find.byKey(const ValueKey('salary-structure-pdf')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('payslip-PS10')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('salary-receipt')), findsOneWidget);
    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();

    await openModule('tax-documents');
    expect(find.text('Form 16 · FY 2025-2026'), findsOneWidget);
    expect(find.text('Total tax deducted'), findsOneWidget);
    expect(find.text('View PDF'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
