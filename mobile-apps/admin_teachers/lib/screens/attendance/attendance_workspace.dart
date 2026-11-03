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
        // Open the teacher's current class straight away (any device, no saved selection).
        final first = result['default_class'];
        if (widget.initialClass == null && program.isEmpty && first is Map) {
          level = _asText(first['course_level']).isEmpty ? level : _asText(first['course_level']);
          program = _asText(first['program_code']);
          year = _asText(first['academic_year_code']);
          section = _asText(first['section_code']);
          final chosen = _asRows(result['courses']).where((c) => c['code'] == program).firstOrNull;
          if (chosen != null) course = _asText(chosen['name']);
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
        // Every student is saved: changed marks, earlier marks (late stays late), otherwise the
        // register default — present, or absent for a student on approved leave.
        'marks': roster
            .map(
              (s) => {
                'student_code': s['code'],
                'status': draft[s['code']] ??
                    values[s['code']] ??
                    effective(_asText(s['code'])),
              },
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
            ...sections.map(
              (r) => (
                _asText(r['code']),
                [
                  _asText(r['name']),
                  if (r['students'] != null) '${r['students']} students',
                  if (r['current'] == true) 'current',
                ].join(' · '),
              ),
            ),
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

  Widget trend() {
    final days = _asRows(data?['calendar']);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Monthly attendance pattern',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 120,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: days
                    .map(
                      (d) => Expanded(
                        child: Tooltip(
                          message:
                              '${d['date']}: ${d['percentage'] ?? 'Not recorded'}',
                          child: InkWell(
                            onTap: () => change(
                              () => day = DateTime.parse(d['date'] as String),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 1,
                              ),
                              child: Container(
                                height:
                                    ((d['percentage'] as num?)?.toDouble() ??
                                        0) +
                                    3,
                                decoration: BoxDecoration(
                                  color: d['percentage'] == null
                                      ? collegeLine
                                      : collegePine,
                                  borderRadius: BorderRadius.circular(3),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Students with approved leave on the selected day (they default to absent).
  Set<String> get onLeave {
    final dates = Map<String, dynamic>.from(data?['leave_dates'] as Map? ?? {});
    final today = _attDate(day);
    return {
      for (final e in dates.entries)
        if ((e.value as List? ?? []).contains(today)) e.key,
    };
  }

  /// Present / absent as shown in the register: saved or changed marks, otherwise present —
  /// or absent for a student on approved leave.
  String effective(String code) {
    final value = marks[code] as String?;
    if (value == 'present' || value == 'late') return 'present';
    if (value == 'absent' || value == 'excused') return 'absent';
    return onLeave.contains(code) ? 'absent' : 'present';
  }

  Widget register() {
    final text = Theme.of(context).textTheme;
    final roster = _asRows(data?['students']);
    final leave = onLeave;
    final shown = roster
        .where(
          (s) => '${s['name']} ${s['admission_number']}'.toLowerCase().contains(
            search.text.toLowerCase(),
          ),
        )
        .toList();
    final registers = _asRows(
      data?['registers'],
    ).where((r) => r['session_date'] == _attDate(day)).toList();
    final saved = current != null;
    final presentCount = roster.where((s) => effective(_asText(s['code'])) == 'present').length;
    final leaveCount = roster.where((s) => leave.contains(_asText(s['code']))).length;
    final absentCount = roster.length - presentCount;
    // Unsaved registers are saved with the defaults; saved ones when something changed.
    final canSave = canMark && !saving && roster.isNotEmpty && (draft.isNotEmpty || !saved);
    Widget count(String label, int value, Color tint, IconData icon) => Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(14)),
        child: Column(children: [
          Icon(icon, size: 18, color: EduTints.ink(tint)),
          const SizedBox(height: 4),
          Text('$value', style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800, color: EduTints.ink(tint))),
          FittedBox(fit: BoxFit.scaleDown, child: Text(label, style: text.labelSmall?.copyWith(color: EduTints.ink(tint), fontWeight: FontWeight.w600))),
        ]),
      ),
    );
    void setAll(String status) => setState(() {
      for (final s in roster) {
        final code = _asText(s['code']);
        // "All present" keeps students on approved leave absent.
        draft[code] = status == 'present' && leave.contains(code) ? 'absent' : status;
      }
    });
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Expanded(
            child: Text(
              '${prettyDate(day)} · ${period == 0 ? 'Whole day' : 'Period $period'}',
              style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800),
            ),
          ),
          if (canMark)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: saved && draft.isEmpty ? EduTints.sage : EduTints.gold,
                borderRadius: BorderRadius.circular(99),
              ),
              child: Text(
                saved && draft.isEmpty ? 'Saved' : draft.isNotEmpty ? '${draft.length} unsaved' : 'Not saved yet',
                style: text.labelMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
            ),
        ]),
        const SizedBox(height: 12),
        // Register overview.
        Row(children: [
          count('Students', roster.length, EduTints.mist, Icons.groups_outlined),
          const SizedBox(width: 8),
          count('Present', presentCount, EduTints.sage, Icons.check_circle_outline),
          const SizedBox(width: 8),
          count('Absent', absentCount, EduTints.clay, Icons.cancel_outlined),
          const SizedBox(width: 8),
          count('On leave', leaveCount, EduTints.gold, Icons.event_busy_outlined),
        ]),
        const SizedBox(height: 12),
        if (canMark) ...[
          TextField(
            controller: subject,
            decoration: const InputDecoration(
              labelText: 'Subject / class note',
              hintText: 'Optional subject',
              isDense: true,
            ),
            maxLength: 160,
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                key: const ValueKey('mark-all-present'),
                onPressed: saving ? null : () => setAll('present'),
                icon: const Icon(Icons.done_all_rounded, size: 18),
                label: const Text('Mark all present'),
              ),
              OutlinedButton.icon(
                onPressed: saving ? null : () => setAll('absent'),
                icon: const Icon(Icons.remove_done_rounded, size: 18),
                label: const Text('All absent'),
              ),
              TextButton(
                onPressed: draft.isEmpty || saving ? null : () => setState(draft.clear),
                child: const Text('Reset changes'),
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
            isDense: true,
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 10),
        if (canMark)
          Text('Tap a student to switch between present and absent.', style: text.bodySmall),
        const SizedBox(height: 10),
        if (shown.isEmpty) const Text('No students in this selection.'),
        // The register grid: one compact tile per student.
        LayoutBuilder(builder: (context, constraints) {
          final columns = MediaQuery.textScalerOf(context).scale(16) > 22
              ? 2
              : constraints.maxWidth >= 720
              ? 5
              : constraints.maxWidth >= 520
              ? 4
              : 3;
          final width = (constraints.maxWidth - (columns - 1) * 8) / columns;
          return Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final (i, s) in shown.indexed)
                Builder(builder: (context) {
                  final code = _asText(s['code']);
                  final present = effective(code) == 'present';
                  final leaveToday = leave.contains(code);
                  final tint = present ? EduTints.sage : EduTints.clay;
                  final ink = EduTints.ink(tint);
                  final raw = marks[code] as String?;
                  return SizedBox(
                    width: width,
                    child: Semantics(
                      button: canMark,
                      toggled: present,
                      label: '${_asText(s['name'])}: ${present ? 'present' : 'absent'}${leaveToday ? ', on approved leave' : ''}',
                      excludeSemantics: true,
                      child: Material(
                        key: ValueKey('att-$code'),
                        color: tint.withValues(alpha: present ? .55 : .75),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                          side: BorderSide(
                            color: draft.containsKey(code) ? Theme.of(context).colorScheme.primary : ink.withValues(alpha: .25),
                            width: draft.containsKey(code) ? 1.6 : 1,
                          ),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: !canMark || saving
                              ? null
                              : () => setState(() => draft[code] = present ? 'absent' : 'present'),
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Container(
                                  width: 24,
                                  height: 24,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: .8), shape: BoxShape.circle),
                                  child: Text('${i + 1}', style: text.labelSmall?.copyWith(fontWeight: FontWeight.w800, color: ink)),
                                ),
                                const Spacer(),
                                Icon(present ? Icons.check_circle_rounded : Icons.cancel_rounded, size: 20, color: ink),
                              ]),
                              const SizedBox(height: 6),
                              Text(
                                _asText(s['name']),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: text.labelLarge?.copyWith(fontWeight: FontWeight.w700, height: 1.15),
                              ),
                              Text(
                                _asText(s['admission_number']),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: text.labelSmall,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                leaveToday
                                    ? 'On leave'
                                    : raw == 'late'
                                    ? 'Late'
                                    : present
                                    ? 'Present'
                                    : 'Absent',
                                style: text.labelSmall?.copyWith(fontWeight: FontWeight.w800, color: ink),
                              ),
                            ]),
                          ),
                        ),
                      ),
                    ),
                  );
                }),
            ],
          );
        }),
        if (canMark) ...[
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: canSave ? save : null,
              icon: const Icon(Icons.save_outlined),
              label: Text(
                saving
                    ? 'Saving…'
                    : 'Save attendance · $presentCount present, $absentCount absent',
              ),
            ),
          ),
        ],
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

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
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
      onRefresh: () => ApiFreshness.refresh(() async => change(() {})),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
        children: [
          if (busy) const LinearProgressIndicator(),
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
  });
  final CollegeApi api;
  final String studentCode;
  final Json? initialClass;
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
      if (!snapshot.hasData) return const LinearProgressIndicator();
      final summaries = Map<String, dynamic>.from(
        (snapshot.data as Map)['summaries'] as Map? ?? {},
      );
      final month = Map<String, dynamic>.from(summaries['month'] as Map? ?? {});
      final pct = month['percentage'];
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Attendance overview',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 12),
              Text(
                pct == null
                    ? 'No attendance recorded this month'
                    : '$pct% this month',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 10),
              LinearProgressIndicator(
                value: pct == null ? 0 : (pct as num).toDouble() / 100,
              ),
              const SizedBox(height: 12),
              Text(
                'Week leave days: ${(summaries['week'] as Map?)?['leave_days'] ?? 0} · Month leave days: ${month['leave_days'] ?? 0}',
              ),
              Text(
                'Attended ${month['attended'] ?? 0} of ${month['recorded'] ?? 0} recorded sessions',
              ),
            ],
          ),
        ),
      );
    },
  );
}
