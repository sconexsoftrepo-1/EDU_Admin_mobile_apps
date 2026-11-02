part of '../../app/edunexa_client.dart';

class AssessmentHub extends StatefulWidget {
  const AssessmentHub({
    super.key,
    required this.api,
    required this.role,
    this.studentCode = '',
  });
  final CollegeApi api;
  final MobileRole role;
  final String studentCode;
  @override
  State<AssessmentHub> createState() => _AssessmentHubState();
}

class _AssessmentHubState extends State<AssessmentHub> {
  Json? data;
  String bucket = 'upcoming', query = '', child = '';
  bool loading = false;
  String? error;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    child = widget.studentCode;
    load();
    timer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (!loading) load();
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = Map<String, dynamic>.from(
        await widget.api.assessments(studentCode: child) as Map,
      );
      if (mounted) {
        setState(() {
          data = result;
          loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          loading = false;
        });
      }
    }
  }

  Future<void> details(Json item) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AssessmentDetails(
          api: widget.api,
          code: _asText(item['code']),
          studentCode: child,
        ),
      ),
    );
    if (mounted) await load();
  }

  static const _months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  String _time(DateTime t) {
    final hour = t.hour % 12 == 0 ? 12 : t.hour % 12;
    return '$hour:${t.minute.toString().padLeft(2, '0')} ${t.hour < 12 ? 'AM' : 'PM'}';
  }

  /// The signed-in student's (or selected child's) mark on a listed assessment, if published.
  Json? _myMark(Json item) {
    if (widget.role != MobileRole.student && widget.role != MobileRole.parent) {
      return null;
    }
    final rows = _asRows(item['students']);
    final mine =
        rows.where((r) => child.isEmpty || r['code'] == child).firstOrNull ??
        (rows.length == 1 ? rows.first : null);
    final mark = mine?['mark'];
    return mark is Map ? Map<String, dynamic>.from(mark) : null;
  }

  Widget _performanceCard(BuildContext context, Json performance) {
    final text = Theme.of(context).textTheme;
    final pct = num.tryParse('${performance['percentage'] ?? ''}');
    final all = _asRows(data?['items']);
    final upcoming = all.where((a) => a['bucket'] == 'upcoming').length;
    final done = all.where((a) => a['bucket'] == 'completed').length;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xffeee6f3), Color(0xffe3ebee)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: collegeLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              EduRing(
                value: pct == null ? 0 : pct / 100,
                size: 92,
                color: pct == null
                    ? collegeMuted
                    : pct >= 75
                    ? const Color(0xff4f7a52)
                    : pct >= 50
                    ? const Color(0xff9a7a2e)
                    : const Color(0xffa8553f),
                center: Text(
                  pct == null ? '—' : '${pct.round()}%',
                  style: text.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Assessment performance',
                      style: text.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      pct == null
                          ? 'No graded results yet'
                          : pct >= 75
                          ? 'Doing well — keep it up'
                          : pct >= 50
                          ? 'On track, room to improve'
                          : 'Needs attention',
                      style: text.bodyMedium,
                    ),
                    Text(
                      '${performance['graded'] ?? 0} graded results · weighted by maximum marks',
                      style: text.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: collegeIvory.withValues(alpha: .75),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                for (final (label, value) in [
                  ('Upcoming', '$upcoming'),
                  ('Results out', '$done'),
                  ('Graded', '${performance['graded'] ?? 0}'),
                ])
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label, style: text.labelMedium),
                        Text.rich(
                          TextSpan(text: value),
                          style: text.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _scoreColor(num? pct) => pct == null
      ? collegeMuted
      : pct >= 75
      ? const Color(0xff4f7a52)
      : pct >= 50
      ? const Color(0xff9a7a2e)
      : const Color(0xffa8553f);

  /// Each student's overall score: avatar, name and a ring, so it reads differently
  /// from the per-subject bars below.
  Widget _studentScores(BuildContext context, List<Json> rows) {
    final text = Theme.of(context).textTheme;
    return Container(
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xfff3f1fa),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: EduWorkspace.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.person_pin_outlined, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  rows.length == 1
                      ? 'Overall score'
                      : 'Overall score by student',
                  style: text.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'All graded assessments together, weighted by maximum marks.',
            style: text.bodySmall,
          ),
          for (final r in rows) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: EduTints.plum,
                    child: Text(
                      _asText(r['name'])
                          .trim()
                          .split(RegExp(r'\s+'))
                          .where((w) => w.isNotEmpty)
                          .take(2)
                          .map((w) => w[0].toUpperCase())
                          .join(),
                      style: text.labelLarge?.copyWith(
                        color: EduTints.ink(EduTints.plum),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _asText(r['name']),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: text.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          '${r['graded'] ?? 0} graded results',
                          style: text.labelSmall,
                        ),
                      ],
                    ),
                  ),
                  EduRing(
                    value:
                        (num.tryParse('${r['percentage'] ?? ''}') ?? 0) / 100,
                    size: 52,
                    color: _scoreColor(
                      num.tryParse('${r['percentage'] ?? ''}'),
                    ),
                    center: Text(
                      r['percentage'] == null
                          ? '—'
                          : '${num.parse('${r['percentage']}').round()}%',
                      style: text.labelLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// Current semester at a glance: course, academic year, semester and section on top,
  /// then each subject or lab with its credits and assigned faculty.
  Widget _semesterSubjects(BuildContext context, List<Json> rows) {
    final text = Theme.of(context).textTheme;
    final first = rows.first;
    final semester = first['current_semester'] ?? first['semester_number'];
    final labs = rows
        .where(
          (r) =>
              '${r['subject_type']}'.toLowerCase().contains('lab') ||
              '${r['subject_type']}'.toLowerCase().contains('practical'),
        )
        .length;
    Widget fact(IconData icon, String label, String value) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: Colors.white70),
        const SizedBox(width: 6),
        Flexible(
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '$label  ',
                  style: const TextStyle(color: Colors.white70),
                ),
                TextSpan(
                  text: value,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ],
            ),
            style: text.bodySmall?.copyWith(color: Colors.white),
          ),
        ),
      ],
    );
    return Container(
      margin: const EdgeInsets.only(top: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: EduWorkspace.border),
        boxShadow: EduWorkspace.shadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Highlighted header in the role's accent colour.
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  Theme.of(context).colorScheme.primary,
                  Color.lerp(
                    Theme.of(context).colorScheme.primary,
                    Colors.black,
                    .25,
                  )!,
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'My semester subjects & labs',
                            style: text.labelLarge?.copyWith(
                              color: Colors.white70,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _asText(first['program_name']).isEmpty
                                ? 'Current semester'
                                : _asText(first['program_name']),
                            style: text.titleLarge?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (semester != null)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(
                          children: [
                            Text(
                              'SEM',
                              style: text.labelSmall?.copyWith(
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1,
                              ),
                            ),
                            Text(
                              '$semester',
                              style: text.titleLarge?.copyWith(
                                fontWeight: FontWeight.w900,
                                color: Theme.of(context).colorScheme.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 16,
                  runSpacing: 6,
                  children: [
                    if (_asText(first['academic_year_name']).isNotEmpty)
                      fact(
                        Icons.date_range_outlined,
                        'Academic year',
                        _asText(first['academic_year_name']),
                      ),
                    if (_asText(first['section_name']).isNotEmpty)
                      fact(
                        Icons.groups_outlined,
                        'Section',
                        _asText(first['section_name']),
                      ),
                    fact(
                      Icons.menu_book_outlined,
                      'Subjects',
                      '${rows.length - labs}',
                    ),
                    if (labs > 0) fact(Icons.science_outlined, 'Labs', '$labs'),
                  ],
                ),
              ],
            ),
          ),
          for (final (i, s) in rows.indexed) ...[
            if (i > 0)
              const Divider(
                height: 1,
                indent: 16,
                endIndent: 16,
                color: EduWorkspace.border,
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Builder(
                    builder: (context) {
                      final lab =
                          '${s['subject_type']}'.toLowerCase().contains(
                            'lab',
                          ) ||
                          '${s['subject_type']}'.toLowerCase().contains(
                            'practical',
                          );
                      final tint = lab ? EduTints.mist : EduTints.sage;
                      return Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: tint,
                          borderRadius: BorderRadius.circular(11),
                        ),
                        child: Icon(
                          lab
                              ? Icons.science_outlined
                              : Icons.menu_book_outlined,
                          size: 20,
                          color: EduTints.ink(tint),
                        ),
                      );
                    },
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _asText(s['name']),
                          style: text.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: [
                            for (final chip in [
                              _asText(s['subject_type']).isEmpty
                                  ? null
                                  : '${_asText(s['subject_type'])[0].toUpperCase()}${_asText(s['subject_type']).substring(1)}',
                              _asText(s['credits']).isEmpty ||
                                      _asText(s['credits']) == '0'
                                  ? null
                                  : '${s['credits']} credits',
                            ].nonNulls)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: collegeCanvas,
                                  borderRadius: BorderRadius.circular(99),
                                ),
                                child: Text(
                                  chip,
                                  style: text.labelSmall?.copyWith(
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(
                              Icons.badge_outlined,
                              size: 15,
                              color: collegeMuted,
                            ),
                            const SizedBox(width: 5),
                            Expanded(
                              child: Text(
                                _asRows(s['faculty']).isEmpty
                                    ? 'Faculty not assigned yet'
                                    : _asRows(s['faculty'])
                                          .map((f) => _asText(f['name']))
                                          .where((n) => n.isNotEmpty)
                                          .toSet()
                                          .join(', '),
                                style: text.bodySmall?.copyWith(
                                  fontWeight: _asRows(s['faculty']).isEmpty
                                      ? FontWeight.w400
                                      : FontWeight.w600,
                                  fontStyle: _asRows(s['faculty']).isEmpty
                                      ? FontStyle.italic
                                      : FontStyle.normal,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _breakdown(BuildContext context, String title, List<Json> rows) {
    final text = Theme.of(context).textTheme;
    return Container(
      margin: const EdgeInsets.only(top: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: collegeIvory,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: collegeLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          for (final b in rows) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Text(
                    _asText(b['name']),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  b['percentage'] == null ? '—' : '${b['percentage']}%',
                  style: text.labelLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                minHeight: 8,
                value: ((num.tryParse('${b['percentage'] ?? ''}') ?? 0) / 100)
                    .clamp(0, 1)
                    .toDouble(),
                backgroundColor: collegeCanvas,
              ),
            ),
            if (b['graded'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 3),
                child: Text(
                  '${b['graded']} graded results',
                  style: text.labelSmall,
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _assessmentCard(BuildContext context, Json item) {
    final text = Theme.of(context).textTheme;
    final at = DateTime.tryParse(_asText(item['scheduled_at']))?.toLocal();
    final bucketName = _asText(item['bucket']);
    final mark = _myMark(item);
    final maxMarks = _asText(item['max_marks']);
    final today = DateUtils.dateOnly(DateTime.now());
    final days = at == null
        ? null
        : DateUtils.dateOnly(at).difference(today).inDays;
    final status = bucketName == 'draft'
        ? (label: 'Draft', tint: EduTints.mist)
        : bucketName == 'completed'
        ? (
            label: mark == null
                ? 'Marks pending'
                : mark['absent'] == true
                ? 'Absent'
                : 'Result out',
            tint: mark == null ? EduTints.gold : EduTints.sage,
          )
        : days == 0
        ? (label: 'Today', tint: EduTints.clay)
        : days == 1
        ? (label: 'Tomorrow', tint: EduTints.clay)
        : (
            label: days != null && days > 1 ? 'In $days days' : 'Upcoming',
            tint: EduTints.plum,
          );
    final score = mark == null || mark['absent'] == true
        ? null
        : num.tryParse(_asText(mark['marks']));
    final maximum = num.tryParse(maxMarks);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: collegeIvory,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: collegeLine),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: ValueKey('assessment-${item['code']}'),
          onTap: () => details(item),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 54,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: status.tint,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Column(
                      children: [
                        Text(
                          at == null ? '—' : '${at.day}',
                          style: text.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: EduTints.ink(status.tint),
                          ),
                        ),
                        Text(
                          at == null ? '' : _months[at.month - 1],
                          style: text.labelMedium?.copyWith(
                            color: EduTints.ink(status.tint),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _asText(item['title']),
                        style: text.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        [
                          _asText(item['subject_name']),
                          if (at != null) _time(at),
                          if (maxMarks.isNotEmpty) '$maxMarks marks',
                        ].where((v) => v.isNotEmpty).join(' · '),
                        style: text.bodySmall,
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: status.tint,
                              borderRadius: BorderRadius.circular(99),
                            ),
                            child: Text(
                              status.label,
                              style: text.labelMedium?.copyWith(
                                color: EduTints.ink(status.tint),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          if (score != null)
                            Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(
                                    text: '$score',
                                    style: text.titleSmall?.copyWith(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  TextSpan(text: ' / $maxMarks'),
                                  if (maximum != null && maximum > 0)
                                    TextSpan(
                                      text:
                                          '  ·  ${(score / maximum * 100).round()}%',
                                    ),
                                ],
                              ),
                              style: text.labelMedium,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: collegeMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final buckets = [
      'upcoming',
      'completed',
      if (data?['can_create'] == true ||
          _asRows(data?['items']).any((a) => a['bucket'] == 'draft'))
        'draft',
    ];
    final items =
        _asRows(data?['items'])
            .where(
              (a) =>
                  a['bucket'] == bucket &&
                  '${a['title']} ${a['subject_name']} ${a['batch_name']}'
                      .toLowerCase()
                      .contains(query.toLowerCase()),
            )
            .toList()
          ..sort((a, b) {
            final order = _asText(
              a['scheduled_at'],
            ).compareTo(_asText(b['scheduled_at']));
            return bucket == 'upcoming' ? order : -order;
          });
    final performance = Map<String, dynamic>.from(
      data?['performance'] as Map? ?? {},
    );
    final children = _asRows(data?['students']);
    final studentScores = _asRows(data?['student_performance']);
    final subjectScores = _asRows(data?['subject_performance']);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Assessments'),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            onPressed: loading ? null : load,
            tooltip: 'Refresh assessments',
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton: data?['can_create'] == true
          ? FloatingActionButton.extended(
              onPressed: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => AssessmentComposer(api: widget.api),
                  ),
                );
                if (mounted) await load();
              },
              icon: const Icon(Icons.add),
              label: const Text('Add assessment'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            if (error != null)
              WorkspaceMessage(
                icon: Icons.cloud_off_outlined,
                title: 'Could not load assessments',
                message: error!,
                onRetry: load,
              ),
            if (children.length > 1) ...[
              DropdownButtonFormField<String>(
                key: ValueKey(child),
                initialValue: child.isEmpty ? null : child,
                isExpanded: true,
                decoration: const InputDecoration(
                  labelText: 'Student',
                  prefixIcon: Icon(Icons.person_outline),
                ),
                items: children
                    .map(
                      (s) => DropdownMenuItem(
                        value: _asText(s['code']),
                        child: Text(_asText(s['name'])),
                      ),
                    )
                    .toList(),
                onChanged: (v) {
                  child = v ?? '';
                  load();
                },
              ),
              const SizedBox(height: 14),
            ],
            if (data == null && loading)
              const EduCardSkeleton(height: 190)
            else
              EduReveal(child: _performanceCard(context, performance)),
            if (studentScores.isNotEmpty)
              _studentScores(context, studentScores),
            if (subjectScores.isNotEmpty)
              _breakdown(context, 'Subject performance', subjectScores),
            if (_asRows(data?['batch_performance']).isNotEmpty)
              _breakdown(
                context,
                'Class performance',
                _asRows(data?['batch_performance']),
              ),
            if (_asRows(data?['subjects']).isNotEmpty)
              _semesterSubjects(context, _asRows(data?['subjects'])),
            const SizedBox(height: 18),
            EduPillTabs(
              labels: [
                for (final t in buckets)
                  t == 'upcoming'
                      ? 'Upcoming'
                      : t == 'completed'
                      ? 'Completed'
                      : 'Drafts',
              ],
              selected: buckets.indexOf(bucket).clamp(0, buckets.length - 1),
              onSelected: (i) => setState(() => bucket = buckets[i]),
            ),
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search assessments',
              ),
              onChanged: (v) => setState(() => query = v),
            ),
            const SizedBox(height: 14),
            if (data == null && loading) ...[
              const EduCardSkeleton(height: 96),
              const SizedBox(height: 12),
              const EduCardSkeleton(height: 96),
            ] else if (items.isEmpty)
              WorkspaceMessage(
                icon: Icons.fact_check_outlined,
                title: 'No assessments in this tab.',
                message: bucket == 'upcoming'
                    ? 'Upcoming tests and internal assessments appear here.'
                    : bucket == 'completed'
                    ? 'Completed assessments and their marks appear here.'
                    : 'Draft assessments you save appear here.',
              )
            else
              for (final item in items) _assessmentCard(context, item),
          ],
        ),
      ),
    );
  }
}

class AssessmentDetails extends StatefulWidget {
  const AssessmentDetails({
    super.key,
    required this.api,
    required this.code,
    this.studentCode = '',
  });
  final CollegeApi api;
  final String code, studentCode;
  @override
  State<AssessmentDetails> createState() => _AssessmentDetailsState();
}

class _AssessmentDetailsState extends State<AssessmentDetails> {
  Json? data;
  String? error;
  bool saving = false;
  final Map<String, TextEditingController> marks = {}, feedback = {};
  final Map<String, bool> absent = {};
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    for (final c in [...marks.values, ...feedback.values]) {
      c.dispose();
    }
    super.dispose();
  }

  void populate(Json value) {
    for (final s in _asRows(value['students'])) {
      final code = _asText(s['code']);
      final m = Map<String, dynamic>.from(s['mark'] as Map? ?? {});
      marks.putIfAbsent(code, () => TextEditingController()).text = _asText(
        m['marks'],
      );
      feedback.putIfAbsent(code, () => TextEditingController()).text = _asText(
        m['feedback'],
      );
      absent[code] = m['absent'] == true;
    }
  }

  Future<void> load() async {
    try {
      final result = Map<String, dynamic>.from(
        await widget.api.assessmentDetails(
              widget.code,
              studentCode: widget.studentCode,
            )
            as Map,
      );
      if (mounted) {
        setState(() {
          data = result;
          populate(result);
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  Future<void> save() async {
    setState(() => saving = true);
    try {
      final rows = <Json>[];
      for (final s in _asRows(data?['students'])) {
        final code = _asText(s['code']);
        final text = marks[code]!.text.trim();
        final n = double.tryParse(text);
        if (text.isNotEmpty &&
            (n == null ||
                !n.isFinite ||
                n < 0 ||
                n > double.parse(_asText(data!['max_marks'])))) {
          throw const FormatException(
            'Marks must be between zero and the maximum.',
          );
        }
        if (text.isNotEmpty ||
            absent[code] == true ||
            feedback[code]!.text.isNotEmpty ||
            s['mark'] != null) {
          rows.add({
            'student_code': code,
            'marks': absent[code] == true || text.isEmpty ? null : text,
            'feedback': feedback[code]!.text,
            'absent': absent[code] == true,
          });
        }
      }
      if (rows.isEmpty) {
        throw const FormatException('Enter marks or mark an absence first.');
      }
      final result = Map<String, dynamic>.from(
        await widget.api.assessmentMarks(widget.code, {
              'revision': data!['revision'],
              'students': rows,
            })
            as Map,
      );
      if (mounted) {
        setState(() {
          data = result;
          populate(result);
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Marks published to students and parents.'),
          ),
        );
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = data;
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _asText(a?['title']).isEmpty
              ? 'Assessment details'
              : _asText(a?['title']),
        ),
      ),
      body: a == null
          ? Center(
              child: error == null
                  ? const CircularProgressIndicator()
                  : TextButton(onPressed: load, child: Text('$error · Retry')),
            )
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  _asText(a['subject_name']),
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                Text('${a['course_name']} · ${a['batch_name']}'),
                Text('${_asDate(a['scheduled_at'])} · ${a['bucket']}'),
                Text('Maximum marks: ${a['max_marks']}'),
                const SizedBox(height: 24),
                Text(
                  'Description',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Text(_asText(a['description'])),
                const SizedBox(height: 20),
                Text('Guidance', style: Theme.of(context).textTheme.titleLarge),
                Text(_asText(a['guidance'])),
                const SizedBox(height: 20),
                _asAttachments(context, widget.api, a['attachments']),
                if (a['status'] == 'draft' && a['can_manage'] == true)
                  FilledButton(
                    onPressed: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              AssessmentComposer(api: widget.api, initial: a),
                        ),
                      );
                      if (mounted) await load();
                    },
                    child: const Text('Edit or publish draft'),
                  ),
                const SizedBox(height: 24),
                Text(
                  a['can_grade'] == true ? 'Enter student marks' : 'Results',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                for (final s in _asRows(a['students']))
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _asText(s['name']),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          if (a['can_grade'] == true) ...[
                            TextField(
                              controller: marks[_asText(s['code'])],
                              enabled:
                                  !saving && absent[_asText(s['code'])] != true,
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              decoration: InputDecoration(
                                labelText: 'Marks / ${a['max_marks']}',
                              ),
                            ),
                            CheckboxListTile(
                              contentPadding: EdgeInsets.zero,
                              title: const Text('Absent'),
                              value: absent[_asText(s['code'])] == true,
                              onChanged: saving
                                  ? null
                                  : (v) => setState(
                                      () => absent[_asText(s['code'])] =
                                          v == true,
                                    ),
                            ),
                            TextField(
                              controller: feedback[_asText(s['code'])],
                              enabled: !saving,
                              decoration: const InputDecoration(
                                labelText: 'Feedback',
                              ),
                            ),
                          ] else ...[
                            Text(
                              s['mark'] == null
                                  ? 'Marks pending'
                                  : (s['mark'] as Map)['absent'] == true
                                  ? 'Absent'
                                  : '${(s['mark'] as Map)['marks'] ?? 'Pending'} / ${a['max_marks']}',
                            ),
                            Text(_asText((s['mark'] as Map?)?['feedback'])),
                          ],
                        ],
                      ),
                    ),
                  ),
                if (error != null)
                  Text(
                    error!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                if (a['can_grade'] == true)
                  FilledButton(
                    onPressed: saving ? null : save,
                    child: Text(saving ? 'Saving…' : 'Save & publish marks'),
                  ),
              ],
            ),
    );
  }
}

class AssessmentComposer extends StatefulWidget {
  const AssessmentComposer({super.key, required this.api, this.initial});
  final CollegeApi api;
  final Json? initial;
  @override
  State<AssessmentComposer> createState() => _AssessmentComposerState();
}

class _AssessmentComposerState extends State<AssessmentComposer> {
  final form = GlobalKey<FormState>();
  final title = TextEditingController(),
      description = TextEditingController(),
      guidance = TextEditingController(),
      maximum = TextEditingController(text: '100');
  Json? options;
  String level = '',
      program = '',
      year = '',
      section = '',
      subject = '',
      teacher = '';
  int semester = 1;
  DateTime? scheduled;
  List<XFile> files = [];
  bool busy = false, loading = false;
  String? error;
  int ticket = 0;
  @override
  void initState() {
    super.initState();
    final a = widget.initial;
    if (a != null) {
      title.text = _asText(a['title']);
      description.text = _asText(a['description']);
      guidance.text = _asText(a['guidance']);
      maximum.text = _asText(a['max_marks']);
      level = _asText(a['course_level']);
      program = _asText(a['program_code']);
      year = _asText(a['academic_year_code']);
      section = _asText(a['section_code']);
      subject = _asText(a['subject_code']);
      teacher = _asText(a['teacher_code']);
      semester = a['semester_number'] as int;
      scheduled = DateTime.parse(_asText(a['scheduled_at'])).toLocal();
    }
    load();
  }

  @override
  void dispose() {
    for (final c in [title, description, guidance, maximum]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> load() async {
    final current = ++ticket;
    setState(() => loading = true);
    try {
      final result = Map<String, dynamic>.from(
        await widget.api.assessmentOptions(
              program: program,
              year: year,
              section: section,
            )
            as Map,
      );
      if (mounted && ticket == current) {
        setState(() {
          options = result;
          if (widget.initial == null && result['current_semester'] is int) {
            semester = result['current_semester'] as int;
          }
        });
      }
    } catch (e) {
      if (mounted && ticket == current) setState(() => error = e.toString());
    } finally {
      if (mounted && ticket == current) setState(() => loading = false);
    }
  }

  Widget select(
    String label,
    String value,
    List<Json> items,
    void Function(String) change, {
    bool required = true,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 18),
    child: DropdownButtonFormField<String>(
      key: ValueKey('$label-$value-${items.map((s) => s['code']).join()}'),
      initialValue: items.any((r) => _asText(r['code']) == value)
          ? value
          : null,
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: items
          .map(
            (r) => DropdownMenuItem(
              value: _asText(r['code']),
              child: Text(_asText(r['name']), overflow: TextOverflow.ellipsis),
            ),
          )
          .toList(),
      onChanged: busy || loading ? null : (v) => change(v ?? ''),
      validator: (v) =>
          required && (v == null || v.isEmpty) ? 'Select $label' : null,
    ),
  );
  Future<void> date() async {
    final day = await showDatePicker(
      context: context,
      initialDate: scheduled ?? DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (day == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: scheduled == null
          ? const TimeOfDay(hour: 9, minute: 0)
          : TimeOfDay.fromDateTime(scheduled!),
    );
    if (time != null && mounted) {
      setState(
        () => scheduled = DateTime(
          day.year,
          day.month,
          day.day,
          time.hour,
          time.minute,
        ),
      );
    }
  }

  Future<void> save(String status) async {
    if (!form.currentState!.validate()) return;
    if (scheduled == null) {
      setState(() => error = 'Choose the assessment date and time.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final attachments = _asRows(
        widget.initial?['attachments'],
      ).map((f) => _asText(f['code'])).toList();
      for (final f in files) {
        attachments.add(
          _asText((await _asUpload(widget.api, f, assessment: true))['code']),
        );
      }
      await widget.api.saveAssessment({
        'title': title.text,
        'description': description.text,
        'guidance': guidance.text,
        'course_level': level,
        'program_code': program,
        'academic_year_code': year,
        'section_code': section.isEmpty ? null : section,
        'subject_code': subject,
        'teacher_code': teacher,
        'semester_number': semester,
        'scheduled_at': scheduled!.toUtc().toIso8601String(),
        'max_marks': maximum.text,
        'status': status,
        'attachments': attachments,
        'revision': widget.initial?['revision'] ?? 0,
      }, code: widget.initial?['code'] as String?);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final subjects = _asRows(options?['subjects']);
    final semesters =
        subjects.map((s) => s['semester_number'] as int).toSet().toList()
          ..sort();
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.initial == null ? 'Create assessment' : 'Edit draft',
        ),
      ),
      body: Form(
        key: form,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            if (loading) const LinearProgressIndicator(),
            select(
              'Course level',
              level,
              [
                {'code': 'intermediate', 'name': 'Intermediate'},
                {'code': 'degree', 'name': 'Degree'},
              ],
              (v) {
                setState(() {
                  level = v;
                  program = '';
                  year = '';
                  section = '';
                  subject = '';
                });
                load();
              },
            ),
            select(
              'Course / branch',
              program,
              _asRows(options?['courses'])
                  .where((c) => c['course_level'] == level)
                  .map(
                    (c) => {
                      ...c,
                      'name':
                          '${c['name']}${c['branch'] == null ? '' : ' · ${c['branch']}'}',
                    },
                  )
                  .toList(),
              (v) {
                setState(() {
                  program = v;
                  year = '';
                  section = '';
                  subject = '';
                });
                load();
              },
            ),
            select(
              'Academic batch',
              year,
              _asRows(
                options?['academic_years'],
              ).where((y) => y['program_code'] == program).toList(),
              (v) {
                setState(() {
                  year = v;
                  section = '';
                });
                load();
              },
            ),
            select(
              'Section',
              section,
              [
                {'code': '', 'name': 'All eligible sections'},
                ..._asRows(options?['sections']),
              ],
              (v) {
                setState(() => section = v);
                load();
              },
              required: false,
            ),
            select(
              'Semester',
              semester.toString(),
              semesters
                  .map((n) => {'code': '$n', 'name': 'Semester $n'})
                  .toList(),
              (v) => setState(() {
                semester = int.parse(v);
                subject = '';
              }),
            ),
            select(
              'Subject',
              subject,
              subjects
                  .where((s) => s['semester_number'] == semester)
                  .map((s) => {...s, 'code': s['subject_code']})
                  .toList(),
              (v) => setState(() => subject = v),
            ),
            select(
              'Teacher',
              teacher,
              _asRows(options?['teachers']),
              (v) => setState(() => teacher = v),
            ),
            Text(
              '${_asRows(options?['students']).length} eligible students will receive the published assessment.',
            ),
            TextFormField(
              controller: title,
              decoration: const InputDecoration(labelText: 'Assessment name *'),
              maxLength: 180,
              validator: (v) => v == null || v.trim().isEmpty
                  ? 'Enter assessment name'
                  : null,
            ),
            TextFormField(
              controller: description,
              decoration: const InputDecoration(labelText: 'Description'),
              minLines: 3,
              maxLines: 6,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: guidance,
              decoration: const InputDecoration(
                labelText: 'Guidance & preparation',
              ),
              minLines: 3,
              maxLines: 6,
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: busy ? null : date,
              icon: const Icon(Icons.schedule),
              label: Text(
                scheduled == null
                    ? 'Choose date & time *'
                    : _asDate(scheduled!.toIso8601String()),
              ),
            ),
            TextFormField(
              controller: maximum,
              decoration: const InputDecoration(labelText: 'Maximum marks *'),
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              validator: (v) {
                final n = double.tryParse(v ?? '');
                return n == null || !n.isFinite || n <= 0 || n > 10000
                    ? 'Enter maximum marks (up to 10000)'
                    : null;
              },
            ),
            OutlinedButton.icon(
              onPressed: busy
                  ? null
                  : () async {
                      try {
                        final picked = await _asPickFiles();
                        if (mounted) setState(() => files = picked);
                      } catch (e) {
                        if (context.mounted) _asError(context, e);
                      }
                    },
              icon: const Icon(Icons.attach_file),
              label: const Text('Attach images / PDFs'),
            ),
            for (final f in files) Text(f.name),
            if (error != null)
              Text(
                error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: busy || loading ? null : () => save('draft'),
              child: const Text('Save draft'),
            ),
            FilledButton(
              onPressed: busy || loading ? null : () => save('published'),
              child: Text(busy ? 'Saving…' : 'Publish & notify class'),
            ),
          ],
        ),
      ),
    );
  }
}
