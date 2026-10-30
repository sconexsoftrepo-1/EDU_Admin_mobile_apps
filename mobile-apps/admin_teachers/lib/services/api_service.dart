import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import '../constants/api_config.dart';
import '../models/api_models.dart';

export '../constants/api_config.dart';
export '../models/api_models.dart';

/// The only REST endpoint registry for this application's API service.
abstract final class _Endpoints {
  static const login = '/auth/login';
  static const refresh = '/auth/refresh';
  static const logout = '/auth/logout';
  static const me = '/auth/me';
  static const screens = '/mobile/workspace/screens';
  static const registerDevice = '/mobile/devices/register';
  static const unregisterDevice = '/mobile/devices/unregister';
  static const alerts = '/mobile/alerts';
  static const financeReport = '/reports/finance.pdf';
  static const assignments = '/academics/assignment-workspace';
  static const syllabus = '/academics/syllabus-workspace';
  static const calendar = '/academics/calendar-workspace';
  static const certificates = '/certificates/workspace';
  static String workspace(String screen) =>
      '/mobile/workspace/${Uri.encodeComponent(screen)}';
  static String action(String screen, String action) =>
      '${workspace(screen)}/actions/${Uri.encodeComponent(action)}';
  static String document(String kind, String code) =>
      '/documents/${Uri.encodeComponent(kind)}/${Uri.encodeComponent(code)}/download';
  static String record(String root, String code) =>
      '$root/${Uri.encodeComponent(code)}';
  static String query(String path, Map<String, String> values) =>
      Uri(path: path, queryParameters: values.isEmpty ? null : values).toString();
}

class CollegeApi {
  final String baseUrl, clientId;
  final http.Client httpClient;
  final FlutterSecureStorage storage;
  String? _access;
  String? _webRefresh;
  Future<void>? _refreshing;
  CollegeApi({
    this.baseUrl = ApiConfig.baseUrl,
    required this.clientId,
    http.Client? httpClient,
    FlutterSecureStorage? storage,
  }) : httpClient = httpClient ?? http.Client(),
       storage = storage ?? const FlutterSecureStorage();
  String get _key => ApiConfig.refreshKey(clientId);
  Future<void> accept(Json result) async {
    final session = AuthResponse.fromJson(result);
    _access = session.accessToken;
    // A single native secure-storage entry keeps refresh rotation atomic.
    if (kIsWeb) {
      _webRefresh = session.refreshToken;
    } else {
      await storage.write(key: _key, value: session.refreshToken);
    }
  }

  Future<void> login(String loginId, String password) async {
    final result = await _send(
      'POST',
      _Endpoints.login,
      LoginPayload(
        loginId: loginId,
        password: password,
        client: clientId,
      ).toJson(),
      auth: false,
    );
    await accept(result as Json);
  }

  Future<bool> restore() async {
    if (kIsWeb) {
      return false; // Never persist refresh tokens in browser localStorage.
    }
    if (await storage.read(key: _key) == null) return false;
    try {
      await refresh();
      return true;
    } on ApiException catch (e) {
      if (e.status == 401) return false;
      rethrow;
    }
  }

  Future<void> refresh() {
    return _refreshing ??= _rotate().whenComplete(() => _refreshing = null);
  }

  Future<void> _rotate() async {
    final token = kIsWeb ? _webRefresh : await storage.read(key: _key);
    if (token == null) throw ApiException('Please sign in again.', 401);
    try {
      final result = await _send(
        'POST',
        _Endpoints.refresh,
        RefreshPayload(refreshToken: token, client: clientId).toJson(),
        auth: false,
      );
      await accept(result as Json);
    } on ApiException catch (e) {
      if (e.status == 401) await clear();
      rethrow;
    }
  }

  Future<void> clear() async {
    _access = null;
    _webRefresh = null;
    if (!kIsWeb) await storage.delete(key: _key);
  }

  Future<void> logout() async {
    try {
      await _send('POST', _Endpoints.logout, null);
    } finally {
      await clear();
    }
  }

  Future<Uint8List> assignmentFile(String code) async => (await _response(
    'GET',
    '${_Endpoints.assignments}/files/${Uri.encodeComponent(code)}/view',
    null,
  )).bodyBytes;

