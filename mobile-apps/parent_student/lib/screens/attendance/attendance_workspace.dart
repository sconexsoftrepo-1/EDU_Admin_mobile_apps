part of '../../app/edunexa_client.dart';

String _attDate(DateTime value) =>
    '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
const _attNames = {
  'present': 'Present',
  'late': 'Late',
  'absent': 'Absent',
  'excused': 'Leave / excused',
};

/// All clients use the same scoped register and server-calculated summaries.
class AttendanceHub extends StatefulWidget {
  const AttendanceHub({
    super.key,
    required this.api,
    required this.role,
    this.title = 'Attendance',
    this.studentCode = '',
    this.initialClass,
  });
  final CollegeApi api;
  final MobileRole role;
  final String title;
  final String studentCode;
  final Json? initialClass;
  @override
  State<AttendanceHub> createState() => _AttendanceHubState();
}

class _AttendanceHubState extends State<AttendanceHub> {
  Json? options, data;
  String level = 'intermediate',
      course = '',
      program = '',
      year = '',
      section = '',
      child = '',
      range = 'month',
      error = '',
      notice = '';
  DateTime day = DateUtils.dateOnly(DateTime.now());
  int period = 1, sequence = 0;

  /// Parent/student tab: 0 classes on the selected day, 1 missed classes, 2 calendar.
  int view = 0;
  bool busy = true, saving = false;
  final Map<String, String> draft = {};
  final search = TextEditingController(), subject = TextEditingController();
  bool get personal =>
      options?['personal'] == true ||
      widget.role == MobileRole.student ||
      widget.role == MobileRole.parent;
  bool get ready => personal || program.isNotEmpty && year.isNotEmpty;
  bool get canMark =>
      options?['can_mark'] == true &&
      !personal &&
      (options?['teacher'] != true || section.isNotEmpty) &&
      !day.isAfter(DateUtils.dateOnly(DateTime.now()));
  List<Json> get courses => _asRows(
    options?['courses'],
  ).where((r) => r['course_level'] == level).toList();
  List<Json> get years => _asRows(
    options?['academic_years'],
  ).where((r) => r['program_code'] == program).toList();
  List<Json> get sections {
    final selected = years.where((r) => r['code'] == year).firstOrNull;
    final batch = selected?['batch_code'];
    final codes = selected?['section_codes'] as List? ?? [];
    return _asRows(options?['sections'])
        .where(
          (r) =>
              codes.contains(r['code']) ||
              batch != null && r['batch_code'] == batch,
        )
        .toList();
  }

  Json? get current => _asRows(data?['registers'])
      .where(
        (r) =>
            r['session_date'] == _attDate(day) &&
            r['period'] == period &&
            (personal || _asText(r['section_code']) == section),
      )
      .firstOrNull;
  Map<String, dynamic> get marks => {
    ...Map<String, dynamic>.from(current?['marks'] as Map? ?? {}),
    ...draft,
  };
  @override
  void initState() {
    super.initState();
    final c = widget.initialClass;
    if (c != null) {
      program = _asText(c['program_code']);
      year = _asText(c['academic_year_code']);
      section = _asText(c['section_code']);
      day = DateTime.parse(_asText(c['session_date']));
      period = c['period'] as int;
      subject.text = _asText(c['subject_name']);
    }
    initialize();
  }

  @override
  void dispose() {
    search.dispose();
    subject.dispose();
    super.dispose();
  }

