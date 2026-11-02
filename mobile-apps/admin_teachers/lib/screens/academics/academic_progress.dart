part of '../../app/edunexa_client.dart';

class AcademicHub extends StatefulWidget {
  const AcademicHub({
    super.key,
    required this.api,
    required this.role,
    this.studentCode = '',
    this.onOpenFees,
  });
  final CollegeApi api;
  final MobileRole role;
  final String studentCode;
  final VoidCallback? onOpenFees;
  @override
  State<AcademicHub> createState() => _AcademicHubState();
}

class _AcademicHubState extends State<AcademicHub> {
  Json? data;
  String program = '',
      year = '',
      child = '',
      batchCode = '',
      tab = 'Overview',
      error = '';
  int semester = 0, ticket = 0;
  bool busy = false;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    child = widget.studentCode;
    load();
    timer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (!busy) load();
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> load() async {
    final sequence = ++ticket;
    setState(() => busy = true);
    try {
      final result = Map<String, dynamic>.from(
        await widget.api.academicProgress(
              program: program,
              year: year,
              student: child,
            )
            as Map,
      );
      if (mounted && sequence == ticket) {
        setState(() {
          data = result;
          error = '';
          busy = false;
        });
      }
    } catch (e) {
      if (mounted && sequence == ticket) {
        setState(() {
          error = e.toString();
          busy = false;
        });
      }
    }
  }

  Json? get batch {
    final all = _asRows(data?['batches']);
    return all.where((b) => b['code'] == batchCode).firstOrNull ??
        all.where((b) => _asRows(b['students']).isNotEmpty).firstOrNull ??
        all.firstOrNull;
  }

