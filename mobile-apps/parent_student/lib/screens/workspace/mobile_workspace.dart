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
  String get primary => switch (widget.role) {
    MobileRole.admin => 'overview',
    MobileRole.teacher => 'classes',
    MobileRole.parent => 'fees',
    MobileRole.student => 'assignments',
  };
  String get primaryLabel => switch (widget.role) {
    MobileRole.admin => 'Finance',
    MobileRole.teacher => 'Classes',
    MobileRole.parent => 'Fees',
    MobileRole.student => 'Study',
  };
  /// Academic progress screen key (parents and students see their own progress there).
  String get progress => has('academics') ? 'academics' : 'results';
  // Bottom bar order: primary, Progress, Home (centre), Chats, More. Inbox lives on the bell.
  int get tab => selected == null
      ? 2
      : selected == primary
      ? 0
      : selected == progress
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
        // Opened from the notification bar: wait for the signed-in screens, then go where the
        // notice points (the push carries the screen and record ids as well).
        for (var i = 0; i < 40 && screens.isEmpty && mounted; i++) {
          await Future<void>.delayed(const Duration(milliseconds: 250));
        }
        if (!mounted) return;
        final code = data['notification_code']?.toString();
        Json? notice;
        if (has('notifications')) {
          await fetchSection('notifications');
          notice = rows('notifications').where((row) => row['code']?.toString() == code).firstOrNull;
        }
        if (notice != null && notice['status'] != 'read') unawaited(markRead(notice));
        final target = noticeTarget(notice ?? Map<String, dynamic>.from(data));
        if (target != null) {
          target();
        } else if (has('notifications')) {
          open('notifications');
        }
      },
      onForeground: (title, body, data) {
        // The push is already shown in the notification bar; keep the badges and inbox current.
        if (!mounted) return;
        refreshChatBadge();
        if (has('notifications')) fetchSection('notifications');
      },
    );
    resumePush();
  }

  Future<void> resumePush() async {
    try {
      // Ask for notifications, camera and microphone when the app opens (prompts only appear
      // for permissions not answered yet), then connect device alerts.
      if (mounted) await AppPermissions.requestAtStartup(context);
      if (mounted) await enablePush();
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
    // Back from the phone's settings with notifications turned on: connect device alerts.
    if (state == AppLifecycleState.resumed && !pushBusy && pushStatus != 'Device alerts enabled' && push != null) {
      enablePush();
    }
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
    // Once per sign-in / app start: the fee due popup on the home screen.
    if (!feeAlertChecked && mounted && has('fees')) {
      feeAlertChecked = true;
      unawaited(showFeeAlert());
    }
  }

  bool feeAlertChecked = false;

  /// Semester fee due within a week, due today or overdue: a popup with the balance, the late
  /// fee and Pay now (the same alerts also arrive as notifications, three a day).
  Future<void> showFeeAlert() async {
    Json? alert;
    try {
      final result = await widget.api.feeAlert();
      if (result is Map && result['alert'] is Map) alert = Map<String, dynamic>.from(result['alert'] as Map);
    } catch (_) {
      return; // the popup is a convenience; the Fees screen still shows the balance
    }
    if (alert == null || !mounted) return;
    final a = alert;
    final term = '${a['term'] ?? 'semester'}';
    final days = int.tryParse('${a['days_left']}') ?? 0;
    final level = '${a['level']}';
    final late = num.tryParse('${a['late_fee_amount']}') ?? 0;
    final due = DateTime.tryParse('${a['due_date']}');
    final dueText = due == null ? '' : prettyDate(due);
    final who = '${a['student_name'] ?? ''}'.trim();
    final forWho = who.isEmpty || widget.role == MobileRole.student ? '' : ' for $who';
    final title = level == 'last_day'
        ? 'Last day to pay the $term fee'
        : level == 'overdue'
        ? '${term[0].toUpperCase()}${term.substring(1)} fee overdue'
        : '$days day${days == 1 ? '' : 's'} left to pay the $term fee';
    final balance = money(a['balance']);
    final lateText = late <= 0
        ? ''
        : a['late_fee_added'] == true
        ? ' A late fee of ${money(late)} has been added.'
        : level == 'overdue'
        ? ' A late fee of ${money(late)} will be added.'
        : ' Pay now, or a late fee of ${money(late)} will be added after $dueText.';
    final body = level == 'last_day'
        ? 'Today is the last day to pay $balance$forWho.$lateText'
        : level == 'overdue'
        ? '$balance$forWho was due on $dueText.$lateText'
        : '$balance$forWho is due on $dueText.$lateText';
    final pay = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        key: const ValueKey('fee-due-alert'),
        icon: Icon(level == 'due_soon' ? Icons.schedule_rounded : Icons.warning_amber_rounded,
            color: level == 'due_soon' ? null : Theme.of(dialog).colorScheme.error),
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Later')),
          FilledButton(onPressed: () => Navigator.pop(dialog, true), child: const Text('Pay now')),
        ],
      ),
    );
    if (pay != true || !mounted) return;
    final child = a['student_code']?.toString();
    if (child != null && child != student && widget.role == MobileRole.parent) await changeStudent(child);
    if (mounted) open('fees');
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
      if (key == 'fees' && has('payments')) unawaited(fetchSection('payments'));
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
  Widget pdfButtons(String title, Future<Uint8List> Function() load, {String view = 'View', String save = 'Download', Key? key}) => Wrap(
    key: key,
    spacing: 8,
    runSpacing: 8,
    children: [
      FilledButton.tonalIcon(
        onPressed: downloading ? null : () => pdfDocument(load, title),
        icon: const Icon(Icons.visibility_outlined, size: 18),
        label: Text(view),
      ),
      OutlinedButton.icon(
        onPressed: downloading ? null : () => pdfDocument(load, title, view: false),
        icon: const Icon(Icons.download_outlined, size: 18),
        label: Text(save),
      ),
    ],
  );

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
      }
      if (mounted) setState(() => pushStatus = status);
    } catch (e, stack) {
      // Shown in the device log (adb logcat -s flutter) to diagnose push setup.
      debugPrint('Device alerts could not connect: $e\n$stack');
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
                          const Text('Edu Nest'),
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
                        : Theme.of(
                            context,
                          ).colorScheme.primary.withValues(alpha: .12),
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
                    has(progress) ? progress : '_more',
                    null,
                    'messages',
                    '_more',
                  ][i],
                ),
          items: [
            EduNavItem(moduleIcon(primary), primaryLabel),
            const EduNavItem(Icons.insights_rounded, 'Progress'),
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
      MobileRole.admin => ['dues', 'collections', 'students', 'reports'],
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
    final schedule = has('timetable')
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
    if (family || learning) {
      return personalHome(
        context,
        name: name,
        greeting: greeting,
        today: today,
        periods: periods,
        events: events,
        announcements: announcements,
        children: children,
        summary: summary,
        priorities: priorities,
        records: records,
        schedule: schedule,
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

  /// Parent and student home: a glanceable dashboard of the selected student.
  List<Widget> personalHome(
    BuildContext context, {
    required String name,
    required String greeting,
    required DateTime today,
    required List<Json> periods,
    required List<Json> events,
    required List<Json> announcements,
    required List<Json> children,
    required Json? summary,
    required List<String> priorities,
    required List<Widget> Function(String key, String heading, {int limit})
    records,
    required List<Widget> schedule,
  }) {
    final role = widget.role;
    final family = role == MobileRole.parent;
    final child =
        children.where((c) => c['code'] == student).firstOrNull ??
        children.firstOrNull;
    final fees = family ? summary : cache['fees']?['summary'] as Json?;
    final totals = fees?['totals'] is Map
        ? Map<String, dynamic>.from(fees!['totals'] as Map)
        : fees;
    final outstanding = totals?['outstanding'];
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return [
      // One hero card: greeting, the student being viewed, attendance and quick figures.
      EduReveal(
        key: ValueKey('hero-${role.name}-$student'),
        child: FamilyHeroCard(
          key: ValueKey('hero-card-$student-$generation'),
          api: widget.api,
          studentCode: student ?? '',
          greeting: greeting,
          name: name,
          date: '${weekdays[today.weekday - 1]}, ${today.day} ${months[today.month - 1]}',
          childName: family ? (child?['name']?.toString()) : null,
          canSwitch: family && children.length > 1,
          onSwitch: () => showChildPicker(children),
          onProfile: has('profile') ? () => open('profile') : null,
          onAttendance: has('attendance') ? () => open('attendance') : null,
          feesDue: outstanding == null ? '—' : money(outstanding),
          feesLoading: busy && fees == null,
          onFees: has('fees') ? () => open('fees') : null,
          classesToday: periods.length,
          classesLoading: busy && cache['timetable'] == null,
          onClasses: has('timetable') ? () => open('timetable') : null,
          unread: unread,
          alertsLoading: busy && cache['notifications'] == null,
          onAlerts: has('notifications') ? () => open('notifications') : null,
        ),
      ),
      if (has('academics') || has('results')) ...[
        const SizedBox(height: 12),
        AcademicOverview(
          key: ValueKey('academic-home-$student-$generation'),
          api: widget.api,
          studentCode: student ?? '',
          onOpen: () => open(has('academics') ? 'academics' : 'results'),
        ),
      ],
      if (has('announcements')) ...[
        SectionHeading(
          title: 'Updates',
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
          LayoutBuilder(
            builder: (context, constraints) => SizedBox(
              height: EduSizes.scaled(context, 170),
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: announcements.take(6).length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (context, i) {
                  final notice = announcements[i];
                  final published = DateTime.tryParse(
                    '${notice['published_at'] ?? ''}',
                  );
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
      SectionHeading(
        title: 'Quick actions',
        action: 'View all',
        onAction: () => open('_more'),
      ),
      EduReveal(
        order: 2,
        child: EduGrid(
          fold: 3,
          spacing: 10,
          children: [
            for (final (i, key) in ['messages', ...priorities.where((k) => k != 'messages' && has(k))].take(6).indexed)
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
      ...schedule,
      if (!family) ...records('assignments', 'Your assignments'),
      ...records('results', 'Published results', limit: 1),
      if (!family) ...records('syllabus', 'Learning resources', limit: 1),
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
      const SizedBox(height: 20),
      OutlinedButton.icon(
        onPressed: () => open('_more'),
        icon: const Icon(Icons.grid_view_outlined),
        label: const Text('Explore your workspace'),
      ),
    ];
  }

  /// Slide-up list for parents with several linked children.
  Future<void> showChildPicker(List<Json> children) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (sheet) => SafeArea(
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        children: [
          Text('Choose a child', style: Theme.of(sheet).textTheme.titleLarge),
          const SizedBox(height: 8),
          for (final c in children)
            ListTile(
              selected: c['code'] == student,
              leading: Icon(
                c['code'] == student
                    ? Icons.radio_button_checked
                    : Icons.radio_button_off,
              ),
              title: Text('${c['name']}'),
              onTap: () {
                Navigator.pop(sheet);
                if (c['code'] != student) changeStudent('${c['code']}');
              },
            ),
        ],
      ),
    ),
  );

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
            [
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
              if ('${r['faculty'] ?? ''}'.isNotEmpty) '${r['faculty']}',
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

  List<Widget> screenContent(BuildContext context) {
    final all = rows(selected!);
    final students = (data?['students'] as List? ?? []).cast<Json>();
    final actions = selected == 'certificates' ? <Json>[] : (data?['actions'] as List? ?? []).cast<Json>();
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
    final items = (selected == 'certificates' ? <Json>[] : all).where((r) {
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
    if (selected == 'fees' &&
        (widget.role == MobileRole.parent || widget.role == MobileRole.student)) {
      return feesView(context, all, students, actions);
    }
    if (selected == 'messages') return messagesView(context, all, actions);
    if (selected == 'timetable' && all.any((r) => r['kind'] != null)) return weeklyTimetableView(context, all);
    final personal = widget.role == MobileRole.parent || widget.role == MobileRole.student;
    if (personal && selected == 'payments') return paymentsView(context, all, students);
    if (personal && (selected == 'leave' || selected == 'hostel')) {
      return requestsView(context, all, students, actions);
    }
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
        if (all.any((r) => r['status'] == 'read'))
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              key: const ValueKey('clear-read-notifications'),
              onPressed: saving ? null : clearRead,
              icon: const Icon(Icons.clear_all_rounded),
              label: Text('Clear read (${all.where((r) => r['status'] == 'read').length})'),
            ),
          )
        else
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
                onPressed: pushBusy
                    ? null
                    : () async {
                        // Android does not ask again once blocked: explain and open settings.
                        if (pushStatus.startsWith('Notifications are blocked') ||
                            pushStatus.startsWith('Notification permission has not been granted')) {
                          await AppPermissions.explainBlockedNotifications(context);
                        }
                        await enablePush();
                      },
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
      if (selected == 'reports')
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: FilledButton.icon(
            onPressed: () => download('finance-report', 'college'),
            icon: const Icon(Icons.download_outlined),
            label: const Text('Download finance report'),
          ),
        ),
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
        if (selected == 'notifications')
          EduPillTabs(
            labels: ['All', 'Unread ($unread)'],
            selected: filter == 'Unread' ? 1 : 0,
            onSelected: (i) => setState(() => filter = i == 1 ? 'Unread' : 'All'),
          )
        else if (selected == 'leave' || selected == 'assignments')
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
      if (items.isEmpty && selected != 'overview' && selected != 'reports' && selected != 'certificates')
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
                  ? () => download(data!['downloads'], r['code'])
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
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: pdfButtons('Receipt ${receipt['receipt_number'] ?? ''}'.trim(), () => widget.api.download('receipt', '${receipt['code']}'),
                        view: 'View receipt'),
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


  // ---------------------------------------------------------------------------
  // Inbox: categorised notifications that open the screen they are about.

  /// Category of a notification from the record it links to.
  ({String label, IconData icon, Color tint}) noticeKind(Json r) {
    final screen = '${r['screen'] ?? ''}';
    if (r['certificate_request_code'] != null || r['certificate_code'] != null || screen == 'certificates') {
      return (label: 'Certificates', icon: Icons.workspace_premium_outlined, tint: EduTints.clay);
    }
    if (r['thread_code'] != null || screen == 'messages') {
      return (label: 'Messages', icon: Icons.chat_bubble_outline_rounded, tint: EduTints.sage);
    }
    if (r['cash_transfer_code'] != null || screen == 'cash') {
      return (label: 'Cash', icon: Icons.payments_outlined, tint: EduTints.gold);
    }
    if (r['edit_request_code'] != null || screen == 'change-requests') {
      return (label: 'Approvals', icon: Icons.fact_check_outlined, tint: EduTints.clay);
    }
    if (r['payment_code'] != null) {
      return (label: 'Payments', icon: Icons.receipt_long_outlined, tint: EduTints.gold);
    }
    if (r['announcement_code'] != null || screen == 'announcements') {
      return (label: 'Announcements', icon: Icons.campaign_outlined, tint: EduTints.plum);
    }
    if (screen == 'attendance') {
      return (label: 'Attendance', icon: Icons.fact_check_outlined, tint: EduTints.clay);
    }
    if (screen == 'leave') {
      return (label: 'Leave', icon: Icons.event_busy_outlined, tint: EduTints.mist);
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
    if ((r['announcement_code'] != null || screen == 'announcements') && has('announcements')) return () => open('announcements');
    if (r['payment_code'] != null && has('fees')) return () => openPayment(r['payment_code'].toString(), r['receipt_number']?.toString(), r['student_code']?.toString());
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
  // Fees (parents and students): balance summary, semester plan and fee cards.

  String feeFilter = 'Due';

  /// Due-date status of a charge: label and tint (overdue, due soon, upcoming, paid).
  ({String label, Color tint}) feeStatus(Json r) {
    final balance = num.tryParse('${r['outstanding'] ?? r['balance'] ?? 0}') ?? 0;
    if (balance <= 0) return (label: 'Paid', tint: EduTints.sage);
    final due = DateTime.tryParse('${r['due_date'] ?? ''}');
    if (due == null) return (label: 'Not scheduled', tint: EduTints.mist);
    final days = DateUtils.dateOnly(due).difference(DateUtils.dateOnly(DateTime.now())).inDays;
    if (days < 0) return (label: 'Overdue ${-days}d', tint: EduTints.clay);
    if (days == 0) return (label: 'Due today', tint: EduTints.clay);
    if (days <= 7) return (label: 'Due in ${days}d', tint: EduTints.gold);
    return (label: 'Due ${prettyDate(due)}', tint: EduTints.mist);
  }


  /// Payment mode label and icon.
  ({String label, IconData icon}) paymentMode(Object? method) => switch ('$method') {
    'cash' => (label: 'Cash', icon: Icons.payments_outlined),
    'bank_transfer' => (label: 'Bank transfer', icon: Icons.account_balance_outlined),
    'cheque' => (label: 'Cheque', icon: Icons.receipt_outlined),
    'card' => (label: 'Card', icon: Icons.credit_card_rounded),
    'upi' => (label: 'UPI', icon: Icons.qr_code_2_rounded),
    'online' || 'gateway' => (label: 'Online', icon: Icons.language_rounded),
    final other when other.isNotEmpty && other != 'null' => (label: other.replaceAll('_', ' '), icon: Icons.payments_outlined),
    _ => (label: 'Payment', icon: Icons.payments_outlined),
  };

  ({String label, Color tint}) paymentState(Object? status) => switch ('$status') {
    'settled' || 'paid' || 'success' || 'completed' => (label: 'Successful', tint: EduTints.sage),
    'pending' || 'initiated' || 'processing' => (label: 'Pending', tint: EduTints.gold),
    'failed' || 'cancelled' || 'reversed' || 'refunded' => (label: '${status ?? 'Failed'}'.replaceFirstMapped(RegExp('^.'), (m) => m[0]!.toUpperCase()), tint: EduTints.clay),
    _ => (label: '$status'.isEmpty || '$status' == 'null' ? 'Recorded' : '$status', tint: EduTints.mist),
  };

  /// "22 October 2026 · 4:35 PM", or the date with "time not recorded" for older payments.
  String paymentWhen(Json p) {
    final at = DateTime.tryParse('${p['recorded_at'] ?? ''}')?.toLocal();
    final day = DateTime.tryParse('${p['paid_on'] ?? ''}') ?? at;
    if (day == null) return 'Date not recorded';
    if (at == null) return '${prettyDate(day)} · time not recorded';
    final hour = at.hour % 12 == 0 ? 12 : at.hour % 12;
    return '${prettyDate(day)} · $hour:${at.minute.toString().padLeft(2, '0')} ${at.hour < 12 ? 'AM' : 'PM'}';
  }

  /// Payment details: amount, status, transaction, date and time, mode, what it paid for, receipts.
  Future<void> showPayment(Json p) {
    final mode = paymentMode(p['method']);
    final state = paymentState(p['status']);
    final allocations = (p['allocations'] as List? ?? []).whereType<Map>().toList();
    final receipts = (p['receipts'] as List? ?? []).whereType<Map>().toList();
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (sheet) {
        final text = Theme.of(sheet).textTheme;
        Widget row(String label, String value, {VoidCallback? onTap, IconData? trailing}) => InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(width: 120, child: Text(label, style: text.bodySmall)),
              Expanded(child: Text(value, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
              if (trailing != null) Icon(trailing, size: 16, color: collegeMuted),
            ]),
          ),
        );
        return Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              children: [
                Row(children: [
                  Container(width: 52, height: 52, decoration: BoxDecoration(color: state.tint, shape: BoxShape.circle), child: Icon(mode.icon, color: EduTints.ink(state.tint))),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text.rich(TextSpan(text: money(p['amount'])), style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                      Text('${mode.label} payment', style: text.bodySmall),
                    ]),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(color: state.tint, borderRadius: BorderRadius.circular(99)),
                    child: Text(state.label, style: text.labelMedium?.copyWith(color: EduTints.ink(state.tint), fontWeight: FontWeight.w700)),
                  ),
                ]),
                const SizedBox(height: 16),
                const Divider(height: 1),
                row('Transaction no.', '${p['transaction_reference'] ?? '—'}', trailing: Icons.copy_rounded, onTap: () {
                  Clipboard.setData(ClipboardData(text: '${p['transaction_reference'] ?? ''}'));
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Transaction number copied')));
                }),
                row('Date & time', paymentWhen(p)),
                row('Payment mode', mode.label),
                row('Status', state.label),
                if (p['student_name'] != null) row('Student', '${p['student_name']}'),
                row('Payment ID', '${p['code'] ?? '—'}'),
                if (allocations.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text('Paid for', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  for (final a in allocations)
                    Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(color: collegeCanvas, borderRadius: BorderRadius.circular(12)),
                      child: Row(children: [
                        Expanded(child: Text('${a['fee_head'] ?? 'Fee'}${a['semester_number'] == null ? '' : ' · Semester ${a['semester_number']}'}', style: text.bodyMedium)),
                        Text.rich(TextSpan(text: money(a['amount'])), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                      ]),
                    ),
                ],
                if (receipts.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Text('Receipts', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  for (final r in receipts)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: collegeCanvas, borderRadius: BorderRadius.circular(14)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Icon(Icons.receipt_long_outlined, size: 18, color: Theme.of(context).colorScheme.primary),
                          const SizedBox(width: 8),
                          Expanded(child: Text('Receipt ${r['receipt_number'] ?? ''}', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
                        ]),
                        const SizedBox(height: 8),
                        pdfButtons('Receipt ${r['receipt_number'] ?? ''}'.trim(), () => widget.api.download('receipt', '${r['code']}'),
                            key: ValueKey('receipt-pdf-${r['code']}')),
                      ]),
                    ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  /// One payment in the history list.
  Widget paymentCard(Json p) {
    final text = Theme.of(context).textTheme;
    final mode = paymentMode(p['method']);
    final state = paymentState(p['status']);
    final allocations = (p['allocations'] as List? ?? []).whereType<Map>().toList();
    return Material(
      color: collegeIvory,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: const BorderSide(color: collegeLine)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: ValueKey('payment-${p['code']}'),
        onTap: () => showPayment(p),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(width: 44, height: 44, decoration: BoxDecoration(color: state.tint, shape: BoxShape.circle), child: Icon(mode.icon, size: 21, color: EduTints.ink(state.tint))),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text.rich(TextSpan(text: money(p['amount'])), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                  Text('${mode.label} · ${paymentWhen(p)}', style: text.bodySmall),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(color: state.tint, borderRadius: BorderRadius.circular(99)),
                    child: Text(state.label, style: text.labelMedium?.copyWith(color: EduTints.ink(state.tint), fontWeight: FontWeight.w700)),
                  ),
                ]),
              ),
            ]),
            const SizedBox(height: 10),
            Text('Txn ${p['transaction_reference'] ?? '—'}', maxLines: 1, overflow: TextOverflow.ellipsis, style: text.labelMedium?.copyWith(letterSpacing: .3)),
            if (allocations.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final a in allocations)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                    decoration: BoxDecoration(color: collegeCanvas, borderRadius: BorderRadius.circular(99)),
                    child: Text.rich(TextSpan(text: '${a['fee_head'] ?? 'Fee'} ${money(a['amount'])}'), style: text.labelSmall?.copyWith(fontWeight: FontWeight.w600)),
                  ),
              ]),
            ],
            const SizedBox(height: 6),
            Row(children: [
              if ((p['receipts'] as List? ?? []).isNotEmpty) ...[
                Icon(Icons.receipt_long_outlined, size: 15, color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 4),
                Expanded(child: Text('Receipt available', maxLines: 1, overflow: TextOverflow.ellipsis, style: text.labelSmall)),
              ] else
                const Spacer(),
              Text('Details', style: text.labelMedium?.copyWith(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.w700)),
              Icon(Icons.chevron_right, size: 18, color: Theme.of(context).colorScheme.primary),
            ]),
          ]),
        ),
      ),
    );
  }

  void payCharge(Json r, List<Json> actions) {
    final descriptor = actions.where((a) => a['key'] == 'make_payment').firstOrNull;
    if (descriptor == null) return;
    action(descriptor, initial: {'charge_code': r['code'], 'amount': r['outstanding'] ?? r['balance']});
  }

  List<Widget> feesView(BuildContext context, List<Json> all, List<Json> students, List<Json> actions) {
    final text = Theme.of(context).textTheme;
    final summary = data?['summary'] as Json?;
    final totals = summary?['totals'] is Map ? Map<String, dynamic>.from(summary!['totals'] as Map) : (summary ?? {});
    num n(Object? v) => num.tryParse('${v ?? 0}') ?? 0;
    final gross = n(totals['gross']), paid = n(totals['paid']), outstanding = n(totals['outstanding']);
    final relief = n(totals['discount']) + n(totals['scholarship']);
    final net = (gross - relief) > 0 ? gross - relief : paid + outstanding;
    final canPay = actions.any((a) => a['key'] == 'make_payment');
    final due = all.where((r) => n(r['outstanding'] ?? r['balance']) > 0).toList()
      ..sort((a, b) => '${a['due_date'] ?? '9999'}'.compareTo('${b['due_date'] ?? '9999'}'));
    final settled = all.where((r) => n(r['outstanding'] ?? r['balance']) <= 0).toList();
    final next = due.firstOrNull;
    final nextStatus = next == null ? (label: 'All fees paid', tint: EduTints.sage) : feeStatus(next);
    final history = has('payments');
    final payments = [...rows('payments')]
      ..sort((a, b) => '${b['recorded_at'] ?? b['paid_on'] ?? ''}'.compareTo('${a['recorded_at'] ?? a['paid_on'] ?? ''}'));
    final paymentsLoading = history && cache['payments'] == null && sectionErrors['payments'] == null;
    final shown = feeFilter == 'Due' ? due : feeFilter == 'Paid' ? settled : all;
    final terms = [
      for (final plan in (summary?['course_plans'] as List? ?? []).whereType<Map>())
        for (final t in (plan['terms'] as List? ?? []).whereType<Map>()) Map<String, dynamic>.from(t),
    ];

    Widget fact(String label, String value) => Expanded(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.labelMedium),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text.rich(TextSpan(text: value), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
        ),
      ]),
    );

    final hero = Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xfff6ecd8), Color(0xfff3e2d6)], begin: Alignment.topLeft, end: Alignment.bottomRight),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: collegeLine),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Outstanding balance', style: text.labelLarge?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(money(outstanding), style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
              ),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: nextStatus.tint, borderRadius: BorderRadius.circular(99)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(next == null ? Icons.verified_rounded : Icons.event_outlined, size: 14, color: EduTints.ink(nextStatus.tint)),
                  const SizedBox(width: 5),
                  Flexible(
                    child: Text(next == null ? nextStatus.label : 'Next: ${nextStatus.label}', maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: text.labelMedium?.copyWith(color: EduTints.ink(nextStatus.tint), fontWeight: FontWeight.w700)),
                  ),
                ]),
              ),
            ]),
          ),
          const SizedBox(width: 12),
          EduRing(
            value: net <= 0 ? null : (paid / net).clamp(0, 1).toDouble(),
            size: 88,
            color: collegePine,
            center: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(net <= 0 ? '—' : '${(paid / net * 100).clamp(0, 100).round()}%', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
              Text('paid', style: text.labelSmall),
            ]),
          ),
        ]),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: collegeIvory.withValues(alpha: .7), borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            fact('Total fees', money(net)),
            fact('Paid', money(paid)),
            if (relief > 0) fact('Concessions', money(relief)),
          ]),
        ),
        if (canPay && next != null) ...[
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              key: const ValueKey('pay-next-fee'),
              onPressed: saving ? null : () => payCharge(next, actions),
              icon: const Icon(Icons.lock_outline_rounded, size: 18),
              label: Text('Pay next due · ${next['fee_head'] ?? 'Fee'}', maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
          ),
        ],
      ]),
    );

    Widget termCard(Map<String, dynamic> t) {
      final total = n(t['total']), tPaid = n(t['paid']);
      final status = '${t['status'] ?? ''}';
      final tint = switch (status) { 'Paid' => EduTints.sage, 'Overdue' => EduTints.clay, 'Upcoming' => EduTints.gold, _ => EduTints.mist };
      final dueDate = DateTime.tryParse('${t['due_date'] ?? ''}');
      return Container(
        width: EduSizes.scaled(context, 168),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: collegeIvory, borderRadius: BorderRadius.circular(20), border: Border.all(color: collegeLine)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Semester ${t['semester']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
          Text('Year ${t['year']}${dueDate == null ? '' : ' · due ${dueDate.day}/${dueDate.month}'}', maxLines: 1, overflow: TextOverflow.ellipsis, style: text.labelSmall),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(99)),
            child: Text(status, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.labelSmall?.copyWith(color: EduTints.ink(tint), fontWeight: FontWeight.w700)),
          ),
          const Spacer(),
          Text.rich(TextSpan(text: money(total)), style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(value: total <= 0 ? 0 : (tPaid / total).clamp(0, 1).toDouble(), minHeight: 6, color: collegePine, backgroundColor: collegeCard),
          ),
          const SizedBox(height: 4),
          Text.rich(TextSpan(text: 'Paid ${money(tPaid)}'), style: text.labelSmall),
        ]),
      );
    }

    Widget chargeCard(Json r) {
      final status = feeStatus(r);
      final rGross = n(r['gross'] ?? r['amount']);
      final rNet = rGross - n(r['discount']) - n(r['scholarship']);
      final rPaid = n(r['paid']), rBalance = n(r['outstanding'] ?? r['balance']);
      final receipts = (r['receipts'] as List? ?? []).whereType<Map>().toList();
      Widget figure(String label, num value, {bool strong = false}) => Expanded(
        child: Text.rich(
          TextSpan(children: [
            TextSpan(text: '$label\n', style: text.labelSmall),
            TextSpan(text: money(value), style: text.titleSmall?.copyWith(fontWeight: strong ? FontWeight.w800 : FontWeight.w600)),
          ]),
          maxLines: 2,
        ),
      );
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: collegeIvory, borderRadius: BorderRadius.circular(22), border: Border.all(color: collegeLine)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(color: status.tint, shape: BoxShape.circle),
              child: Icon(rBalance <= 0 ? Icons.check_rounded : Icons.account_balance_wallet_outlined, color: EduTints.ink(status.tint), size: 21),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${r['fee_head'] ?? 'Fee'}', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                if (r['semester_number'] != null || (students.length > 1 && r['student_name'] != null))
                  Text(
                    [if (r['semester_number'] != null) 'Semester ${r['semester_number']}', if (students.length > 1 && r['student_name'] != null) '${r['student_name']}'].join(' · '),
                    style: text.bodySmall,
                  ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(color: status.tint, borderRadius: BorderRadius.circular(99)),
                  child: Text(status.label, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: text.labelMedium?.copyWith(color: EduTints.ink(status.tint), fontWeight: FontWeight.w700)),
                ),
              ]),
            ),
          ]),
          const SizedBox(height: 14),
          Row(children: [
            figure('Net fee', rNet > 0 ? rNet : rGross),
            figure('Paid', rPaid),
            figure('Balance', rBalance, strong: true),
          ]),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: (rPaid + rBalance) <= 0 ? 1 : (rPaid / (rPaid + rBalance)).clamp(0, 1).toDouble(),
              minHeight: 8,
              color: rBalance <= 0 ? collegePine : EduTints.ink(EduTints.gold),
              backgroundColor: collegeCard,
            ),
          ),
          if ((canPay && rBalance > 0) || receipts.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              if (canPay && rBalance > 0)
                FilledButton.icon(
                  onPressed: saving ? null : () => payCharge(r, actions),
                  icon: const Icon(Icons.payments_outlined, size: 18),
                  label: Text.rich(TextSpan(text: 'Pay ${money(rBalance)}')),
                ),
              for (final receipt in receipts)
                OutlinedButton.icon(
                  onPressed: downloading
                      ? null
                      : () => pdfDocument(() => widget.api.download('receipt', '${receipt['code']}'), 'Receipt ${receipt['receipt_number'] ?? ''}'.trim()),
                  icon: const Icon(Icons.receipt_long_outlined, size: 18),
                  label: Text('Receipt ${receipt['receipt_number'] ?? ''}'),
                ),
            ]),
          ],
        ]),
      );
    }

    return [
      if (students.length > 1) ...[
        DropdownButtonFormField<String>(
          key: ValueKey('fees-student-$student'),
          initialValue: student,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Student', prefixIcon: Icon(Icons.person_outline)),
          items: [for (final s in students) DropdownMenuItem<String>(value: s['code'], child: Text(s['name']))],
          onChanged: (v) { if (v != null) changeStudent(v); },
        ),
        const SizedBox(height: 16),
      ],
      EduReveal(child: hero),
      if (student != null && all.isNotEmpty) ...[
        const SizedBox(height: 12),
        Container(
          key: const ValueKey('fee-statement'),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: collegeLine)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: EduTints.gold, borderRadius: BorderRadius.circular(12)),
                child: Icon(Icons.description_outlined, color: EduTints.ink(EduTints.gold), size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Fee statement', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800)),
                  Text('Every fee, concession, receipt and the balance due — as a PDF', style: text.bodySmall),
                ]),
              ),
            ]),
            const SizedBox(height: 10),
            pdfButtons('Fee statement', () => widget.api.printPdf('fee-statement/${Uri.encodeComponent(student!)}')),
          ]),
        ),
      ],
      if (terms.isNotEmpty) ...[
        SectionHeading(title: 'Semester plan'),
        SizedBox(
          height: EduSizes.scaled(context, 178),
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: terms.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (_, i) => termCard(terms[i]),
          ),
        ),
      ],
      SectionHeading(
        title: 'Fee details',
        action: has('payments') ? 'Payment history' : null,
        onAction: has('payments') ? () => open('payments') : null,
      ),
      EduPillTabs(
        labels: [
          'Due (${due.length})',
          history ? (paymentsLoading ? 'Payments' : 'Payments (${payments.length})') : 'Paid (${settled.length})',
          'All fees (${all.length})',
        ],
        selected: const ['Due', 'Paid', 'All'].indexOf(feeFilter),
        onSelected: (i) => setState(() => feeFilter = const ['Due', 'Paid', 'All'][i]),
      ),
      const SizedBox(height: 14),
      // Payments tab: every payment made (full or part), newest first.
      if (feeFilter == 'Paid' && history) ...[
        if (sectionErrors['payments'] != null)
          sectionFailure('payments')
        else if (paymentsLoading)
          const EduLoadingSkeleton()
        else if (payments.isEmpty)
          const QuietEmpty(
            icon: Icons.receipt_long_outlined,
            title: 'No payments yet',
            message: 'Payments made at the college office or online appear here with their receipts.',
          )
        else
          EduGrid(phone: 1, fold: 2, tablet: 2, children: payments.map(paymentCard).toList()),
      ] else if (shown.isEmpty)
        QuietEmpty(
          icon: feeFilter == 'Due' ? Icons.verified_outlined : Icons.receipt_long_outlined,
          title: feeFilter == 'Due' ? 'No fees due' : feeFilter == 'Paid' ? 'No fully paid fees yet' : 'No fees recorded',
          message: feeFilter == 'Due' ? 'Everything is paid up. Receipts are under Payments.' : 'Fee charges appear here once the college raises them.',
        )
      else
        // One column on phones; two on unfolded phones and tablets.
        EduGrid(phone: 1, fold: 2, tablet: 2, children: shown.map(chargeCard).toList()),
      if (all.length < (data?['total'] as int? ?? 0))
        OutlinedButton(onPressed: paging ? null : loadMore, child: Text(paging ? 'Loading…' : 'Load more fees')),
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
  // Payments & receipts, leave and hostel permissions (parents and students).

  String requestFilter = 'All';

  Widget studentPicker(List<Json> students) => students.length > 1
      ? Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: DropdownButtonFormField<String>(
            key: ValueKey('$selected-student-$student'),
            initialValue: student,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Student', prefixIcon: Icon(Icons.person_outline)),
            items: [for (final s in students) DropdownMenuItem<String>(value: s['code'], child: Text(s['name']))],
            onChanged: (v) { if (v != null) changeStudent(v); },
          ),
        )
      : const SizedBox.shrink();

  List<Widget> paymentsView(BuildContext context, List<Json> all, List<Json> students) {
    final text = Theme.of(context).textTheme;
    final payments = [...all]
      ..sort((a, b) => '${b['recorded_at'] ?? b['paid_on'] ?? ''}'.compareTo('${a['recorded_at'] ?? a['paid_on'] ?? ''}'));
    final total = payments.fold<num>(0, (sum, p) => sum + (num.tryParse('${p['amount'] ?? 0}') ?? 0));
    final receipts = payments.fold<int>(0, (sum, p) => sum + ((p['receipts'] as List?)?.length ?? 0));
    final latest = payments.firstOrNull;
    return [
      studentPicker(students),
      EduReveal(
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xffe8efe2), Color(0xffe3ebee)], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(26),
            border: Border.all(color: collegeLine),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Total paid', style: text.labelLarge?.copyWith(fontWeight: FontWeight.w700)),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text.rich(TextSpan(text: money(total)), style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: collegeIvory.withValues(alpha: .75), borderRadius: BorderRadius.circular(16)),
              child: Row(children: [
                for (final (label, value) in [
                  ('Payments', '${payments.length}'),
                  ('Receipts', '$receipts'),
                  ('Last paid', latest == null ? '—' : prettyDate(DateTime.tryParse('${latest['paid_on']}') ?? DateTime.now())),
                ])
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(label, style: text.labelMedium),
                      FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(value, style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800))),
                    ]),
                  ),
              ]),
            ),
            if (has('fees')) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(onPressed: () => open('fees'), icon: const Icon(Icons.account_balance_wallet_outlined), label: const Text('View fees due')),
            ],
          ]),
        ),
      ),
      SectionHeading(title: 'Payment history'),
      if (payments.isEmpty)
        const QuietEmpty(icon: Icons.receipt_long_outlined, title: 'No payments yet', message: 'Payments made at the college office or online appear here with their receipts.')
      else
        EduGrid(phone: 1, fold: 2, tablet: 2, children: payments.map(paymentCard).toList()),
    ];
  }

  /// Leave and hostel permission requests: status counts, a request button and request cards.
  List<Widget> requestsView(BuildContext context, List<Json> all, List<Json> students, List<Json> actions) {
    final text = Theme.of(context).textTheme;
    final hostel = selected == 'hostel';
    String state(Json r) => '${r['status'] ?? 'pending'}'.toLowerCase();
    bool approved(Json r) => const {'approved', 'completed', 'returned'}.contains(state(r));
    bool rejected(Json r) => const {'rejected', 'declined', 'cancelled'}.contains(state(r));
    final pending = all.where((r) => !approved(r) && !rejected(r)).length;
    final ok = all.where(approved).length;
    final no = all.where(rejected).length;
    final shown = all.where((r) => switch (requestFilter) {
      'Pending' => !approved(r) && !rejected(r),
      'Approved' => approved(r),
      'Declined' => rejected(r),
      _ => true,
    }).toList()
      ..sort((a, b) => '${b[hostel ? 'leave_at' : 'start_date'] ?? ''}'.compareTo('${a[hostel ? 'leave_at' : 'start_date'] ?? ''}'));
    final descriptor = actions.where((a) => a['key'] == (hostel ? 'request_hostel_permission' : 'request_student_leave')).firstOrNull;

    String when(Object? value, {bool withTime = false}) {
      final t = DateTime.tryParse('${value ?? ''}');
      if (t == null) return '—';
      if (!withTime) return prettyDate(t);
      final hour = t.hour % 12 == 0 ? 12 : t.hour % 12;
      return '${prettyDate(t)}, $hour:${t.minute.toString().padLeft(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}';
    }

    Widget card(Json r) {
      final status = approved(r)
          ? (label: 'Approved', tint: EduTints.sage, icon: Icons.check_circle_rounded)
          : rejected(r)
          ? (label: 'Declined', tint: EduTints.clay, icon: Icons.cancel_rounded)
          : (label: 'Pending', tint: EduTints.gold, icon: Icons.hourglass_top_rounded);
      final from = DateTime.tryParse('${r[hostel ? 'leave_at' : 'start_date'] ?? ''}');
      final to = DateTime.tryParse('${r[hostel ? 'return_at' : 'end_date'] ?? ''}');
      final days = from == null || to == null ? null : DateUtils.dateOnly(to).difference(DateUtils.dateOnly(from)).inDays + 1;
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: collegeIvory, borderRadius: BorderRadius.circular(20), border: Border.all(color: collegeLine)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(color: status.tint, shape: BoxShape.circle),
              child: Icon(hostel ? Icons.directions_walk_rounded : Icons.event_busy_outlined, color: EduTints.ink(status.tint), size: 21),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  hostel ? 'Out pass' : days == null ? 'Leave' : '$days day${days == 1 ? '' : 's'} leave',
                  style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                ),
                if (r['student_name'] != null && students.length > 1) Text('${r['student_name']}', style: text.bodySmall),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(color: status.tint, borderRadius: BorderRadius.circular(99)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(status.icon, size: 14, color: EduTints.ink(status.tint)),
                    const SizedBox(width: 5),
                    Text(status.label, style: text.labelMedium?.copyWith(color: EduTints.ink(status.tint), fontWeight: FontWeight.w700)),
                  ]),
                ),
              ]),
            ),
          ]),
          const SizedBox(height: 14),
          // From → to timeline.
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: collegeCanvas, borderRadius: BorderRadius.circular(14)),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(hostel ? 'Leaves' : 'From', style: text.labelSmall),
                  Text(when(r[hostel ? 'leave_at' : 'start_date'], withTime: hostel), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                ]),
              ),
              const Padding(padding: EdgeInsets.symmetric(horizontal: 8), child: Icon(Icons.arrow_forward_rounded, size: 18, color: collegeMuted)),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(hostel ? 'Returns' : 'To', style: text.labelSmall),
                  Text(when(r[hostel ? 'return_at' : 'end_date'], withTime: hostel), style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                ]),
              ),
            ]),
          ),
          if ('${r['reason'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text('Reason', style: text.labelSmall),
            Text('${r['reason']}', style: text.bodyMedium),
          ],
          if (hostel && '${r['pickup_person_name'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(children: [
              const Icon(Icons.person_pin_circle_outlined, size: 18, color: collegeMuted),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Pickup: ${r['pickup_person_name']}${'${r['pickup_relationship'] ?? ''}'.isEmpty ? '' : ' (${'${r['pickup_relationship']}'.replaceAll('_', ' ')})'}',
                  style: text.bodySmall,
                ),
              ),
            ]),
          ],
          if ('${r['decision_note'] ?? r['remarks'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text('College note: ${r['decision_note'] ?? r['remarks']}', style: text.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
          ],
        ]),
      );
    }

    return [
      studentPicker(students),
      EduGrid(phone: 3, fold: 3, tablet: 3, spacing: 10, children: [
        EduStatCard(label: 'Pending', value: '$pending', icon: Icons.hourglass_top_rounded, tint: EduTints.gold, onTap: () => setState(() => requestFilter = 'Pending')),
        EduStatCard(label: 'Approved', value: '$ok', icon: Icons.check_circle_outline, tint: EduTints.sage, onTap: () => setState(() => requestFilter = 'Approved')),
        EduStatCard(label: 'Declined', value: '$no', icon: Icons.block_outlined, tint: EduTints.clay, onTap: () => setState(() => requestFilter = 'Declined')),
      ]),
      if (descriptor != null) ...[
        const SizedBox(height: 14),
        FilledButton.icon(
          key: ValueKey('request-$selected'),
          onPressed: saving ? null : () => action(descriptor),
          icon: Icon(hostel ? Icons.directions_walk_rounded : Icons.event_available_outlined),
          label: Text(hostel ? 'Request hostel permission' : 'Request leave'),
        ),
      ],
      const SizedBox(height: 18),
      EduPillTabs(
        labels: const ['All', 'Pending', 'Approved', 'Declined'],
        selected: const ['All', 'Pending', 'Approved', 'Declined'].indexOf(requestFilter),
        onSelected: (i) => setState(() => requestFilter = const ['All', 'Pending', 'Approved', 'Declined'][i]),
      ),
      const SizedBox(height: 14),
      if (shown.isEmpty)
        QuietEmpty(
          icon: hostel ? Icons.directions_walk_rounded : Icons.event_available_outlined,
          title: requestFilter == 'All' ? (hostel ? 'No hostel permissions yet' : 'No leave requests yet') : 'Nothing ${requestFilter.toLowerCase()}',
          message: hostel ? 'Request an out pass with the pickup person and return time.' : 'Request leave with the dates and the reason.',
        )
      else
        EduGrid(phone: 1, fold: 2, tablet: 2, children: shown.map(card).toList()),
    ];
  }

  /// Removes the read notifications from this inbox (unread ones stay).
  Future<void> clearRead() async {
    if (saving) return;
    setState(() => saving = true);
    try {
      final result = await widget.api.clearReadNotifications();
      await fetchSection('notifications');
      final cleared = (result is Map ? result['cleared'] : null) ?? 0;
      if (mounted) toast('Cleared $cleared read notification${cleared == 1 ? '' : 's'}', success: true);
    } catch (e) {
      if (mounted) toast(e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  /// A payment notice opens Fees and that payment's details (receipt, what it settled).
  Future<void> openPayment(String code, String? receipt, String? studentCode) async {
    open('fees');
    if (!has('payments')) return;
    await fetchSection('payments');
    final payment = rows('payments')
        .where((r) => r['code']?.toString() == code || (receipt != null && (r['receipts'] as List? ?? [])
            .any((x) => x is Map && x['receipt_number']?.toString() == receipt)))
        .firstOrNull;
    if (payment != null && mounted) await showPayment(payment);
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

/// Parent / student home hero: greeting, the student being viewed, this month's attendance
/// ring with today's status, and quick figures for fees, today's classes and alerts.
class FamilyHeroCard extends StatefulWidget {
  final CollegeApi api;
  final String studentCode, greeting, name, date;
  final String? childName;
  final bool canSwitch;
  final VoidCallback? onSwitch, onProfile, onAttendance, onFees, onClasses, onAlerts;
  final String feesDue;
  final bool feesLoading, classesLoading, alertsLoading;
  final int classesToday, unread;
  const FamilyHeroCard({
    super.key,
    required this.api,
    required this.studentCode,
    required this.greeting,
    required this.name,
    required this.date,
    this.childName,
    this.canSwitch = false,
    this.onSwitch,
    this.onProfile,
    this.onAttendance,
    this.onFees,
    this.onClasses,
    this.onAlerts,
    required this.feesDue,
    this.feesLoading = false,
    this.classesLoading = false,
    this.alertsLoading = false,
    required this.classesToday,
    required this.unread,
  });
  @override
  State<FamilyHeroCard> createState() => _FamilyHeroCardState();
}

class _FamilyHeroCardState extends State<FamilyHeroCard> {
  Json? attendance;
  bool failed = false;
  /// Day shown on the attendance card; tap a bar or the date chip to change it.
  DateTime shownDay = DateUtils.dateOnly(DateTime.now());
  static const _monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  void showDay(DateTime value) {
    final next = DateUtils.dateOnly(value);
    if (next == shownDay) return;
    setState(() => shownDay = next);
    load();
  }

  Future<void> pickDay() async {
    final now = DateUtils.dateOnly(DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: shownDay.isAfter(now) ? now : shownDay,
      firstDate: DateTime(now.year - 5),
      lastDate: now,
      helpText: 'Show attendance for',
    );
    if (picked != null && mounted) showDay(picked);
  }

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void didUpdateWidget(covariant FamilyHeroCard old) {
    super.didUpdateWidget(old);
    if (old.studentCode != widget.studentCode) load();
  }

  Future<void> load() async {
    setState(() {
      attendance = null;
      failed = false;
    });
    final now = shownDay;
    try {
      final value = Map<String, dynamic>.from(
        await widget.api.attendance(
              studentCode: widget.studentCode,
              on: '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}',
            )
            as Map,
      );
      if (mounted) setState(() => attendance = value);
    } catch (_) {
      if (mounted) setState(() => failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final summaries = Map<String, dynamic>.from(
      attendance?['summaries'] as Map? ?? {},
    );
    final month = Map<String, dynamic>.from(summaries['month'] as Map? ?? {});
    final day = Map<String, dynamic>.from(summaries['day'] as Map? ?? {});
    final pct = month['percentage'] as num?;
    final loading = attendance == null && !failed;
    // The shown day's status as a short pill; the icon carries the meaning.
    final isToday = DateUtils.isSameDay(shownDay, DateTime.now());
    final dayLabel = '${shownDay.day} ${_monthNames[shownDay.month - 1]}';
    final (today, todayTint, todayIcon) = (day['leave_days'] as num? ?? 0) > 0
        ? (isToday ? 'On leave' : 'On leave · $dayLabel', EduTints.gold, Icons.event_busy_outlined)
        : (day['recorded'] as num? ?? 0) == 0
        ? (isToday ? 'Not marked' : 'Not marked · $dayLabel', EduTints.mist, Icons.schedule_rounded)
        : (day['attended'] as num? ?? 0) > 0
        ? (isToday ? 'Present today' : 'Present · $dayLabel', EduTints.sage, Icons.check_circle_rounded)
        : (isToday ? 'Absent today' : 'Absent · $dayLabel', EduTints.clay, Icons.cancel_rounded);
    // Recent class days up to the shown day for the mini chart.
    final now = shownDay;
    final recent = _asRows(attendance?['calendar'])
        .where((d) {
          final date = DateTime.tryParse('${d['date']}');
          return date != null && !date.isAfter(now) && d['percentage'] != null;
        })
        .toList();
    bool isShown(Json d) => '${d['date']}' == '${shownDay.year}-${shownDay.month.toString().padLeft(2, '0')}-${shownDay.day.toString().padLeft(2, '0')}';
    // A tappable bar for one class day; the shown day is outlined.
    Widget dayTap(Json d, Widget child) => Semantics(
      button: true,
      selected: isShown(d),
      label: 'Show attendance for ${d['date']}',
      excludeSemantics: true,
      child: InkWell(
        key: ValueKey('home-day-${d['date']}'),
        borderRadius: BorderRadius.circular(8),
        onTap: () => showDay(DateTime.parse('${d['date']}')),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 2),
          decoration: isShown(d)
              ? BoxDecoration(color: collegeCanvas, borderRadius: BorderRadius.circular(8), border: Border.all(color: collegeLine))
              : null,
          child: child,
        ),
      ),
    );
    final week = recent.length > 6 ? recent.sublist(recent.length - 6) : recent;

    Widget tile(IconData icon, Color tint, String label, String value, bool busy, VoidCallback? onTap) {
      final ink = EduTints.ink(tint);
      return Expanded(
        child: Semantics(
          button: onTap != null,
          label: busy ? '$label: loading' : '$label: $value',
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
                    decoration: const BoxDecoration(color: collegeIvory, shape: BoxShape.circle),
                    child: Icon(icon, size: 17, color: ink),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: EduSizes.scaled(context, 24),
                    child: busy
                        ? EduShimmer(child: EduSkeletonBox(width: 54, height: 18, color: ink.withValues(alpha: .15)))
                        : AnimatedSwitcher(
                            duration: EduMotion.duration(context, EduMotion.tab),
                            child: FittedBox(
                              key: ValueKey(value),
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: Text(value, maxLines: 1, style: text.titleLarge?.copyWith(color: ink, fontWeight: FontWeight.w800)),
                            ),
                          ),
                  ),
                  Text(label, maxLines: 2, overflow: TextOverflow.ellipsis, style: text.labelMedium?.copyWith(color: ink.withValues(alpha: .85), fontWeight: FontWeight.w600)),
                ]),
              ),
            ),
          ),
        ),
      );
    }

    Color barColor(num pct) => pct >= 90
        ? collegePine
        : pct >= 75
        ? EduTints.ink(EduTints.gold)
        : EduTints.ink(EduTints.clay);
    Widget weekStrip() => Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
      Text('This week', style: text.labelMedium?.copyWith(fontWeight: FontWeight.w700)),
      const SizedBox(width: 16),
      Expanded(
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, crossAxisAlignment: CrossAxisAlignment.end, children: [
          for (final d in week)
            Flexible(child: FittedBox(fit: BoxFit.scaleDown, child: dayTap(d, Column(mainAxisSize: MainAxisSize.min, children: [
              Text('${(d['percentage'] as num).round()}%', style: text.labelSmall),
              const SizedBox(height: 3),
              Container(
                width: 10,
                height: (34 * (d['percentage'] as num) / 100).clamp(4, 34).toDouble(),
                decoration: BoxDecoration(color: barColor(d['percentage'] as num), borderRadius: BorderRadius.circular(5)),
              ),
              const SizedBox(height: 3),
              Text(const ['M', 'T', 'W', 'T', 'F', 'S', 'S'][DateTime.parse('${d['date']}').weekday - 1], style: text.labelSmall),
            ])))),
        ]),
      ),
    ]);

    final ring = loading
        ? const EduShimmer(child: EduSkeletonBox(width: 84, height: 84, radius: 42))
        : EduRing(
            value: pct == null ? null : pct / 100,
            size: 84,
            color: collegePine,
            center: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(pct == null ? '—' : '${pct.round()}%', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
              Text('attended', style: text.labelSmall),
            ]),
          );
    final sameMonth = shownDay.year == DateTime.now().year && shownDay.month == DateTime.now().month;
    final summary = Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(
        sameMonth ? 'Attendance this month' : 'Attendance · ${_monthNames[shownDay.month - 1]} ${shownDay.year}',
        style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      ),
      const SizedBox(height: 3),
      if (loading)
        const EduShimmer(child: EduSkeletonBox(width: 140, height: 11))
      else
        Text(
          failed
              ? 'Could not load. Pull down to retry.'
              : pct == null
              ? 'No classes recorded yet'
              : '${month['attended'] ?? 0} of ${month['recorded'] ?? 0} classes',
          style: text.bodySmall,
        ),
      if (!failed) ...[
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
          if (!loading)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
              decoration: BoxDecoration(color: todayTint, borderRadius: BorderRadius.circular(99)),
              child: Semantics(
                label: "${isToday ? "Today's" : dayLabel} attendance: $today",
                excludeSemantics: true,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(todayIcon, size: 14, color: EduTints.ink(todayTint)),
                  const SizedBox(width: 5),
                  Flexible(child: Text(today, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.labelMedium?.copyWith(color: EduTints.ink(todayTint), fontWeight: FontWeight.w700))),
                ]),
              ),
            ),
          // Choose any past date to see that day's attendance.
          Material(
            color: Colors.white,
            shape: const StadiumBorder(side: BorderSide(color: collegeLine)),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              key: const ValueKey('home-attendance-date'),
              onTap: pickDay,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.calendar_month_outlined, size: 14),
                  const SizedBox(width: 4),
                  Flexible(child: Text(isToday ? 'Today' : dayLabel, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.labelMedium?.copyWith(fontWeight: FontWeight.w700))),
                  const Icon(Icons.arrow_drop_down_rounded, size: 18),
                ]),
              ),
            ),
          ),
        ]),
      ],
    ]);
    // Mini chart of the latest class days: bar height is that day's attendance.
    final chart = week.isEmpty
        ? null
        : Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
            Text('This week', style: text.labelSmall),
            const SizedBox(height: 6),
            SizedBox(
              height: 52,
              child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.end, children: [
                for (final d in week)
                  Padding(
                    padding: const EdgeInsets.only(left: 1),
                    child: dayTap(d, Tooltip(
                      message: '${d['date']}: ${d['percentage']}%',
                      child: Container(
                        width: 8,
                        height: (44 * (d['percentage'] as num) / 100).clamp(4, 44).toDouble(),
                        decoration: BoxDecoration(
                          color: (d['percentage'] as num) >= 90
                              ? collegePine
                              : (d['percentage'] as num) >= 75
                              ? EduTints.ink(EduTints.gold)
                              : EduTints.ink(EduTints.clay),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    )),
                  ),
              ]),
            ),
            const SizedBox(height: 4),
            Text(
              [for (final d in week) const ['M', 'T', 'W', 'T', 'F', 'S', 'S'][DateTime.parse('${d['date']}').weekday - 1]].join('  '),
              style: text.labelSmall?.copyWith(letterSpacing: .4),
            ),
          ]);

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xffe8efe2), Color(0xffe3ebee)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: collegeLine),
        boxShadow: [BoxShadow(color: collegeEspresso.withValues(alpha: .06), blurRadius: 18, offset: const Offset(0, 8))],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${widget.greeting} · ${widget.date}', maxLines: 1, overflow: TextOverflow.ellipsis, style: text.labelMedium),
              const SizedBox(height: 2),
              Row(children: [
                Flexible(
                  child: Text(widget.name.isEmpty ? 'Welcome' : widget.name, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                ),
                if (widget.onProfile != null)
                  IconButton(
                    tooltip: 'Profile',
                    visualDensity: VisualDensity.compact,
                    onPressed: widget.onProfile,
                    icon: const Icon(Icons.person_outline_rounded, size: 20),
                  ),
              ]),
              if (widget.childName != null) ...[
                const SizedBox(height: 8),
                Material(
                  color: collegeIvory,
                  shape: const StadiumBorder(side: BorderSide(color: collegeLine)),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    key: const ValueKey('child-switcher'),
                    onTap: widget.canSwitch ? widget.onSwitch : null,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.school_outlined, size: 16),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(widget.childName!, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: text.labelLarge?.copyWith(fontWeight: FontWeight.w700)),
                        ),
                        if (widget.canSwitch) const Icon(Icons.unfold_more_rounded, size: 18),
                      ]),
                    ),
                  ),
                ),
              ],
            ]),
          ),
          // Illustration: at most a third of the card; hidden on very narrow screens / large text.
          if (MediaQuery.sizeOf(context).width >= 340 && MediaQuery.textScalerOf(context).scale(16) <= 22) ...[
            const SizedBox(width: 8),
            ConstrainedBox(
              constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * .3, maxHeight: 92),
              child: FittedBox(
                fit: BoxFit.contain,
                child: EduArtwork(
                  name: widget.childName != null ? 'illustrations/parent_student' : 'illustrations/student_studying',
                  height: 92,
                ),
              ),
            ),
          ],
        ]),
        const SizedBox(height: 14),
        Material(
          color: collegeIvory,
          borderRadius: BorderRadius.circular(20),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: widget.onAttendance,
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final wide = constraints.maxWidth >= 300 && MediaQuery.textScalerOf(context).scale(16) <= 22;
                  return wide
                      ? Row(children: [
                          ring,
                          const SizedBox(width: 14),
                          Expanded(child: summary),
                          ?chart,
                        ])
                      : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [ring, const SizedBox(width: 14), Expanded(child: summary)]),
                          if (week.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            const Divider(height: 1, color: collegeLine),
                            const SizedBox(height: 10),
                            weekStrip(),
                          ],
                        ]);
                },
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        LayoutBuilder(builder: (context, constraints) {
          final tiles = [
            tile(Icons.account_balance_wallet_outlined, EduTints.clay, 'Fees due', widget.feesDue, widget.feesLoading, widget.onFees),
            tile(Icons.schedule_rounded, EduTints.gold, 'Classes today', '${widget.classesToday}', widget.classesLoading, widget.onClasses),
            tile(Icons.notifications_none_rounded, EduTints.plum, widget.unread == 1 ? 'Alert' : 'Alerts', '${widget.unread}', widget.alertsLoading, widget.onAlerts),
          ];
          if (constraints.maxWidth < 270 || MediaQuery.textScalerOf(context).scale(16) > 22) {
            return Column(children: [
              for (final (i, t) in tiles.indexed) ...[if (i > 0) const SizedBox(height: 8), Row(children: [t])],
            ]);
          }
          return IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (final (i, t) in tiles.indexed) ...[if (i > 0) const SizedBox(width: 10), t],
            ]),
          );
        }),
      ]),
    );
  }
}


/// New message: searchable contacts with their role and class, then subject and message.
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
