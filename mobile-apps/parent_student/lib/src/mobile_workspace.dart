part of 'edunexa_client.dart';

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
  final scaffoldKey = GlobalKey<ScaffoldState>();
  final search = TextEditingController();
  List<Json> screens = [];
  final Map<String, Json> cache = {};
  final Map<String, String> sectionErrors = {};
  String? selected, student, error;
  String query = '', filter = 'All';
  bool busy = true, saving = false, paging = false, downloading = false;
  int generation = 0;
  DateTime calendarDay = DateUtils.dateOnly(DateTime.now());
  DateTime calendarMonth = DateTime(DateTime.now().year, DateTime.now().month);
  PushNotifications? push;
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
  int get tab => selected == null
      ? 0
      : selected == primary
      ? 1
      : selected == 'calendar'
      ? 2
      : selected == 'notifications'
      ? 3
      : 4;
  int get unread =>
      rows('notifications').where((r) => r['status'] != 'read').length;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    loadScreens();
    push = PushNotifications(
      onOpen: (_) {
        if (mounted && has('notifications')) open('notifications');
      },
      onForeground: (title, body) {
        if (!mounted) return;
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
      },
    );
    resumePush();
  }

  Future<void> resumePush() async {
    try {
      final enabled = await widget.api.storage.read(
        key: ApiConfig.pushPreferenceKey(widget.api.clientId),
      );
      if (enabled == 'true' && mounted) await enablePush();
    } catch (_) {
      /* Optional device alerts never block sign-in. */
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    push?.dispose();
    search.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !busy) load();
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

  Future<void> fetchSection(String key) async {
    if (!has(key)) return;
    final ticket = generation;
    try {
      final result = await fetch(key);
      if (!mounted || ticket != generation) return;
      setState(() {
        cache[key] = result;
        student ??= result['selected_student_code'] as String?;
        sectionErrors.remove(key);
      });
    } catch (e) {
      if (!mounted || ticket != generation) return;
      if (e is ApiException && e.status == 401) {
        widget.onLogout();
        return;
      }
      setState(() => sectionErrors[key] = e.toString());
    }
  }

  Future<void> loadScreens() async {
    final ticket = ++generation;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await widget.api.listScreens();
      if (!mounted || ticket != generation) return;
      setState(
        () => screens = result.map((screen) => screen.toJson()).toList(),
      );
      await loadHome(ticket);
      if (mounted && ticket == generation) setState(() => busy = false);
    } catch (e) {
      fail(e, ticket);
    }
  }

  Future<void> loadHome(int ticket) async {
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
    if (has('profile')) await fetchSection('profile');
    final pending = keys.where((key) => has(key) && key != 'profile').toList();
    for (var start = 0; start < pending.length; start += 3) {
      if (!mounted || ticket != generation) return;
      await Future.wait(pending.skip(start).take(3).map(fetchSection));
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

  Future<void> load() async {
    if (selected == null || selected == '_more') {
      await loadScreens();
      return;
    }
    final ticket = ++generation;
    final key = selected!;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await fetch(key);
      if (!mounted || ticket != generation) return;
      setState(() {
        cache[key] = result;
        student ??= result['selected_student_code'] as String?;
        busy = false;
        sectionErrors.remove(key);
      });
    } catch (e) {
      fail(e, ticket);
    }
  }

  void open(String? key) {
    if (saving) return;
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
    if (key != null && key != '_more') load();
  }

  Future<void> refreshWorkspace() async {
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
      if (selected != null) ...[
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
        if (!didPop) open(null);
      },
      child: Scaffold(
        key: scaffoldKey,
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('EduNexa'),
              Text(
                selected == null ? widget.title : widget.role.label,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
          actions: [
            if (has('notifications'))
              IconButton(
                tooltip: 'Notifications',
                onPressed: () => open('notifications'),
                icon: Badge(
                  isLabelVisible: unread > 0,
                  label: Text('$unread'),
                  child: const Icon(Icons.notifications_outlined),
                ),
              ),
            IconButton(
              tooltip: 'Refresh',
              onPressed: busy || saving ? null : load,
              icon: const Icon(Icons.refresh),
            ),
            IconButton(
              tooltip: 'Sign out',
              onPressed: saving ? null : logout,
              icon: const Icon(Icons.logout),
            ),
          ],
        ),
        drawer: Drawer(
          child: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: [
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: CollegeBrand(subtitle: 'Your college, connected'),
                ),
                ListTile(
                  leading: const Icon(Icons.home_outlined),
                  title: const Text('Dashboard'),
                  onTap: () {
                    Navigator.pop(context);
                    open(null);
                  },
                ),
                ...screens.map(
                  (s) => ListTile(
                    selected: selected == s['key'],
                    leading: EduModuleIcon(icon: moduleIcon(s['key'])),
                    title: Text(s['title']),
                    onTap: () {
                      Navigator.pop(context);
                      open(s['key']);
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
        bottomNavigationBar: Container(
          decoration: const BoxDecoration(
            border: Border(top: BorderSide(color: collegeLine)),
          ),
          child: NavigationBar(
            selectedIndex: tab,
            animationDuration: EduMotion.duration(context, EduMotion.tab),
            onDestinationSelected: saving
                ? null
                : (i) => open(
                    [
                      null,
                      has(primary) ? primary : '_more',
                      has('calendar') ? 'calendar' : '_more',
                      has('notifications') ? 'notifications' : '_more',
                      '_more',
                    ][i],
                  ),
            destinations: [
              const NavigationDestination(
                icon: EduModuleIcon(icon: Icons.home_outlined),
                selectedIcon: EduModuleIcon(icon: Icons.home_rounded),
                label: 'Home',
              ),
              NavigationDestination(
                icon: EduModuleIcon(icon: moduleIcon(primary)),
                label: primaryLabel,
              ),
              const NavigationDestination(
                icon: EduModuleIcon(icon: Icons.calendar_month_outlined),
                label: 'Calendar',
              ),
              NavigationDestination(
                icon: Badge(
                  isLabelVisible: unread > 0,
                  child: const EduModuleIcon(icon: Icons.inbox_outlined),
                ),
                label: 'Inbox',
              ),
              const NavigationDestination(
                icon: Icon(Icons.grid_view_outlined),
                label: 'More',
              ),
            ],
          ),
        ),
        body: SafeArea(
          top: false,
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 900),
              child: selected == 'assignments' || selected == 'submissions'
                ? AssignmentHub(key: ValueKey('assignment-$selected-$student-$generation'), api: widget.api, role: widget.role, title: title)
                : EduNexaAnimatedRefresh(
                onRefresh: refreshWorkspace,
                child: AnimatedSwitcher(
                  duration: EduMotion.duration(context, EduMotion.tab),
                  child: ListView.builder(
                    key: ValueKey('page-${selected ?? 'home'}'),
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
      MobileRole.student => ['syllabus', 'results', 'fees', 'messages'],
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
      if ((family || learning) && cache['attendance'] != null) ...[
        SectionHeading(title: 'Academic snapshot'),
        EduReveal(
          order: 1,
          child: AttendanceSummary(items: rows('attendance')),
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

  List<Widget> modules(BuildContext context) {
    final filtered = screens
        .where(
          (s) =>
              s['title'].toString().toLowerCase().contains(query.toLowerCase()),
        )
        .toList();
    final groups = <String, List<Json>>{};
    for (final s in filtered) {
      groups.putIfAbsent(moduleGroup(s['key']), () => []).add(s);
    }
    return [
      TextField(
        controller: search,
        onChanged: (v) => setState(() => query = v),
        decoration: const InputDecoration(
          hintText: 'Find a module',
          prefixIcon: Icon(Icons.search),
        ),
      ),
      for (final group in groups.entries) ...[
        SectionHeading(title: group.key),
        shortcutGrid(group.value),
      ],
      if (filtered.isEmpty)
        const QuietEmpty(
          icon: Icons.search_off,
          title: 'No matching modules',
          message: 'Try a different search.',
        ),
    ];
  }

  List<Widget> screenContent(BuildContext context) {
    final all = rows(selected!);
    final students = (data?['students'] as List? ?? []).cast<Json>();
    final actions = (data?['actions'] as List? ?? []).cast<Json>();
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
    final items = all.where((r) {
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
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Device notifications',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 8),
                Text(pushStatus),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: pushBusy ? null : enablePush,
                  icon: const Icon(Icons.notifications_active_outlined),
                  label: Text(
                    pushBusy ? 'Connecting…' : 'Enable device alerts',
                  ),
                ),
              ],
            ),
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
      if (selected == 'timetable') ...[
        TimetableDaySelector(
          selected: calendarDay,
          onChanged: (v) => setState(() => calendarDay = v),
        ),
        const SizedBox(height: 12),
      ],
      if (actions.isNotEmpty) ...[
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: actions
              .where((a) => a['key'] != 'read_notification')
              .map(
                (a) => FilledButton.tonalIcon(
                  onPressed: saving ? null : () => action(a),
                  icon: Icon(actionIcon(a['key'])),
                  label: Text(a['label']),
                ),
              )
              .toList(),
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
      if (items.isEmpty && selected != 'overview' && selected != 'reports')
        QuietEmpty(
          icon: moduleIcon(selected!),
          title: query.isNotEmpty
              ? 'No matching records'
              : emptyTitle(selected!),
          message: query.isNotEmpty
              ? 'Try a different search.'
              : emptyDescription(selected!),
        ),
      ...items.map(
        (r) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CampusRecord(
              record: r,
              screen: selected!,
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
                  : selected == 'notifications' && r['assignment_code'] != null ? 'Open assignment' : null,
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
    if (selected == 'notifications' && record['assignment_code'] != null) {
      return () => Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => AssignmentReview(api: widget.api, code: record['assignment_code'].toString())));
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
