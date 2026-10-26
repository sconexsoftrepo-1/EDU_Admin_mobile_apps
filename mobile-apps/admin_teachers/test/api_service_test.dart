import 'dart:convert';
import 'package:edunexa_admin/services/api_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'app-local service serializes payloads, parses responses and builds workspace queries',
    () async {
      final calls = <http.Request>[];
      final api = CollegeApi(
        baseUrl: 'http://localhost:8010/',
        clientId: ApiConfig.parentClient,
        httpClient: MockClient((request) async {
          calls.add(request);
          final path = request.url.path;
          if (path.endsWith('/login')) {
            return http.Response(
              '{"access_token":"access","refresh_token":"refresh"}',
              200,
            );
          }
          if (path.endsWith('/screens')) {
            return http.Response(
              '{"screens":[{"key":"fees","title":"Fees","resource":"fees"}]}',
              200,
            );
          }
          if (path.endsWith('/actions/make_payment')) {
            return http.Response(
              '{"checkout_url":"https://checkout.example.test/order"}',
              201,
            );
          }
          if (path.endsWith('/workspace/calendar')) {
            return http.Response(
              '{"screen":"calendar","title":"Calendar","items":[{"code":"EVENT-1"}],"total":1,"selected_student_code":"STU-2"}',
              200,
            );
          }
          return http.Response('{}', 200);
        }),
      );
      await api.login('parent', 'test-password');
      expect(jsonDecode(calls.first.body), {
        'login_id': 'parent',
        'password': 'test-password',
        'client': ApiConfig.parentClient,
      });
      expect(calls.first.url.path, '/api/v1/auth/login');
      final screens = await api.listScreens();
      expect(screens.single.key, 'fees');
      final result = await api.workspace(
        'calendar',
        query: WorkspaceQuery(
          studentCode: 'STU-2',
          fromDate: DateTime(2026, 10, 1),
          toDate: DateTime(2026, 10, 31),
          offset: 50,
        ),
      );
      expect(result.items.single['code'], 'EVENT-1');
      expect(result.total, 1);
      expect(result.selectedStudentCode, 'STU-2');
      expect(calls.last.url.queryParameters, {
        'student_code': 'STU-2',
        'from_date': '2026-10-01',
        'to_date': '2026-10-31',
        'offset': '50',
      });
      final action = await api.executeAction(
        'fees',
        'make_payment',
        const WorkspaceActionPayload(
          values: {'charge_code': 'FEE-2', 'amount': '1500'},
          studentCode: 'STU-2',
          formRevision: 3,
        ),
      );
      expect(action.checkoutUrl, 'https://checkout.example.test/order');
      expect(jsonDecode(calls.last.body), {
        'values': {'charge_code': 'FEE-2', 'amount': '1500'},
        'student_code': 'STU-2',
        'form_revision': 3,
      });
      expect(calls.last.headers['Authorization'], 'Bearer access');
      await api.registerDevice(
        const DeviceRegistrationPayload(
          token: 'device-token-123456789012345',
          platform: 'android',
        ),
      );
      expect(calls.last.url.path, '/api/v1/mobile/devices/register');
      expect(jsonDecode(calls.last.body), {
        'token': 'device-token-123456789012345',
        'platform': 'android',
      });
      await api.unregisterDevice(
        const TokenPayload('device-token-123456789012345'),
      );
      expect(calls.last.url.path, '/api/v1/mobile/devices/unregister');
      await api.markNotificationRead('NOTICE-1');
      expect(
        calls.last.url.path,
        '/api/v1/mobile/workspace/notifications/actions/read_notification',
      );
      expect(jsonDecode(calls.last.body), {
        'values': {'notification_code': 'NOTICE-1'},
      });
    },
  );
  test(
    'response models preserve server-defined fields and dynamic form definitions',
    () {
      final result = WorkspaceResponse.fromJson({
        'items': [],
        'summary': {
          'totals': {'outstanding': '200'},
        },
        'custom_extension': 'kept',
        'actions': [
          {
            'key': 'request_leave',
            'label': 'Request leave',
            'form_revision': 4,
            'fields': [
              {
                'key': 'reason',
                'label': 'Reason',
                'type': 'textarea',
                'required': true,
              },
            ],
          },
        ],
      });
      expect(result.actions.single.formRevision, 4);
      expect(result.actions.single.fields.single.required, isTrue);
      expect(result.summary!['totals']['outstanding'], '200');
      expect(result.toJson()['custom_extension'], 'kept');
    },
  );
}