  Future<void> initialize() async {
    try {
      final result = Map<String, dynamic>.from(
        await widget.api.attendanceOptions() as Map,
      );
      if (!mounted) return;
      setState(() {
        options = result;
        if (widget.initialClass != null) {
          final selected = _asRows(
            result['courses'],
          ).where((c) => c['code'] == program).firstOrNull;
          if (selected != null) {
            level = _asText(selected['course_level']);
            course = _asText(selected['name']);
          }
        }
        final children = _asRows(result['students']);
        if (children.isNotEmpty) {
          child = children.any((s) => s['code'] == widget.studentCode)
              ? widget.studentCode
              : _asText(children.first['code']);
        }
        busy = false;
      });
      if (ready) await load();
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          busy = false;
        });
      }
    }
  }

  Future<void> load() async {
    if (!ready) {
      setState(() => data = null);
      return;
    }
    final token = ++sequence;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final value = Map<String, dynamic>.from(
        await widget.api.attendance(
              program: personal ? '' : program,
              academicYear: personal ? '' : year,
              section: personal ? '' : section,
              studentCode: child,
              on: _attDate(day),
              period: period,
            )
            as Map,
      );
      if (mounted && token == sequence) setState(() => data = value);
    } catch (e) {
      if (mounted && token == sequence) setState(() => error = e.toString());
    } finally {
      if (mounted && token == sequence) setState(() => busy = false);
    }
  }

  Future<void> change(VoidCallback action) async {
    if (saving) return;
    if (draft.isNotEmpty) {
      final discard = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('Discard attendance changes?'),
          content: const Text(
            'Save this register before changing the class or date.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Keep editing'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Discard'),
            ),
          ],
        ),
      );
      if (discard != true || !mounted) return;
    }
    setState(() {
      draft.clear();
      subject.clear();
      notice = '';
      data = null;
      action();
    });
    if (options == null) {
      await initialize();
    } else {
      await load();
    }
  }

  Future<void> save() async {
    if (!canMark || data == null) return;
    final existing = current;
    final roster = _asRows(data!['students']);
    final values = marks;
    setState(() => saving = true);
    try {
      await widget.api.saveAttendance({
        'program_code': program,
        'academic_year_code': year,
        'section_code': section.isEmpty ? null : section,
        if (widget.initialClass != null &&
            widget.initialClass!['program_code'] == program &&
            widget.initialClass!['academic_year_code'] == year &&
            widget.initialClass!['section_code'] == section &&
            widget.initialClass!['period'] == period &&
            widget.initialClass!['session_date'] == _attDate(day))
          'slot_code': widget.initialClass!['code'],
        'session_date': _attDate(day),
        'period': period,
        'subject': subject.text.trim().isEmpty
            ? _asText(existing?['subject'])
            : subject.text.trim(),
        'revision': existing?['legacy'] == true
            ? 0
            : existing?['revision'] ?? 0,
        'marks': roster
            .where((s) => values[s['code']] != null)
            .map(
              (s) => {'student_code': s['code'], 'status': values[s['code']]},
            )
            .toList(),
      });
      if (!mounted) return;
      setState(() {
        draft.clear();
        notice = 'Attendance saved for this class and date.';
      });
      await load();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Widget select(
    String label,
    String value,
    List<(String, String)> entries,
    ValueChanged<String> update, {
    bool enabled = true,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: DropdownButtonFormField<String>(
      key: ValueKey('$label-$value'),
      initialValue: entries.any((e) => e.$1 == value) ? value : null,
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: entries
          .map(
            (e) => DropdownMenuItem(
              value: e.$1,
              child: Text(e.$2, overflow: TextOverflow.ellipsis),
            ),
          )
          .toList(),
      onChanged: !enabled || saving
          ? null
          : (v) {
              if (v != null) change(() => update(v));
            },
    ),
  );
  Widget filters() => Column(
    children: [
      if (personal)
        select(
          'Student',
          child,
          _asRows(
            options?['students'],
          ).map((s) => (_asText(s['code']), _asText(s['name']))).toList(),
          (v) => child = v,
        )
      else ...[
        select(
          'Course level',
          level,
          const [('intermediate', 'Intermediate'), ('degree', 'Degree')],
          (v) {
            level = v;
            course = '';
            program = '';
            year = '';
            section = '';
          },
        ),
        select(
          'Course',
          course,
          courses
              .map((r) => _asText(r['name']))
              .toSet()
              .map((n) => (n, n))
              .toList(),
          (v) {
            course = v;
            program = '';
            year = '';
            section = '';
          },
        ),
        select(
          'Branch / specialization',
          program,
          courses
              .where((r) => r['name'] == course)
              .map((r) => (_asText(r['code']), _asText(r['branch'])))
              .toList(),
          (v) {
            program = v;
            year = '';
            section = '';
          },
          enabled: course.isNotEmpty,
        ),
        select(
          'Academic batch',
          year,
          years.map((r) => (_asText(r['code']), _asText(r['name']))).toList(),
          (v) {
            year = v;
            section = '';
          },
          enabled: program.isNotEmpty,
        ),
        select(
          'Section',
          section,
          [
            if (options?['teacher'] != true) ('', 'All sections'),
            ...sections.map((r) => (_asText(r['code']), _asText(r['name']))),
          ],
          (v) => section = v,
          enabled: year.isNotEmpty,
        ),
      ],
      Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: saving
                  ? null
                  : () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: day,
                        firstDate: DateTime(2000),
                        lastDate: DateTime(DateTime.now().year + 2),
                      );
                      if (picked != null && mounted) change(() => day = picked);
                    },
              icon: const Icon(Icons.calendar_month_outlined),
              label: Text(_attDate(day)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: select(
              'Register',
              period.toString(),
              _asRows(
                options?['periods'],
              ).map((r) => (_asText(r['value']), _asText(r['label']))).toList(),
              (v) => period = int.parse(v),
            ),
          ),
        ],
      ),
    ],
  );
  Widget metric(String label, String value, IconData icon) => SizedBox(
    width: 150,
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: collegePine),
            const SizedBox(height: 10),
            Text(value, style: Theme.of(context).textTheme.headlineSmall),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    ),
  );
  Widget overview() {
    final summaries = Map<String, dynamic>.from(
          data?['summaries'] as Map? ?? {},
        ),
        stats = Map<String, dynamic>.from(summaries[range] as Map? ?? {});
    final pct = stats['percentage'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 7,
          children: ['period', 'day', 'week', 'month', 'year']
              .map(
                (r) => ChoiceChip(
                  label: Text('${r[0].toUpperCase()}${r.substring(1)}'),
                  selected: range == r,
                  onSelected: (_) => setState(() => range = r),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            metric(
              'Attendance',
              pct == null ? '—' : '$pct%',
              Icons.pie_chart_outline,
            ),
            metric(
              'Attended sessions',
              '${stats['attended'] ?? 0} / ${stats['recorded'] ?? 0}',
              Icons.fact_check_outlined,
            ),
            metric(
              'Leave days',
              '${stats['leave_days'] ?? 0}',
              Icons.event_busy_outlined,
            ),
            metric(
              'Days with absences',
              '${stats['absent_days'] ?? 0}',
              Icons.person_off_outlined,
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          'Week leave days: ${summaries['week']?['leave_days'] ?? 0} · Month leave days: ${summaries['month']?['leave_days'] ?? 0}',
        ),
        const SizedBox(height: 8),
        Text(
          _asText(data?['calculation']),
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget calendar() {
    final days = _asRows(data?['calendar']);
    final first = DateTime(day.year, day.month, 1);
    final offset = first.weekday % 7;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            Row(
              children: [
                IconButton(
                  tooltip: 'Previous month',
                  onPressed: () =>
                      change(() => day = DateTime(day.year, day.month - 1, 1)),
                  icon: const Icon(Icons.chevron_left),
                ),
                Expanded(
                  child: Text(
                    '${const ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][day.month - 1]} ${day.year}',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  tooltip: 'Next month',
                  onPressed: () =>
                      change(() => day = DateTime(day.year, day.month + 1, 1)),
                  icon: const Icon(Icons.chevron_right),
                ),
              ],
            ),
            Row(
              children: const [
                'S',
                'M',
                'T',
                'W',
                'T',
                'F',
                'S',
              ].map((d) => Expanded(child: Center(child: Text(d)))).toList(),
            ),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 7,
                mainAxisSpacing: 5,
                crossAxisSpacing: 5,
                mainAxisExtent: 64,
              ),
              itemCount: offset + days.length,
              itemBuilder: (c, i) {
                if (i < offset) return const SizedBox.shrink();
                final item = days[i - offset];
                final recorded = (item['recorded'] as num? ?? 0) > 0,
                    absent = (item['absent'] as num? ?? 0) > 0,
                    leave = (item['leave_days'] as num? ?? 0) > 0;
                final selected = item['date'] == _attDate(day);
                return Semantics(
                  label:
                      '${item['date']}, ${recorded
                          ? '${item['percentage']} percent'
                          : leave
                          ? 'Leave'
                          : 'Not recorded'}',
                  button: true,
                  child: InkWell(
                    onTap: () => change(
                      () => day = DateTime.parse(item['date'] as String),
                    ),
                    borderRadius: BorderRadius.circular(9),
                    child: Container(
                      decoration: BoxDecoration(
                        color: absent
                            ? const Color(0xffffefeb)
                            : leave
                            ? const Color(0xfffff7e1)
                            : recorded
                            ? const Color(0xffeaf5ef)
                            : const Color(0xfff6f7f8),
                        borderRadius: BorderRadius.circular(9),
                        border: Border.all(
                          color: selected ? collegePine : Colors.transparent,
                          width: 2,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Expanded(
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                '${i - offset + 1}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: FittedBox(
                              fit: BoxFit.scaleDown,
                              child: Text(
                                recorded
                                    ? '${item['percentage']}%'
                                    : leave
                                    ? 'Leave'
                                    : '—',
                                style: const TextStyle(fontSize: 9),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 8),
            const Text(
              'Green: attended · Red: absence · Gold: leave · —: not recorded',
              style: TextStyle(fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  /// Bar colour for a day's attendance: green 90%+, gold 75–89%, clay below 75%.
  Color trendColor(num? pct) => pct == null
      ? collegeLine
      : EduTints.ink(
          pct >= 90
              ? EduTints.sage
              : pct >= 75
              ? EduTints.gold
              : EduTints.clay,
        ).withValues(alpha: .8);

  Widget trend() {
    final text = Theme.of(context).textTheme;
    final days = _asRows(data?['calendar']);
    final recorded = days.where((d) => d['percentage'] != null).toList();
    final average = recorded.isEmpty
        ? null
        : recorded.fold<num>(0, (sum, d) => sum + (d['percentage'] as num)) /
              recorded.length;
    final lowest = recorded.isEmpty
        ? null
        : recorded.reduce(
            (a, b) =>
                (a['percentage'] as num) <= (b['percentage'] as num) ? a : b,
          );
    final selected = days.where((d) => d['date'] == _attDate(day)).firstOrNull;
    const chart = 140.0;
    final axis = EduSizes.scaled(context, 38);
    String short(String iso) {
      final date = DateTime.parse(iso);
      return '${date.day} ${const ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.month - 1]}';
    }

    // Day numbers on the axis: the 1st, every 5th day and the last day.
    bool labelled(int i) =>
        i == 0 ||
        (i + 1) % 5 == 0 && i + 1 < days.length - 1 ||
        i == days.length - 1;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: collegeIvory,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: collegeLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Monthly attendance pattern', style: text.titleMedium),
          const SizedBox(height: 2),
          Text(
            average == null
                ? 'No classes recorded this month yet.'
                : 'Average ${average.toStringAsFixed(0)}% · lowest ${lowest!['percentage']}% on ${short('${lowest['date']}')}',
            style: text.bodySmall,
          ),
          // Room above and below so the 100% and 0% labels are not clipped.
          const SizedBox(height: 26),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Percentage axis: each label centred on its gridline.
              SizedBox(
                width: axis,
                height: chart,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    for (final (value, top) in [
                      ('100%', 0.0),
                      ('50%', chart / 2),
                      ('0%', chart),
                    ])
                      Positioned(
                        top: top,
                        right: 6,
                        child: FractionalTranslation(
                          translation: const Offset(0, -.5),
                          child: Text(
                            value,
                            maxLines: 1,
                            style: text.labelSmall,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  children: [
                    SizedBox(
                      height: chart,
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          for (final top in [0.0, chart / 2, chart])
                            Positioned(
                              top: top,
                              left: 0,
                              right: 0,
                              child: Container(height: 1, color: collegeLine),
                            ),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              for (final d in days)
                                Expanded(
                                  child: Semantics(
                                    button: true,
                                    label:
                                        '${short('${d['date']}')}: ${d['percentage'] == null ? 'not recorded' : '${d['percentage']} percent'}',
                                    excludeSemantics: true,
                                    child: GestureDetector(
                                      behavior: HitTestBehavior.opaque,
                                      onTap: () => change(
                                        () => day = DateTime.parse(
                                          d['date'] as String,
                                        ),
                                      ),
                                      child: Padding(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 1.2,
                                        ),
                                        child: Container(
                                          height: d['percentage'] == null
                                              ? 4
                                              : (chart *
                                                        (d['percentage']
                                                            as num) /
                                                        100)
                                                    .clamp(4, chart)
                                                    .toDouble(),
                                          decoration: BoxDecoration(
                                            color: d == selected
                                                ? Theme.of(
                                                    context,
                                                  ).colorScheme.primary
                                                : trendColor(
                                                    d['percentage'] as num?,
                                                  ),
                                            borderRadius: BorderRadius.circular(
                                              4,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    // Day numbers under their bars (a fixed-height row so labels can overhang narrow bars).
                    SizedBox(
                      height: EduSizes.scaled(context, 16),
                      child: Row(
                        children: [
                          for (final (i, d) in days.indexed)
                            Expanded(
                              child: labelled(i) || d == selected
                                  ? OverflowBox(
                                      maxWidth: 40,
                                      child: Text(
                                        '${i + 1}',
                                        textAlign: TextAlign.center,
                                        style: text.labelSmall?.copyWith(
                                          color: d == selected
                                              ? Theme.of(
                                                  context,
                                                ).colorScheme.primary
                                              : collegeMuted,
                                          fontWeight: d == selected
                                              ? FontWeight.w800
                                              : FontWeight.w500,
                                        ),
                                      ),
                                    )
                                  : const SizedBox.shrink(),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (selected != null)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: collegeCanvas,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                selected['percentage'] == null
                    ? '${short('${selected['date']}')} · no classes recorded'
                    : '${short('${selected['date']}')} · ${selected['percentage']}% · ${selected['attended'] ?? '—'} of ${selected['recorded'] ?? '—'} classes',
                style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 14,
            runSpacing: 4,
            children: [
              for (final (label, pct) in [
                ('90%+', 95),
                ('75–89%', 80),
                ('Below 75%', 50),
                ('Not recorded', null),
              ])
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.circle, size: 9, color: trendColor(pct)),
                    const SizedBox(width: 5),
                    Text(label, style: text.labelMedium),
                  ],
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text('Tap a bar to open that day.', style: text.bodySmall),
        ],
      ),
    );
  }

  Widget register() {
    final roster = _asRows(data?['students']);
    final shown = roster
        .where(
          (s) => '${s['name']} ${s['admission_number']}'.toLowerCase().contains(
            search.text.toLowerCase(),
          ),
        )
        .toList();
    final values = marks;
    final registers = _asRows(
      data?['registers'],
    ).where((r) => r['session_date'] == _attDate(day)).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '${_attDate(day)} · ${period == 0 ? 'Whole day' : 'Period $period'}',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        if (canMark) ...[
          TextField(
            controller: subject,
            decoration: const InputDecoration(
              labelText: 'Subject / class note',
              hintText: 'Optional subject',
            ),
            maxLength: 160,
          ),
          Wrap(
            spacing: 8,
            children: [
              OutlinedButton(
                onPressed: saving
                    ? null
                    : () => setState(
                        () => draft.addAll({
                          for (final s in roster) _asText(s['code']): 'present',
                        }),
                      ),
                child: const Text('Mark all present'),
              ),
              TextButton(
                onPressed: draft.isEmpty || saving
                    ? null
                    : () => setState(draft.clear),
                child: const Text('Reset changes'),
              ),
              FilledButton.icon(
                onPressed: draft.isEmpty || saving ? null : save,
                icon: const Icon(Icons.save_outlined),
                label: Text(saving ? 'Saving…' : 'Save attendance'),
              ),
            ],
          ),
          const SizedBox(height: 12),
        ],
        TextField(
          controller: search,
          decoration: const InputDecoration(
            prefixIcon: Icon(Icons.search),
            hintText: 'Search student or admission number',
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        if (shown.isEmpty) const Text('No students in this selection.'),
        ...shown.map(
          (s) => Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _asText(s['name']),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(_asText(s['admission_number'])),
                  const SizedBox(height: 10),
                  if (canMark)
                    DropdownButtonFormField<String>(
                      key: ValueKey(
                        '${s['code']}-${values[s['code']]}-${_attDate(day)}',
                      ),
                      initialValue: values[s['code']] as String?,
                      decoration: const InputDecoration(
                        labelText: 'Attendance',
                      ),
                      items: _attNames.entries
                          .map(
                            (e) => DropdownMenuItem(
                              value: e.key,
                              child: Text(e.value),
                            ),
                          )
                          .toList(),
                      onChanged: saving
                          ? null
                          : (v) {
                              if (v != null) {
                                setState(() => draft[_asText(s['code'])] = v);
                              }
                            },
                    )
                  else
                    Text(
                      _attNames[_asText(values[s['code']])] ?? 'Not recorded',
                    ),
                ],
              ),
            ),
          ),
        ),
        if (personal) ...[
          const SizedBox(height: 16),
          Text(
            'Periods on this day',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          if (registers.isEmpty)
            const Text('No periods recorded for this date.'),
          ...registers.map((r) {
            final status = Map<String, dynamic>.from(
              r['marks'] as Map? ?? {},
            )[child];
            return ListTile(
              title: Text(
                '${r['period'] == 0 ? 'Whole day' : 'Period ${r['period']}'} · ${_asText(r['subject'])}',
              ),
              trailing: Text(_attNames[_asText(status)] ?? 'Not recorded'),
            );
          }),
        ],
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // Parent / student view: one analytics card, then classes, missed classes and calendar.

  static const _ranges = ['day', 'week', 'month', 'year'];
  static const _months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  String get _student => child.isNotEmpty
      ? child
      : _asText(_asRows(options?['students']).firstOrNull?['code']);

  String? statusIn(Json register) {
    final marks = Map<String, dynamic>.from(register['marks'] as Map? ?? {});
    final status =
        marks[_student] ?? (marks.length == 1 ? marks.values.first : null);
    return status?.toString();
  }

  String periodText(Map<String, dynamic> stats) {
    final start = DateTime.tryParse('${stats['start'] ?? ''}');
    final end = DateTime.tryParse('${stats['end'] ?? ''}');
    if (start == null) return '';
    return switch (range) {
      'day' => prettyDate(start),
      'week' =>
        'Week of ${start.day} ${_months[start.month - 1].substring(0, 3)}${end == null ? '' : ' – ${end.day} ${_months[end.month - 1].substring(0, 3)}'}',
      'month' => '${_months[start.month - 1]} ${start.year}',
      _ => '${start.year}',
    };
  }

  Future<void> pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: day,
      firstDate: DateTime(2000),
      lastDate: DateTime(DateTime.now().year + 2),
    );
    if (picked != null && mounted) change(() => day = picked);
  }

  ({Color tint, String label}) statusStyle(String? status) => switch (status) {
    'present' => (tint: EduTints.sage, label: 'Present'),
    'late' => (tint: EduTints.gold, label: 'Late'),
    'absent' => (tint: EduTints.clay, label: 'Absent'),
    'excused' => (tint: EduTints.mist, label: 'Leave'),
    _ => (tint: collegeCard, label: 'Not recorded'),
  };

  Widget analyticsCard(Map<String, dynamic> stats) {
    final text = Theme.of(context).textTheme;
    final pct = stats['percentage'] as num?;
    final recorded = stats['recorded'] as num? ?? 0;
    final counts = [
      ('Present', stats['present'] as num? ?? 0, EduTints.sage),
      ('Late', stats['late'] as num? ?? 0, EduTints.gold),
      ('Absent', stats['absent'] as num? ?? 0, EduTints.clay),
      ('Leave', stats['excused'] as num? ?? 0, EduTints.mist),
    ];
    final missed = stats['absent'] as num? ?? 0;
    Widget line(
      IconData icon,
      Color tint,
      String label,
      String value, {
      VoidCallback? onTap,
    }) => InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 4),
        child: Row(
          children: [
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
              child: Icon(icon, size: 16, color: EduTints.ink(tint)),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(label, style: text.bodyMedium)),
            Text(
              value,
              style: text.titleSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            if (onTap != null)
              const Icon(Icons.chevron_right, size: 18, color: collegeMuted),
          ],
        ),
      ),
    );
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: collegeIvory,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: collegeLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 12,
            runSpacing: 10,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Attendance', style: text.titleLarge),
                    Text(periodText(stats), style: text.bodySmall),
                  ],
                ),
              ),
              Material(
                color: collegeCanvas,
                shape: const StadiumBorder(
                  side: BorderSide(color: collegeLine),
                ),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  key: const ValueKey('attendance-date'),
                  onTap: saving ? null : pickDate,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.calendar_month_outlined, size: 18),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            '${day.day} ${_months[day.month - 1].substring(0, 3)} ${day.year}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.labelLarge?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Ring beside the figures; stacked when the card is narrow or the text is large.
          LayoutBuilder(
            builder: (context, constraints) {
              final ringWidget = EduRing(
                value: pct == null ? null : pct / 100,
                size: 104,
                color: collegePine,
                center: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      pct == null ? '—' : '${pct.round()}%',
                      style: text.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text('attended', style: text.labelSmall),
                  ],
                ),
              );
              final figures = Column(
                children: [
                  line(
                    Icons.check_rounded,
                    EduTints.sage,
                    'Attended',
                    '${stats['attended'] ?? 0} of $recorded',
                  ),
                  line(
                    Icons.event_busy_outlined,
                    EduTints.mist,
                    'Leave days',
                    '${stats['leave_days'] ?? 0}',
                  ),
                  line(
                    Icons.close_rounded,
                    EduTints.clay,
                    'Classes missed',
                    '$missed',
                    onTap: missed > 0 ? () => setState(() => view = 1) : null,
                  ),
                ],
              );
              return constraints.maxWidth < 290
                  ? Column(
                      children: [
                        ringWidget,
                        const SizedBox(height: 12),
                        figures,
                      ],
                    )
                  : Row(
                      children: [
                        ringWidget,
                        const SizedBox(width: 14),
                        Expanded(child: figures),
                      ],
                    );
            },
          ),
          if (recorded > 0) ...[
            const SizedBox(height: 16),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: SizedBox(
                height: 10,
                child: Row(
                  children: [
                    for (final c in counts)
                      if (c.$2 > 0)
                        Expanded(
                          flex: c.$2.toInt(),
                          child: Container(
                            color: EduTints.ink(c.$3).withValues(alpha: .75),
                          ),
                        ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 14,
              runSpacing: 4,
              children: [
                for (final c in counts)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.circle,
                        size: 9,
                        color: EduTints.ink(c.$3).withValues(alpha: .75),
                      ),
                      const SizedBox(width: 5),
                      Text('${c.$1} ${c.$2}', style: text.labelMedium),
                    ],
                  ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          Text(
            recorded == 0
                ? 'No classes have been recorded in this period yet.'
                : 'Each class period counts as one session. Classes missed are sessions marked absent; leave days are approved leave.',
            style: text.bodySmall,
          ),
        ],
      ),
    );
  }

  /// One class: time, subject and period, with its attendance status.
  Widget classCard(Json r) {
    final text = Theme.of(context).textTheme;
    final style = statusStyle(statusIn(r));
    final start = _asText(r['start_time']), end = _asText(r['end_time']);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: collegeIvory,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: collegeLine),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: 62,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    start.isEmpty
                        ? (r['period'] == 0 ? 'All day' : 'P${r['period']}')
                        : start.substring(0, start.length.clamp(0, 5)),
                    style: text.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  if (end.isNotEmpty)
                    Text(
                      end.substring(0, end.length.clamp(0, 5)),
                      style: text.bodySmall,
                    ),
                ],
              ),
            ),
            Container(
              width: 4,
              margin: const EdgeInsets.symmetric(horizontal: 10),
              decoration: BoxDecoration(
                color: EduTints.ink(style.tint).withValues(alpha: .6),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _asText(r['subject']).isEmpty
                        ? 'Class'
                        : _asText(r['subject']),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: text.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    r['period'] == 0 ? 'Whole day' : 'Period ${r['period']}',
                    style: text.bodySmall,
                  ),
                ],
              ),
            ),
            Center(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: style.tint,
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  style.label,
                  style: text.labelMedium?.copyWith(
                    color: EduTints.ink(style.tint),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> personalBody(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final students = _asRows(options?['students']);
    final summaries = Map<String, dynamic>.from(
      data?['summaries'] as Map? ?? {},
    );
    final stats = Map<String, dynamic>.from(summaries[range] as Map? ?? {});
    final loading = data == null && error.isEmpty;
    final registers = _asRows(data?['registers']);
    final today = DateUtils.isSameDay(day, DateTime.now());
    final dayClasses =
        registers.where((r) => r['session_date'] == _attDate(day)).toList()
          ..sort((a, b) => '${a['period']}'.compareTo('${b['period']}'));
    final from = '${stats['start'] ?? ''}', to = '${stats['end'] ?? ''}';
    final missed =
        registers
            .where(
              (r) =>
                  statusIn(r) == 'absent' &&
                  from.compareTo('${r['session_date']}') <= 0 &&
                  '${r['session_date']}'.compareTo(to) <= 0,
            )
            .toList()
          ..sort(
            (a, b) => '${b['session_date']}${b['period']}'.compareTo(
              '${a['session_date']}${a['period']}',
            ),
          );
    final missedByDay = <String, List<Json>>{};
    for (final r in missed) {
      missedByDay.putIfAbsent('${r['session_date']}', () => []).add(r);
    }
    return [
      if (students.length > 1) ...[
        // Only parents with more than one child choose a student.
        DropdownButtonFormField<String>(
          key: ValueKey('attendance-student-$child'),
          initialValue: child.isEmpty ? null : child,
          isExpanded: true,
          decoration: const InputDecoration(
            labelText: 'Student',
            prefixIcon: Icon(Icons.person_outline),
          ),
          items: [
            for (final s in students)
              DropdownMenuItem(
                value: _asText(s['code']),
                child: Text(_asText(s['name'])),
              ),
          ],
          onChanged: saving
              ? null
              : (v) {
                  if (v != null) change(() => child = v);
                },
        ),
        const SizedBox(height: 12),
      ],
      EduPillTabs(
        labels: const ['Day', 'Week', 'Month', 'Year'],
        selected: _ranges.indexOf(range).clamp(0, 3),
        onSelected: (i) => setState(() => range = _ranges[i]),
      ),
      const SizedBox(height: 14),
      if (loading) const EduCardSkeleton(height: 250) else analyticsCard(stats),
      const SizedBox(height: 18),
      EduPillTabs(
        labels: [
          today
              ? 'Classes today'
              : 'Classes · ${day.day} ${_months[day.month - 1].substring(0, 3)}',
          loading ? 'Missed' : 'Missed (${missed.length})',
          'Calendar',
        ],
        selected: view,
        onSelected: (i) => setState(() => view = i),
      ),
      const SizedBox(height: 14),
      if (loading)
        const EduLoadingSkeleton()
      else if (view == 0)
        ...(dayClasses.isEmpty
            ? [
                QuietEmpty(
                  icon: Icons.event_available_outlined,
                  title: today
                      ? 'No classes recorded today'
                      : 'No classes recorded on this day',
                  message: 'Choose another date from the attendance card.',
                ),
              ]
            : dayClasses.map(classCard))
      else if (view == 1)
        ...(missed.isEmpty
            ? [
                QuietEmpty(
                  icon: Icons.verified_outlined,
                  title: 'No classes missed',
                  message:
                      'Nothing marked absent ${range == 'day' ? 'on this day' : 'in this $range'}.',
                ),
              ]
            : [
                for (final entry in missedByDay.entries) ...[
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 6, 4, 8),
                    child: Text(
                      prettyDate(DateTime.parse(entry.key)),
                      style: text.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  ...entry.value.map(classCard),
                ],
              ])
      else ...[
        calendar(),
        const SizedBox(height: 12),
        trend(),
      ],
    ];
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    // Parents and students: the workspace header names the screen; pull down to refresh.
    appBar: personal
        ? null
        : AppBar(
            title: Text(widget.title),
            automaticallyImplyLeading: false,
            actions: [
              IconButton(
                tooltip: 'Refresh',
                onPressed: busy || saving ? null : () => change(() {}),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
    body: RefreshIndicator(
      onRefresh: () => change(() {}),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          if (busy && !personal) const LinearProgressIndicator(),
          if (error.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(error),
              ),
            ),
          if (notice.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(notice),
              ),
            ),
          if (personal) ...[
            if (error.isNotEmpty)
              TextButton.icon(
                onPressed: () => change(() {}),
                icon: const Icon(Icons.refresh),
                label: const Text('Try again'),
              ),
            ...personalBody(context),
          ] else ...[
            filters(),
            if (!ready)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'Select a course, branch and academic batch to load the class register.',
                ),
              )
            else if (data != null) ...[
              overview(),
              const SizedBox(height: 18),
              calendar(),
              trend(),
              const SizedBox(height: 18),
              register(),
            ],
          ],
        ],
      ),
    ),
  );
}

class AttendanceOverview extends StatefulWidget {
  const AttendanceOverview({
    super.key,
    required this.api,
    this.studentCode = '',
    this.initialClass,
    this.studentName,
    this.onOpen,
  });
  final CollegeApi api;
  final String studentCode;
  final Json? initialClass;
  final String? studentName;
  final VoidCallback? onOpen;
  @override
  State<AttendanceOverview> createState() => _AttendanceOverviewState();
}

class _AttendanceOverviewState extends State<AttendanceOverview> {
  late Future<dynamic> result;
  @override
  void initState() {
    super.initState();
    result = widget.api.attendance(
      studentCode: widget.studentCode,
      on: _attDate(DateTime.now()),
    );
  }

  @override
  void didUpdateWidget(covariant AttendanceOverview old) {
    super.didUpdateWidget(old);
    if (old.studentCode != widget.studentCode) {
      result = widget.api.attendance(
        studentCode: widget.studentCode,
        on: _attDate(DateTime.now()),
      );
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: result,
    builder: (c, snapshot) {
      if (snapshot.hasError) {
        return const Card(
          child: Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              'Attendance could not be loaded. Open Attendance to retry.',
            ),
          ),
        );
      }
      if (!snapshot.hasData) return const EduCardSkeleton(height: 170);
      final summaries = Map<String, dynamic>.from(
        (snapshot.data as Map)['summaries'] as Map? ?? {},
      );
      final month = Map<String, dynamic>.from(summaries['month'] as Map? ?? {});
      final day = Map<String, dynamic>.from(summaries['day'] as Map? ?? {});
      final pct = month['percentage'] as num?;
      final who = widget.studentName?.split(' ').first ?? 'Your child';
      // Today's status comes from the day's recorded sessions and approved leave.
      final (todayText, todayTint) = (day['leave_days'] as num? ?? 0) > 0
          ? ('$who is on leave today', EduTints.gold)
          : (day['recorded'] as num? ?? 0) == 0
          ? ('Attendance not marked yet today', EduTints.mist)
          : (day['attended'] as num? ?? 0) > 0
          ? ('$who is present today', EduTints.sage)
          : ('$who is absent today', EduTints.clay);
      final text = Theme.of(context).textTheme;
      return Material(
        color: collegeIvory,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: collegeLine),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: widget.onOpen,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    EduRing(
                      value: pct == null ? null : pct / 100,
                      size: 88,
                      color: collegePine,
                      center: Text(
                        pct == null ? '—' : '${pct.round()}%',
                        style: text.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Attendance this month',
                            style: text.titleMedium,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            pct == null
                                ? 'No sessions recorded this month'
                                : 'Attended ${month['attended'] ?? 0} of ${month['recorded'] ?? 0} sessions',
                            style: text.bodySmall,
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Leave · ${(summaries['week'] as Map?)?['leave_days'] ?? 0} this week · ${month['leave_days'] ?? 0} this month',
                            style: text.bodySmall,
                          ),
                        ],
                      ),
                    ),
                    if (widget.onOpen != null)
                      const Icon(Icons.chevron_right, color: collegeMuted),
                  ],
                ),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: todayTint,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.circle,
                        size: 10,
                        color: EduTints.ink(todayTint),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          todayText,
                          style: text.titleSmall?.copyWith(
                            color: EduTints.ink(todayTint),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}