  int get term => semester > 0
      ? semester
      : ((batch?['timeline'] as Map?)?['current'] as int?) ??
            (_asRows(batch?['semesters']).firstOrNull?['semester_number']
                as int?) ??
            1;
  Widget select(
    String label,
    String value,
    List<Json> items,
    void Function(String) changed, {
    bool all = true,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: DropdownButtonFormField<String>(
      key: ValueKey('$label:$value:${items.map((s) => s['code']).join()}'),
      initialValue: value.isEmpty ? null : value,
      isExpanded: true,
      decoration: InputDecoration(labelText: label),
      items: [
        if (all) DropdownMenuItem(value: '', child: Text('All $label')),
        for (final item in items)
          DropdownMenuItem(
            value: _asText(item['code']),
            child: Text(_asText(item['name']), overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: busy ? null : (v) => changed(v ?? ''),
    ),
  );
  Widget metric(String label, dynamic value) => SizedBox(
    width: 155,
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.labelMedium),
            const SizedBox(height: 8),
            Text(
              _asText(value),
              style: Theme.of(context).textTheme.headlineSmall,
            ),
          ],
        ),
      ),
    ),
  );
  Future<void> results() async {
    final b = batch;
    if (b == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) =>
            SemesterResultsEditor(api: widget.api, batch: b, semester: term),
      ),
    );
    if (mounted) await load();
  }

  Future<void> calendar() async {
    final b = batch;
    if (b == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SemesterCalendarEditor(api: widget.api, batch: b),
      ),
    );
    if (mounted) await load();
  }

  Widget overview(Json? b) {
    final totals = Map<String, dynamic>.from(data?['totals'] as Map? ?? {});
    final placements = _asRows(
      b?['placements'],
    ).where((p) => p['semester_number'] == term).toList();
    final terms = _asRows(b?['semesters']);
    final summary = terms
        .where((s) => s['semester_number'] == term)
        .firstOrNull;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (data?['personal'] == true && placements.isNotEmpty) ...[
          Text(
            'Class & section',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          for (final placement in placements)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${placement['student_name']} · ${placement['section_name']}', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  Text('Semester $term · Roll ${placement['roll_number']}'),
                  Text('Admission ${placement['admission_number'] ?? ''}'),
                ]),
              ),
            ),
          const SizedBox(height: 16),
        ],
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            metric('Students', totals['students'] ?? 0),
            metric('With backlogs', totals['backlog_students'] ?? 0),
            metric(
              'All-clear semesters',
              totals['all_clear_semester_results'] ?? 0,
            ),
            metric(
              'Academic performance',
              data?['college_percentage'] == null
                  ? 'Pending'
                  : '${data!['college_percentage']}%',
            ),
          ],
        ),
        const SizedBox(height: 20),
        Text('Today’s classes', style: Theme.of(context).textTheme.titleLarge),
        const Text('India Standard Time · status refreshes every minute.'),
        for (final c in _asRows(data?['today_classes']))
          Card(
            color: c['state'] == 'ongoing' ? const Color(0xffedf5ef) : null,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _asText(c['subject_name']),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    '${c['start_time']}–${c['end_time']} · Period ${c['period']} · ${c['state']}',
                  ),
                  Text(
                    '${c['teacher_name']} · Semester ${c['semester_number']}',
                  ),
                  if (c['can_take_attendance'] == true)
                    FilledButton.icon(
                      onPressed: () async {
                        await Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => AttendanceHub(
                              api: widget.api,
                              role: widget.role,
                              initialClass: c,
                            ),
                          ),
                        );
                        if (mounted) await load();
                      },
                      icon: const Icon(Icons.fact_check_outlined),
                      label: const Text('Take attendance'),
                    ),
                ],
              ),
            ),
          ),
        if (_asRows(data?['today_classes']).isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Text('No classes scheduled today in the active semester.'),
          ),
        const SizedBox(height: 20),
        Text(
          'Course comparison',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        for (final c in _asRows(data?['course_comparison']))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${c['name']} · ${c['percentage'] == null ? 'Pending' : '${c['percentage']}%'}',
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: ((c['percentage'] as num? ?? 0) / 100).clamp(0, 1),
                  minHeight: 9,
                  borderRadius: BorderRadius.circular(8),
                ),
              ],
            ),
          ),
        const SizedBox(height: 20),
        Text(
          'Batch comparison · Semester $term',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        for (final cohort in _asRows(data?['batches']))
          Builder(
            builder: (context) {
              final score = _asRows(cohort['semesters'])
                  .where((s) => s['semester_number'] == term)
                  .firstOrNull?['percentage'];
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${cohort['course_name']} · ${cohort['name']} · ${score == null ? 'Pending' : '$score%'}',
                    ),
                    const SizedBox(height: 8),
                    LinearProgressIndicator(
                      value: ((score as num? ?? 0) / 100).clamp(0, 1),
                      minHeight: 9,
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ],
                ),
              );
            },
          ),
        if (b != null) ...[
          const SizedBox(height: 20),
          Text(
            'Semester performance',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const Text('Tap a semester to view its subjects and results.'),
          SizedBox(
            height: 150 + 50 * MediaQuery.textScalerOf(context).scale(1),
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final s in terms)
                  InkWell(
                    onTap: () =>
                        setState(() => semester = s['semester_number'] as int),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Text(
                            s['percentage'] == null
                                ? 'Pending'
                                : '${s['percentage']}%',
                          ),
                          const SizedBox(height: 8),
                          Container(
                            width: 38,
                            height: 105,
                            alignment: Alignment.bottomCenter,
                            decoration: BoxDecoration(
                              color: const Color(0xffeee7dc),
                              borderRadius: BorderRadius.circular(7),
                            ),
                            child: FractionallySizedBox(
                              heightFactor:
                                  ((s['percentage'] as num? ?? 0) / 100).clamp(
                                    0,
                                    1,
                                  ),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: Theme.of(context).colorScheme.primary,
                                  borderRadius: BorderRadius.circular(7),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text('S${s['semester_number']}'),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              metric('All clear', summary?['all_clear'] ?? 0),
              metric('With backlogs', summary?['backlog_students'] ?? 0),
              metric('Pending results', summary?['pending_students'] ?? 0),
            ],
          ),
          if (_asRows(
            (b['timeline'] as Map?)?['semesters'],
          ).any((s) => s['estimated'] == true))
            const Padding(
              padding: EdgeInsets.all(12),
              child: Text(
                'Semester dates are estimated. The college should confirm the actual calendar.',
              ),
            ),
        ],
      ],
    );
  }

  Widget subjects(Json b) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        'Semester $term subjects & labs',
        style: Theme.of(context).textTheme.titleLarge,
      ),
      for (final s in _asRows(
        b['subjects'],
      ).where((s) => s['semester_number'] == term))
        Card(
          child: ListTile(
            leading: Icon(
              s['subject_type'] == 'practical'
                  ? Icons.science_outlined
                  : Icons.menu_book_outlined,
            ),
            title: Text(_asText(s['name'])),
            subtitle: Text(
              '${s['subject_type']} · ${s['credits'] ?? 0} credits\n${_asRows(s['faculty']).map((f) => f['teacher_name']).toSet().join(', ')}',
            ),
          ),
        ),
    ],
  );
  Widget studentResults(Json b) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        'Semester $term results',
        style: Theme.of(context).textTheme.titleLarge,
      ),
      if (data?['can_grade'] == true)
        FilledButton.icon(
          onPressed: results,
          icon: const Icon(Icons.edit_note),
          label: const Text('Enter final results / reattempt'),
        ),
      for (final s in _asRows(
        b['students'],
      ).where((s) => s['semester_number'] == term))
        Card(
          child: ExpansionTile(
            title: Text(_asText(s['name'])),
            subtitle: Text(
              '${_asText(s['status']).replaceAll('_', ' ')} · ${_asRows(s['backlogs']).length} backlogs · ${s['pending_subjects']} pending',
            ),
            children: [
              for (final r in _asRows(b['results']).where(
                (r) =>
                    r['student_code'] == s['code'] &&
                    r['semester_number'] == term,
              ))
                ListTile(
                  title: Text(
                    _asText(
                      _asRows(b['subjects'])
                          .where((v) => v['subject_code'] == r['subject_code'])
                          .firstOrNull?['name'],
                    ),
                  ),
                  subtitle: Text(
                    'Attempt ${r['attempt']} · Pass marks ${r['pass_marks']}',
                  ),
                  trailing: Text(
                    r['absent'] == true
                        ? 'Absent'
                        : r['marks'] == null
                        ? 'Pending'
                        : '${r['marks']} / ${r['max_marks']}',
                  ),
                ),
              for (final backlog in _asRows(s['backlogs']))
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: Text(_asText(backlog['subject_name'])),
                  subtitle: const Text(
                    'A published passing reattempt will clear this backlog.',
                  ),
                ),
            ],
          ),
        ),
    ],
  );
  Widget fees(Json? b) {
    final rows = _asRows(data?['fees'])
        .where(
          (f) =>
              (b == null || f['academic_year_code'] == b['code']) &&
              (f['semester_number'] == null || f['semester_number'] == term),
        )
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Semester $term fees',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const Text('Annual or unallocated charges stay labelled separately.'),
        if (widget.onOpenFees != null)
          FilledButton(
            onPressed: widget.onOpenFees,
            child: const Text('Fees & payments'),
          ),
        if (rows.isEmpty)
          const Padding(
            padding: EdgeInsets.all(20),
            child: Text('No charges scheduled for this semester.'),
          ),
        for (final f in rows)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _asText(f['fee_head']),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  Text(
                    f['semester_number'] == null
                        ? 'Annual / unallocated'
                        : 'Semester ${f['semester_number']}',
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 18,
                    runSpacing: 10,
                    children: [
                      Text('Amount ₹${f['amount']}'),
                      Text('Paid ₹${f['paid']}'),
                      Text('Balance ₹${f['outstanding']}'),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Due ${f['due_date'] ?? 'Not scheduled'} · ${_asText(f['reminder_state']).replaceAll('_', ' ')}',
                  ),
                ],
              ),
            ),
          ),
        ExpansionTile(
          title: const Text('Payment history'),
          children: [
            for (final p in _asRows(data?['payments']))
              ListTile(
                title: Text('₹${p['amount']} · ${p['method']}'),
                subtitle: Text('${p['paid_on']} · ${p['status']}'),
              ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final b = batch;
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Academic progress',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        automaticallyImplyLeading: false,
        actions: [
          if (data?['can_manage_calendar'] == true && b != null)
            IconButton(
              onPressed: calendar,
              tooltip: 'Semester calendar',
              icon: const Icon(Icons.calendar_month_outlined),
            ),
          IconButton(
            onPressed: busy ? null : load,
            tooltip: 'Refresh academic progress',
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            if (busy) const LinearProgressIndicator(),
            if (error.isNotEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(error),
                      TextButton(onPressed: load, child: const Text('Retry')),
                    ],
                  ),
                ),
              ),
            if (data != null) ...[
              select('Course', program, _asRows(data!['courses']), (v) {
                setState(() {
                  program = v;
                  year = '';
                  batchCode = '';
                  semester = 0;
                });
                load();
              }),
              select(
                'Academic batch',
                year,
                _asRows(data!['academic_years'])
                    .where(
                      (y) => program.isEmpty || y['program_code'] == program,
                    )
                    .toList(),
                (v) {
                  setState(() {
                    year = v;
                    batchCode = v;
                    semester = 0;
                  });
                  load();
                },
              ),
              if (_asRows(data!['children']).length > 1)
                select('Student', child, _asRows(data!['children']), (v) {
                  setState(() {
                    child = v;
                    semester = 0;
                  });
                  load();
                }),
              if (b != null) ...[
                if (_asRows(data!['batches']).length > 1)
                  select(
                    'Batch detail',
                    _asText(b['code']),
                    _asRows(data!['batches'])
                        .map(
                          (v) => {
                            ...v,
                            'name': '${v['course_name']} · ${v['name']}',
                          },
                        )
                        .toList(),
                    (v) => setState(() {
                      batchCode = v;
                      semester = 0;
                    }),
                    all: false,
                  ),
                Text(
                  '${b['course_name']} · ${b['name']}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Text(
                  (b['timeline'] as Map?)?['current'] == null
                      ? _asText(
                          (b['timeline'] as Map?)?['state'],
                        ).replaceAll('_', ' ')
                      : 'Current semester ${(b['timeline'] as Map)['current']}',
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final s in _asRows(b['semesters']))
                      ChoiceChip(
                        label: Text('Semester ${s['semester_number']}'),
                        selected: term == s['semester_number'],
                        onSelected: (_) => setState(
                          () => semester = s['semester_number'] as int,
                        ),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final t in [
                    'Overview',
                    'Subjects',
                    'Results',
                    if (data?['personal'] == true ||
                        widget.role == MobileRole.admin)
                      'Fees',
                  ])
                    ChoiceChip(
                      label: Text(t),
                      selected: tab == t,
                      onSelected: (_) => setState(() => tab = t),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              if (tab == 'Overview') overview(b),
              if (tab == 'Subjects' && b != null) subjects(b),
              if (tab == 'Results' && b != null) studentResults(b),
              if (tab == 'Fees') fees(b),
              if (b == null)
                const Text('No eligible academic batch is linked yet.'),
              const SizedBox(height: 20),
              Text(
                'Updated ${_asDate(data!['generated_at'])}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class SemesterResultsEditor extends StatefulWidget {
  const SemesterResultsEditor({
    super.key,
    required this.api,
    required this.batch,
    required this.semester,
  });
  final CollegeApi api;
  final Json batch;
  final int semester;
  @override
  State<SemesterResultsEditor> createState() => _SemesterResultsEditorState();
}

class _SemesterResultsEditorState extends State<SemesterResultsEditor> {
  final form = GlobalKey<FormState>();
  final max = TextEditingController(text: '100'),
      pass = TextEditingController(text: '40');
  final Map<String, TextEditingController> marks = {};
  final Map<String, bool> absent = {};
  String subject = '', error = '';
  int attempt = 1;
  DateTime? assessed;
  bool saving = false, publish = true;
  List<Json> get students => _asRows(widget.batch['students'])
      .where(
        (s) =>
            s['semester_number'] == widget.semester &&
            (subject.isEmpty ||
                _asRows(widget.batch['subjects'])
                        .where((v) => v['subject_code'] == subject)
                        .firstOrNull?['eligible_student_codes'] ==
                    null ||
                (_asRows(widget.batch['subjects'])
                            .where((v) => v['subject_code'] == subject)
                            .firstOrNull!['eligible_student_codes']
                        as List)
                    .contains(s['code'])),
      )
      .toList();
  @override
  void initState() {
    super.initState();
    for (final s in students) {
      marks[_asText(s['code'])] = TextEditingController();
    }
  }

  @override
  void dispose() {
    max.dispose();
    pass.dispose();
    for (final c in marks.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    if (assessed == null) {
      setState(() => error = 'Choose the assessment date.');
      return;
    }
    setState(() => saving = true);
    try {
      final rows = <Json>[];
      for (final s in students) {
        final code = _asText(s['code']), value = marks[code]!.text.trim();
        if (value.isNotEmpty || absent[code] == true) {
          rows.add({
            'student_code': code,
            'marks': absent[code] == true ? null : value,
            'absent': absent[code] == true,
          });
        }
      }
      final previous = _asRows(widget.batch['result_groups'])
          .where(
            (g) =>
                g['semester_number'] == widget.semester &&
                g['subject_code'] == subject &&
                g['attempt'] == attempt,
          )
          .firstOrNull;
      await widget.api.saveSemesterResults({
        'program_code': widget.batch['program_code'],
        'academic_year_code': widget.batch['code'],
        'semester_number': widget.semester,
        'subject_code': subject,
        'attempt': attempt,
        'revision': previous?['revision'] ?? 0,
        'max_marks': max.text,
        'pass_marks': pass.text,
        'assessed_on': _attDate(assessed!),
        'published': publish,
        'students': rows,
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('Semester ${widget.semester} final results')),
    body: Form(
      key: form,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Final results drive backlog and all-clear status. Choose a new attempt for supplementary results.',
          ),
          DropdownButtonFormField<String>(
            initialValue: null,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Subject *'),
            items: _asRows(widget.batch['subjects'])
                .where((s) => s['semester_number'] == widget.semester)
                .map(
                  (s) => DropdownMenuItem(
                    value: _asText(s['subject_code']),
                    child: Text(
                      _asText(s['name']),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            onChanged: (v) => setState(() => subject = v ?? ''),
            validator: (v) => v == null ? 'Select subject' : null,
          ),
          TextFormField(
            initialValue: '1',
            decoration: const InputDecoration(labelText: 'Attempt'),
            keyboardType: TextInputType.number,
            onChanged: (v) => attempt = int.tryParse(v) ?? 1,
            validator: (v) {
              final n = int.tryParse(v ?? '');
              return n == null || n < 1 || n > 20
                  ? 'Choose attempt 1–20'
                  : null;
            },
          ),
          TextFormField(
            controller: max,
            decoration: const InputDecoration(labelText: 'Maximum marks'),
            keyboardType: TextInputType.number,
            validator: (v) => (double.tryParse(v ?? '') ?? 0) <= 0
                ? 'Enter maximum marks'
                : null,
          ),
          TextFormField(
            controller: pass,
            decoration: const InputDecoration(labelText: 'Pass marks'),
            keyboardType: TextInputType.number,
            validator: (v) =>
                double.tryParse(v ?? '') == null ? 'Enter passing marks' : null,
          ),
          OutlinedButton(
            onPressed: saving
                ? null
                : () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: assessed ?? DateTime.now(),
                      firstDate: DateTime(2000),
                      lastDate: DateTime.now(),
                    );
                    if (date != null && mounted) {
                      setState(() => assessed = date);
                    }
                  },
            child: Text(
              assessed == null ? 'Assessment date *' : _attDate(assessed!),
            ),
          ),
          for (final s in students)
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
                    TextFormField(
                      controller: marks[_asText(s['code'])],
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Final marks',
                      ),
                      enabled: !saving && absent[_asText(s['code'])] != true,
                    ),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Absent'),
                      value: absent[_asText(s['code'])] == true,
                      onChanged: saving
                          ? null
                          : (v) => setState(
                              () => absent[_asText(s['code'])] = v == true,
                            ),
                    ),
                  ],
                ),
              ),
            ),
          CheckboxListTile(
            title: const Text('Publish to students and parents'),
            value: publish,
            onChanged: saving
                ? null
                : (v) => setState(() => publish = v == true),
          ),
          if (error.isNotEmpty)
            Text(
              error,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          FilledButton(
            onPressed: saving ? null : save,
            child: Text(saving ? 'Saving…' : 'Save semester results'),
          ),
        ],
      ),
    ),
  );
}

class SemesterCalendarEditor extends StatefulWidget {
  const SemesterCalendarEditor({
    super.key,
    required this.api,
    required this.batch,
  });
  final CollegeApi api;
  final Json batch;
  @override
  State<SemesterCalendarEditor> createState() => _SemesterCalendarEditorState();
}

class _SemesterCalendarEditorState extends State<SemesterCalendarEditor> {
  late List<Json> terms;
  bool saving = false;
  String error = '';
  @override
  void initState() {
    super.initState();
    terms = _asRows(
      (widget.batch['timeline'] as Map?)?['semesters'],
    ).map((s) => Map<String, dynamic>.from(s)).toList();
  }

  Future<void> pick(int i, String key) async {
    final current = DateTime.parse(_asText(terms[i][key]));
    final chosen = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (chosen != null && mounted) {
      setState(() => terms[i][key] = _attDate(chosen));
    }
  }

  Future<void> save() async {
    setState(() => saving = true);
    try {
      await widget.api.saveSemesterCalendar({
        'program_code': widget.batch['program_code'],
        'academic_year_code': widget.batch['code'],
        'revision': widget.batch['calendar_revision'],
        'semesters': terms
            .map(
              (s) => {
                'semester_number': s['semester_number'],
                'start_date': s['start_date'],
                'end_date': s['end_date'],
              },
            )
            .toList(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Semester calendar')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Dates determine the ongoing semester. Gaps are treated as semester breaks.',
        ),
        for (int i = 0; i < terms.length; i++)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Semester ${terms[i]['semester_number']}',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  TextButton(
                    onPressed: saving ? null : () => pick(i, 'start_date'),
                    child: Text('Start: ${terms[i]['start_date']}'),
                  ),
                  TextButton(
                    onPressed: saving ? null : () => pick(i, 'end_date'),
                    child: Text('End: ${terms[i]['end_date']}'),
                  ),
                ],
              ),
            ),
          ),
        if (error.isNotEmpty) Text(error),
        FilledButton(
          onPressed: saving ? null : save,
          child: Text(saving ? 'Saving…' : 'Save semester calendar'),
        ),
      ],
    ),
  );
}