  // Assignment API
  Future<dynamic> assignments({String studentCode = ''}) => get(
    _Endpoints.query(_Endpoints.assignments, {
      if (studentCode.isNotEmpty) 'student_code': studentCode,
    }),
  );
  Future<dynamic> assignmentOptions({
    String programCode = '',
    String academicYearCode = '',
    String sectionCode = '',
  }) => get(_Endpoints.query('${_Endpoints.assignments}/options', {
    if (programCode.isNotEmpty) 'program_code': programCode,
    if (academicYearCode.isNotEmpty) 'academic_year_code': academicYearCode,
    if (sectionCode.isNotEmpty) 'section_code': sectionCode,
  }));
  Future<dynamic> assignmentDetails(String code, {String studentCode = ''}) =>
      get(_Endpoints.query(_Endpoints.record(_Endpoints.assignments, code), {
        if (studentCode.isNotEmpty) 'student_code': studentCode,
      }));
  Future<dynamic> createAssignment(Json body) => post(_Endpoints.assignments, body);
  Future<dynamic> reviewAssignment(String code, Json body) =>
      post('${_Endpoints.record(_Endpoints.assignments, code)}/review', body);
  Future<dynamic> submitAssignment(String code, Json body) =>
      post('${_Endpoints.record(_Endpoints.assignments, code)}/submit', body);

  // Shared file upload API used by assignments, syllabus and calendar events.
  Future<dynamic> startFileUpload({
    required String filename,
    required int sizeBytes,
    String? assignmentCode,
    bool resource = false,
    bool event = false,
  }) => post('${_Endpoints.assignments}/files/start', {
    'filename': filename,
    'size_bytes': sizeBytes,
    'assignment_code': assignmentCode,
    if (resource) 'resource_upload': true,
    if (event) 'event_upload': true,
  });
  Future<dynamic> uploadFileChunk(String code, int index, String contentBase64) =>
      post('${_Endpoints.assignments}/files/${Uri.encodeComponent(code)}/chunk', {
        'index': index,
        'content_base64': contentBase64,
      });
  Future<dynamic> finishFileUpload(String code) =>
      post('${_Endpoints.assignments}/files/${Uri.encodeComponent(code)}/finish', {});

  // Syllabus and shared resource API
  Future<dynamic> syllabus({String studentCode = ''}) => get(
    _Endpoints.query(_Endpoints.syllabus, {
      if (studentCode.isNotEmpty) 'student_code': studentCode,
    }),
  );
  Future<dynamic> syllabusDetails(String code) =>
      get(_Endpoints.record(_Endpoints.syllabus, code));
  Future<dynamic> syllabusOptions({String courseLevel = '', String programCode = ''}) =>
      get(_Endpoints.query('${_Endpoints.syllabus}/options', {
        if (courseLevel.isNotEmpty) 'course_level': courseLevel,
        if (programCode.isNotEmpty) 'program_code': programCode,
      }));
  Future<dynamic> createSyllabus(Json body) => post(_Endpoints.syllabus, body);

  // Academic calendar API
  Future<dynamic> calendar({String studentCode = ''}) => get(
    _Endpoints.query(_Endpoints.calendar, {
      if (studentCode.isNotEmpty) 'student_code': studentCode,
    }),
  );
  Future<dynamic> calendarDetails(String code) =>
      get(_Endpoints.record(_Endpoints.calendar, code));
  Future<dynamic> calendarOptions() => get('${_Endpoints.calendar}/options');
  Future<dynamic> createCalendarEvent(Json body) => post(_Endpoints.calendar, body);

  // Certificate request and approval API
  Future<dynamic> certificates({String studentCode = ''}) => get(
    _Endpoints.query(_Endpoints.certificates, {
      if (studentCode.isNotEmpty) 'student_code': studentCode,
    }),
  );
  Future<dynamic> certificateOptions() => get('${_Endpoints.certificates}/options');
  Future<dynamic> requestCertificate(String templateCode, {String? studentCode}) =>
      post('${_Endpoints.certificates}/requests', {
        'template_code': templateCode,
        if (studentCode != null) 'student_code': studentCode,
      });
  Future<dynamic> decideCertificate(String code, {required bool approve, String message = ''}) =>
      post('${_Endpoints.certificates}/requests/${Uri.encodeComponent(code)}/${approve ? 'approve' : 'reject'}',
        approve ? <String, dynamic>{} : {'message': message});

