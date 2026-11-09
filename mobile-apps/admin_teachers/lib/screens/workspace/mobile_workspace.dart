part of '../../app/edunexa_client.dart';

class MobileWorkspace extends StatefulWidget {
  final String title;
  final CollegeApi api;
  final VoidCallback onLogout;
  final MobileRole role;
  const MobileWorkspace({
    super.key,
    required this.title,
    required this.api,
    required this.onLogout,
    required this.role,
  });
  @override
  State<MobileWorkspace> createState() => _MobileWorkspaceState();
}

class _MobileWorkspaceState extends State<MobileWorkspace>
    with WidgetsBindingObserver {
  final search = TextEditingController();
  List<Json> screens = [];
  final Map<String, Json> cache = {};
  /// When each screen's data was fetched; screens reuse it until a save, pull-to-refresh or
  /// it is older than [staleAfter] when the app comes back to the foreground.
  final Map<String, DateTime> fetchedAt = {};
  static const staleAfter = Duration(minutes: 10);
  /// Screens whose request depends on the date being viewed: always fetched when opened.
  static const dateScoped = {'calendar', 'labs'};
  /// Changes only when the selected student changes; older responses are then ignored.
  int studentEpoch = 0;
  /// One scroll controller per screen, remembering its position for Back.
  final Map<String, _RememberedScroll> scrolls = {};
  ScrollController pageScroll(String key) => scrolls.putIfAbsent(key, _RememberedScroll.new);
  final Map<String, String> sectionErrors = {};
  String? selected, student, error;
  String query = '', filter = 'All';
  bool busy = true, saving = false, paging = false, downloading = false;
  int generation = 0;
  DateTime calendarDay = DateUtils.dateOnly(DateTime.now());
  DateTime calendarMonth = DateTime(DateTime.now().year, DateTime.now().month);
  PushNotifications? push;
  /// Unread chat messages (Chats tab badge) and a conversation to open from a notification.
  int chatUnread = 0;
  String? chatThread;
  Timer? chatTimer;
  String pushStatus = 'Enable device alerts for important college updates.';
  bool pushBusy = false;
  Json? get data => cache[selected];
  bool has(String key) => screens.any((s) => s['key'] == key);
  List<Json> rows(String key) =>
      (cache[key]?['items'] as List? ?? []).cast<Json>();
  /// Lab in-charges sign in to the staff app; their workspace offers labs instead of classes.
  bool get labIncharge => widget.role == MobileRole.teacher && has('labs') && !has('classes');
  /// Cash clerks sign in to the staff app too; their main screen is cash to deposit.
  bool get cashClerk => widget.role == MobileRole.teacher && has('cash');
  /// Screens the app draws itself (no generic record list or screen actions).
  static const selfDrawn = {'certificates', 'cash', 'cash-analytics', 'change-requests'};
  String get primary => switch (widget.role) {
    MobileRole.admin => 'overview',
    MobileRole.teacher => cashClerk ? 'cash' : labIncharge ? 'labs' : 'classes',
    MobileRole.parent => 'fees',
    MobileRole.student => 'assignments',
  };
  String get primaryLabel => switch (widget.role) {
    MobileRole.admin => 'Finance',
    MobileRole.teacher => cashClerk ? 'Cash' : labIncharge ? 'Labs' : 'Classes',
    MobileRole.parent => 'Fees',
    MobileRole.student => 'Study',
  };
  /// Second bottom-bar destination: the week for teaching staff, students for administrators.
  String get secondary => widget.role == MobileRole.admin
      ? (has('students') ? 'students' : 'reports')
      : cashClerk ? 'leave' : 'timetable';
  String get secondaryLabel => widget.role == MobileRole.admin
      ? (has('students') ? 'Students' : 'Reports')
      : cashClerk ? 'Leave' : 'Timetable';
  // Bottom bar order: primary, secondary, Home (centre), Chats, More. Inbox lives on the bell.
  int get tab => selected == null
      ? 2
      : selected == primary
      ? 0
      : selected == secondary
      ? 1
      : selected == 'messages'
      ? 3
      : 4;

  Future<void> refreshChatBadge() async {
    try {
      final count = await ChatApi(widget.api).unread();
      if (mounted && count != chatUnread) setState(() => chatUnread = count);
    } catch (_) {
      /* The badge refreshes on the next tick. */
    }
  }

  /// Opens the Chats tab, optionally straight into one conversation.
  void openChat([String? thread]) {
    chatThread = thread;
    history.clear();
    open('messages', remember: false);
  }
  int get unread =>
      rows('notifications').where((r) => r['status'] != 'read').length;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    loadScreens();
    refreshChatBadge();
    chatTimer = Timer.periodic(const Duration(seconds: 30), (_) => refreshChatBadge());
    push = PushNotifications(
      onOpen: (data) async {
        if (!mounted) return;
        // Chat pushes open the conversation straight away.
        final thread = data['thread_code']?.toString();
        if (thread != null && thread.isNotEmpty) {
          openChat(thread);
          return;
        }
        final code = data['notification_code']?.toString();
        if (!has('notifications')) return;
        await fetchSection('notifications');
        final notice = rows('notifications').where((row) => row['code']?.toString() == code).firstOrNull;
        if (notice != null && notice['thread_code'] != null) {
          openChat(notice['thread_code'].toString());
        } else if (notice != null && (notice['certificate_request_code'] != null || notice['certificate_code'] != null || notice['screen'] == 'certificates')) {
          open('certificates');
        } else if (notice != null && notice['assessment_code'] != null && has('assessments')) {
          open('assessments');
        } else if(notice!=null&&notice['screen'] is String&&has(notice['screen'] as String)){
          open(notice['screen'] as String);
        } else {
          open('notifications');
        }
      },
      onForeground: (title, body, data) {
        if (!mounted) return;
        if (data['kind'] == 'chat' || data['screen'] == 'messages') {
          refreshChatBadge();
          final thread = data['thread_code']?.toString();
          // Android shows a notification; on iOS show a banner unless that chat is open.
          if (Theme.of(context).platform == TargetPlatform.iOS && thread != PushNotifications.activeThread) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text('$title\n$body', maxLines: 3, overflow: TextOverflow.ellipsis),
              action: SnackBarAction(label: 'Open', onPressed: () => openChat(thread)),
            ));
          }
          return;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$title\n$body'),
            action: SnackBarAction(
              label: 'View',
              onPressed: () => open('notifications'),
            ),
          ),
        );
        fetchSection('notifications');
        refreshChatBadge();
      },
    );
    resumePush();
  }

  Future<void> resumePush() async {
    try {
      final enabled = await widget.api.storage.read(
        key: ApiConfig.pushPreferenceKey(widget.api.clientId),
      );
      // On by default: the first sign-in asks for notification permission once.
      if ((enabled == 'true' || enabled == null) && mounted) await enablePush();
    } catch (_) {
      /* Optional device alerts never block sign-in. */
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    for (final c in scrolls.values) {
      c.dispose();
    }
    push?.dispose();
    chatTimer?.cancel();
    search.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) refreshChatBadge();
    if (state == AppLifecycleState.resumed && !busy && selected != 'messages') {
      final at = fetchedAt[selected ?? primary];
      if (at == null || DateTime.now().difference(at) > staleAfter) load();
    }
  }

  WorkspaceQuery workspaceQuery(String key, {int? offset}) {
    final now = DateUtils.dateOnly(DateTime.now());
    return WorkspaceQuery(
      studentCode: student,
      offset: offset,
      fromDate: key == 'calendar'
          ? (selected == null
                ? now
                : DateTime(calendarMonth.year, calendarMonth.month))
          : key == 'labs'
          ? (selected == 'labs' ? labDay : now)
          : null,
      toDate: key == 'calendar'
          ? (selected == null
                ? now.add(const Duration(days: 90))
                : DateTime(calendarMonth.year, calendarMonth.month + 1, 0))
          : null,
    );
  }

  Future<Json> fetch(String key) async =>
      (await widget.api.workspace(key, query: workspaceQuery(key))).toJson();

  Future<void> fetchSection(String key, {bool force = true}) async {
    if (!has(key)) return;
    if (!force && cache[key] != null) return;
    final ticket = studentEpoch;
    try {
      final result = await fetch(key);
      if (!mounted || ticket != studentEpoch) return;
      setState(() {
        cache[key] = result;
        fetchedAt[key] = DateTime.now();
        student ??= result['selected_student_code'] as String?;
        sectionErrors.remove(key);
      });
    } catch (e) {
      if (!mounted || ticket != studentEpoch) return;
      if (e is ApiException && e.status == 401) {
        widget.onLogout();
        return;
      }
      setState(() => sectionErrors[key] = e.toString());
    }
  }

  Future<void> loadScreens({bool force = true}) async {
    final ticket = ++generation;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await widget.api.listScreens();
      if (!mounted || ticket != generation) return;
      setState(
        () => screens = result
            .map((screen) => screen.toJson())
            // Bus & route is not offered in the app for now.
            .where((screen) => screen['key'] != 'transport')
            .toList(),
      );
      await loadHome(ticket, force: force);
      if (mounted && ticket == generation) setState(() => busy = false);
    } catch (e) {
      fail(e, ticket);
    }
  }

  /// Home sections load in the background and are kept even if you open another screen
  /// meanwhile (only switching the student discards them). [force] false loads only missing ones.
  Future<void> loadHome(int ticket, {bool force = true}) async {
    final keys = <String>{
      'profile',
      primary,
      'calendar',
      'notifications',
      'announcements',
      if (widget.role != MobileRole.admin) 'timetable',
      if (widget.role == MobileRole.parent) 'children',
      if (widget.role == MobileRole.student ||
          widget.role == MobileRole.parent) ...[
        'attendance',
        'assessments',
        'results',
        'assignments',
        'syllabus',
      ],
      if (widget.role == MobileRole.admin) ...[
        'activity',
        'students',
        'employees',
      ],
      if (widget.role == MobileRole.teacher) 'assignments',
    };
    // Establish the selected child before loading independent dashboard sections.
    if (has('profile')) await fetchSection('profile', force: force);
    final pending = keys.where((key) => has(key) && key != 'profile').toList();
    for (var start = 0; start < pending.length; start += 3) {
      if (!mounted) return;
      await Future.wait(pending.skip(start).take(3).map((key) => fetchSection(key, force: force)));
    }
  }

  void fail(Object e, int ticket) {
    if (!mounted || ticket != generation) return;
    setState(() {
      busy = false;
      error = e.toString();
    });
    if (e is ApiException && e.status == 401) widget.onLogout();
  }

  /// Loads the open screen. [force] false (just navigating) reuses data already loaded; saves,
  /// pull-to-refresh and the first visit fetch from the server.
  Future<void> load({bool force = true}) async {
    if (selected == null || selected == '_more') {
      if (!force && screens.isNotEmpty) {
        unawaited(loadHome(generation, force: false));
        return;
      }
      await loadScreens(force: force);
      return;
    }
    if (selected == 'messages') return; // Chats load themselves (ChatHome).
    final key = selected!;
    if (!force && cache[key] != null && !dateScoped.contains(key)) {
      setState(() {
        busy = false;
        error = null;
      });
      if (key == 'fees' && has('payments')) unawaited(fetchSection('payments', force: false));
      return;
    }
    final ticket = ++generation;
    final epoch = studentEpoch;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await fetch(key);
      if (!mounted || epoch != studentEpoch) return;
      // Keep the data even if another screen was opened meanwhile; it is shown when you return.
      setState(() {
        cache[key] = result;
        fetchedAt[key] = DateTime.now();
        student ??= result['selected_student_code'] as String?;
        if (ticket == generation) busy = false;
        sectionErrors.remove(key);
      });
    } catch (e) {
      fail(e, ticket);
    }
  }

  /// Screens to return to with Back: a module opened from Home or More goes back there.
  final List<String?> history = [];

  /// Opens [key] (null is Home). [remember] keeps the current screen for Back; bottom-bar tabs
  /// pass false because they are top-level destinations whose Back returns Home.
  void open(String? key, {bool remember = true, bool restore = false}) {
    if (saving) return;
    if (!restore) scrolls[key ?? 'home']?.saved = 0;
    if (key == null) {
      history.clear();
    } else if (remember && key != selected) {
      history.add(selected);
      if (history.length > 20) history.removeAt(0);
    }
    generation++;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      selected = key;
      query = '';
      filter = 'All';
      error = null;
      search.clear();
      busy = false;
    });
    if (key == null) {
      if (screens.isNotEmpty) unawaited(loadHome(generation, force: false));
    } else if (key != '_more') {
      load(force: false);
    }
  }

  void goBack() {
    if (saving) return;
    open(history.isEmpty ? null : history.removeLast(), remember: false, restore: true);
  }

  void openTab(String? key) {
    history.clear();
    open(key, remember: false);
  }

  Future<void> confirmLogout() async {
    if (saving) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign out of Edu-Pragathi?'),
        content: const Text(
          'You will need your login ID and password to sign in again.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) await logout();
  }

  Future<void> refreshWorkspace() async {
    ApiFreshness.epoch++; // pull-to-refresh always reads fresh data
    await load();
    if (!mounted) return;
    if (error != null ||
        ((selected == null || selected == '_more') &&
            sectionErrors.isNotEmpty)) {
      throw StateError(error ?? 'Some college records could not refresh');
    }
  }

  Future<void> changeStudent(String value) async {
    generation++;
    studentEpoch++;
    fetchedAt.clear();
    setState(() {
      student = value;
      cache.clear();
    });
    if (selected == null) {
      await loadScreens();
    } else {
      await load();
    }
  }

  Future<void> action(Json descriptor, {Json initial = const {}}) async {
    if (saving || selected == null) return;
    final screen = selected!;
    final values = await Navigator.of(context).push<Json>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => ActionForm(
          action: descriptor,
          lookups: (data?['lookups'] as Json?) ?? {},
          initial: initial,
        ),
      ),
    );
    if (values == null || !mounted) return;
    setState(() => saving = true);
    try {
      final response = await widget.api.executeAction(
        screen,
        descriptor['key'],
        WorkspaceActionPayload(
          values: values,
          studentCode: student,
          formRevision: descriptor['form_revision'] as int?,
        ),
      );
      if (response.checkoutUrl != null) {
        final uri = Uri.parse(response.checkoutUrl!);
        if (uri.scheme != 'https' || uri.host.isEmpty) {
          throw ApiException('Invalid checkout address', 0);
        }
        if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
          throw ApiException('Unable to open checkout', 0);
        }
        if (mounted) {
          toast(
            'Checkout opened. Your balance updates after payment confirmation.',
          );
        }
      } else if (mounted) {
        toast('${descriptor['label']} completed.', success: true);
      }
      if (response.reauthenticate) {
        await widget.api.clear();
        if (mounted) widget.onLogout();
        return;
      }
      if (mounted) await load();
    } catch (e) {
      if (mounted) toast(e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  void toast(String text, {bool success = false}) =>
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              if (success) ...[
                const SizedBox(
                  width: 26,
                  height: 26,
                  child: EduArtwork(name: 'motion/success_check', height: 26),
                ),
                const SizedBox(width: 12),
              ],
              Expanded(child: Text(text)),
            ],
          ),
        ),
      );

  /// Opens a college PDF (logo, formatted) in the app; the viewer can share or save it.
  Future<void> openDocument(String kind, String code, String title) async {
    if (downloading) return;
    setState(() => downloading = true);
    toast('Opening $title…');
    try {
      final bytes = await widget.api.download(kind, code);
      if (!mounted) return;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      await Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => CertificatePdfScreen(bytes: bytes, title: title)));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        toast(e.toString());
      }
    } finally {
      if (mounted) setState(() => downloading = false);
    }
  }

  /// Opens a college PDF in the app (the viewer can save or share it) or, with [view] false,
  /// goes straight to save / share.
  Future<void> pdfDocument(Future<Uint8List> Function() load, String title, {bool view = true}) async {
    if (downloading) return;
    setState(() => downloading = true);
    toast(view ? 'Opening $title…' : 'Preparing $title…');
    try {
      final bytes = await load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      if (view) {
        await Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => CertificatePdfScreen(bytes: bytes, title: title)));
      } else {
        final box = context.findRenderObject() as RenderBox?;
        await SharePlus.instance.share(ShareParams(
          files: [XFile.fromData(bytes, mimeType: 'application/pdf')],
          fileNameOverrides: ['${title.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '-')}.pdf'],
          sharePositionOrigin: box == null ? null : box.localToGlobal(Offset.zero) & box.size,
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        toast(e.toString());
      }
    } finally {
      if (mounted) setState(() => downloading = false);
    }
  }

  /// "View" and "Download" for one PDF; wraps on narrow screens and large text.
  Widget pdfButtons(String title, Future<Uint8List> Function() load,
          {String view = 'View', String save = 'Download', Key? viewKey, VoidCallback? before}) =>
      Wrap(spacing: 8, runSpacing: 8, children: [
        FilledButton.tonalIcon(
          key: viewKey,
          onPressed: downloading
              ? null
              : () {
                  before?.call();
                  pdfDocument(load, title);
                },
          icon: const Icon(Icons.visibility_outlined, size: 18),
          label: Text(view),
        ),
        OutlinedButton.icon(
          onPressed: downloading
              ? null
              : () {
                  before?.call();
                  pdfDocument(load, title, view: false);
                },
          icon: const Icon(Icons.download_outlined, size: 18),
          label: Text(save),
        ),
      ]);

  /// A college report PDF opened in the app (view, save or share from the viewer).
  Future<void> openReport(String name, String title) async {
    if (downloading) return;
    setState(() => downloading = true);
    toast('Preparing $title…');
    try {
      final bytes = name.startsWith('ledger-')
          ? await widget.api.ledgerPdf(name.split('-')[1], mode: name.endsWith('-cash') ? 'cash' : 'all')
          : await widget.api.reportPdf(name);
      if (!mounted) return;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      await Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => CertificatePdfScreen(bytes: bytes, title: '$title report')));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        toast(e.toString());
      }
    } finally {
      if (mounted) setState(() => downloading = false);
    }
  }

  /// Taken | pending | remaining bar for one leave type (Paid leave 12, Sick leave 8 …).
  Widget leaveBar(BuildContext context, Json b) {
    final text = Theme.of(context).textTheme;
    final allowed = (b['allowed'] as num?)?.toInt() ?? 0, taken = (b['taken'] as num?)?.toInt() ?? 0;
    final pending = (b['pending'] as num?)?.toInt() ?? 0, left = (b['remaining'] as num?)?.toInt() ?? 0;
    final total = [allowed, taken + pending, 1].reduce((a, c) => a > c ? a : c);
    final accent = Theme.of(context).colorScheme.primary;
    return Semantics(
      label: '${b['name']}: $taken taken, $pending pending, $left remaining of $allowed',
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text('${b['name']}', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
          Text('$left of $allowed left', style: text.labelMedium?.copyWith(color: accent, fontWeight: FontWeight.w800)),
        ]),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: SizedBox(
            height: 12,
            child: Row(children: [
              if (taken > 0) Expanded(flex: taken, child: Container(color: accent)),
              if (pending > 0) Expanded(flex: pending, child: Container(color: collegeGold)),
              if (total - taken - pending > 0) Expanded(flex: total - taken - pending, child: Container(color: collegeCard)),
            ]),
          ),
        ),
        const SizedBox(height: 4),
        Text('$taken taken · $pending pending', style: text.bodySmall),
      ]),
    );
  }

  Future<void> download(String kind, String code) async {
    if (downloading) return;
    setState(() => downloading = true);
    toast('Preparing your document…');
    try {
      final bytes = kind == 'finance-report'
          ? await widget.api.downloadFinanceReport()
          : await widget.api.download(kind, code);
      if (!mounted) return;
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      final box = context.findRenderObject() as RenderBox?;
      await SharePlus.instance.share(
        ShareParams(
          files: [XFile.fromData(bytes, mimeType: 'application/pdf')],
          fileNameOverrides: ['$kind-$code.pdf'],
          sharePositionOrigin: box == null
              ? null
              : box.localToGlobal(Offset.zero) & box.size,
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        toast(e.toString());
      }
    } finally {
      if (mounted) setState(() => downloading = false);
    }
  }

  Future<void> enablePush() async {
    if (pushBusy) return;
    setState(() => pushBusy = true);
    try {
      final status = await push!.enable(
        register: (token, platform) async {
          await widget.api.registerDevice(
            DeviceRegistrationPayload(token: token, platform: platform),
          );
        },
      );
      if (status == 'Device alerts enabled') {
        await widget.api.storage.write(
          key: ApiConfig.pushPreferenceKey(widget.api.clientId),
          value: 'true',
        );
      } else if (status.startsWith('Notifications are blocked')) {
        // Don't ask again at every launch; the switch in the inbox still turns alerts on.
        await widget.api.storage.write(
          key: ApiConfig.pushPreferenceKey(widget.api.clientId),
          value: 'false',
        );
      }
      if (mounted) setState(() => pushStatus = status);
    } catch (e) {
      if (mounted) {
        setState(
          () => pushStatus = 'Device alerts could not connect. Try again.',
        );
      }
    } finally {
      if (mounted) setState(() => pushBusy = false);
    }
  }

  Future<void> logout() async {
    if (saving) return;
    try {
      await push?.unregister(
        (token) => widget.api.unregisterDevice(TokenPayload(token)),
      );
    } catch (_) {
      if (mounted) {
        toast('Could not disconnect device alerts. Try signing out again.');
      }
      return;
    }
    await push?.dispose();
    try {
      await widget.api.logout();
    } catch (_) {}
    if (mounted) widget.onLogout();
  }

  Future<void> loadMore() async {
    if (paging) return;
    final key = selected!, ticket = generation;
    final existing = rows(key);
    setState(() => paging = true);
    try {
      final result = (await widget.api.workspace(
        key,
        query: workspaceQuery(key, offset: existing.length),
      )).toJson();
      if (mounted && ticket == generation) {
        setState(
          () => cache[key] = {
            ...cache[key]!,
            'items': [...existing, ...result['items']],
          },
        );
      }
    } catch (e) {
      if (mounted) toast(e.toString());
    } finally {
      if (mounted) setState(() => paging = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = selected == null
        ? widget.title
        : selected == '_more'
        ? 'Your workspace'
        : (screens.where((s) => s['key'] == selected).firstOrNull?['title'] ??
                  'College')
              .toString();
    final pageWidgets = <Widget>[
      if (selected != null && selected != '_more') ...[
        Text(title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 16),
      ],
      if (busy || saving || downloading) ...[
        const LinearProgressIndicator(minHeight: 3),
        if ((selected == null && cache.isEmpty) ||
            (selected != null && data == null))
          const EduLoadingSkeleton(),
      ],
      if (error != null)
        WorkspaceMessage(
          icon: Icons.cloud_off_outlined,
          title: 'Couldn’t load this screen',
          message: error!,
          onRetry: load,
        ),
      if (selected == null)
        ...home(context)
      else if (selected == '_more')
        ...modules(context)
      else if (data != null)
        ...screenContent(context),
    ];
    return PopScope(
      canPop: selected == null,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) goBack();
      },
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          leading: selected == null
              ? null
              : IconButton(
                  tooltip: 'Back',
                  onPressed: saving ? null : goBack,
                  icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
                ),
          titleSpacing: selected == null ? 20 : 0,
          title: Tooltip(
            message: 'Go to home',
            child: InkWell(
              onTap: saving ? null : () => open(null),
              borderRadius: BorderRadius.circular(10),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // App logo in a circle at the left end of the title.
                    Container(
                      key: const ValueKey('appbar-logo'),
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: collegeIvory,
                        border: Border.all(
                          color: Theme.of(context).colorScheme.primary.withValues(alpha: .25),
                        ),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: Transform.scale(
                        // The icon art has a rounded-square margin; crop into it.
                        scale: 1.18,
                        child: Image.asset(
                          'assets/icons/image.png',
                          fit: BoxFit.cover,
                          cacheWidth: 160,
                          filterQuality: FilterQuality.medium,
                          errorBuilder: (context, error, stack) => const SizedBox.shrink(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Flexible(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Edu Desk'),
                          Text(
                            selected == null ? widget.title : title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          actions: [
            // Inbox: a highlighted round bell, filled while the inbox is open.
            if (has('notifications'))
              Padding(
                padding: const EdgeInsets.only(right: 4),
                child: IconButton(
                  tooltip: 'Notifications',
                  onPressed: saving ? null : () => open('notifications'),
                  style: IconButton.styleFrom(
                    backgroundColor: selected == 'notifications'
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.primary.withValues(alpha: .12),
                    foregroundColor: selected == 'notifications'
                        ? collegeIvory
                        : Theme.of(context).colorScheme.primary,
                    shape: const CircleBorder(),
                  ),
                  icon: Badge(
                    isLabelVisible: unread > 0,
                    label: Text(unread > 99 ? '99+' : '$unread'),
                    child: Icon(
                      selected == 'notifications'
                          ? Icons.notifications_rounded
                          : Icons.notifications_outlined,
                    ),
                  ),
                ),
              ),
            IconButton(
              tooltip: 'Sign out',
              onPressed: saving ? null : confirmLogout,
              icon: const Icon(Icons.logout),
            ),
          ],
        ),
        bottomNavigationBar: EduFloatingNavBar(
          selectedIndex: tab,
          onDestinationSelected: saving
              ? null
              : (i) => openTab(
                  [
                    has(primary) ? primary : '_more',
                    has(secondary) ? secondary : '_more',
                    null,
                    'messages',
                    '_more',
                  ][i],
                ),
          items: [
            EduNavItem(moduleIcon(primary), primaryLabel),
            EduNavItem(
              widget.role == MobileRole.admin || cashClerk ? moduleIcon(secondary) : Icons.view_week_outlined,
              secondaryLabel,
            ),
            const EduNavItem(Icons.house_rounded, 'Home'),
            EduNavItem(Icons.forum_rounded, 'Chats', badge: chatUnread),
            const EduNavItem(Icons.grid_view_rounded, 'More'),
          ],
        ),
        body: SafeArea(
          top: false,
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 900),
              child: selected == 'messages' ? ChatHome(key: ValueKey('chats-${chatThread ?? ''}'), api: widget.api, openThread: chatThread, onUnread: (n) { chatThread = null; if (mounted && n != chatUnread) setState(() => chatUnread = n); }) : selected == 'academics' || selected == 'results' ? AcademicHub(key:ValueKey('academic-$student-$generation'),api:widget.api,role:widget.role,studentCode:student??'',onOpenFees:()=>open('fees')) : selected == 'assessments' ? AssessmentHub(key:ValueKey('assessments-$student-$generation'),api:widget.api,role:widget.role,studentCode:student??'') : selected == 'assignments' || selected == 'submissions'
                  ? AssignmentHub(
                      key: ValueKey(
                        'assignment-$selected-$student-$generation',
                      ),
                      api: widget.api,
                      role: widget.role,
                      title: title,
                    )
                  : selected == 'attendance'
                  ? AttendanceHub(key: ValueKey('attendance-$student-$generation'), api: widget.api, role: widget.role, title: title, studentCode: student ?? '')
                  : selected == 'calendar'
                  ? CalendarHub(api: widget.api, role: widget.role, title: title)
                  : selected == 'syllabus'
                  ? SyllabusHub(api: widget.api, role: widget.role, title: title)
                  : EduNexaAnimatedRefresh(
                      onRefresh: refreshWorkspace,
                      child: AnimatedSwitcher(
                        duration: EduMotion.duration(context, EduMotion.tab),
                        child: ListView.builder(
                          key: ValueKey('page-${selected ?? 'home'}'),
                          // Back returns to where you were; opening a screen afresh starts at the top.
                          controller: pageScroll(selected ?? 'home'),
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                          itemCount: pageWidgets.length,
                          itemBuilder: (context, index) => pageWidgets[index],
                        ),
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> home(BuildContext context) {
    final person = rows('profile').firstOrNull;
    final name = person == null
        ? ''
        : [
            person['first_name'],
            person['last_name'],
          ].where((v) => v != null).join(' ');
    final today = DateTime.now();
    final greeting = today.hour < 12
        ? 'Good morning'
        : today.hour < 17
        ? 'Good afternoon'
        : 'Good evening';
    final role = widget.role;
    final periods =
        rows(
          'timetable',
        ).where((r) => '${r['weekday']}' == '${today.weekday}').toList()..sort(
          (a, b) =>
              '${a['start_time'] ?? ''}'.compareTo('${b['start_time'] ?? ''}'),
        );
    final events =
        rows(
          'calendar',
        ).where((r) => eventEnd(r)?.isBefore(today) != true).toList()..sort(
          (a, b) =>
              '${a['starts_at'] ?? ''}'.compareTo('${b['starts_at'] ?? ''}'),
        );
    final announcements = rows('announcements').toList()
      ..sort(
        (a, b) => '${b['published_at'] ?? ''}'.compareTo(
          '${a['published_at'] ?? ''}',
        ),
      );
    final children =
        (cache['profile']?['students'] as List? ??
                cache[primary]?['students'] as List? ??
                [])
            .cast<Json>();
    final summary = cache[primary]?['summary'] as Json?;
    final priorities = switch (role) {
      MobileRole.admin => ['change-requests', 'cash', 'cash-analytics', 'dues', 'collections', 'students', 'reports'],
      MobileRole.teacher when cashClerk => ['cash', 'leave', 'payslips', 'tax-documents'],
      MobileRole.teacher when labIncharge => ['labs', 'timetable', 'leave', 'payslips', 'tax-documents'],
      MobileRole.teacher => [
        'attendance',
        'assessments',
        'assignments',
        'submissions',
        'results',
      ],
      MobileRole.parent => [
        'attendance',
        'timetable',
        'fees',
        'results',
        'assignments',
        'messages',
      ],
      MobileRole.student => ['assessments', 'syllabus', 'results', 'fees', 'messages'],
    };
    List<Widget> records(String key, String heading, {int limit = 2}) =>
        has(key)
        ? [
            SectionHeading(
              title: heading,
              action: 'View all',
              onAction: () => open(key),
            ),
            if (sectionErrors[key] != null)
              sectionFailure(key)
            else if (cache[key] == null && busy)
              const EduLoadingSkeleton()
            else if (rows(key).isEmpty)
              QuietEmpty(
                icon: moduleIcon(key),
                title: emptyTitle(key),
                message: emptyDescription(key),
              )
            else
              ...rows(key)
                  .take(limit)
                  .map(
                    (r) => CampusRecord(
                      record: r,
                      screen: key,
                      onTap: () => open(key),
                    ),
                  ),
          ]
        : [];
    final teaching = role == MobileRole.teacher;
    final learning = role == MobileRole.student;
    final family = role == MobileRole.parent;
    final schedule = labIncharge
        ? <Widget>[
            SectionHeading(title: 'Today’s lab sessions', action: 'Labs', onAction: () => open('labs')),
            if (sectionErrors['labs'] != null)
              sectionFailure('labs')
            else if (cache['labs'] == null && busy)
              const EduLoadingSkeleton()
            else if (rows('labs').isEmpty)
              const QuietEmpty(icon: Icons.science_outlined, title: 'No lab sessions today', message: 'Open Labs to see another day.')
            else
              ...rows('labs').take(3).map((r) => labSessionCard(context, r, compact: true)),
          ]
        : has('timetable')
        ? <Widget>[
            SectionHeading(
              title: teaching ? 'Today’s classes' : 'Today’s schedule',
              action: 'Timetable',
              onAction: () => open('timetable'),
            ),
            if (sectionErrors['timetable'] != null)
              sectionFailure('timetable')
            else if (periods.isEmpty)
              const QuietEmpty(
                icon: Icons.wb_sunny_outlined,
                title: 'No classes scheduled today',
                message: 'Choose a different day in your timetable.',
              )
            else
              ...periods
                  .take(3)
                  .map(
                    (r) => CampusRecord(
                      record: r,
                      screen: 'timetable',
                      onTap: () => open('timetable'),
                    ),
                  ),
          ]
        : <Widget>[];
    if (teaching || role == MobileRole.admin) {
      return staffHome(
        context,
        name: name,
        greeting: greeting,
        today: today,
        events: events,
        announcements: announcements,
        summary: summary,
        priorities: priorities,
        records: records,
      );
    }
    return [
      EduReveal(
        key: ValueKey('greeting-${role.name}-$student'),
        child: EduGreeting(
          name: name,
          greeting: greeting,
          role: role.label,
          description: role.description,
          date: prettyDate(today),
          artwork: switch (role) {
            MobileRole.admin => 'academic_campus',
            MobileRole.teacher => 'teacher_workspace',
            MobileRole.parent => 'parent_student',
            MobileRole.student => 'student_studying',
          },
          onProfile: has('profile') ? () => open('profile') : null,
        ),
      ),
      if (children.length > 1) ...[
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          key: ValueKey('home-child-$student'),
          initialValue: student,
          isExpanded: true,
          decoration: const InputDecoration(
            labelText: 'Viewing student',
            prefixIcon: Icon(Icons.family_restroom_outlined),
          ),
          items: children
              .map(
                (s) => DropdownMenuItem<String>(
                  value: s['code'],
                  child: Text(s['name']),
                ),
              )
              .toList(),
          onChanged: (v) {
            if (v != null) changeStudent(v);
          },
        ),
      ],
      if (family && children.isNotEmpty)
        Card(
          child: ListTile(
            leading: const EduModuleIcon(icon: Icons.groups_outlined),
            title: Text(
              '${children.where((c) => c['code'] == student).firstOrNull?['name'] ?? children.first['name']}',
            ),
            subtitle: const Text('Selected child'),
            trailing: const Icon(Icons.chevron_right),
            onTap: has('children') ? () => open('children') : null,
          ),
        ),
      if (teaching || learning) ...schedule,
      if (teaching && periods.isNotEmpty) ...[
        SectionHeading(title: 'Next scheduled period'),
        NextPeriodCard(periods: periods, onOpen: () => open('timetable')),
      ],
      if(has('academics')||has('results')) AcademicOverview(key:ValueKey('academic-home-$student-$generation'),api:widget.api,studentCode:student??'',onOpen:()=>open(has('academics')?'academics':'results')),
      if (learning) ...records('assignments', 'Your assignments'),
      if (role == MobileRole.admin) ...[
        SectionHeading(
          title: 'College finances',
          action: 'Finance',
          onAction: () => open('overview'),
        ),
        if (summary != null)
          EduReveal(
            order: 1,
            child: SummaryPanel(
              summary: summary,
              financial: true,
              compact: true,
            ),
          ),
        if (sectionErrors[primary] != null) sectionFailure(primary),
        if (summary != null) FinanceComposition(summary: summary),
        if (cache['students']?['total'] != null ||
            cache['employees']?['total'] != null)
          MetricStrip(
            metrics: [
              if (cache['students']?['total'] != null)
                (
                  'Students',
                  '${cache['students']!['total']}',
                  Icons.groups_outlined,
                ),
              if (cache['employees']?['total'] != null)
                (
                  'Employees',
                  '${cache['employees']!['total']}',
                  Icons.people_outline,
                ),
            ],
          ),
      ],
      if (family) ...[
        SectionHeading(title: 'Academic snapshot'),
        EduReveal(
          order: 1,
          child: AttendanceOverview(key: ValueKey('attendance-overview-$student-$generation'), api: widget.api, studentCode: student ?? ''),
        ),
      ],
      if (family || learning)
        ...records('results', 'Published results', limit: 1),
      if (family && summary != null) ...[
        SectionHeading(
          title: 'Fees at a glance',
          action: 'Review fees',
          onAction: () => open('fees'),
        ),
        SummaryPanel(summary: summary, financial: true, compact: true),
      ],
      SectionHeading(
        title: teaching
            ? 'Teaching tools'
            : family
            ? 'For your child'
            : learning
            ? 'Learning & self-service'
            : 'Campus tools',
        action: 'View all',
        onAction: () => open('_more'),
      ),
      EduReveal(
        order: 2,
        child: shortcutGrid(
          priorities
              .where(has)
              .map((k) => screens.firstWhere((s) => s['key'] == k))
              .toList(),
          compact: true,
        ),
      ),
      if (teaching) ...[
        SectionHeading(title: 'Teaching overview'),
        MetricStrip(
          metrics: [
            (
              'Assigned classes',
              '${cache['classes']?['total'] ?? '—'}',
              Icons.groups_outlined,
            ),
            (
              'Today’s periods',
              sectionErrors['timetable'] == null ? '${periods.length}' : '—',
              Icons.schedule_outlined,
            ),
          ],
        ),
        ...records('assignments', 'Assignments & grading', limit: 1),
        SectionHeading(title: 'Employee self-service'),
        shortcutGrid(
          ['leave', 'payslips', 'tax-documents']
              .where(has)
              .map((k) => screens.firstWhere((s) => s['key'] == k))
              .toList(),
          compact: true,
        ),
      ],
      if (family) ...schedule,
      if (learning) ...records('syllabus', 'Learning resources', limit: 1),
      if (role == MobileRole.admin)
        ...records('activity', 'Recent activity', limit: 3),
      if (has('calendar')) ...[
        SectionHeading(
          title: 'Upcoming events',
          action: 'Calendar',
          onAction: () => open('calendar'),
        ),
        if (sectionErrors['calendar'] != null)
          sectionFailure('calendar')
        else if (events.isEmpty)
          const QuietEmpty(
            icon: Icons.event_available_outlined,
            title: 'No upcoming events',
            message: 'Published college events will appear here.',
          )
        else
          ...events
              .take(2)
              .map(
                (r) => CampusRecord(
                  record: r,
                  screen: 'calendar',
                  onTap: () => open('calendar'),
                ),
              ),
      ],
      if (has('announcements')) ...[
        SectionHeading(
          title: 'College notices',
          action: 'View all',
          onAction: () => open('announcements'),
        ),
        if (sectionErrors['announcements'] != null)
          sectionFailure('announcements')
        else if (announcements.isEmpty)
          const QuietEmpty(
            icon: Icons.campaign_outlined,
            title: 'No announcements yet',
            message: 'College news and notices will appear here.',
          )
        else
          ...announcements
              .take(2)
              .map((r) => CampusRecord(record: r, screen: 'announcements')),
      ],
      if (unread > 0)
        Card(
          child: ListTile(
            leading: const EduModuleIcon(icon: Icons.notifications_outlined),
            title: Text('$unread unread ${unread == 1 ? 'alert' : 'alerts'}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => open('notifications'),
          ),
        ),
      const SizedBox(height: 20),
      OutlinedButton.icon(
        onPressed: () => open('_more'),
        icon: const Icon(Icons.grid_view_outlined),
        label: const Text('Explore your workspace'),
      ),
    ];
  }

  // ---------------------------------------------------------------------------
  // Staff home (teachers, lab in-charges and administrators): the same layout language as the
  // parent / student home — one hero card with today's figures, a timeline, quick actions,
  // notices and events.

  /// Teaching periods (no break / lunch) for one weekday, in time order.
  List<Json> periodsOn(int weekday) =>
      rows(labIncharge ? 'labs' : 'timetable')
          .where((r) => '${r['weekday']}' == '$weekday' || (labIncharge && r['weekday'] == null))
          .where((r) => r['kind'] != 'break' && r['kind'] != 'lunch')
          .toList()
        ..sort((a, b) => '${a['start_time'] ?? ''}'.compareTo('${b['start_time'] ?? ''}'));

  /// Today's periods, or the next class day's when today has none (e.g. Sunday).
  ({DateTime day, List<Json> periods, bool today}) nextClassDay() {
    final now = DateUtils.dateOnly(DateTime.now());
    final todays = periodsOn(now.weekday);
    if (todays.isNotEmpty || labIncharge) return (day: now, periods: todays, today: true);
    for (var i = 1; i <= 7; i++) {
      final day = now.add(Duration(days: i));
      final found = periodsOn(day.weekday);
      if (found.isNotEmpty) return (day: day, periods: found, today: false);
    }
    return (day: now, periods: const [], today: true);
  }

  Json? get cashSummary => cache['cash']?['summary'] as Json?;

  /// Clerk home: the cash handed to this clerk that is not settled yet, newest first.
  List<Widget> clerkCashSection(BuildContext context) {
    final text = Theme.of(context).textTheme;
    const labels = {
      'assigned': ('Collect from accounts', EduTints.gold),
      'collected': ('Deposit in the bank', EduTints.clay),
      'deposited': ('Upload the bank slip', EduTints.mist),
      'awaiting_review': ('Slip with admin for review', EduTints.sage),
    };
    final open = rows('cash').where((t) => labels.containsKey('${t['status']}')).toList();
    return [
      SectionHeading(title: 'Cash to deposit', action: 'Cash deposits', onAction: () => this.open('cash')),
      if (sectionErrors['cash'] != null)
        sectionFailure('cash')
      else if (cache['cash'] == null && busy)
        const EduCardSkeleton(height: 110)
      else if (open.isEmpty)
        const QuietEmpty(
          icon: Icons.account_balance_wallet_outlined,
          title: 'No cash with you',
          message: 'Cash the accounts office hands you for the bank appears here.',
        )
      else
        for (final t in open.take(4))
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Material(
              color: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: EduWorkspace.border)),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => this.open('cash'),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Row(children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(color: labels['${t['status']}']!.$2, borderRadius: BorderRadius.circular(12)),
                      child: Icon(Icons.payments_outlined, size: 20, color: EduTints.ink(labels['${t['status']}']!.$2)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(money(t['status'] == 'assigned' ? t['amount'] : t['with_clerk']), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 2),
                        Text(labels['${t['status']}']!.$1, style: text.bodySmall),
                      ]),
                    ),
                    const Icon(Icons.chevron_right_rounded),
                  ]),
                ),
              ),
            ),
          ),
    ];
  }

  Widget staffHeroCard(BuildContext context, {required String name, required String greeting, required DateTime today, Json? summary}) {
    final text = Theme.of(context).textTheme;
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    final admin = widget.role == MobileRole.admin;
    final totals = summary?['totals'] is Map ? Map<String, dynamic>.from(summary!['totals'] as Map) : summary;
    final todays = periodsOn(today.weekday);
    final tiles = admin
        ? [
            (Icons.groups_outlined, EduTints.mist, 'Students', '${cache['students']?['total'] ?? '—'}', cache['students'] == null && busy, has('students') ? () => open('students') : null),
            (Icons.account_balance_wallet_outlined, EduTints.clay, 'Outstanding', totals?['outstanding'] == null ? '—' : money(totals!['outstanding']), cache[primary] == null && busy, has('dues') ? () => open('dues') : null),
            (Icons.notifications_none_rounded, EduTints.plum, unread == 1 ? 'Alert' : 'Alerts', '$unread', cache['notifications'] == null && busy, has('notifications') ? () => open('notifications') : null),
          ]
        : cashClerk
        ? [
            (Icons.account_balance_wallet_outlined, EduTints.clay, 'With me', cashSummary?['in_hand'] == null ? '—' : money(cashSummary!['in_hand']), cache['cash'] == null && busy, () => open('cash')),
            (Icons.move_to_inbox_outlined, EduTints.gold, 'To collect', '${cashSummary?['to_collect'] ?? '—'}', cache['cash'] == null && busy, () => open('cash')),
            (Icons.upload_file_outlined, EduTints.mist, 'To upload', '${cashSummary?['to_upload'] ?? '—'}', cache['cash'] == null && busy, () => open('cash')),
          ]
        : labIncharge
        ? [
            (Icons.science_outlined, EduTints.mist, 'Lab sessions', '${rows('labs').length}', cache['labs'] == null && busy, () => open('labs')),
            (Icons.groups_outlined, EduTints.gold, 'Students', '${rows('labs').fold<num>(0, (sum, r) => sum + (((r['counts'] as Map?)?['total'] as num?) ?? 0))}', cache['labs'] == null && busy, () => open('labs')),
            (Icons.notifications_none_rounded, EduTints.plum, unread == 1 ? 'Alert' : 'Alerts', '$unread', cache['notifications'] == null && busy, has('notifications') ? () => open('notifications') : null),
          ]
        : [
            (Icons.schedule_rounded, EduTints.gold, 'Today', '${todays.length}', cache['timetable'] == null && busy, has('timetable') ? () => open('timetable') : null),
            (Icons.class_outlined, EduTints.mist, 'My classes', '${cache['classes']?['total'] ?? '—'}', cache['classes'] == null && busy, has('classes') ? () => open('classes') : null),
            (Icons.notifications_none_rounded, EduTints.plum, unread == 1 ? 'Alert' : 'Alerts', '$unread', cache['notifications'] == null && busy, has('notifications') ? () => open('notifications') : null),
          ];
    Widget tile((IconData, Color, String, String, bool, VoidCallback?) t) {
      final (icon, tint, label, value, loading, onTap) = t;
      final ink = EduTints.ink(tint);
      return Expanded(
        child: Semantics(
          button: onTap != null,
          label: loading ? '$label: loading' : '$label: $value',
          excludeSemantics: true,
          child: Material(
            color: tint,
            borderRadius: BorderRadius.circular(18),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: .7), shape: BoxShape.circle),
                    child: Icon(icon, size: 17, color: ink),
                  ),
                  const SizedBox(height: 10),
                  loading
                      ? const EduShimmer(child: EduSkeletonBox(width: 40, height: 18))
                      : FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(value, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: ink)),
                        ),
                  Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.labelMedium?.copyWith(color: ink, fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xffe8efe2), Color(0xffe3ebee)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: collegeLine),
        boxShadow: [BoxShadow(color: collegeEspresso.withValues(alpha: .06), blurRadius: 18, offset: const Offset(0, 8))],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('$greeting · ${weekdays[today.weekday - 1]}, ${today.day} ${months[today.month - 1]}', maxLines: 1, overflow: TextOverflow.ellipsis, style: text.labelMedium),
              const SizedBox(height: 2),
              Row(children: [
                Flexible(
                  child: Text(name.isEmpty ? 'Welcome' : name, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                ),
                if (has('profile'))
                  IconButton(
                    tooltip: 'Profile',
                    visualDensity: VisualDensity.compact,
                    onPressed: () => open('profile'),
                    icon: const Icon(Icons.person_outline_rounded, size: 20),
                  ),
              ]),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: collegeIvory, borderRadius: BorderRadius.circular(99), border: Border.all(color: collegeLine)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(admin ? Icons.admin_panel_settings_outlined : cashClerk ? Icons.account_balance_wallet_outlined : labIncharge ? Icons.science_outlined : Icons.school_outlined, size: 16),
                  const SizedBox(width: 6),
                  Flexible(
                    child: Text(
                      admin ? 'College administration' : cashClerk ? 'Cash clerk' : labIncharge ? 'Lab in-charge' : 'Faculty',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.labelLarge?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                ]),
              ),
            ]),
          ),
          if (MediaQuery.sizeOf(context).width >= 340 && MediaQuery.textScalerOf(context).scale(16) <= 22) ...[
            const SizedBox(width: 8),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * .3, maxHeight: 92),
              child: FittedBox(
                fit: BoxFit.contain,
                child: EduArtwork(name: admin ? 'illustrations/academic_campus' : 'illustrations/teacher_workspace', height: 92),
              ),
            ),
          ],
        ]),
        const SizedBox(height: 14),
        LayoutBuilder(builder: (context, constraints) {
          final stacked = constraints.maxWidth < 300 || MediaQuery.textScalerOf(context).scale(16) > 22;
          return stacked
              ? Column(children: [
                  for (final t in tiles) ...[Row(children: [tile(t)]), const SizedBox(height: 8)],
                ])
              : Row(children: [tile(tiles[0]), const SizedBox(width: 8), tile(tiles[1]), const SizedBox(width: 8), tile(tiles[2])]);
        }),
      ]),
    );
  }

  /// A period on the home timeline: time, coloured type, title, class and room; "Now" when live.
  Widget timelinePeriod(BuildContext context, Json r, {required bool live, VoidCallback? onTap}) {
    final text = Theme.of(context).textTheme;
    final style = periodStyle('${r['kind'] ?? 'theory'}');
    final details = [
      if ('${r['section_name'] ?? ''}'.isNotEmpty) 'Section ${r['section_name']}',
      if ('${r['course_name'] ?? r['program_name'] ?? ''}'.isNotEmpty) '${r['course_name'] ?? r['program_name']}',
      if ('${r['room'] ?? r['room_number'] ?? ''}'.isNotEmpty) 'Room ${r['room'] ?? r['room_number']}',
    ].join(' · ');
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          width: 62,
          child: Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(hm('${r['start_time']}'), style: text.labelMedium?.copyWith(fontWeight: FontWeight.w800)),
              Text(hm('${r['end_time']}'), style: text.labelSmall),
            ]),
          ),
        ),
        Expanded(
          child: Material(
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: live ? Theme.of(context).colorScheme.primary : EduWorkspace.border, width: live ? 1.6 : 1),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(color: style.tint, borderRadius: BorderRadius.circular(10)),
                    child: Icon(style.icon, size: 19, color: EduTints.ink(style.tint)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(
                          child: Text('${r['title'] ?? r['subject_name'] ?? style.label}', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(color: style.tint, borderRadius: BorderRadius.circular(99)),
                          child: Text(live ? 'Now' : style.label, style: text.labelSmall?.copyWith(fontWeight: FontWeight.w700, color: EduTints.ink(style.tint))),
                        ),
                      ]),
                      if (details.isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(details, style: text.bodySmall),
                      ],
                    ]),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ]),
    );
  }

  List<Widget> staffHome(
    BuildContext context, {
    required String name,
    required String greeting,
    required DateTime today,
    required List<Json> events,
    required List<Json> announcements,
    required Json? summary,
    required List<String> priorities,
    required List<Widget> Function(String key, String heading, {int limit}) records,
  }) {
    final admin = widget.role == MobileRole.admin;
    final next = nextClassDay();
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    final now = DateTime.now();
    final minutesNow = now.hour * 60 + now.minute;
    int minutes(Object? v) {
      final p = '${v ?? ''}'.split(':');
      return (int.tryParse(p.first) ?? 0) * 60 + (int.tryParse(p.length > 1 ? p[1] : '') ?? 0);
    }
    final scheduleKey = labIncharge ? 'labs' : 'timetable';
    return [
      EduReveal(
        key: ValueKey('staff-hero-${widget.role.name}'),
        child: staffHeroCard(context, name: name, greeting: greeting, today: today, summary: summary),
      ),
      if (cashClerk) ...clerkCashSection(context),
      if (!admin && !cashClerk && has(scheduleKey)) ...[
        SectionHeading(
          title: labIncharge
              ? 'Today’s lab sessions'
              : next.today
              ? 'Today’s classes'
              : '${dayNames[next.day.weekday - 1]}’s classes',
          action: labIncharge ? 'Labs' : 'Timetable',
          onAction: () => open(scheduleKey),
        ),
        if (!next.today)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              today.weekday == 7 ? 'No classes on Sunday — here is your next class day.' : 'No classes today — here is your next class day.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        if (sectionErrors[scheduleKey] != null)
          sectionFailure(scheduleKey)
        else if (cache[scheduleKey] == null && busy)
          const EduCardSkeleton(height: 120)
        else if (next.periods.isEmpty)
          QuietEmpty(
            icon: labIncharge ? Icons.science_outlined : Icons.wb_sunny_outlined,
            title: labIncharge ? 'No lab sessions today' : 'No classes in your timetable yet',
            message: labIncharge
                ? 'Open Labs to see another day.'
                : 'Your weekly timetable appears here once the college publishes it.',
          )
        else
          for (final r in next.periods.take(labIncharge ? 3 : 6))
            labIncharge
                ? labSessionCard(context, r, compact: true)
                : timelinePeriod(
                    context,
                    r,
                    live: next.today && minutes(r['start_time']) <= minutesNow && minutesNow < minutes(r['end_time']),
                    onTap: () => open('timetable'),
                  ),
      ],
      if (admin && has('overview')) ...[
        SectionHeading(title: 'College finances', action: 'Finance', onAction: () => open('overview')),
        if (summary != null)
          EduReveal(order: 1, child: SummaryPanel(summary: summary, financial: true, compact: true)),
        if (sectionErrors[primary] != null) sectionFailure(primary),
        if (summary != null) FinanceComposition(summary: summary),
      ],
      SectionHeading(title: 'Quick actions', action: 'View all', onAction: () => open('_more')),
      EduReveal(
        order: 2,
        child: EduGrid(
          fold: 3,
          spacing: 10,
          children: [
            for (final (i, key) in ['messages', ...<String>{...priorities, if (!admin) ...['leave', 'payslips', 'tax-documents']}.where((k) => k != 'messages' && has(k))].take(admin ? 6 : 8).indexed)
              EduQuickAction(
                key: ValueKey('quick-$key'),
                label: key == 'messages' ? (chatUnread > 0 ? 'Chats · $chatUnread new' : 'Chats') : '${screens.firstWhere((s) => s['key'] == key)['title']}',
                icon: key == 'messages' ? Icons.forum_rounded : moduleIcon(key),
                tint: EduTints.all[i % EduTints.all.length],
                onTap: key == 'messages' ? openChat : () => open(key),
              ),
          ],
        ),
      ),
      if (!admin && !labIncharge && !cashClerk && has('assignments')) ...records('assignments', 'Assignments & grading', limit: 1),
      if (admin) ...records('activity', 'Recent activity', limit: 3),
      if (has('announcements')) ...[
        SectionHeading(title: 'Updates', action: 'View all', onAction: () => open('announcements')),
        if (sectionErrors['announcements'] != null)
          sectionFailure('announcements')
        else if (announcements.isEmpty)
          const QuietEmpty(icon: Icons.campaign_outlined, title: 'No announcements yet', message: 'College news and notices will appear here.')
        else
          LayoutBuilder(
            builder: (context, constraints) => SizedBox(
              height: EduSizes.scaled(context, 170),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: announcements.take(6).length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (context, i) {
                  final notice = announcements[i];
                  final published = DateTime.tryParse('${notice['published_at'] ?? ''}');
                  return SizedBox(
                    width: (constraints.maxWidth * .82).clamp(240.0, 340.0),
                    child: EduUpdateCard(
                      title: '${notice['title'] ?? 'College notice'}',
                      body: '${notice['body'] ?? ''}',
                      date: published == null ? '' : prettyDate(published),
                      category: 'Notice',
                      tint: EduTints.all[(i + 1) % EduTints.all.length],
                      onTap: () => open('announcements'),
                    ),
                  );
                },
              ),
            ),
          ),
      ],
      if (has('calendar')) ...[
        SectionHeading(title: 'Upcoming events', action: 'Calendar', onAction: () => open('calendar')),
        if (sectionErrors['calendar'] != null)
          sectionFailure('calendar')
        else if (events.isEmpty)
          const QuietEmpty(icon: Icons.event_available_outlined, title: 'No upcoming events', message: 'Published college events will appear here.')
        else
          ...events.take(2).map((r) => CampusRecord(record: r, screen: 'calendar', onTap: () => open('calendar'))),
      ],
      const SizedBox(height: 20),
      OutlinedButton.icon(
        onPressed: () => open('_more'),
        icon: const Icon(Icons.grid_view_outlined),
        label: const Text('Explore your workspace'),
      ),
    ];
  }

  Widget sectionFailure(String key) => WorkspaceMessage(
    icon: Icons.cloud_off_outlined,
    title: 'Updates unavailable',
    message: sectionErrors[key]!,
    onRetry: () => fetchSection(key),
  );

  Widget shortcutGrid(List<Json> definitions, {bool compact = false}) =>
      LayoutBuilder(
        builder: (context, constraints) {
          final columns =
              MediaQuery.textScalerOf(context).scale(16) > 22 ||
                  constraints.maxWidth < 300
              ? 1
              : constraints.maxWidth >= 760
              ? 4
              : constraints.maxWidth >= 540
              ? 3
              : 2;
          final width = (constraints.maxWidth - (columns - 1) * 12) / columns;
          return Wrap(
            spacing: 12,
            runSpacing: 12,
            children: definitions
                .map(
                  (s) => SizedBox(
                    width: width,
                    child: ModuleShortcut(
                      key: ValueKey(
                        '${compact ? 'quick' : 'module'}-${s['key']}',
                      ),
                      title: s['title'],
                      compact: compact,
                      icon: moduleIcon(s['key']),
                      onTap: () => open(s['key']),
                    ),
                  ),
                )
                .toList(),
          );
        },
      );

  // ---------------------------------------------------------------------------
  // Workspace (More): search, quick actions and expandable categories, all driven by the
  // module registry in presentations.dart (moduleGroup / workspaceIcon / workspaceKeywords).

  final Set<String> collapsedCategories = {};
  String? categoryFilter;

  /// Frequently used modules shown as quick actions, in priority order per role.
  List<(String, String)> get quickActionKeys => switch (widget.role) {
    MobileRole.parent || MobileRole.student => const [
      ('fees', 'Pay fees'),
      ('leave', 'Apply leave'),
      ('messages', 'Messages'),
      ('attendance', 'Attendance'),
      ('certificates', 'Certificates'),
      ('timetable', 'Timetable'),
    ],
    MobileRole.teacher => const [
      ('attendance', 'Attendance'),
      ('assignments', 'Homework'),
      ('messages', 'Messages'),
      ('leave', 'Apply leave'),
      ('timetable', 'Timetable'),
    ],
    _ => const [
      ('collections', 'Collections'),
      ('admissions', 'Admissions'),
      ('students', 'Students'),
      ('announcements', 'Announce'),
      ('dues', 'Dues'),
    ],
  };

  Future<void> chooseCategory(List<String> available) async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (sheet) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          children: [
            Text('Show modules', style: Theme.of(sheet).textTheme.titleLarge),
            const SizedBox(height: 8),
            for (final option in ['', ...available])
              ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                leading: Icon(option.isEmpty ? Icons.apps_rounded : workspaceCategories.firstWhere((c) => c.title == option).icon),
                title: Text(option.isEmpty ? 'All modules' : option),
                trailing: (categoryFilter ?? '') == option ? Icon(Icons.check_rounded, color: Theme.of(sheet).colorScheme.primary) : null,
                onTap: () => Navigator.pop(sheet, option),
              ),
          ],
        ),
      ),
    );
    if (picked != null && mounted) setState(() => categoryFilter = picked.isEmpty ? null : picked);
  }

  List<Widget> modules(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final q = query.trim().toLowerCase();
    bool matches(Json s) => q.isEmpty || '${s['title']} ${s['key']} ${workspaceKeywords[s['key']] ?? ''}'.toLowerCase().contains(q);
    final available = [
      for (final c in workspaceCategories)
        if (screens.any((s) => moduleGroup('${s['key']}') == c.title)) c.title,
    ];
    final filtered = screens.where((s) => matches(s) && (categoryFilter == null || moduleGroup('${s['key']}') == categoryFilter)).toList();
    final quick = [
      for (final (key, label) in quickActionKeys)
        if (has(key)) (key, label),
    ].take(4).toList();
    final searching = q.isNotEmpty || categoryFilter != null;
    return [
      // Introduction with a faint campus illustration fading in on the right.
      EduReveal(
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 92),
          child: Stack(children: [
            Positioned(
              right: -8, top: -6, bottom: -6,
              child: Opacity(
                opacity: .16,
                child: ShaderMask(
                  shaderCallback: (r) => const LinearGradient(colors: [Colors.transparent, Colors.white], stops: [0, .45]).createShader(r),
                  blendMode: BlendMode.dstIn,
                  child: const EduArtwork(name: 'illustrations/academic_campus', height: 104),
                ),
              ),
            ),
            Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Your Workspace', style: text.headlineSmall?.copyWith(color: EduWorkspace.ink, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text('Access, manage and track everything in one place.', style: text.bodyMedium?.copyWith(color: EduWorkspace.muted)),
            ])),
          ]),
        ),
      ),
      const SizedBox(height: 12),
      EduReveal(
        order: 1,
        child: EduSearchField(
          controller: search,
          hint: 'Search module, feature or service…',
          onChanged: (v) => setState(() => query = v),
          filtered: categoryFilter != null,
          onFilter: available.length > 1 ? () => chooseCategory(available) : null,
        ),
      ),
      if (categoryFilter != null) ...[
        const SizedBox(height: 10),
        Align(
          alignment: Alignment.centerLeft,
          child: InputChip(label: Text(categoryFilter!), onDeleted: () => setState(() => categoryFilter = null), deleteButtonTooltipMessage: 'Show all modules'),
        ),
      ],
      if (!searching && quick.isNotEmpty) ...[
        const SizedBox(height: 20),
        Text('Quick actions', style: text.titleMedium?.copyWith(color: EduWorkspace.ink, fontWeight: FontWeight.w700)),
        const SizedBox(height: 10),
        LayoutBuilder(builder: (context, constraints) {
          final height = MediaQuery.textScalerOf(context).scale(12) * 2.4 + 72;
          final fits = constraints.maxWidth >= quick.length * 78 + (quick.length - 1) * 10;
          final width = fits ? (constraints.maxWidth - (quick.length - 1) * 10) / quick.length : 84.0;
          return SizedBox(
            height: height,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              physics: fits ? const NeverScrollableScrollPhysics() : null,
              itemCount: quick.length,
              separatorBuilder: (_, _) => const SizedBox(width: 10),
              itemBuilder: (context, i) => SizedBox(
                width: width,
                child: EduReveal(
                  order: 2 + i,
                  child: EduActionCard(
                    key: ValueKey('quick-action-${quick[i].$1}'),
                    label: quick[i].$2,
                    icon: workspaceIcon(quick[i].$1),
                    tint: EduTints.all[i % EduTints.all.length],
                    onTap: () => open(quick[i].$1),
                  ),
                ),
              ),
            ),
          );
        }),
      ],
      const SizedBox(height: 20),
      for (final (i, category) in workspaceCategories.indexed)
        if (filtered.any((s) => moduleGroup('${s['key']}') == category.title))
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: EduReveal(
              order: 3 + i,
              child: EduCategorySection(
                key: ValueKey('category-${category.title}'),
                title: category.title,
                icon: category.icon,
                tint: EduTints.all[i % EduTints.all.length],
                // While searching or filtering, every category with matches stays open.
                expanded: searching || !collapsedCategories.contains(category.title),
                onToggle: () => setState(() {
                  if (!collapsedCategories.remove(category.title)) collapsedCategories.add(category.title);
                }),
                tiles: [
                  for (final s in filtered)
                    if (moduleGroup('${s['key']}') == category.title)
                      EduModuleTile(
                        key: ValueKey('module-${s['key']}'),
                        title: '${s['title']}',
                        query: q,
                        icon: workspaceIcon('${s['key']}'),
                        tint: EduTints.all[i % EduTints.all.length],
                        onTap: () => open(s['key']),
                      ),
                ],
              ),
            ),
          ),
      if (filtered.isEmpty)
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: EduWorkspace.surface, borderRadius: BorderRadius.circular(18), border: Border.all(color: EduWorkspace.border)),
          child: Column(children: [
            const EduArtwork(name: 'empty_states/no_results', height: 96),
            const SizedBox(height: 12),
            Text('No matching modules', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Try another word, or clear the search and filter.', textAlign: TextAlign.center, style: text.bodyMedium?.copyWith(color: EduWorkspace.muted)),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => setState(() {
                search.clear();
                query = '';
                categoryFilter = null;
              }),
              child: const Text('Clear search'),
            ),
          ]),
        ),
    ];
  }


  // ---------------------------------------------------------------------------
  // Messages: conversations between families and the teachers of their classes.

  List<Json> get messageContacts =>
      ((data?['lookups'] as Map?)?['contacts'] as List? ?? []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();

  /// Messages grouped into conversations, newest conversation first.
  List<({String code, String subject, String with_, List<Json> messages})> conversations(List<Json> all) {
    final threads = <String, List<Json>>{};
    for (final m in all) {
      threads.putIfAbsent('${m['thread_code']}', () => []).add(m);
    }
    final result = [
      for (final e in threads.entries)
        (
          code: e.key,
          subject: '${e.value.first['thread_subject'] ?? 'Conversation'}',
          with_: ((e.value.first['with'] as List?) ?? []).join(', '),
          messages: e.value..sort((a, b) => '${a['sent_at']}'.compareTo('${b['sent_at']}')),
        ),
    ]..sort((a, b) => '${b.messages.last['sent_at']}'.compareTo('${a.messages.last['sent_at']}'));
    return result;
  }

  Future<List<Json>> reloadMessages() async {
    await fetchSection('messages');
    if (selected == 'messages') await load();
    return rows('messages');
  }

  Future<void> openThread(String code, String subject, String withWhom) => Navigator.of(context).push<void>(
    MaterialPageRoute(
      builder: (_) => MessageThreadScreen(
        api: widget.api,
        threadCode: code,
        subject: subject,
        withWhom: withWhom,
        studentCode: student,
        initial: rows('messages').where((m) => '${m['thread_code']}' == code).toList(),
        reload: reloadMessages,
      ),
    ),
  );

  /// Slide-up composer: choose a contact (role and class shown), subject and message.
  Future<void> composeMessage() async {
    final contacts = messageContacts;
    final sent = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => _ComposeMessageSheet(api: widget.api, contacts: contacts, studentCode: student),
    );
    if (sent != null && mounted) {
      toast('Message sent.', success: true);
      await reloadMessages();
    }
  }

  List<Widget> messagesView(BuildContext context, List<Json> all, List<Json> actions) {
    final text = Theme.of(context).textTheme;
    final canStart = actions.any((a) => a['key'] == 'start_thread');
    final threads = conversations(all);
    final contacts = messageContacts;
    return [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Color(0xffe8efe2), Color(0xffe3ebee)], begin: Alignment.topLeft, end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: collegeLine),
        ),
        child: Row(children: [
          Container(width: 46, height: 46, decoration: const BoxDecoration(color: collegeIvory, shape: BoxShape.circle), child: const Icon(Icons.forum_outlined)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${threads.length} conversation${threads.length == 1 ? '' : 's'}', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              Text(
                widget.role == MobileRole.teacher
                    ? '${contacts.length} students and parents in your classes'
                    : '${contacts.length} teacher${contacts.length == 1 ? '' : 's'} you can message',
                style: text.bodySmall,
              ),
            ]),
          ),
        ]),
      ),
      const SizedBox(height: 12),
      if (canStart)
        FilledButton.icon(
          key: const ValueKey('new-message'),
          onPressed: saving || contacts.isEmpty ? null : composeMessage,
          icon: const Icon(Icons.edit_outlined),
          label: const Text('New message'),
        ),
      const SizedBox(height: 16),
      if (threads.isEmpty)
        QuietEmpty(
          icon: Icons.forum_outlined,
          title: 'No conversations yet',
          message: widget.role == MobileRole.teacher
              ? 'Message the parents or students of the classes you teach.'
              : 'Message your child’s teachers about classes, homework or progress.',
        )
      else
        for (final t in threads)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Material(
              color: collegeIvory,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: const BorderSide(color: collegeLine)),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                key: ValueKey('thread-${t.code}'),
                onTap: () => openThread(t.code, t.subject, t.with_),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    CircleAvatar(
                      radius: 22,
                      backgroundColor: EduTints.mist,
                      child: Text(
                        t.with_.trim().isEmpty ? '?' : t.with_.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join(),
                        style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: EduTints.ink(EduTints.mist)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text(t.with_.isEmpty ? 'Conversation' : t.with_, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
                          Text(timeAgo(DateTime.tryParse('${t.messages.last['sent_at']}')?.toLocal()), style: text.labelSmall),
                        ]),
                        Text(t.subject, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.labelLarge?.copyWith(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text(
                          '${t.messages.last['mine'] == true ? 'You: ' : ''}${t.messages.last['body'] ?? ''}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: text.bodySmall,
                        ),
                      ]),
                    ),
                  ]),
                ),
              ),
            ),
          ),
    ];
  }


  // ---------------------------------------------------------------------------
  // Inbox: categorised notifications that open the screen they are about.

  /// Category of a notification from the record it links to.
  ({String label, IconData icon, Color tint}) noticeKind(Json r) {
    final screen = '${r['screen'] ?? ''}';
    if (r['certificate_request_code'] != null || r['certificate_code'] != null || screen == 'certificates') {
      return (label: 'Certificates', icon: Icons.workspace_premium_outlined, tint: EduTints.clay);
    }
    if (screen == 'fees' || r['charge_code'] != null) {
      return (label: 'Fees', icon: Icons.account_balance_wallet_outlined, tint: EduTints.gold);
    }
    if (screen == 'results' || r['assessment_code'] != null) {
      return (label: 'Results', icon: Icons.insights_rounded, tint: EduTints.sage);
    }
    if (r['assignment_code'] != null) {
      return (label: 'Assignments', icon: Icons.assignment_outlined, tint: EduTints.plum);
    }
    if (r['syllabus_code'] != null) {
      return (label: 'Resources', icon: Icons.menu_book_outlined, tint: EduTints.plum);
    }
    if (r['calendar_event_code'] != null) {
      return (label: 'Events', icon: Icons.event_outlined, tint: EduTints.mist);
    }
    return (label: 'General', icon: Icons.campaign_outlined, tint: EduTints.mist);
  }

  DateTime? noticeTime(Json r) =>
      DateTime.tryParse('${r['sent_at'] ?? r['created_at'] ?? r['published_at'] ?? ''}')?.toLocal();

  String timeAgo(DateTime? t) {
    if (t == null) return '';
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 1) return 'Just now';
    if (d.inHours < 1) return '${d.inMinutes}m ago';
    if (d.inDays < 1) return '${d.inHours}h ago';
    if (d.inDays < 7) return '${d.inDays}d ago';
    return prettyDate(t);
  }

  /// Where a notification leads, or null for a plain notice.
  VoidCallback? noticeTarget(Json r) {
    final screen = '${r['screen'] ?? ''}';
    if (r['calendar_event_code'] != null) {
      return () async {
        try {
          final event = Map<String, dynamic>.from(await widget.api.calendarDetails(r['calendar_event_code'].toString()) as Map);
          if (mounted) await Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => EventDetailScreen(api: widget.api, event: event)));
        } catch (e) { if (mounted) toast(e.toString()); }
      };
    }
    if ((r['certificate_request_code'] != null || r['certificate_code'] != null || screen == 'certificates') && has('certificates')) {
      return () => open('certificates');
    }
    if (r['syllabus_code'] != null) {
      return () => Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => SyllabusDetail(api: widget.api, code: r['syllabus_code'].toString())));
    }
    if (r['assignment_code'] != null) {
      return () => Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => AssignmentReview(api: widget.api, code: r['assignment_code'].toString())));
    }
    if (r['assessment_code'] != null && has('assessments')) return () => open('assessments');
    if (r['thread_code'] != null || screen == 'messages') return () => openChat(r['thread_code']?.toString());
    if (screen.isNotEmpty && has(screen)) return () => open(screen);
    return null;
  }

  /// Tap: mark as read, then open what it is about (or show the full notice).
  Future<void> openNotice(Json r) async {
    if (r['status'] != 'read') unawaited(markRead(r));
    final target = noticeTarget(r);
    if (target != null) {
      target();
      return;
    }
    final kind = noticeKind(r);
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(width: 44, height: 44, decoration: BoxDecoration(color: kind.tint, shape: BoxShape.circle), child: Icon(kind.icon, color: EduTints.ink(kind.tint))),
              const SizedBox(width: 12),
              Expanded(child: Text('${r['title'] ?? 'Notification'}', style: Theme.of(sheet).textTheme.titleLarge)),
            ]),
            const SizedBox(height: 6),
            Text('${kind.label} · ${timeAgo(noticeTime(r))}', style: Theme.of(sheet).textTheme.bodySmall),
            const SizedBox(height: 14),
            Text('${r['body'] ?? r['message'] ?? ''}', style: Theme.of(sheet).textTheme.bodyLarge),
          ]),
        ),
      ),
    );
  }

  /// Inbox summary: unread, today and this week, with a chip per category present.
  Widget inboxSummary(List<Json> all) {
    final text = Theme.of(context).textTheme;
    final now = DateTime.now();
    final today = all.where((r) { final t = noticeTime(r); return t != null && DateUtils.isSameDay(t, now); }).length;
    final week = all.where((r) { final t = noticeTime(r); return t != null && now.difference(t).inDays < 7; }).length;
    final kinds = <String, ({String label, IconData icon, Color tint, int count})>{};
    for (final r in all) {
      final k = noticeKind(r);
      final previous = kinds[k.label];
      kinds[k.label] = (label: k.label, icon: k.icon, tint: k.tint, count: (previous?.count ?? 0) + 1);
    }
    Widget figure(String value, String label, Color tint) => Expanded(
      child: Column(children: [
        Text(value, style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800, color: EduTints.ink(tint))),
        Text(label, style: text.labelMedium),
      ]),
    );
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: collegeIvory, borderRadius: BorderRadius.circular(22), border: Border.all(color: collegeLine)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        IntrinsicHeight(
          child: Row(children: [
            figure('$unread', 'Unread', EduTints.clay),
            const VerticalDivider(width: 1, color: collegeLine),
            figure('$today', 'Today', EduTints.sage),
            const VerticalDivider(width: 1, color: collegeLine),
            figure('$week', 'This week', EduTints.mist),
          ]),
        ),
        if (kinds.isNotEmpty) ...[
          const SizedBox(height: 14),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final k in kinds.values)
              Container(
                padding: const EdgeInsets.fromLTRB(6, 4, 10, 4),
                decoration: BoxDecoration(color: k.tint, borderRadius: BorderRadius.circular(99)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(k.icon, size: 15, color: EduTints.ink(k.tint)),
                  const SizedBox(width: 5),
                  Text('${k.label} ${k.count}', style: text.labelMedium?.copyWith(color: EduTints.ink(k.tint), fontWeight: FontWeight.w700)),
                ]),
              ),
          ]),
        ],
      ]),
    );
  }

  /// Notifications grouped by day: Today, Yesterday, then dates.
  List<Widget> noticeList(List<Json> items) {
    final text = Theme.of(context).textTheme;
    final accent = Theme.of(context).colorScheme.primary;
    final now = DateTime.now();
    final sorted = [...items]..sort((a, b) => (noticeTime(b) ?? DateTime(0)).compareTo(noticeTime(a) ?? DateTime(0)));
    final groups = <String, List<Json>>{};
    for (final r in sorted) {
      final t = noticeTime(r);
      final label = t == null
          ? 'Earlier'
          : DateUtils.isSameDay(t, now)
          ? 'Today'
          : DateUtils.isSameDay(t, now.subtract(const Duration(days: 1)))
          ? 'Yesterday'
          : prettyDate(t);
      groups.putIfAbsent(label, () => []).add(r);
    }
    return [
      for (final group in groups.entries) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 10, 4, 8),
          child: Text(group.key, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
        ),
        for (final r in group.value)
          Builder(builder: (context) {
            final kind = noticeKind(r);
            final unreadNotice = r['status'] != 'read';
            final leads = noticeTarget(r) != null;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Material(
                color: unreadNotice ? Color.lerp(collegeIvory, kind.tint, .35) : collegeIvory,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: BorderSide(color: unreadNotice ? EduTints.ink(kind.tint).withValues(alpha: .25) : collegeLine)),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  key: ValueKey('notice-${r['code']}'),
                  onTap: saving ? null : () => openNotice(r),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(width: 44, height: 44, decoration: BoxDecoration(color: kind.tint, shape: BoxShape.circle), child: Icon(kind.icon, size: 21, color: EduTints.ink(kind.tint))),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Expanded(child: Text('${r['title'] ?? 'Notification'}', maxLines: 2, overflow: TextOverflow.ellipsis,
                                style: text.titleSmall?.copyWith(fontWeight: unreadNotice ? FontWeight.w800 : FontWeight.w600))),
                            if (unreadNotice) ...[
                              const SizedBox(width: 6),
                              Container(width: 9, height: 9, decoration: BoxDecoration(color: accent, shape: BoxShape.circle)),
                            ],
                          ]),
                          if ('${r['body'] ?? r['message'] ?? ''}'.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Text('${r['body'] ?? r['message']}', maxLines: 2, overflow: TextOverflow.ellipsis, style: text.bodySmall),
                          ],
                          const SizedBox(height: 8),
                          Row(children: [
                            Flexible(
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(color: kind.tint, borderRadius: BorderRadius.circular(99)),
                                child: Text(kind.label, maxLines: 1, overflow: TextOverflow.ellipsis,
                                    style: text.labelSmall?.copyWith(color: EduTints.ink(kind.tint), fontWeight: FontWeight.w700)),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(child: Text(timeAgo(noticeTime(r)), style: text.labelSmall)),
                            if (leads) Text('Open', style: text.labelMedium?.copyWith(color: accent, fontWeight: FontWeight.w700)),
                            if (leads) Icon(Icons.chevron_right, size: 18, color: accent),
                          ]),
                        ]),
                      ),
                    ]),
                  ),
                ),
              ),
            );
          }),
      ],
    ];
  }


  // ---------------------------------------------------------------------------
  // Lab in-charges: the day's lab sessions (batch, lab, time, students and attendance) and the
  // weekly lab timetable.

  DateTime labDay = DateUtils.dateOnly(DateTime.now());
  final Set<String> openSessions = {};

  Future<void> pickLabDay() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: labDay,
      firstDate: DateTime(DateTime.now().year - 2),
      lastDate: DateTime(DateTime.now().year + 1, 12, 31),
      helpText: 'Show lab sessions for',
    );
    if (picked != null && mounted) {
      setState(() => labDay = DateUtils.dateOnly(picked));
      await load();
    }
  }

  void shiftLabDay(int days) {
    setState(() => labDay = DateUtils.dateOnly(labDay.add(Duration(days: days))));
    load();
  }

  String clock(String? value) {
    final parts = (value ?? '').split(':');
    final h = int.tryParse(parts.first);
    if (h == null || parts.length < 2) return value ?? '';
    return '${h % 12 == 0 ? 12 : h % 12}:${parts[1].padLeft(2, '0')} ${h < 12 ? 'AM' : 'PM'}';
  }

  /// One lab session: lab and room, time, batch, subject and faculty, attendance counts and
  /// (when opened) every student with their attendance.
  Widget labSessionCard(BuildContext context, Json r, {bool compact = false}) {
    final text = Theme.of(context).textTheme;
    final counts = Map<String, dynamic>.from(r['counts'] as Map? ?? {});
    final students = (r['students'] as List? ?? []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
    final total = (counts['total'] as num?) ?? students.length;
    final present = ((counts['present'] as num?) ?? 0) + ((counts['late'] as num?) ?? 0);
    final absent = (counts['absent'] as num?) ?? 0;
    final marked = r['attendance_marked'] == true;
    final key = '${r['code']}';
    final expanded = openSessions.contains(key);
    final batch = [
      '${r['program_name'] ?? ''}',
      '${r['academic_year_name'] ?? ''}',
      if ('${r['section_name'] ?? ''}'.isNotEmpty) 'Section ${r['section_name']}',
    ].where((v) => v.trim().isNotEmpty).join(' · ');
    Widget stat(String label, Object value, Color tint) => Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
        decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(12)),
        child: Column(children: [
          Text('$value', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: EduTints.ink(tint))),
          FittedBox(fit: BoxFit.scaleDown, child: Text(label, style: text.labelSmall?.copyWith(color: EduTints.ink(tint)))),
        ]),
      ),
    );
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: EduWorkspace.border),
        boxShadow: EduWorkspace.shadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // Time band and lab.
        Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          color: EduTints.mist.withValues(alpha: .6),
          child: Row(children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
              child: Icon(Icons.science_outlined, color: EduTints.ink(EduTints.mist)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${r['lab_name'] ?? 'Lab'}', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                Text(
                  [if ('${r['floor'] ?? ''}'.isNotEmpty) '${r['floor']} floor', if ('${r['room_number'] ?? ''}'.isNotEmpty) 'Room ${r['room_number']}'].join(' · '),
                  style: text.bodySmall,
                ),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(clock('${r['start_time']}'), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
              Text('to ${clock('${r['end_time']}')}', style: text.labelSmall),
            ]),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${r['subject_name'] ?? ''}', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
            if (batch.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.school_outlined, size: 16, color: collegeMuted),
                const SizedBox(width: 6),
                Expanded(child: Text(batch, style: text.bodySmall)),
              ]),
            ],
            if ('${r['faculty_name'] ?? ''}'.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(children: [
                const Icon(Icons.badge_outlined, size: 16, color: collegeMuted),
                const SizedBox(width: 6),
                Expanded(child: Text('Faculty: ${r['faculty_name']}', style: text.bodySmall)),
              ]),
            ],
            if (!compact && r['students'] != null) ...[
              const SizedBox(height: 12),
              Row(children: [
                stat('Students', total, EduTints.mist),
                const SizedBox(width: 8),
                stat('Present', marked ? present : '—', EduTints.sage),
                const SizedBox(width: 8),
                stat('Absent', marked ? absent : '—', EduTints.clay),
              ]),
              if (!marked) ...[
                const SizedBox(height: 8),
                Text('Attendance not marked yet for this session.', style: text.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
              ],
              const SizedBox(height: 6),
              TextButton.icon(
                key: ValueKey('lab-students-$key'),
                onPressed: () => setState(() => expanded ? openSessions.remove(key) : openSessions.add(key)),
                icon: Icon(expanded ? Icons.expand_less_rounded : Icons.expand_more_rounded),
                label: Text(expanded ? 'Hide students' : 'Show ${students.length} students'),
              ),
              if (expanded)
                for (final st in students)
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: const BoxDecoration(border: Border(top: BorderSide(color: EduWorkspace.border))),
                    child: Row(children: [
                      CircleAvatar(
                        radius: 16,
                        backgroundColor: EduTints.plum,
                        child: Text(
                          '${st['name'] ?? '?'}'.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).take(2).map((w) => w[0].toUpperCase()).join(),
                          style: text.labelSmall?.copyWith(fontWeight: FontWeight.w800, color: EduTints.ink(EduTints.plum)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${st['name']}', style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                          if ('${st['admission_number'] ?? ''}'.isNotEmpty) Text('${st['admission_number']}', style: text.labelSmall),
                        ]),
                      ),
                      Builder(builder: (context) {
                        final status = '${st['status'] ?? ''}';
                        final tint = switch (status) {
                          'present' => EduTints.sage,
                          'late' => EduTints.gold,
                          'absent' => EduTints.clay,
                          'excused' => EduTints.mist,
                          _ => collegeCanvas,
                        };
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                          decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(99)),
                          child: Text(
                            status.isEmpty ? 'Not marked' : '${status[0].toUpperCase()}${status.substring(1)}',
                            style: text.labelMedium?.copyWith(fontWeight: FontWeight.w700, color: status.isEmpty ? collegeMuted : EduTints.ink(tint)),
                          ),
                        );
                      }),
                    ]),
                  ),
            ],
          ]),
        ),
      ]),
    );
  }

  List<Widget> labsView(BuildContext context, List<Json> all) {
    final text = Theme.of(context).textTheme;
    final summary = Map<String, dynamic>.from(data?['summary'] as Map? ?? {});
    final labs = ((data?['lookups'] as Map?)?['labs'] as List? ?? []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
    final isToday = DateUtils.isSameDay(labDay, DateTime.now());
    return [
      // Day switcher.
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: EduWorkspace.border)),
        child: Row(children: [
          IconButton(tooltip: 'Previous day', onPressed: busy ? null : () => shiftLabDay(-1), icon: const Icon(Icons.chevron_left_rounded)),
          Expanded(
            child: InkWell(
              key: const ValueKey('lab-day'),
              borderRadius: BorderRadius.circular(12),
              onTap: busy ? null : pickLabDay,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Column(children: [
                  Text(isToday ? 'Today' : const ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][labDay.weekday - 1], style: text.labelMedium),
                  Text(prettyDate(labDay), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                ]),
              ),
            ),
          ),
          IconButton(tooltip: 'Next day', onPressed: busy ? null : () => shiftLabDay(1), icon: const Icon(Icons.chevron_right_rounded)),
        ]),
      ),
      const SizedBox(height: 12),
      EduGrid(phone: 3, fold: 3, tablet: 3, spacing: 10, children: [
        EduStatCard(label: 'Sessions', value: '${summary['sessions'] ?? all.length}', icon: Icons.science_outlined, tint: EduTints.mist),
        EduStatCard(label: 'Students', value: '${summary['students'] ?? 0}', icon: Icons.groups_outlined, tint: EduTints.plum),
        EduStatCard(label: 'Absent', value: '${summary['absent'] ?? 0}', icon: Icons.person_off_outlined, tint: EduTints.clay),
      ]),
      if (labs.isNotEmpty) ...[
        SectionHeading(title: 'My labs'),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final lab in labs)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: EduTints.sage.withValues(alpha: .6), borderRadius: BorderRadius.circular(14)),
              child: Text.rich(
                TextSpan(children: [
                  TextSpan(text: '${lab['name']}', style: const TextStyle(fontWeight: FontWeight.w800)),
                  TextSpan(text: '  ${lab['floor']} · Room ${lab['room_number']}'),
                ]),
                style: text.bodySmall,
              ),
            ),
        ]),
      ],
      SectionHeading(title: isToday ? 'Today’s lab sessions' : 'Lab sessions · ${prettyDate(labDay)}'),
      if (all.isEmpty)
        QuietEmpty(
          icon: Icons.science_outlined,
          title: labs.isEmpty ? 'No labs assigned yet' : 'No lab sessions on this day',
          message: labs.isEmpty
              ? 'The college office assigns labs to you in the lab register.'
              : 'Choose another day to see its lab sessions.',
        )
      else
        for (final r in all) labSessionCard(context, r),
    ];
  }

  /// Weekly lab timetable: pick a weekday, see each lab period with its batch.
  List<Widget> labTimetableView(BuildContext context, List<Json> all) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final weekday = calendarDay.weekday.clamp(1, 6);
    final today = all.where((r) => '${r['weekday']}' == '$weekday').toList()
      ..sort((a, b) => '${a['start_time']}'.compareTo('${b['start_time']}'));
    return [
      EduPillTabs(
        labels: days,
        selected: weekday - 1,
        onSelected: (i) => setState(() {
          final now = DateUtils.dateOnly(DateTime.now());
          calendarDay = now.add(Duration(days: (i + 1) - now.weekday));
        }),
      ),
      const SizedBox(height: 14),
      if (today.isEmpty)
        const QuietEmpty(icon: Icons.event_available_outlined, title: 'No lab periods', message: 'No lab sessions are scheduled on this day.')
      else
        for (final r in today) labSessionCard(context, r, compact: true),
    ];
  }

  // ---------------------------------------------------------------------------
  // Weekly timetable (published by the college): the same Monday–Saturday week repeats for the
  // whole semester, with classes, labs, sports, library, breaks and lunch.

  ({String label, IconData icon, Color tint}) periodStyle(String kind) => switch (kind) {
    'lab' => (label: 'Lab', icon: Icons.science_outlined, tint: EduTints.mist),
    'sports' || 'activity' => (label: kind == 'sports' ? 'Sports' : 'Activity', icon: Icons.sports_basketball_outlined, tint: EduTints.clay),
    'library' => (label: 'Library', icon: Icons.local_library_outlined, tint: EduTints.gold),
    'break' => (label: 'Break', icon: Icons.free_breakfast_outlined, tint: collegeCanvas),
    'lunch' => (label: 'Lunch', icon: Icons.restaurant_outlined, tint: collegeCanvas),
    _ => (label: 'Class', icon: Icons.menu_book_outlined, tint: EduTints.sage),
  };

  String hm(String? value) {
    final parts = (value ?? '').split(':');
    final h = int.tryParse(parts.first);
    if (h == null || parts.length < 2) return value ?? '';
    return '${h % 12 == 0 ? 12 : h % 12}:${parts[1].padLeft(2, '0')}${h < 12 ? ' AM' : ' PM'}';
  }

  List<Widget> weeklyTimetableView(BuildContext context, List<Json> all) {
    final text = Theme.of(context).textTheme;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    final weekday = calendarDay.weekday == 7 ? 1 : calendarDay.weekday;
    final now = DateTime.now();
    final isToday = weekday == now.weekday;
    final minutesNow = now.hour * 60 + now.minute;
    int minutes(String? v) {
      final p = (v ?? '').split(':');
      return (int.tryParse(p.first) ?? 0) * 60 + (int.tryParse(p.length > 1 ? p[1] : '') ?? 0);
    }
    final day = all.where((r) => '${r['weekday']}' == '$weekday').toList()
      ..sort((a, b) => '${a['start_time']}'.compareTo('${b['start_time']}'));
    final first = all.firstOrNull ?? {};
    final sectionCount = all.map((r) => r['section_code']).whereType<Object>().toSet().length;
    DateTime? from = DateTime.tryParse('${first['valid_from'] ?? ''}'), to = DateTime.tryParse('${first['valid_to'] ?? ''}');
    final counts = <String, int>{};
    for (final r in all.where((r) => r['kind'] != 'break' && r['kind'] != 'lunch')) {
      final label = periodStyle('${r['kind']}').label;
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Color(0xffe8efe2), Color(0xffe3ebee)], begin: Alignment.topLeft, end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: EduWorkspace.border),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.view_week_outlined),
            const SizedBox(width: 8),
            Expanded(child: Text('Weekly timetable', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800))),
            if (first['semester'] != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(99)),
                child: Text('Sem ${first['semester']}', style: text.labelMedium?.copyWith(fontWeight: FontWeight.w800)),
              ),
          ]),
          const SizedBox(height: 4),
          Text(
            sectionCount > 1
                ? '$sectionCount classes you teach'
                : [
                    if ('${first['course_name'] ?? ''}'.isNotEmpty) '${first['course_name']}',
                    if ('${first['section_name'] ?? ''}'.isNotEmpty) 'Section ${first['section_name']}',
                  ].join(' · '),
            style: text.bodySmall,
          ),
          const SizedBox(height: 8),
          Row(children: [
            const Icon(Icons.repeat_rounded, size: 16, color: collegeMuted),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                from != null && to != null
                    ? 'Repeats every week · ${prettyDate(from)} – ${prettyDate(to)}'
                    : 'Repeats every week of the semester',
                style: text.bodySmall?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
          ]),
          if (counts.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(spacing: 6, runSpacing: 6, children: [
              for (final e in counts.entries)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: .85), borderRadius: BorderRadius.circular(99)),
                  child: Text('${e.value} ${e.key.toLowerCase()} periods / week', style: text.labelSmall?.copyWith(fontWeight: FontWeight.w600)),
                ),
            ]),
          ],
        ]),
      ),
      const SizedBox(height: 14),
      EduPillTabs(
        labels: days,
        selected: weekday - 1,
        onSelected: (i) => setState(() {
          final today = DateUtils.dateOnly(DateTime.now());
          calendarDay = today.add(Duration(days: (i + 1) - today.weekday));
        }),
      ),
      const SizedBox(height: 14),
      if (day.isEmpty)
        const QuietEmpty(icon: Icons.wb_sunny_outlined, title: 'Nothing scheduled', message: 'No periods on this day.')
      else
        for (final r in day)
          Builder(builder: (context) {
            final kind = '${r['kind'] ?? 'theory'}';
            final style = periodStyle(kind);
            final pause = kind == 'break' || kind == 'lunch';
            final live = isToday && minutes('${r['start_time']}') <= minutesNow && minutesNow < minutes('${r['end_time']}');
            final time = SizedBox(
              width: 64,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(hm('${r['start_time']}'), style: text.labelMedium?.copyWith(fontWeight: FontWeight.w800)),
                Text(hm('${r['end_time']}'), style: text.labelSmall),
              ]),
            );
            if (pause) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(children: [
                  time,
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: style.tint,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: live ? Theme.of(context).colorScheme.primary : EduWorkspace.border),
                      ),
                      child: Row(children: [
                        Icon(style.icon, size: 16, color: collegeMuted),
                        const SizedBox(width: 8),
                        Expanded(child: Text('${r['title'] ?? style.label}', style: text.bodySmall?.copyWith(fontWeight: FontWeight.w600))),
                        if (live) Text('Now', style: text.labelSmall?.copyWith(fontWeight: FontWeight.w800, color: Theme.of(context).colorScheme.primary)),
                      ]),
                    ),
                  ),
                ]),
              );
            }
            final details = [
              // Teachers see which class it is; students see who teaches it.
              if (sectionCount > 1 && '${r['section_name'] ?? ''}'.isNotEmpty)
                '${r['course_name'] ?? ''} · Section ${r['section_name']}'.replaceFirst(RegExp(r'^ · '), '')
              else if ('${r['faculty'] ?? ''}'.isNotEmpty)
                '${r['faculty']}',
              if ('${r['room'] ?? ''}'.isNotEmpty) 'Room ${r['room']}',
            ].join(' · ');
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: const EdgeInsets.only(top: 12), child: time),
                Expanded(
                  child: Container(
                    key: ValueKey('period-${r['code']}'),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: live ? Theme.of(context).colorScheme.primary : EduWorkspace.border, width: live ? 1.6 : 1),
                      boxShadow: EduWorkspace.shadow,
                    ),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(color: style.tint, borderRadius: BorderRadius.circular(10)),
                        child: Icon(style.icon, size: 19, color: EduTints.ink(style.tint)),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Expanded(child: Text('${r['title'] ?? r['subject_name'] ?? style.label}', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(color: style.tint, borderRadius: BorderRadius.circular(99)),
                              child: Text(live ? 'Now' : style.label, style: text.labelSmall?.copyWith(fontWeight: FontWeight.w700, color: EduTints.ink(style.tint))),
                            ),
                          ]),
                          if (details.isNotEmpty) ...[
                            const SizedBox(height: 3),
                            Text(details, style: text.bodySmall),
                          ],
                        ]),
                      ),
                    ]),
                  ),
                ),
              ]),
            );
          }),
    ];
  }

  // ---------------------------------------------------------------------------
  // Staff self-service screens: assigned classes, leave, payslips and Form 16 — styled like the
  // parent / student screens (summary card, pastel tiles, white cards with status pills).

  Widget staffCard(BuildContext context, {required Widget child, VoidCallback? onTap, Key? key}) => Container(
    key: key,
    margin: const EdgeInsets.only(bottom: 12),
    decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), boxShadow: EduWorkspace.shadow),
    child: Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: const BorderSide(color: EduWorkspace.border)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(onTap: onTap, child: Padding(padding: const EdgeInsets.all(16), child: child)),
    ),
  );

  Widget pill(BuildContext context, String label, Color tint, {IconData? icon}) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
    decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(99)),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      if (icon != null) ...[Icon(icon, size: 14, color: EduTints.ink(tint)), const SizedBox(width: 5)],
      Flexible(
        child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(color: EduTints.ink(tint), fontWeight: FontWeight.w700)),
      ),
    ]),
  );

  Widget summaryBand(BuildContext context, String title, String value, List<(String, String)> facts, {IconData icon = Icons.insights_rounded}) {
    final text = Theme.of(context).textTheme;
    return EduReveal(
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [Color(0xffe8efe2), Color(0xffe3ebee)], begin: Alignment.topLeft, end: Alignment.bottomRight),
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: collegeLine),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(icon, size: 20),
            const SizedBox(width: 8),
            Expanded(child: Text(title, style: text.labelLarge?.copyWith(fontWeight: FontWeight.w700))),
          ]),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text.rich(TextSpan(text: value), style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
          ),
          if (facts.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: collegeIvory.withValues(alpha: .75), borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                for (final (label, v) in facts)
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(label, style: text.labelMedium),
                      FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                          child: Text.rich(TextSpan(text: v), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
                    ]),
                  ),
              ]),
            ),
          ],
        ]),
      ),
    );
  }

  /// Teacher: the classes they teach, with batch, section, semester and class size.
  List<Widget> classesView(BuildContext context, List<Json> all) {
    final text = Theme.of(context).textTheme;
    final students = all.fold<int>(0, (sum, r) => sum + ((r['students'] as num?)?.toInt() ?? 0));
    final weekly = rows('timetable').where((r) => r['kind'] == 'theory' || r['kind'] == 'lab').length;
    return [
      summaryBand(context, 'Assigned classes', '${all.length}', [
        ('Students', '$students'),
        ('Periods / week', weekly == 0 ? '—' : '$weekly'),
        ('Labs', '${all.where((r) => '${r['subject_type']}' == 'practical' || '${r['subject_name'] ?? ''}'.toLowerCase().contains('lab') || '${r['subject_name'] ?? ''}'.toLowerCase().contains('practical')).length}'),
      ], icon: Icons.class_outlined),
      SectionHeading(title: 'My classes'),
      if (all.isEmpty)
        const QuietEmpty(icon: Icons.class_outlined, title: 'No classes assigned yet', message: 'Classes appear here once the college assigns you to a subject.')
      else
        EduGrid(phone: 1, fold: 2, tablet: 2, children: [
          for (final (i, r) in all.indexed)
            Builder(builder: (context) {
              final name = '${r['subject_name'] ?? r['subject'] ?? r['subject_code'] ?? 'Subject'}';
              final lab = '${r['subject_type']}' == 'practical' || name.toLowerCase().contains('lab') || name.toLowerCase().contains('practical');
              final tint = lab ? EduTints.mist : EduTints.all[i % EduTints.all.length];
              return staffCard(
                context,
                key: ValueKey('class-${r['code']}'),
                onTap: has('attendance') ? () => open('attendance') : null,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(13)),
                      child: Icon(lab ? Icons.science_outlined : Icons.menu_book_outlined, color: EduTints.ink(tint)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(name, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                        Text(
                          [
                            if ('${r['course_name'] ?? ''}'.isNotEmpty) '${r['course_name']}',
                            if ('${r['academic_year_name'] ?? ''}'.isNotEmpty) '${r['academic_year_name']}',
                          ].join(' · '),
                          style: text.bodySmall,
                        ),
                      ]),
                    ),
                  ]),
                  const SizedBox(height: 10),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    if ('${r['section_name'] ?? ''}'.isNotEmpty) pill(context, 'Section ${r['section_name']}', EduTints.sage, icon: Icons.groups_outlined),
                    if (r['semester_number'] != null) pill(context, 'Semester ${r['semester_number']}', EduTints.gold),
                    if (r['students'] != null) pill(context, '${r['students']} students', EduTints.plum, icon: Icons.person_outline),
                    pill(context, lab ? 'Lab' : 'Theory', tint),
                  ]),
                ]),
              );
            }),
        ]),
    ];
  }

  /// Employee leave: counts, request button, filters and request cards.
  String staffLeaveFilter = 'All';
  List<Widget> staffLeaveView(BuildContext context, List<Json> all, List<Json> actions) {
    final text = Theme.of(context).textTheme;
    String state(Json r) => '${r['status'] ?? 'pending'}'.toLowerCase();
    bool approved(Json r) => const {'approved', 'completed'}.contains(state(r));
    bool rejected(Json r) => const {'rejected', 'declined', 'cancelled'}.contains(state(r));
    final shown = all.where((r) => switch (staffLeaveFilter) {
      'Pending' => !approved(r) && !rejected(r),
      'Approved' => approved(r),
      'Declined' => rejected(r),
      _ => true,
    }).toList()
      ..sort((a, b) => '${b['start_date'] ?? ''}'.compareTo('${a['start_date'] ?? ''}'));
    final descriptor = actions.where((a) => a['key'] == 'request_leave').firstOrNull;
    final days = all.where(approved).fold<int>(0, (sum, r) {
      final from = DateTime.tryParse('${r['start_date'] ?? ''}'), to = DateTime.tryParse('${r['end_date'] ?? ''}');
      return sum + (from == null || to == null ? 0 : DateUtils.dateOnly(to).difference(DateUtils.dateOnly(from)).inDays + 1);
    });
    const filters = ['All', 'Pending', 'Approved', 'Declined'];
    final summary = Map<String, dynamic>.from(data?['summary'] as Map? ?? {});
    final balances = (summary['leave_balances'] as List? ?? []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
    final att = Map<String, dynamic>.from(summary['attendance'] as Map? ?? {});
    return [
      if (balances.isNotEmpty) ...[
        SectionHeading(title: 'Leave balance ${DateTime.now().year}'),
        staffCard(context, child: Column(children: [
          for (final (i, b) in balances.indexed) ...[
            if (i > 0) const Divider(height: 22),
            leaveBar(context, b),
          ],
        ])),
      ],
      if (att.isNotEmpty) ...[
        SectionHeading(title: 'Attendance · ${att['label'] ?? 'this month'}'),
        staffCard(context, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(att['percent'] == null ? 'Not marked yet' : '${att['percent']}% attendance',
                style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800))),
            Text('${att['working_days'] ?? 0} working days', style: text.bodySmall),
          ]),
          const SizedBox(height: 10),
          Wrap(spacing: 6, runSpacing: 6, children: [
            pill(context, '${att['present'] ?? 0} present', EduTints.sage),
            pill(context, '${att['half_day'] ?? 0} half day', EduTints.gold),
            pill(context, '${att['leave'] ?? 0} leave', EduTints.mist),
            pill(context, '${att['absent'] ?? 0} absent', EduTints.clay),
            pill(context, '${att['holiday'] ?? 0} holidays', EduTints.plum),
          ]),
        ])),
      ],
      const SizedBox(height: 12),
      EduGrid(phone: 3, fold: 3, tablet: 3, spacing: 10, children: [
        EduStatCard(label: 'Pending', value: '${all.where((r) => !approved(r) && !rejected(r)).length}', icon: Icons.hourglass_top_rounded, tint: EduTints.gold, onTap: () => setState(() => staffLeaveFilter = 'Pending')),
        EduStatCard(label: 'Days approved', value: '$days', icon: Icons.check_circle_outline, tint: EduTints.sage, onTap: () => setState(() => staffLeaveFilter = 'Approved')),
        EduStatCard(label: 'Declined', value: '${all.where(rejected).length}', icon: Icons.block_outlined, tint: EduTints.clay, onTap: () => setState(() => staffLeaveFilter = 'Declined')),
      ]),
      if (descriptor != null) ...[
        const SizedBox(height: 14),
        FilledButton.icon(
          key: const ValueKey('request-leave'),
          onPressed: saving ? null : () => action(descriptor),
          icon: const Icon(Icons.event_available_outlined),
          label: const Text('Request leave'),
        ),
      ],
      const SizedBox(height: 18),
      EduPillTabs(
        labels: filters,
        selected: filters.indexOf(staffLeaveFilter),
        onSelected: (i) => setState(() => staffLeaveFilter = filters[i]),
      ),
      const SizedBox(height: 14),
      if (shown.isEmpty)
        QuietEmpty(
          icon: Icons.event_available_outlined,
          title: staffLeaveFilter == 'All' ? 'No leave requests yet' : 'Nothing ${staffLeaveFilter.toLowerCase()}',
          message: 'Request leave with the dates and the reason.',
        )
      else
        for (final r in shown)
          Builder(builder: (context) {
            final status = approved(r)
                ? (label: 'Approved', tint: EduTints.sage, icon: Icons.check_circle_rounded)
                : rejected(r)
                ? (label: 'Declined', tint: EduTints.clay, icon: Icons.cancel_rounded)
                : (label: 'Pending', tint: EduTints.gold, icon: Icons.hourglass_top_rounded);
            final from = DateTime.tryParse('${r['start_date'] ?? ''}'), to = DateTime.tryParse('${r['end_date'] ?? ''}');
            final n = from == null || to == null ? null : DateUtils.dateOnly(to).difference(DateUtils.dateOnly(from)).inDays + 1;
            return staffCard(
              context,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: status.tint, shape: BoxShape.circle),
                    child: Icon(Icons.event_busy_outlined, color: EduTints.ink(status.tint), size: 21),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(n == null ? 'Leave' : '$n day${n == 1 ? '' : 's'} ${r['leave_type_name'] ?? 'leave'}'.trim(),
                          style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      pill(context, status.label, status.tint, icon: status.icon),
                    ]),
                  ),
                ]),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: collegeCanvas, borderRadius: BorderRadius.circular(14)),
                  child: Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('From', style: text.labelSmall),
                      Text(from == null ? '—' : prettyDate(from), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                    ])),
                    const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Icon(Icons.arrow_forward_rounded, size: 18, color: collegeMuted)),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('To', style: text.labelSmall),
                      Text(to == null ? '—' : prettyDate(to), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                    ])),
                  ]),
                ),
                if ('${r['reason'] ?? ''}'.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text('Reason', style: text.labelSmall),
                  Text('${r['reason']}', style: text.bodyMedium),
                ],
              ]),
            );
          }),
    ];
  }

  /// Two-column statement rows (component · amount) used by the salary structure and payslips.
  Widget statementTable(BuildContext context, List<Json> earnings, List<Json> deductions, {String? gross, String? less}) {
    final text = Theme.of(context).textTheme;
    Widget column(String title, List<Json> rows, String? total, Color tint, String totalLabel) => Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: tint.withValues(alpha: .45), borderRadius: BorderRadius.circular(14)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: text.labelLarge?.copyWith(fontWeight: FontWeight.w800, color: EduTints.ink(tint))),
          const SizedBox(height: 6),
          if (rows.isEmpty) Text('—', style: text.bodySmall),
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: Text('${r['component']}', style: text.bodySmall)),
                const SizedBox(width: 6),
                Text.rich(TextSpan(text: money(r['amount'])), style: text.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
              ]),
            ),
          if (total != null) ...[
            const Divider(height: 14),
            Row(children: [
              Expanded(child: Text(totalLabel, style: text.labelMedium?.copyWith(fontWeight: FontWeight.w800))),
              Text.rich(TextSpan(text: money(total)), style: text.labelMedium?.copyWith(fontWeight: FontWeight.w800)),
            ]),
          ],
        ]),
      ),
    );
    final narrow = MediaQuery.textScalerOf(context).scale(16) > 22 || MediaQuery.sizeOf(context).width < 360;
    final earn = column('Earnings', earnings, gross, EduTints.sage, 'Gross');
    final ded = column('Deductions', deductions, less, EduTints.clay, 'Total');
    return narrow
        ? Column(children: [Row(children: [earn]), const SizedBox(height: 8), Row(children: [ded])])
        : IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [earn, const SizedBox(width: 8), ded]));
  }

  /// One month's payslip, formatted like the PDF, with download.
  Future<void> showPayslip(Json r) async {
    final kind = '${data?['downloads'] ?? 'payslip'}';
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      backgroundColor: Colors.white,
      builder: (sheet) {
        final text = Theme.of(sheet).textTheme;
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: .85,
          maxChildSize: .95,
          builder: (context, controller) => ListView(
            controller: controller,
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: collegePine, borderRadius: BorderRadius.circular(18)),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('PAYSLIP', style: text.labelLarge?.copyWith(color: Colors.white70, letterSpacing: 1.2, fontWeight: FontWeight.w800)),
                      Text('${r['period'] ?? 'Salary statement'}', style: text.titleLarge?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
                    ]),
                  ),
                  const Icon(Icons.request_quote_outlined, color: Colors.white, size: 30),
                ]),
              ),
              const SizedBox(height: 16),
              statementTable(
                context,
                (r['earnings'] as List? ?? []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList(),
                (r['deductions'] as List? ?? []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList(),
                gross: '${r['gross_amount']}',
                less: '${r['deduction_amount']}',
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: EduTints.sage, borderRadius: BorderRadius.circular(16)),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text('Net pay', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800))),
                    Text.rich(TextSpan(text: money(r['net_amount'])), style: text.titleLarge?.copyWith(fontWeight: FontWeight.w900, color: collegePine)),
                  ]),
                  if ('${r['net_in_words'] ?? ''}'.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text('${r['net_in_words']}', style: text.bodySmall),
                  ],
                ]),
              ),
              if (r['paid_on'] != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: collegeCanvas, borderRadius: BorderRadius.circular(14)),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Salary credited', style: text.labelLarge?.copyWith(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text('Paid ${prettyDate(DateTime.tryParse('${r['paid_on']}') ?? DateTime.now())} · ${'${r['payment_mode'] ?? 'bank_transfer'}'.replaceAll('_', ' ')}',
                        style: text.bodySmall),
                    Text('Receipt ${r['receipt_number'] ?? '—'} · Ref ${r['transaction_reference'] ?? '—'}', style: text.bodySmall),
                  ]),
                ),
              ],
              const SizedBox(height: 16),
              Text('Payslip PDF', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 8),
              pdfButtons('Payslip ${r['period'] ?? ''}'.trim(), () => widget.api.download(kind, '${r['code']}'),
                  view: 'View payslip', viewKey: const ValueKey('download-payslip'), before: () => Navigator.pop(sheet)),
              if (r['paid_on'] != null) ...[
                const SizedBox(height: 14),
                Text('Salary payment receipt', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                pdfButtons('Salary receipt ${r['period'] ?? ''}'.trim(), () => widget.api.download('salary-receipt', '${r['code']}'),
                    view: 'View receipt', viewKey: const ValueKey('salary-receipt'), before: () => Navigator.pop(sheet)),
              ],
            ],
          ),
        );
      },
    );
  }

  /// Salary and payslips: take-home summary, the salary structure, then one card per month.
  List<Widget> payslipsView(BuildContext context, List<Json> all) {
    final text = Theme.of(context).textTheme;
    final structure = Map<String, dynamic>.from((data?['summary'] as Map?)?['structure'] as Map? ?? {});
    List<Json> part(String key) => (structure[key] as List? ?? []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
    final latest = all.firstOrNull;
    final paid = all.fold<num>(0, (sum, r) => sum + (num.tryParse('${r['net_amount'] ?? 0}') ?? 0));
    final bonuses = ((data?['summary'] as Map?)?['adjustments'] as List? ?? [])
        .whereType<Map>()
        .map((m) => Map<String, dynamic>.from(m))
        .where((b) => b['status'] == 'approved')
        .toList();
    return [
      summaryBand(
        context,
        'Monthly take-home',
        structure.isEmpty ? (latest == null ? '—' : money(latest['net_amount'])) : money(structure['in_hand_monthly'] ?? structure['net_monthly']),
        [
          ('Gross / month', structure.isEmpty ? '—' : money(structure['gross_monthly'])),
          ('Annual CTC', structure.isEmpty ? '—' : money(structure['ctc_annual'])),
          ('Paid so far', money(paid)),
        ],
        icon: Icons.account_balance_wallet_outlined,
      ),
      if (structure.isNotEmpty) ...[
        SectionHeading(title: 'Salary structure'),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: EduWorkspace.border),
            boxShadow: EduWorkspace.shadow,
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              'Monthly${'${structure['effective_from'] ?? ''}'.isEmpty ? '' : ' · effective ${prettyDate(DateTime.tryParse('${structure['effective_from']}') ?? DateTime.now())}'}',
              style: text.bodySmall,
            ),
            const SizedBox(height: 10),
            statementTable(context, part('earnings'), part('deductions'),
                gross: '${structure['gross_monthly']}', less: '${structure['deductions_monthly']}'),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: Text('Net salary', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
              Text.rich(TextSpan(text: money(structure['net_monthly'])), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w900, color: collegePine)),
            ]),
            const SizedBox(height: 12),
            if (structure['employee_code'] != null)
              pdfButtons('Salary structure', () => widget.api.download('salary-structure', '${structure['employee_code']}'),
                  view: 'View salary structure', viewKey: const ValueKey('salary-structure-pdf')),
          ]),
        ),
      ],
      if (bonuses.isNotEmpty) ...[
        SectionHeading(title: 'Bonuses & incentives'),
        staffCard(context, child: Column(children: [
          for (final (i, b) in bonuses.indexed) ...[
            if (i > 0) const Divider(height: 18),
            Row(children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(color: EduTints.gold, borderRadius: BorderRadius.circular(11)),
                child: Icon(b['category'] == 'Reimbursement' ? Icons.receipt_outlined : Icons.card_giftcard_rounded,
                    color: EduTints.ink(EduTints.gold), size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${b['component']}', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  Text('${b['category'] ?? ''} · ${b['period'] ?? ''}', style: text.bodySmall),
                ]),
              ),
              Text.rich(TextSpan(text: money(b['amount'])), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
            ]),
          ],
        ])),
      ],
      SectionHeading(title: 'Monthly payslips'),
      if (all.isEmpty)
        const QuietEmpty(icon: Icons.receipt_long_outlined, title: 'No payslips yet', message: 'Published payslips appear here every month.')
      else
        EduGrid(phone: 1, fold: 2, tablet: 2, children: [
          for (final r in all)
            staffCard(
              context,
              key: ValueKey('payslip-${r['code']}'),
              onTap: () => showPayslip(r),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: EduTints.sage, borderRadius: BorderRadius.circular(13)),
                    child: Icon(Icons.request_quote_outlined, color: EduTints.ink(EduTints.sage)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${r['period'] ?? 'Salary statement'}', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                      Text.rich(TextSpan(text: 'Net ${money(r['net_amount'])}'), style: text.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
                    ]),
                  ),
                  IconButton(
                    tooltip: 'Payslip PDF',
                    onPressed: downloading ? null : () => openDocument('${data?['downloads'] ?? 'payslip'}', '${r['code']}', 'Payslip ${r['period'] ?? ''}'.trim()),
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                  ),
                ]),
                const SizedBox(height: 10),
                Wrap(spacing: 6, runSpacing: 6, children: [
                  pill(context, 'Gross ${money(r['gross_amount'])}', EduTints.mist),
                  pill(context, 'Deductions ${money(r['deduction_amount'])}', EduTints.clay),
                  if (r['paid_on'] != null) pill(context, 'Paid', EduTints.sage, icon: Icons.check_circle_rounded),
                ]),
                const SizedBox(height: 8),
                Row(children: [
                  Text('View payslip', style: text.labelMedium?.copyWith(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w700)),
                  Icon(Icons.chevron_right, size: 18, color: Theme.of(context).colorScheme.primary),
                ]),
              ]),
            ),
        ]),
    ];
  }

  /// Form 16 and other tax documents: per financial year the Part B figures (salary, deductions,
  /// TDS by quarter, net) with the PDF to view, save or share.
  List<Widget> taxDocumentsView(BuildContext context, List<Json> all) {
    final text = Theme.of(context).textTheme;
    final accent = Theme.of(context).colorScheme.primary;
    final sorted = [...all]..sort((a, b) => '${b['financial_year'] ?? ''}'.compareTo('${a['financial_year'] ?? ''}'));
    List<Json> list(Json st, String key) => (st[key] as List? ?? []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
    Widget line(String label, Object? value, {bool strong = false}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        Expanded(child: Text(label, style: strong ? text.titleSmall?.copyWith(fontWeight: FontWeight.w800) : text.bodySmall)),
        Text.rich(TextSpan(text: money(value)), style: (strong ? text.titleSmall : text.bodySmall)?.copyWith(fontWeight: FontWeight.w800)),
      ]),
    );
    final latest = sorted.firstOrNull;
    final latestSt = Map<String, dynamic>.from(latest?['statement'] as Map? ?? {});
    return [
      summaryBand(context, 'Form 16', latest == null ? '—' : 'FY ${latest['financial_year']}', [
        ('Gross salary', latestSt.isEmpty ? '—' : money(latestSt['gross'])),
        ('Tax deducted', latestSt.isEmpty ? '—' : money(latestSt['tax'])),
        ('Documents', '${all.length}'),
      ], icon: Icons.description_outlined),
      SectionHeading(title: 'Form 16 and tax documents'),
      if (sorted.isEmpty)
        const QuietEmpty(icon: Icons.description_outlined, title: 'No tax documents yet', message: 'Form 16 appears here once the college publishes it.')
      else
        for (final r in sorted)
          Builder(builder: (context) {
            final st = Map<String, dynamic>.from(r['statement'] as Map? ?? {});
            final title = RegExp(r'^form[\s_-]?16a', caseSensitive: false).hasMatch('${r['document_type'] ?? ''}') ? 'Form 16A' : 'Form 16';
            return staffCard(
              context,
              key: ValueKey('tax-${r['code']}'),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(color: EduTints.gold, borderRadius: BorderRadius.circular(13)),
                    child: Icon(Icons.description_outlined, color: EduTints.ink(EduTints.gold)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('$title · FY ${r['financial_year'] ?? '—'}', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                      Text([
                        if (st['assessment_year'] != null) 'AY ${st['assessment_year']}',
                        'Revision ${r['revision'] ?? 1}',
                        if (st['months'] != null) '${st['months']} months',
                      ].join(' · '), style: text.bodySmall),
                    ]),
                  ),
                ]),
                if (st.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: collegeCanvas, borderRadius: BorderRadius.circular(14)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Salary paid', style: text.labelLarge?.copyWith(fontWeight: FontWeight.w800, color: accent)),
                      for (final e in list(st, 'earnings')) line('${e['component']}', e['amount']),
                      line('Gross salary', st['gross'], strong: true),
                      const Divider(height: 16),
                      Text('Deductions', style: text.labelLarge?.copyWith(fontWeight: FontWeight.w800, color: accent)),
                      line('Other than tax', st['other_deductions']),
                      for (final q in list(st, 'quarters')) line('TDS ${q['quarter']}', q['amount']),
                      line('Total tax deducted', st['tax'], strong: true),
                      const Divider(height: 16),
                      line('Net salary paid', st['net'], strong: true),
                    ]),
                  ),
                ],
                const SizedBox(height: 12),
                pdfButtons('$title FY ${r['financial_year']}', () => widget.api.download('tax-document', '${r['code']}'), view: 'View PDF'),
              ]),
            );
          }),
    ];
  }

  List<Widget> screenContent(BuildContext context) {
    final all = rows(selected!);
    final students = (data?['students'] as List? ?? []).cast<Json>();
    final actions = selfDrawn.contains(selected) ? <Json>[] : (data?['actions'] as List? ?? []).cast<Json>();
    final financial = {
      'overview',
      'dues',
      'collections',
      'fees',
      'payments',
      'expenses',
      'reports',
      'payslips',
    }.contains(selected);
    final items = (selfDrawn.contains(selected) ? <Json>[] : all).where((r) {
      if (query.isNotEmpty &&
          !display(r).toLowerCase().contains(query.toLowerCase())) {
        return false;
      }
      if (filter == 'Unread' && r['status'] == 'read') return false;
      if (selected == 'assignments' && widget.role == MobileRole.student) {
        final submitted = r['my_submission'] != null;
        if (filter == 'Submitted' && !submitted) return false;
        if (filter == 'Pending' && submitted) return false;
      }
      if (filter == 'Pending' &&
          [
            'approved',
            'paid',
            'completed',
            'submitted',
          ].contains(r['status'])) {
        return false;
      }
      if (selected == 'calendar') {
        final start = eventStart(r), end = eventEnd(r);
        if (start == null) return false;
        return !calendarDay.isBefore(DateUtils.dateOnly(start)) &&
            !calendarDay.isAfter(DateUtils.dateOnly(end ?? start));
      }
      if (selected == 'timetable') {
        return r['weekday'].toString() == '${calendarDay.weekday}';
      }
      return true;
    }).toList();
    if (selected == 'calendar' || selected == 'timetable') {
      items.sort(
        (a, b) => (a['starts_at'] ?? a['start_time'] ?? '')
            .toString()
            .compareTo((b['starts_at'] ?? b['start_time'] ?? '').toString()),
      );
    }
    if (selected == 'messages') return messagesView(context, all, actions);
    if (selected == 'timetable' && !labIncharge && all.any((r) => r['kind'] != null)) return weeklyTimetableView(context, all);
    if (selected == 'labs') return labsView(context, all);
    if (selected == 'classes') return classesView(context, all);
    if (selected == 'leave') return staffLeaveView(context, all, actions);
    if (selected == 'payslips') return payslipsView(context, all);
    if (selected == 'tax-documents') return taxDocumentsView(context, all);
    if (selected == 'timetable' && labIncharge) return labTimetableView(context, all);
    return [
      if (students.length > 1) ...[
        DropdownButtonFormField<String>(
          key: ValueKey('student-$student'),
          initialValue: student,
          decoration: const InputDecoration(
            labelText: 'Viewing student',
            prefixIcon: Icon(Icons.school_outlined),
          ),
          isExpanded: true,
          items: students
              .map(
                (s) => DropdownMenuItem<String>(
                  value: s['code'],
                  child: Text(s['name']),
                ),
              )
              .toList(),
          onChanged: (v) {
            if (v != null) changeStudent(v);
          },
        ),
        const SizedBox(height: 20),
      ],
      if (selected == 'profile') ...[
        ProfileHeader(record: all.firstOrNull ?? {}, role: widget.role.label),
        const SizedBox(height: 16),
      ],
      if (selected == 'notifications') ...[
        // Summary first, then a compact device-alerts banner.
        inboxSummary(all),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
          decoration: BoxDecoration(
            color: EduTints.mist.withValues(alpha: .6),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              const Icon(Icons.notifications_active_outlined, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  pushStatus,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              TextButton(
                onPressed: pushBusy ? null : enablePush,
                child: Text(pushBusy ? 'Connecting…' : 'Enable'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
      ],
      if (data?['summary'] != null)
        SummaryPanel(summary: data!['summary'] as Json, financial: financial),
      if (selected == 'attendance') AttendanceSummary(items: all),
      if (selected == 'overview') ...[
        SectionHeading(title: 'Finance tools'),
        shortcutGrid(
          screens
              .where(
                (s) => [
                  'dues',
                  'collections',
                  'expenses',
                  'reports',
                ].contains(s['key']),
              )
              .toList(),
          compact: true,
        ),
      ],
      if (selected == 'reports') ...[
        LedgerSummary(api: widget.api, onPdf: (period) => openReport('ledger-$period', '${period[0].toUpperCase()}${period.substring(1)}ly receipts & cash ledger'.replaceAll('Dayly', 'Daily'))),
        const SectionHeading(title: 'Report PDFs'),
        EduGrid(phone: 1, fold: 2, tablet: 2, spacing: 10, children: [
          for (final (key, title, icon) in const [
            ('finance', 'Student fee ledgers', Icons.account_balance_wallet_outlined),
            ('outstanding', 'Outstanding fees', Icons.pending_actions_outlined),
            ('collections', 'Fee collections', Icons.payments_outlined),
            ('cashbook', 'Cashbook', Icons.menu_book_outlined),
            ('expenses', 'Expenses', Icons.receipt_long_outlined),
            ('payroll', 'Payroll', Icons.badge_outlined),
            ('ledger-day', 'Daily receipts & cash ledger', Icons.today_outlined),
            ('ledger-week', 'Weekly receipts & cash ledger', Icons.view_week_outlined),
            ('ledger-month', 'Monthly receipts & cash ledger', Icons.calendar_month_outlined),
            ('ledger-year', 'Yearly receipts & cash ledger', Icons.event_note_outlined),
            ('ledger-month-cash', 'Cash ledger (cash only)', Icons.payments_outlined),
          ])
            staffCard(
              context,
              key: ValueKey('report-$key'),
              onTap: downloading ? null : () => openReport(key, title),
              child: Row(children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(color: EduTints.gold, borderRadius: BorderRadius.circular(12)),
                  child: Icon(icon, color: EduTints.ink(EduTints.gold), size: 21),
                ),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  Text('Formatted PDF · view, save or share', style: Theme.of(context).textTheme.bodySmall),
                ])),
                const Icon(Icons.picture_as_pdf_outlined, color: collegeMuted),
              ]),
            ),
        ]),
        const SizedBox(height: 12),
      ],
      if (selected == 'calendar')
        AnimatedSwitcher(
          duration: EduMotion.duration(context, EduMotion.tab),
          child: CampusCalendar(
            key: ValueKey('month-${calendarMonth.year}-${calendarMonth.month}'),
            month: calendarMonth,
            selected: calendarDay,
            events: all,
            onMonth: (v) {
              setState(() => calendarMonth = v);
              load();
            },
            onDay: (v) => setState(() => calendarDay = v),
          ),
        ),
      if (selected == 'calendar')
        SectionHeading(title: 'Agenda · ${prettyDate(calendarDay)}'),
      if (selected == 'certificates')
        CertificateMobileWorkspace(api: widget.api, role: widget.role, studentCode: student),
      if (selected == 'cash')
        widget.role == MobileRole.admin ? AdminCashWorkspace(api: widget.api) : CashDepositWorkspace(api: widget.api),
      if (selected == 'cash-analytics')
        CollectionAnalyticsWorkspace(api: widget.api),
      if (selected == 'change-requests')
        ChangeRequestsWorkspace(api: widget.api),
      if (selected == 'timetable') ...[
        TimetableDaySelector(
          selected: calendarDay,
          onChanged: (v) => setState(() => calendarDay = v),
        ),
        const SizedBox(height: 12),
      ],
      if (actions.any((a) => a['key'] != 'read_notification')) ...[
        // Screen actions share one even grid: same width and height for every button.
        LayoutBuilder(
          builder: (context, constraints) {
            final shown = actions
                .where((a) => a['key'] != 'read_notification')
                .toList();
            final columns =
                shown.length == 1 ||
                    MediaQuery.textScalerOf(context).scale(16) > 22 ||
                    constraints.maxWidth < 300
                ? 1
                : 2;
            final width =
                (constraints.maxWidth - (columns - 1) * 10) / columns;
            return Wrap(
              spacing: 10,
              runSpacing: 10,
              children: shown
                  .map(
                    (a) => SizedBox(
                      width: width,
                      height: EduSizes.scaled(context, EduSizes.button),
                      child: FilledButton.tonalIcon(
                        onPressed: saving ? null : () => action(a),
                        icon: Icon(actionIcon(a['key'])),
                        label: Text(
                          a['label'],
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            );
          },
        ),
        const SizedBox(height: 20),
      ],
      if (all.isNotEmpty &&
          selected != 'profile' &&
          selected != 'overview') ...[
        TextField(
          controller: search,
          onChanged: (v) => setState(() => query = v),
          decoration: InputDecoration(
            hintText: financial
                ? 'Search transactions or names'
                : 'Search this screen',
            prefixIcon: const Icon(Icons.search),
          ),
        ),
        const SizedBox(height: 12),
        if (selected == 'notifications' ||
            selected == 'leave' ||
            selected == 'assignments')
          Wrap(
            spacing: 8,
            children:
                [
                      'All',
                      if (selected == 'notifications') 'Unread' else 'Pending',
                      if (selected == 'assignments' &&
                          widget.role == MobileRole.student)
                        'Submitted',
                    ]
                    .map(
                      (v) => ChoiceChip(
                        label: Text(v),
                        selected: filter == v,
                        onSelected: (_) => setState(() => filter = v),
                      ),
                    )
                    .toList(),
          ),
        const SizedBox(height: 8),
        Text(
          '${items.length} shown${(data?['total'] as int? ?? all.length) > all.length ? ' of ${data?['total']}' : ''}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 8),
      ],
      if (items.isEmpty && selected != 'overview' && selected != 'reports' && !selfDrawn.contains(selected))
        QuietEmpty(
          icon: moduleIcon(selected!),
          title: query.isNotEmpty
              ? 'No matching records'
              : emptyTitle(selected!),
          message: query.isNotEmpty
              ? 'Try a different search.'
              : emptyDescription(selected!),
        ),
      if (selected == 'notifications')
        ...noticeList(items)
      else
      ...items.map(
        (r) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CampusRecord(
              record: r,
              screen: selected!,
              onTap: selected == 'calendar'
                  ? () => Navigator.of(context).push<void>(MaterialPageRoute(
                      builder: (_) => EventDetailScreen(api: widget.api, event: r),
                    ))
                  : null,
              onDownload:
                  data?['downloads'] != null && r['record_type'] != 'request'
                  ? () => data!['downloads'] == 'receipt'
                        ? openDocument('receipt', '${r['code']}', 'Fee receipt')
                        : download(data!['downloads'], r['code'])
                  : null,
              onRead: selected == 'notifications' && r['status'] != 'read'
                  ? () => markRead(r)
                  : null,
              onPrimary: recordAction(r, actions),
              primaryLabel: selected == 'fees'
                  ? 'Pay this fee'
                  : selected == 'assignments'
                  ? 'Submit assignment'
                  : selected == 'messages'
                  ? 'Reply'
                  : selected == 'notifications' && r['assignment_code'] != null
                  ? 'Open assignment'
                  : selected == 'notifications' && r['syllabus_code'] != null
                  ? 'Open resource'
                  : selected == 'notifications' && r['calendar_event_code'] != null
                  ? 'Open event'
                  : selected == 'notifications' && (r['certificate_request_code'] != null || r['certificate_code'] != null || r['screen'] == 'certificates')
                  ? 'Open certificates'
                  : null,
            ),
            if (r['receipts'] is List)
              ...(r['receipts'] as List).map(
                (receipt) => Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () => download('receipt', receipt['code']),
                    icon: const Icon(Icons.receipt_long_outlined),
                    label: Text('Receipt ${receipt['receipt_number']}'),
                  ),
                ),
              ),
          ],
        ),
      ),
      if (all.length < (data?['total'] as int? ?? 0))
        OutlinedButton(
          onPressed: paging ? null : loadMore,
          child: Text(paging ? 'Loading…' : 'Load more records'),
        ),
    ];
  }

  VoidCallback? recordAction(Json record, List<Json> actions) {
    if (selected == 'notifications' && record['calendar_event_code'] != null) {
      return () async {
        try {
          final event = Map<String, dynamic>.from(await widget.api.calendarDetails(record['calendar_event_code'].toString()) as Map);
          if (mounted) await Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => EventDetailScreen(api: widget.api, event: event)));
        } catch (e) { if (mounted) toast(e.toString()); }
      };
    }
    if (selected == 'notifications' && (record['certificate_request_code'] != null || record['certificate_code'] != null || record['screen'] == 'certificates')) {
      return () => open('certificates');
    }
    if (selected == 'notifications' && record['syllabus_code'] != null) {
      return () => Navigator.of(context).push<void>(MaterialPageRoute(
        builder: (_) => SyllabusDetail(api: widget.api, code: record['syllabus_code'].toString()),
      ));
    }
    if (selected == 'notifications' && record['assignment_code'] != null) {
      return () => Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) => AssignmentReview(
            api: widget.api,
            code: record['assignment_code'].toString(),
          ),
        ),
      );
    }
    String? key;
    Json initial = {};
    if (selected == 'fees' &&
        num.tryParse('${record['outstanding'] ?? record['balance'] ?? 0}') !=
            0) {
      key = 'make_payment';
      initial = {
        'charge_code': record['code'],
        'amount': record['outstanding'] ?? record['balance'],
      };
    } else if (selected == 'assignments' && widget.role == MobileRole.student) {
      key = 'submit_assignment';
      initial = {'assignment_code': record['code']};
    } else if (selected == 'messages') {
      key = 'send_message';
      initial = {'thread_code': record['thread_code']};
    }
    final descriptor = actions.where((a) => a['key'] == key).firstOrNull;
    return descriptor == null
        ? null
        : () => action(descriptor, initial: initial);
  }

  Future<void> markRead(Json record) async {
    if (saving) return;
    setState(() => saving = true);
    try {
      await widget.api.markNotificationRead(record['code']);
      await fetchSection('notifications');
    } catch (e) {
      if (mounted) toast(e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }
}

class _ComposeMessageSheet extends StatefulWidget {
  final CollegeApi api;
  final List<Json> contacts;
  final String? studentCode;
  const _ComposeMessageSheet({required this.api, required this.contacts, this.studentCode});
  @override
  State<_ComposeMessageSheet> createState() => _ComposeMessageSheetState();
}

class _ComposeMessageSheetState extends State<_ComposeMessageSheet> {
  final form = GlobalKey<FormState>();
  final subject = TextEditingController(), body = TextEditingController(), search = TextEditingController();
  String? to, error;
  bool sending = false;

  @override
  void dispose() {
    subject.dispose();
    body.dispose();
    search.dispose();
    super.dispose();
  }

  Future<void> send() async {
    if (to == null) {
      setState(() => error = 'Choose who to message.');
      return;
    }
    if (!form.currentState!.validate()) return;
    setState(() { sending = true; error = null; });
    try {
      final response = await widget.api.executeAction('messages', 'start_thread', WorkspaceActionPayload(
        values: {'recipient_user_code': to, 'subject': subject.text.trim(), 'body': body.text.trim()},
        studentCode: widget.studentCode,
      ));
      if (mounted) Navigator.pop(context, '${response.record?['thread_code'] ?? ''}');
    } catch (e) {
      if (mounted) setState(() { error = e.toString(); sending = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final accent = Theme.of(context).colorScheme.primary;
    final q = search.text.toLowerCase();
    final shown = widget.contacts.where((c) => '${c['name']} ${c['detail'] ?? ''}'.toLowerCase().contains(q)).toList();
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: Center(
        heightFactor: 1,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: Form(
            key: form,
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              children: [
                Text('New message', style: text.headlineSmall),
                const SizedBox(height: 12),
                TextField(
                  controller: search,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(hintText: 'Search people', prefixIcon: Icon(Icons.search)),
                ),
                const SizedBox(height: 8),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 240),
                  child: ListView(
                    shrinkWrap: true,
                    children: [
                      for (final c in shown)
                        ListTile(
                          key: ValueKey('contact-${c['code']}'),
                          selected: to == c['code'],
                          leading: CircleAvatar(
                            backgroundColor: to == c['code'] ? accent : EduTints.mist,
                            child: Icon(
                              c['role'] == 'teacher' ? Icons.school_outlined : c['role'] == 'parent' ? Icons.family_restroom_outlined : Icons.person_outline,
                              color: to == c['code'] ? collegeIvory : EduTints.ink(EduTints.mist),
                              size: 20,
                            ),
                          ),
                          title: Text('${c['name']}'),
                          subtitle: Text('${c['detail'] ?? c['role'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis),
                          trailing: to == c['code'] ? Icon(Icons.check_circle_rounded, color: accent) : null,
                          onTap: sending ? null : () => setState(() { to = '${c['code']}'; error = null; }),
                        ),
                      if (shown.isEmpty) const Padding(padding: EdgeInsets.all(16), child: Text('No matching people.')),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: subject,
                  enabled: !sending,
                  maxLength: 120,
                  decoration: const InputDecoration(labelText: 'Subject'),
                  validator: (v) => (v ?? '').trim().isEmpty ? 'Add a subject.' : null,
                ),
                TextFormField(
                  key: const ValueKey('message-body'),
                  controller: body,
                  enabled: !sending,
                  minLines: 3,
                  maxLines: 6,
                  maxLength: 2000,
                  decoration: const InputDecoration(labelText: 'Message', alignLabelWithHint: true),
                  validator: (v) => (v ?? '').trim().isEmpty ? 'Write a message.' : null,
                ),
                if (error != null) Text(error!, style: text.bodySmall?.copyWith(color: collegeError)),
                const SizedBox(height: 8),
                FilledButton.icon(
                  key: const ValueKey('send-message'),
                  onPressed: sending ? null : send,
                  icon: const Icon(Icons.send_rounded),
                  label: Text(sending ? 'Sending…' : 'Send'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One conversation: chat bubbles (yours on the right) and a reply box.
class MessageThreadScreen extends StatefulWidget {
  final CollegeApi api;
  final String threadCode, subject, withWhom;
  final String? studentCode;
  final List<Json> initial;
  final Future<List<Json>> Function() reload;
  const MessageThreadScreen({
    super.key,
    required this.api,
    required this.threadCode,
    required this.subject,
    required this.withWhom,
    required this.initial,
    required this.reload,
    this.studentCode,
  });
  @override
  State<MessageThreadScreen> createState() => _MessageThreadScreenState();
}

class _MessageThreadScreenState extends State<MessageThreadScreen> {
  late List<Json> messages = [...widget.initial]..sort((a, b) => '${a['sent_at']}'.compareTo('${b['sent_at']}'));
  final reply = TextEditingController();
  bool sending = false;

  @override
  void dispose() {
    reply.dispose();
    super.dispose();
  }

  Future<void> send() async {
    final textValue = reply.text.trim();
    if (textValue.isEmpty || sending) return;
    setState(() => sending = true);
    try {
      await widget.api.executeAction('messages', 'send_message', WorkspaceActionPayload(
        values: {'thread_code': widget.threadCode, 'body': textValue},
        studentCode: widget.studentCode,
      ));
      reply.clear();
      final all = await widget.reload();
      if (mounted) {
        setState(() => messages = all.where((m) => '${m['thread_code']}' == widget.threadCode).toList()
          ..sort((a, b) => '${a['sent_at']}'.compareTo('${b['sent_at']}')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }

  String time(Object? value) {
    final t = DateTime.tryParse('${value ?? ''}')?.toLocal();
    if (t == null) return '';
    final hour = t.hour % 12 == 0 ? 12 : t.hour % 12;
    return '${prettyDate(t)} · $hour:${t.minute.toString().padLeft(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}';
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final accent = Theme.of(context).colorScheme.primary;
    return Scaffold(
      appBar: AppBar(
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.withWhom.isEmpty ? 'Conversation' : widget.withWhom, maxLines: 1, overflow: TextOverflow.ellipsis),
          Text(widget.subject, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.bodySmall),
        ]),
      ),
      body: Column(children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            itemCount: messages.length,
            itemBuilder: (_, i) {
              final m = messages[i];
              final mine = m['mine'] == true;
              return Align(
                alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * .78),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.fromLTRB(14, 10, 14, 8),
                    decoration: BoxDecoration(
                      color: mine ? accent : collegeIvory,
                      border: mine ? null : Border.all(color: collegeLine),
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(18),
                        topRight: const Radius.circular(18),
                        bottomLeft: Radius.circular(mine ? 18 : 4),
                        bottomRight: Radius.circular(mine ? 4 : 18),
                      ),
                    ),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      if (!mine) Text('${m['sender_name'] ?? ''}', style: text.labelMedium?.copyWith(fontWeight: FontWeight.w800, color: accent)),
                      Text('${m['body'] ?? ''}', style: text.bodyMedium?.copyWith(color: mine ? collegeIvory : collegeEspresso)),
                      const SizedBox(height: 4),
                      Text(time(m['sent_at']), style: text.labelSmall?.copyWith(color: mine ? collegeIvory.withValues(alpha: .8) : collegeMuted)),
                    ]),
                  ),
                ),
              );
            },
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 10),
            child: Row(children: [
              Expanded(
                child: TextField(
                  key: const ValueKey('reply-field'),
                  controller: reply,
                  minLines: 1,
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(hintText: 'Write a reply'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                key: const ValueKey('send-reply'),
                tooltip: 'Send',
                onPressed: sending ? null : send,
                icon: sending
                    ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.send_rounded),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}


/// Admin app: receipts & cash ledger by day / week / month / year — receipts count, money in by
/// mode, money out and closing balance per period, with the formatted PDF.
class LedgerSummary extends StatefulWidget {
  const LedgerSummary({super.key, required this.api, required this.onPdf});
  final CollegeApi api;
  final ValueChanged<String> onPdf;
  @override
  State<LedgerSummary> createState() => _LedgerSummaryState();
}

class _LedgerSummaryState extends State<LedgerSummary> {
  static const periods = ['day', 'week', 'month', 'year'];
  String period = 'month';
  Json? data;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => error = null);
    try {
      final r = Map<String, dynamic>.from(await widget.api.ledger(period) as Map);
      if (mounted) setState(() => data = r);
    } catch (e) {
      if (mounted) setState(() => error = e is ApiException ? e.message : 'Could not load the ledger.');
    }
  }

  String inr(Object? v) {
    final n = num.tryParse('${v ?? 0}') ?? 0;
    final whole = n.round().abs().toString();
    final last = whole.length > 3 ? whole.substring(whole.length - 3) : whole;
    var head = whole.length > 3 ? whole.substring(0, whole.length - 3) : '';
    final groups = <String>[];
    while (head.length > 2) {
      groups.insert(0, head.substring(head.length - 2));
      head = head.substring(0, head.length - 2);
    }
    if (head.isNotEmpty) groups.insert(0, head);
    return '${n < 0 ? '-' : ''}₹${[...groups, last].join(',')}';
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final accent = Theme.of(context).colorScheme.primary;
    final totals = Map<String, dynamic>.from(data?['totals'] as Map? ?? {});
    final groups = (data?['groups'] as List? ?? []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList().reversed.toList();
    final modes = (data?['by_mode'] as List? ?? []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeading(title: 'Receipts & cash ledger', action: 'PDF', onAction: () => widget.onPdf(period)),
      EduPillTabs(
        labels: const ['Daily', 'Weekly', 'Monthly', 'Yearly'],
        selected: periods.indexOf(period),
        onSelected: (i) {
          setState(() {
            period = periods[i];
            data = null;
          });
          load();
        },
      ),
      const SizedBox(height: 12),
      if (error != null)
        QuietEmpty(icon: Icons.wifi_off_rounded, title: 'Ledger unavailable', message: error!)
      else if (data == null)
        const EduLoadingSkeleton()
      else ...[
        EduGrid(phone: 2, fold: 4, tablet: 4, spacing: 10, children: [
          EduStatCard(label: 'Receipts', value: '${totals['receipts'] ?? 0}', icon: Icons.receipt_long_outlined, tint: EduTints.sage),
          EduStatCard(label: 'Received', value: inr(totals['received']), icon: Icons.south_west_rounded, tint: EduTints.gold),
          EduStatCard(label: 'Paid out', value: inr(totals['paid_out']), icon: Icons.north_east_rounded, tint: EduTints.clay),
          EduStatCard(label: 'Closing balance', value: inr(totals['closing']), icon: Icons.account_balance_outlined, tint: EduTints.mist),
        ]),
        if (modes.isNotEmpty) ...[
          const SizedBox(height: 10),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final m in modes)
              Chip(
                visualDensity: VisualDensity.compact,
                label: Text('${m['label']} · ${m['count']} · ${inr(m['amount'])}'),
              ),
          ]),
        ],
        const SizedBox(height: 10),
        for (final g in groups.take(12))
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: EduWorkspace.border)),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${g['label']}', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  Text('${g['receipts']} receipts · ${g['payments']} payments', style: text.bodySmall),
                ]),
              ),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('+${inr(g['received'])}', style: text.labelLarge?.copyWith(color: accent, fontWeight: FontWeight.w800)),
                if ((num.tryParse('${g['paid_out']}') ?? 0) > 0)
                  Text('−${inr(g['paid_out'])}', style: text.labelMedium?.copyWith(color: collegeError)),
                Text('Bal ${inr(g['closing'])}', style: text.bodySmall),
              ]),
            ]),
          ),
        if (groups.isEmpty)
          const QuietEmpty(icon: Icons.receipt_long_outlined, title: 'No receipts in this range', message: 'Receipts appear here once fees are collected.'),
      ],
    ]);
  }
}


/// Scroll controller that remembers its offset so a screen reopened with Back resumes there.
class _RememberedScroll extends ScrollController {
  _RememberedScroll() {
    addListener(() {
      if (positions.isNotEmpty) saved = positions.last.pixels;
    });
  }
  double saved = 0;
  @override
  double get initialScrollOffset => saved;
}
