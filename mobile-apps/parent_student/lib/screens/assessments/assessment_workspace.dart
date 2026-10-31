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

  @override
  Widget build(BuildContext context) {
    final items = _asRows(data?['items'])
        .where(
          (a) =>
              a['bucket'] == bucket &&
              '${a['title']} ${a['subject_name']} ${a['batch_name']}'
                  .toLowerCase()
                  .contains(query.toLowerCase()),
        )
        .toList();
    final performance = Map<String, dynamic>.from(
      data?['performance'] as Map? ?? {},
    );
    final children = _asRows(data?['students']);
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
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: [
                      Text(error!),
                      TextButton(onPressed: load, child: const Text('Retry')),
                    ],
                  ),
                ),
              ),
            if (loading) const LinearProgressIndicator(),
            if (children.length > 1)
              DropdownButtonFormField<String>(
                key: ValueKey(child),
                initialValue: child.isEmpty ? null : child,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Student'),
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
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Assessment performance',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(
                      performance['percentage'] == null
                          ? 'No graded results yet'
                          : '${performance['percentage']}%',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    Text(
                      '${performance['graded'] ?? 0} graded results · weighted by maximum marks',
                    ),
                  ],
                ),
              ),
            ),
            if (_asRows(data?['student_performance']).isNotEmpty ||
                _asRows(data?['subject_performance']).isNotEmpty)
              ExpansionTile(
                title: const Text('Student & subject performance'),
                children: [
                  for (final b in [
                    ..._asRows(data?['student_performance']),
                    ..._asRows(data?['subject_performance']),
                  ])
                    ListTile(
                      title: Text(_asText(b['name'])),
                      subtitle: Text('${b['graded']} graded results'),
                      trailing: Text(
                        b['percentage'] == null ? '—' : '${b['percentage']}%',
                      ),
                    ),
                ],
              ),
            for (final b in _asRows(data?['batch_performance']))
              ListTile(
                title: Text(_asText(b['name'])),
                trailing: Text(
                  b['percentage'] == null ? '—' : '${b['percentage']}%',
                ),
              ),
            if (_asRows(data?['subjects']).isNotEmpty)
              ExpansionTile(
                title: const Text('My semester subjects & labs'),
                children: [
                  for (final s in _asRows(data?['subjects']))
                    ListTile(
                      title: Text(_asText(s['name'])),
                      subtitle: Text(
                        'Semester ${s['semester_number']} · ${s['subject_type']}',
                      ),
                    ),
                ],
              ),
            const SizedBox(height: 16),
            TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search assessments',
              ),
              onChanged: (v) => setState(() => query = v),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final t in [
                  'upcoming',
                  'completed',
                  if (data?['can_create'] == true ||
                      _asRows(
                        data?['items'],
                      ).any((a) => a['bucket'] == 'draft'))
                    'draft',
                ])
                  ChoiceChip(
                    label: Text(
                      t == 'upcoming'
                          ? 'Current & upcoming'
                          : t == 'completed'
                          ? 'Completed'
                          : 'Drafts',
                    ),
                    selected: bucket == t,
                    onSelected: (_) => setState(() => bucket = t),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (items.isEmpty && !loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Text('No assessments in this tab.'),
              ),
            for (final item in items)
              Card(
                child: ListTile(
                  isThreeLine: true,
                  title: Text(_asText(item['title'])),
                  subtitle: Text(
                    '${item['subject_name']}\n${_asDate(item['scheduled_at'])}',
                  ),
                  trailing: const Icon(Icons.info_outline),
                  onTap: () => details(item),
                ),
              ),
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
      if (mounted && ticket == current) setState(() => options = result);
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
