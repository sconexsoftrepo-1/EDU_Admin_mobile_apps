/// Request/response contracts. Heterogeneous business records retain their API keys.
typedef Json = Map<String, dynamic>;

class ApiException implements Exception {
  final String message;
  final int status;
  const ApiException(this.message, this.status);
  @override
  String toString() => message;
}

class LoginPayload {
  final String loginId, password, client;
  final String? roleCode;
  const LoginPayload({
    required this.loginId,
    required this.password,
    required this.client,
    this.roleCode,
  });
  Json toJson() => {
    'login_id': loginId,
    'password': password,
    'client': client,
    if (roleCode != null) 'role_code': roleCode,
  };
}

class RefreshPayload {
  final String refreshToken, client;
  const RefreshPayload({required this.refreshToken, required this.client});
  Json toJson() => {'refresh_token': refreshToken, 'client': client};
}

class AccountResponse {
  final Json data;
  const AccountResponse(this.data);
  String get code => data['code'] as String? ?? '';
  String get loginId => data['login_id'] as String? ?? '';
  String get personType => data['person_type'] as String? ?? '';
  String get personCode => data['person_code'] as String? ?? '';
  bool get active => data['active'] == true;
  List<String> get roleCodes =>
      List<String>.from(data['role_codes'] as List? ?? []);
  List<String> get clients => List<String>.from(data['clients'] as List? ?? []);
  Json toJson() => Map.of(data);
}

class AuthResponse {
  final String accessToken, refreshToken;
  final int? expiresIn;
  final AccountResponse? account;
  final List<Json> roles;
  const AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    this.expiresIn,
    this.account,
    this.roles = const [],
  });
  factory AuthResponse.fromJson(Json data) => AuthResponse(
    accessToken: data['access_token'] as String,
    refreshToken: data['refresh_token'] as String,
    expiresIn: data['expires_in'] as int?,
    account: data['account'] is Map
        ? AccountResponse(Map<String, dynamic>.from(data['account']))
        : null,
    roles: (data['roles'] as List? ?? [])
        .map((r) => Map<String, dynamic>.from(r))
        .toList(),
  );
  Json toJson() => {
    'access_token': accessToken,
    'refresh_token': refreshToken,
    if (expiresIn != null) 'expires_in': expiresIn,
    if (account != null) 'account': account!.toJson(),
    'roles': roles,
  };
}

class WorkspaceScreen {
  final String key, title;
  final String? resource;
  const WorkspaceScreen({
    required this.key,
    required this.title,
    this.resource,
  });
  factory WorkspaceScreen.fromJson(Json json) => WorkspaceScreen(
    key: json['key'] as String,
    title: json['title'] as String,
    resource: json['resource'] as String?,
  );
  Json toJson() => {'key': key, 'title': title, 'resource': ?resource};
}

class FormFieldDefinition {
  final Json data;
  const FormFieldDefinition(this.data);
  String get key => data['key'] as String;
  String get label => data['label'] as String;
  String get type => data['type'] as String? ?? 'text';
  bool get required => data['required'] == true;
  List<String> get options =>
      (data['options'] as List? ?? []).map((v) => v.toString()).toList();
  Json toJson() => Map.of(data);
}

class ActionDefinition {
  final Json data;
  const ActionDefinition(this.data);
  String get key => data['key'] as String;
  String get label => data['label'] as String;
  int? get formRevision => data['form_revision'] as int?;
  List<FormFieldDefinition> get fields => (data['fields'] as List? ?? [])
      .map((f) => FormFieldDefinition(Map<String, dynamic>.from(f)))
      .toList();
  Json toJson() => Map.of(data);
}

class WorkspaceResponse {
  final Json data;
  const WorkspaceResponse(this.data);
  factory WorkspaceResponse.fromJson(Json json) =>
      WorkspaceResponse(Map.of(json));
  String? get screen => data['screen'] as String?;
  String? get title => data['title'] as String?;
  String? get selectedStudentCode => data['selected_student_code'] as String?;
  String? get downloadKind => data['downloads'] as String?;
  List<Json> get items => (data['items'] as List? ?? [])
      .map((r) => Map<String, dynamic>.from(r))
      .toList();
  int get total => data['total'] as int? ?? items.length;
  Json? get summary => data['summary'] is Map
      ? Map<String, dynamic>.from(data['summary'])
      : null;
  Json get lookups => Map<String, dynamic>.from(data['lookups'] as Map? ?? {});
  List<Json> get students => (data['students'] as List? ?? [])
      .map((r) => Map<String, dynamic>.from(r))
      .toList();
  List<ActionDefinition> get actions => (data['actions'] as List? ?? [])
      .map((a) => ActionDefinition(Map<String, dynamic>.from(a)))
      .toList();
  Json toJson() => Map.of(data);
}

class WorkspaceQuery {
  final String? studentCode;
  final DateTime? fromDate, toDate;
  final int? offset, limit;
  const WorkspaceQuery({
    this.studentCode,
    this.fromDate,
    this.toDate,
    this.offset,
    this.limit,
  });
  Map<String, String> toQueryParameters() => {
    'student_code': ?studentCode,
    if (fromDate != null)
      'from_date': fromDate!.toIso8601String().split('T').first,
    if (toDate != null) 'to_date': toDate!.toIso8601String().split('T').first,
    if (offset != null) 'offset': '$offset',
    if (limit != null) 'limit': '$limit',
  };
}

class WorkspaceActionPayload {
  final Json values;
  final String? studentCode;
  final int? formRevision;
  const WorkspaceActionPayload({
    required this.values,
    this.studentCode,
    this.formRevision,
  });
  Json toJson() => {
    'values': values,
    if (studentCode != null) 'student_code': studentCode,
    if (formRevision != null) 'form_revision': formRevision,
  };
}

class ActionResponse {
  final Json data;
  const ActionResponse(this.data);
  factory ActionResponse.fromJson(Json json) => ActionResponse(Map.of(json));
  String? get checkoutUrl => data['checkout_url'] as String?;
  bool get reauthenticate => data['reauthenticate'] == true;
  String? get notificationCode => data['notification_code'] as String?;
  Json? get record =>
      data['record'] is Map ? Map<String, dynamic>.from(data['record']) : null;
  Json toJson() => Map.of(data);
}

class DeviceRegistrationPayload {
  final String token, platform;
  const DeviceRegistrationPayload({
    required this.token,
    required this.platform,
  });
  Json toJson() => {'token': token, 'platform': platform};
}

class TokenPayload {
  final String token;
  const TokenPayload(this.token);
  Json toJson() => {'token': token};
}

class AlertPayload {
  final String recipientUserCode, title, body;
  final bool push;
  const AlertPayload({
    required this.recipientUserCode,
    required this.title,
    required this.body,
    this.push = false,
  });
  Json toJson() => {
    'recipient_user_code': recipientUserCode,
    'title': title,
    'body': body,
    'push': push,
  };
}