class AcademicOverview extends StatefulWidget {
  const AcademicOverview({
    super.key,
    required this.api,
    this.studentCode = '',
    required this.onOpen,
  });
  final CollegeApi api;
  final String studentCode;
  final VoidCallback onOpen;
  @override
  State<AcademicOverview> createState() => _AcademicOverviewState();
}

class _AcademicOverviewState extends State<AcademicOverview> {
  Json? data;
  String error = '';
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final value = Map<String, dynamic>.from(
        await widget.api.academicProgress(student: widget.studentCode) as Map,
      );
      if (mounted) setState(() => data = value);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final totals = data?['totals'] as Map?;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Academic progress',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            if (data == null && error.isEmpty) const LinearProgressIndicator(),
            if (error.isNotEmpty)
              TextButton(
                onPressed: load,
                child: const Text('Retry academic progress'),
              ),
            if (data != null) ...[
              for (final b in _asRows(
                data!['batches'],
              ).where((b) => _asRows(b['students']).isNotEmpty).take(3))
                Text(
                  '${b['course_name']} · ${(b['timeline'] as Map?)?['current'] == null ? _asText((b['timeline'] as Map?)?['state']) : 'Semester ${(b['timeline'] as Map)['current']}'}',
                ),
              if (data?['personal'] == true)
                for (final cohort in _asRows(data!['batches']))
                  for (final placement in _asRows(cohort['placements']).where(
                    (p) =>
                        p['semester_number'] ==
                        (cohort['timeline'] as Map?)?['current'],
                  ))
                    Text(
                      '${placement['student_name']} · ${placement['section_name']} · Roll ${placement['roll_number']}',
                    ),
              const SizedBox(height: 8),
              Text(
                '${totals?['backlog_students'] ?? 0} students with backlogs · ${totals?['all_clear_semester_results'] ?? 0} all-clear semester records',
              ),
              TextButton.icon(
                onPressed: widget.onOpen,
                icon: const Icon(Icons.school_outlined),
                label: const Text('Open academic dashboard'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
