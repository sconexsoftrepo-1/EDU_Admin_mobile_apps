import 'package:url_launcher/url_launcher.dart';
import 'dart:async';
import 'dart:convert';
import 'package:file_selector/file_selector.dart';
import 'package:pdfrx/pdfrx.dart';
import '../services/push_notifications.dart';
import '../services/api_service.dart';
export '../services/api_service.dart';
import 'mobile_design.dart';
import '../splash/splash_screen.dart';
import '../splash/splash_assets.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';

part 'mobile_workspace.dart';
part 'assignment_workspace.dart';
part 'workspace_widgets.dart';
part 'workspace_forms.dart';
part 'workspace_presentations.dart';
part 'auth_widgets.dart';

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
    MobileRole.student => collegePine,
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
  final Future<void> Function() initialize;
  const EdunexaApp({
    super.key,
    required this.title,
    required this.clientId,
    this.api,
    this.roles = const [],
    this.apiFactory,
    this.initialize = initializeCollegePush,
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
  bool splashFinished = false, restoreInFlight = false;
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
    if (restoreInFlight) return;
    restoreInFlight = true;
    if (mounted) {
      setState(() {
        restoring = true;
        restoreError = null;
      });
    }
    try {
      await widget.initialize();
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
    restoreInFlight = false;
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
    home: !splashFinished
        ? CinematicSplashScreen(
            configuration:
                widget.clientId == ApiConfig.parentClient ||
                    widget.clientId == ApiConfig.studentClient
                ? SplashConfiguration.students
                : SplashConfiguration.staff,
            ready: !restoring && restoreError == null,
            startupError: restoreError,
            onRetry: restore,
            onComplete: () {
              if (mounted) setState(() => splashFinished = true);
            },
          )
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

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final form = GlobalKey<FormState>(),
      login = TextEditingController(),
      password = TextEditingController();
  bool busy = false, hidden = true;
  bool selectingRole = true, transitioning = false, entranceStarted = false;
  late final AnimationController entrance;
  final authScroll = ScrollController();
  String? roleNotice;
  String? error;
  @override
  void initState() {
    super.initState();
    error = widget.initialError;
    selectingRole = widget.roles.length > 1;
    entrance = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 750),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (EduMotion.reduced(context)) {
      entrance.stop();
      entrance.value = 1;
      entranceStarted = true;
    } else if (!entranceStarted) {
      entranceStarted = true;
      entrance.forward();
    }
  }

  void chooseRole(MobileRole value) {
    if (busy || transitioning || value == widget.role) return;
    final hadPassword = password.text.isNotEmpty || roleNotice != null;
    FocusManager.instance.primaryFocus?.unfocus();
    password.clear();
    if (!EduMotion.reduced(context)) HapticFeedback.selectionClick();
    setState(() {
      error = null;
      hidden = true;
      roleNotice = hadPassword
          ? 'Login ID kept. Re-enter the password for this role.'
          : null;
    });
    widget.onRoleChanged(value);
  }

  Future<void> changeStage(bool selectRole) async {
    if (busy || transitioning || selectingRole == selectRole) return;
    FocusManager.instance.primaryFocus?.unfocus();
    final reduced = EduMotion.reduced(context);
    setState(() => transitioning = true);
    if (!reduced) {
      try {
        await entrance
            .animateTo(
              0,
              duration: const Duration(milliseconds: 100),
              curve: Curves.easeInCubic,
            )
            .orCancel;
      } on TickerCanceled {
        return;
      }
    }
    if (!mounted) return;
    if (authScroll.hasClients) authScroll.jumpTo(0);
    setState(() {
      if (selectRole && password.text.isNotEmpty) {
        password.clear();
        roleNotice = 'Login ID kept. Re-enter the password for this role.';
      }
      selectingRole = selectRole;
      transitioning = false;
      error = null;
      hidden = true;
    });
    entrance.duration = const Duration(milliseconds: 320);
    if (reduced) {
      entrance.value = 1;
    } else {
      entrance.forward(from: 0);
    }
  }

  @override
  void dispose() {
    entrance.dispose();
    authScroll.dispose();
    login.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (busy ||
        transitioning ||
        selectingRole ||
        !form.currentState!.validate()) {
      return;
    }
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

  Widget loginForm() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: EduAuthPalette.surface,
          borderRadius: BorderRadius.circular(23),
          border: Border.all(color: EduAuthPalette.border),
          boxShadow: [
            BoxShadow(
              color: EduAuthPalette.ink.withValues(alpha: .025),
              blurRadius: 20,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            EduAuthTextField(
              key: ValueKey('login-id-${widget.role.name}'),
              controller: login,
              label: 'Login ID',
              icon: 'login_id',
              enabled: !busy,
              action: TextInputAction.next,
              autofill: const [AutofillHints.username],
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Enter your login ID' : null,
            ),
            const SizedBox(height: 14),
            EduAuthTextField(
              key: ValueKey('password-${widget.role.name}'),
              controller: password,
              label: 'Password',
              icon: 'password',
              enabled: !busy,
              obscure: hidden,
              action: TextInputAction.done,
              autofill: const [AutofillHints.password],
              validator: (v) =>
                  v == null || v.isEmpty ? 'Enter your password' : null,
              onSubmitted: (_) => submit(),
              onChanged: (_) {
                if (roleNotice != null) {
                  setState(() => roleNotice = null);
                }
              },
              suffix: IconButton(
                tooltip: hidden ? 'Show password' : 'Hide password',
                onPressed: busy ? null : () => setState(() => hidden = !hidden),
                icon: AnimatedSwitcher(
                  duration: EduMotion.duration(
                    context,
                    const Duration(milliseconds: 160),
                  ),
                  child: Icon(
                    hidden
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    key: ValueKey(hidden),
                    size: 20,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      AnimatedSize(
        duration: EduMotion.duration(
          context,
          const Duration(milliseconds: 220),
        ),
        curve: Curves.easeOutCubic,
        alignment: Alignment.topCenter,
        child: error == null
            ? const SizedBox.shrink()
            : Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Semantics(
                  liveRegion: true,
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xfff8e8df),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.info_outline_rounded,
                          color: collegeError,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            error!,
                            style: const TextStyle(
                              color: collegeError,
                              fontSize: 13,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
      ),
      const SizedBox(height: 14),
      AnimatedAuthButton(
        label: busy ? 'Signing in…' : 'Sign in',
        busy: busy,
        color: EduAuthPalette.accent(widget.role),
        onPressed: busy ? null : submit,
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final accent = EduAuthPalette.accent(widget.role);
    final base = Theme.of(context);
    final staff = widget.roles.any(
      (r) => r == MobileRole.admin || r == MobileRole.teacher,
    );
    final authTheme = base.copyWith(
      colorScheme: base.colorScheme.copyWith(
        primary: accent,
        onPrimary: EduAuthPalette.surface,
        surface: EduAuthPalette.surface,
        onSurface: EduAuthPalette.ink,
        outlineVariant: EduAuthPalette.border,
      ),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: accent,
        selectionColor: accent.withValues(alpha: .18),
        selectionHandleColor: accent,
      ),
      scaffoldBackgroundColor: EduAuthPalette.background,
    );
    return Theme(
      data: authTheme,
      child: PopScope(
        canPop: selectingRole,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop && !busy && !transitioning) {
            changeStage(true);
          }
        },
        child: Scaffold(
          backgroundColor: EduAuthPalette.background,
          body: Stack(
            children: [
              const Positioned.fill(child: EduAuthBackdrop()),
              SafeArea(
                child: LayoutBuilder(
                  builder: (context, bounds) {
                    final keyboard =
                        MediaQuery.viewInsetsOf(context).bottom > 0;
                    final compact =
                        bounds.maxHeight < (selectingRole ? 740 : 860) ||
                        keyboard;
                    final enlarged =
                        MediaQuery.textScalerOf(context).scale(14) > 20;
                    final padding = compact ? 14.0 : 20.0;
                    Widget enter(
                      Widget child, {
                      double start = .2,
                      double end = .85,
                      double rise = 10,
                    }) => EduAuthEntrance(
                      animation: entrance,
                      start: start,
                      end: end,
                      rise: rise,
                      child: child,
                    );
                    return SingleChildScrollView(
                      key: const ValueKey('auth-scroll'),
                      controller: authScroll,
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      padding: EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: padding,
                      ),
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          minHeight: (bounds.maxHeight - padding * 2)
                              .clamp(0.0, bounds.maxHeight)
                              .toDouble(),
                        ),
                        child: Center(
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              maxWidth: selectingRole ? 680 : 460,
                            ),
                            child: AbsorbPointer(
                              absorbing: transitioning,
                              child: AutofillGroup(
                                child: Form(
                                  key: form,
                                  child: Column(
                                    key: ValueKey(
                                      selectingRole
                                          ? 'auth-role-selection'
                                          : 'auth-login',
                                    ),
                                    mainAxisSize: MainAxisSize.min,
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      EduAuthBrandHeader(
                                        staff: staff,
                                        compact: compact || !selectingRole,
                                        animation: entrance,
                                      ),
                                      SizedBox(height: compact ? 16 : 20),
                                      enter(
                                        Text(
                                          selectingRole
                                              ? 'Your college, connected.'
                                              : 'Welcome back',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            fontSize: selectingRole ? 25 : 28,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: -.7,
                                            height: 1.17,
                                            color: EduAuthPalette.ink,
                                          ),
                                        ),
                                        start: .23,
                                        end: .67,
                                      ),
                                      const SizedBox(height: 7),
                                      enter(
                                        Text(
                                          selectingRole
                                              ? 'Choose your role to continue to your workspace.'
                                              : 'Sign in to your ${widget.role.label.toLowerCase()} workspace.',
                                          textAlign: TextAlign.center,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            height: 1.4,
                                            color: EduAuthPalette.muted,
                                          ),
                                        ),
                                        start: .28,
                                        end: .72,
                                        rise: 6,
                                      ),
                                      SizedBox(height: compact ? 18 : 22),
                                      if (selectingRole) ...[
                                        LayoutBuilder(
                                          builder: (context, c) {
                                            final columns =
                                                c.maxWidth >= 600 && !enlarged
                                                ? 2
                                                : 1;
                                            return Wrap(
                                              spacing: 14,
                                              runSpacing: 12,
                                              children: [
                                                for (
                                                  var i = 0;
                                                  i < widget.roles.length;
                                                  i++
                                                )
                                                  SizedBox(
                                                    width:
                                                        (c.maxWidth -
                                                            (columns - 1) *
                                                                14) /
                                                        columns,
                                                    child: enter(
                                                      AnimatedRoleTile(
                                                        role: widget.roles[i],
                                                        selected:
                                                            widget.role ==
                                                            widget.roles[i],
                                                        enabled:
                                                            !busy &&
                                                            !transitioning,
                                                        onTap: () => chooseRole(
                                                          widget.roles[i],
                                                        ),
                                                      ),
                                                      start: .30 + i * .08,
                                                      end: .83 + i * .08,
                                                    ),
                                                  ),
                                              ],
                                            );
                                          },
                                        ),
                                        const SizedBox(height: 18),
                                        enter(
                                          AnimatedAuthButton(
                                            label: 'Continue',
                                            onPressed:
                                                busy ||
                                                    !widget.roles.contains(
                                                      widget.role,
                                                    )
                                                ? null
                                                : () => changeStage(false),
                                          ),
                                          start: .48,
                                          end: .96,
                                        ),
                                      ] else ...[
                                        if (widget.roles.length > 1)
                                          enter(
                                            AnimatedRoleSwitcher(
                                              roles: widget.roles,
                                              selected: widget.role,
                                              enabled: !busy && !transitioning,
                                              onChanged: chooseRole,
                                            ),
                                            start: .30,
                                            end: .78,
                                          ),
                                        if (roleNotice != null)
                                          Padding(
                                            padding: const EdgeInsets.only(
                                              top: 9,
                                            ),
                                            child: Semantics(
                                              liveRegion: true,
                                              child: Text(
                                                roleNotice!,
                                                textAlign: TextAlign.center,
                                                style: const TextStyle(
                                                  fontSize: 12,
                                                  height: 1.4,
                                                  color: EduAuthPalette.muted,
                                                ),
                                              ),
                                            ),
                                          ),
                                        const SizedBox(height: 14),
                                        enter(
                                          loginForm(),
                                          start: .34,
                                          end: .91,
                                        ),
                                        if (widget.roles.length > 1)
                                          TextButton(
                                            onPressed: busy
                                                ? null
                                                : () => changeStage(true),
                                            child: const Text(
                                              'Choose another role',
                                            ),
                                          ),
                                      ],
                                      SizedBox(height: selectingRole ? 10 : 2),
                                      enter(
                                        authIllustration(
                                          selectingRole
                                              ? 'college_campus'
                                              : 'login_landscape',
                                          height: keyboard
                                              ? 40
                                              : enlarged
                                              ? 48
                                              : selectingRole
                                              ? (compact ? 66 : 80)
                                              : (compact ? 100 : 116),
                                        ),
                                        start: .48,
                                        end: 1,
                                        rise: 6,
                                      ),
                                      const SizedBox(height: 6),
                                      enter(
                                        const SconexAuthFooter(),
                                        start: .52,
                                        end: 1,
                                        rise: 5,
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
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
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
  'assignments' || 'submissions' => Icons.assignment_outlined,
  'results' => Icons.quiz_outlined,
  'messages' => Icons.chat_bubble_outline,
  'notifications' || 'announcements' => Icons.notifications_outlined,
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
