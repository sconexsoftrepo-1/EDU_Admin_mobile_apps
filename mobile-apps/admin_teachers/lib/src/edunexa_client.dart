import 'package:url_launcher/url_launcher.dart';
import 'dart:async';
import '../services/push_notifications.dart';
import '../services/api_service.dart';
export '../services/api_service.dart';
import 'mobile_design.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

part 'mobile_workspace.dart';
part 'workspace_widgets.dart';
part 'workspace_forms.dart';

enum MobileRole {
  admin(
    'Admin',
    ApiConfig.adminClient,
    'Manage your college, fees and operations.',
  ),
  teacher(
    'Teacher',
    ApiConfig.teacherClient,
    'Manage your classes, attendance and teaching.',
  ),
  parent(
    'Parent',
    ApiConfig.parentClient,
    'Follow your children’s learning and college updates.',
  ),
  student(
    'Student',
    ApiConfig.studentClient,
    'Your classes, assignments and college updates.',
  );

  const MobileRole(this.label, this.clientId, this.description);
  final String label, clientId, description;
}

extension MobileRoleStyle on MobileRole {
  Color get accent => switch (this) {
    MobileRole.admin => collegeCaramel,
    MobileRole.teacher => collegePine,
    MobileRole.parent => collegeCaramel,
    MobileRole.student => const Color(0xff5e64d0),
  };
  IconData get icon => switch (this) {
    MobileRole.admin => Icons.admin_panel_settings_outlined,
    MobileRole.teacher => Icons.co_present_outlined,
    MobileRole.parent => Icons.family_restroom_outlined,
    MobileRole.student => Icons.school_outlined,
  };
}

class EdunexaApp extends StatefulWidget {
  final String title, clientId;
  final CollegeApi? api;
  final List<MobileRole> roles;
  final CollegeApi Function(MobileRole)? apiFactory;
  const EdunexaApp({
    super.key,
    required this.title,
    required this.clientId,
    this.api,
    this.roles = const [],
    this.apiFactory,
  });
  @override
  State<EdunexaApp> createState() => _EdunexaAppState();
}

class _EdunexaAppState extends State<EdunexaApp> {
  late CollegeApi api;
  late MobileRole role;
  late final List<MobileRole> roles;
  String get roleKey => ApiConfig.roleKey(widget.clientId);
  CollegeApi createApi(MobileRole value) =>
      widget.apiFactory?.call(value) ??
      widget.api ??
      CollegeApi(baseUrl: ApiConfig.baseUrl, clientId: value.clientId);
  bool signedIn = false, restoring = true;
  String? restoreError;
  @override
  void initState() {
    super.initState();
    roles = widget.roles.isEmpty
        ? [MobileRole.values.firstWhere((r) => r.clientId == widget.clientId)]
        : widget.roles;
    role = roles.first;
    api = createApi(role);
    restore();
  }

  Future<void> restore() async {
    try {
      final saved = await api.storage.read(key: roleKey);
      role = roles.firstWhere(
        (r) => r.name == saved,
        orElse: () => roles.first,
      );
      api = createApi(role);
      signedIn = await api.restore();
    } catch (e) {
      restoreError = e.toString();
    }
    if (mounted) setState(() => restoring = false);
  }

  void selectRole(MobileRole value) {
    setState(() {
      role = value;
      api = createApi(value);
      restoreError = null;
    });
  }

  Future<void> loggedIn() async {
    try {
      await api.storage.write(key: roleKey, value: role.name);
    } catch (_) {
      await api.clear();
      rethrow;
    }
    if (mounted) setState(() => signedIn = true);
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: widget.title,
    debugShowCheckedModeBanner: false,
    theme: collegeTheme(role.accent),
    themeAnimationDuration: Duration.zero,
    home: restoring
        ? const Scaffold(body: Center(child: CircularProgressIndicator()))
        : signedIn
        ? MobileWorkspace(
            title: '${role.label} dashboard',
            role: role,
            api: api,
            onLogout: () {
              setState(() => signedIn = false);
            },
          )
        : LoginScreen(
            title: widget.title,
            api: api,
            roles: roles,
            role: role,
            onRoleChanged: selectRole,
            initialError: restoreError,
            onLogin: loggedIn,
          ),
  );
}

class LoginScreen extends StatefulWidget {
  final String title;
  final CollegeApi api;
  final Future<void> Function() onLogin;
  final String? initialError;
  final List<MobileRole> roles;
  final MobileRole role;
  final ValueChanged<MobileRole> onRoleChanged;
  const LoginScreen({
    super.key,
    required this.title,
    required this.api,
    required this.onLogin,
    required this.roles,
    required this.role,
    required this.onRoleChanged,
    this.initialError,
  });
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final form = GlobalKey<FormState>(),
      login = TextEditingController(),
      password = TextEditingController();
  bool busy = false, hidden = true;
  String? error;
  @override
  void initState() {
    super.initState();
    error = widget.initialError;
  }