  Future<dynamic> get(String path) => _send('GET', path, null);
  Future<dynamic> post(String path, Json body) => _send('POST', path, body);
  Future<http.Response> _response(
    String method,
    String path,
    Json? body, {
    bool auth = true,
    bool retry = true,
  }) async {
    if (auth && _access == null) await refresh();
    final uri = Uri.parse(
      '${baseUrl.replaceFirst(RegExp(r"/+$"), "")}${ApiConfig.apiPrefix}$path',
    );
    if (uri.scheme != 'https' && !kDebugMode) {
      throw ApiException('A secure HTTPS server is required.', 0);
    }
    try {
      final request = http.Request(method, uri)
        ..headers['Content-Type'] = 'application/json';
      if (auth) request.headers['Authorization'] = 'Bearer $_access';
      if (body != null) request.body = jsonEncode(body);
      final response = await http.Response.fromStream(
        await httpClient.send(request).timeout(ApiConfig.requestTimeout),
      );
      if (response.statusCode == 401 && auth && retry) {
        await refresh();
        return _response(method, path, body, auth: auth, retry: false);
      }
      if (response.statusCode >= 400) {
        dynamic detail;
        try {
          detail = jsonDecode(response.body)['detail'];
        } catch (_) {
          detail = 'Server request failed';
        }
        throw ApiException(
          detail is String ? detail : jsonEncode(detail),
          response.statusCode,
        );
      }
      return response;
    } on ApiException {
      rethrow;
    } catch (_) {
      throw ApiException(
        'Cannot reach the college server. Check the connection and try again.',
        0,
      );
    }
  }

  Future<dynamic> _send(
    String method,
    String path,
    Json? body, {
    bool auth = true,
  }) async {
    final response = await _response(method, path, body, auth: auth);
    return response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body);
  }

  Future<Uint8List> download(String kind, String code) async =>
      (await _response('GET', _Endpoints.document(kind, code), null)).bodyBytes;

  Future<List<WorkspaceScreen>> listScreens() async {
    final result = await get(_Endpoints.screens) as Json;
    return (result['screens'] as List? ?? [])
        .map((s) => WorkspaceScreen.fromJson(Map<String, dynamic>.from(s)))
        .toList();
  }

  Future<WorkspaceResponse> workspace(
    String screen, {
    WorkspaceQuery query = const WorkspaceQuery(),
  }) async {
    final path = Uri(
      path: _Endpoints.workspace(screen),
      queryParameters: query.toQueryParameters().isEmpty
          ? null
          : query.toQueryParameters(),
    ).toString();
    return WorkspaceResponse.fromJson(await get(path) as Json);
  }

  Future<ActionResponse> executeAction(
    String screen,
    String action,
    WorkspaceActionPayload payload,
  ) async => ActionResponse.fromJson(
    await post(_Endpoints.action(screen, action), payload.toJson()) as Json,
  );

  Future<void> markNotificationRead(String notificationCode) async {
    await executeAction(
      'notifications',
      'read_notification',
      WorkspaceActionPayload(values: {'notification_code': notificationCode}),
    );
  }

  Future<void> registerDevice(DeviceRegistrationPayload payload) async {
    await post(_Endpoints.registerDevice, payload.toJson());
  }

  Future<void> unregisterDevice(TokenPayload payload) async {
    await post(_Endpoints.unregisterDevice, payload.toJson());
  }

  Future<ActionResponse> sendAlert(AlertPayload payload) async =>
      ActionResponse.fromJson(
        await post(_Endpoints.alerts, payload.toJson()) as Json,
      );
  Future<Uint8List> downloadFinanceReport() async =>
      (await _response('GET', _Endpoints.financeReport, null)).bodyBytes;
  Future<AccountResponse> me() async => AccountResponse(
    Map<String, dynamic>.from((await get(_Endpoints.me) as Json)['account']),
  );
  Future<void> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    await executeAction(
      'profile',
      'change_password',
      WorkspaceActionPayload(
        values: {
          'current_password': currentPassword,
          'new_password': newPassword,
        },
      ),
    );
    await clear();
  }
}