  @override
  void dispose() {
    login.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (busy || !form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.login(login.text.trim(), password.text);
      password.clear();
      await widget.onLogin();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: AutofillGroup(
              child: Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    CollegeBrand(
                      subtitle: widget.roles.contains(MobileRole.admin)
                          ? 'College staff'
                          : 'College community',
                    ),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        color: widget.role.accent,
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(width: 32, height: 3, color: collegeGold),
                          const SizedBox(height: 16),
                          Text(
                            widget.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              height: 1.2,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -.5,
                            ),
                          ),
                          const SizedBox(height: 10),
                          const Text(
                            'Sign in with your college account.',
                            style: TextStyle(
                              color: Color(0xfff5ead8),
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    if (widget.roles.length > 1)
                      SegmentedButton<MobileRole>(
                        direction:
                            MediaQuery.textScalerOf(context).scale(14) > 18
                            ? Axis.vertical
                            : Axis.horizontal,
                        expandedInsets:
                            MediaQuery.textScalerOf(context).scale(14) > 18
                            ? null
                            : EdgeInsets.zero,
                        showSelectedIcon: false,
                        segments: widget.roles
                            .map(
                              (r) => ButtonSegment(
                                value: r,
                                icon: Icon(r.icon, size: 20),
                                label: Text(r.label),
                              ),
                            )
                            .toList(),
                        selected: {widget.role},
                        onSelectionChanged: busy
                            ? null
                            : (selection) {
                                password.clear();
                                form.currentState?.reset();
                                setState(() => error = null);
                                widget.onRoleChanged(selection.single);
                              },
                      ),
                    const SizedBox(height: 14),
                    Text(
                      widget.role.description,
                      style: const TextStyle(color: collegeMuted, height: 1.5),
                    ),
                    const SizedBox(height: 24),
                    TextFormField(
                      controller: login,
                      enabled: !busy,
                      textInputAction: TextInputAction.next,
                      decoration: const InputDecoration(
                        labelText: 'Login ID',
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      autofillHints: const [AutofillHints.username],
                      validator: (v) => v == null || v.trim().isEmpty
                          ? 'Enter your login ID'
                          : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: password,
                      enabled: !busy,
                      obscureText: hidden,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.password],
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          tooltip: hidden ? 'Show password' : 'Hide password',
                          onPressed: () => setState(() => hidden = !hidden),
                          icon: Icon(
                            hidden
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (v) =>
                          v == null || v.isEmpty ? 'Enter your password' : null,
                      onFieldSubmitted: (_) => submit(),
                    ),
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 16),
                        child: Semantics(
                          liveRegion: true,
                          child: Text(
                            error!,
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.error,
                              height: 1.5,
                            ),
                          ),
                        ),
                      ),
                    const SizedBox(height: 22),
                    FilledButton(
                      onPressed: busy ? null : submit,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (busy) ...[
                            const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            const SizedBox(width: 10),
                          ],
                          Text(busy ? 'Signing in…' : 'Sign in'),
                          if (!busy) ...[
                            const SizedBox(width: 10),
                            const Icon(Icons.arrow_forward, size: 18),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'Need access? Contact your college office.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: collegeMuted,
                        fontSize: 12,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

IconData moduleIcon(String key) => switch (key) {
  'overview' || 'reports' => Icons.analytics_outlined,
  'classes' || 'timetable' => Icons.calendar_month_outlined,
  'students' || 'children' => Icons.groups_outlined,
  'fees' ||
  'payments' ||
  'dues' ||
  'collections' => Icons.account_balance_wallet_outlined,
  'attendance' => Icons.fact_check_outlined,
  'assignments' || 'submissions' || 'results' => Icons.assignment_outlined,
  'messages' ||
  'notifications' ||
  'announcements' => Icons.notifications_outlined,
  'profile' => Icons.person_outline,
  'calendar' => Icons.event_outlined,
  'leave' => Icons.event_available_outlined,
  'hostel' => Icons.apartment_outlined,
  'transport' => Icons.directions_bus_outlined,
  'library' => Icons.local_library_outlined,
  'certificates' || 'tax-documents' => Icons.description_outlined,
  'payslips' => Icons.receipt_long_outlined,
  'syllabus' => Icons.menu_book_outlined,
  'employees' => Icons.badge_outlined,
  'admissions' => Icons.how_to_reg_outlined,
  'expenses' => Icons.payments_outlined,
  'activity' => Icons.history_outlined,
  _ => Icons.school_outlined,
};
String label(String key) => key
    .replaceAll('_', ' ')
    .split(' ')
    .map((s) => s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}')
    .join(' ');
String display(dynamic value) {
  if (value == null) return '—';
  if (value is Map) {
    return value.entries
        .map((e) => '${label(e.key.toString())}: ${display(e.value)}')
        .join('\n');
  }
  if (value is List) return value.map(display).join('\n');
  return value.toString();
}
