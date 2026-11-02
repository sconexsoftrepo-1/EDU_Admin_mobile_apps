part of '../../app/edunexa_client.dart';

class AssignmentHub extends StatefulWidget {
  const AssignmentHub({
    super.key,
    required this.api,
    required this.role,
    this.title = "Assignments",
  });
  final CollegeApi api;
  final MobileRole role;
  final String title;
  @override
  State<AssignmentHub> createState() => _AssignmentHubState();
}

class _AssignmentHubState extends State<AssignmentHub> {
  Json? data;
  String bucket = 'all', query = '', child = '';
  bool busy = false, mine = false;
  String? error;
  final search = TextEditingController();
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = Map<String, dynamic>.from(
        await widget.api.assignments(studentCode: child) as Map,
      );
      if (!mounted) return;
      final children = _asRows(result['students']);
      setState(() {
        data = result;
        busy = false;
      });
      if (widget.role == MobileRole.parent &&
          child.isEmpty &&
          children.length > 1) {
        child = _asText(children.first['code']);
        await load();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final all = _asRows(data?['items']);
    final items = all
        .where(
          (a) =>
              (bucket == 'all' || a['bucket'] == bucket) &&
              (!mine || a['created_by'] == data?['account_code']) &&
              '${a['title']} ${a['course_name']} ${a['batch_name']}'
                  .toLowerCase()
                  .contains(query.toLowerCase()),
        )
        .toList();
    final students = _asRows(data?['students']);
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            onPressed: busy ? null : load,
            tooltip: 'Refresh assignments',
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      floatingActionButton:
          (data?['can_create'] == true ||
              data == null &&
                  (widget.role == MobileRole.admin ||
                      widget.role == MobileRole.teacher))
          ? FloatingActionButton.extended(
              onPressed: () async {
                final saved = await Navigator.of(context).push<bool>(
                  MaterialPageRoute(
                    builder: (_) => AssignmentComposer(api: widget.api),
                  ),
                );
                if (saved == true && mounted) await load();
              },
              icon: const Icon(Icons.add),
              label: const Text('Add assignment'),
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
            if (busy) const LinearProgressIndicator(),
            if (students.length > 1)
              DropdownButtonFormField<String>(
                key: ValueKey(child),
                initialValue: child.isEmpty ? null : child,
                decoration: const InputDecoration(labelText: 'Student'),
                items: students
                    .map(
                      (s) => DropdownMenuItem(
                        value: _asText(s['code']),
                        child: Text(_asText(s['name'])),
                      ),
                    )
                    .toList(),
                onChanged: (value) {
                  child = value ?? '';
                  load();
                },
              ),
            if (data?['can_review'] == true)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Wrap(
                  spacing: 18,
                  runSpacing: 8,
                  children: [
                    Text(
                      '${all.length} assignments',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(
                      '${all.fold<int>(0, (sum, a) => sum + ((a['counts']?['submitted'] as num?)?.toInt() ?? 0))} uploads received',
                    ),
                    Text(
                      '${all.fold<int>(0, (sum, a) => sum + ((a['counts']?['reviewed'] as num?)?.toInt() ?? 0))} reviewed',
                    ),
                  ],
                ),
              ),
            TextField(
              controller: search,
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                labelText: 'Search assignments',
              ),
              onChanged: (value) => setState(() => query = value),
            ),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: ['all', 'today', 'upcoming', 'overdue', 'completed']
                    .map(
                      (key) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          selected: bucket == key,
                          label: Text(
                            '${key[0].toUpperCase()}${key.substring(1)} (${all.where((a) => key == 'all' || a['bucket'] == key).length})',
                          ),
                          onSelected: (_) => setState(() => bucket = key),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
            if (data?['can_review'] == true)
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Created by me'),
                value: mine,
                onChanged: (value) => setState(() => mine = value ?? false),
              ),
            if (items.isEmpty && !busy)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Text(
                  'No assignments in this view. Choose another tab or check back later.',
                  textAlign: TextAlign.center,
                ),
              ),
            ...items.map(
              (a) => Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () async {
                    await Navigator.of(context).push<void>(
                      MaterialPageRoute(
                        builder: (_) => AssignmentReview(
                          api: widget.api,
                          code: _asText(a['code']),
                          student: child,
                        ),
                      ),
                    );
                    if (mounted) await load();
                  },
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _asText(a['bucket']).toUpperCase(),
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _asText(a['title']),
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 6),
                        Text('${a['course_name']} · ${a['batch_name']}'),
                        Text(
                          'Due ${_asDate(a['due_at'])} · ${a['max_marks']} marks',
                        ),
                        if (a['counts'] is Map) ...[
                          const SizedBox(height: 12),
                          LinearProgressIndicator(
                            value:
                                ((a['counts']['reviewed'] as num?)
                                        ?.toDouble() ??
                                    0) /
                                (((a['counts']['assigned'] as num?)
                                            ?.toDouble() ??
                                        0)
                                    .clamp(1, double.infinity)),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '${a['counts']['submitted']} submitted · ${a['counts']['pending']} awaiting upload · ${a['counts']['reviewed']} reviewed',
                          ),
                        ] else ...[
                          const SizedBox(height: 10),
                          Text(
                            a['my_submission']?['completed'] == true
                                ? 'Reviewed · ${a['my_submission']['marks'] ?? 'Complete'} / ${a['max_marks']}'
                                : a['my_submission']?['submitted_at'] != null
                                ? 'Submitted · awaiting review'
                                : 'Awaiting your submission',
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AssignmentComposer extends StatefulWidget {
  const AssignmentComposer({super.key, required this.api});
  final CollegeApi api;
  @override
  State<AssignmentComposer> createState() => _AssignmentComposerState();
}

class _AssignmentComposerState extends State<AssignmentComposer> {
  final form = GlobalKey<FormState>();
  final title = TextEditingController(),
      description = TextEditingController(),
      marks = TextEditingController(text: '100');
  Json? options;
  String level = 'intermediate',
      course = '',
      year = '',
      section = '',
      teacher = '',
      subject = '',
      progress = '';
  Set<String> recipients = {};
  DateTime? due;
  bool loading = true, saving = false, late = true;
  List<XFile> files = [];
  final uploaded = <XFile, Json>{};
  int ticket = 0;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    title.dispose();
    description.dispose();
    marks.dispose();
    super.dispose();
  }

  Future<void> load() async {
    final current = ++ticket;
    setState(() => loading = true);
    try {
      final value = Map<String, dynamic>.from(
        await widget.api.assignmentOptions(
              programCode: course,
              academicYearCode: year,
              sectionCode: section,
            )
            as Map,
      );
      if (!mounted || current != ticket) return;
      setState(() {
        options = value;
        subject = _asText(
          _asRows(value['subjects'])
              .where((s) => s['semester_number'] == value['current_semester'])
              .firstOrNull?['subject_code'],
        );
        recipients = _asRows(
          value['students'],
        ).map((s) => _asText(s['code'])).toSet();
        loading = false;
        if (value['teacher_locked'] == true) {
          teacher = _asRows(value['teachers']).firstOrNull?['code'] ?? '';
        }
      });
    } catch (e) {
      if (mounted && current == ticket) {
        setState(() => loading = false);
        _asError(context, e);
      }
    }
  }

  Widget select(
    String label,
    String value,
    List<Json> items,
    void Function(String) change, {
    bool enabled = true,
    bool required = true,
    String? empty,
  }) => DropdownButtonFormField<String>(
    key: ValueKey('$label:$value:${items.map((v) => v['code']).join(',')}'),
    initialValue: value.isEmpty && required ? null : value,
    isExpanded: true,
    decoration: InputDecoration(labelText: label),
    items: [
      if (!required)
        DropdownMenuItem(value: '', child: Text(empty ?? 'All sections')),
      ...items.map(
        (s) => DropdownMenuItem(
          value: _asText(s['code']),
          child: Text(
            _asText(s['name']),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
    ],
    validator: (v) => required && (v == null || v.isEmpty)
        ? 'Select ${label.toLowerCase()}'
        : null,
    onChanged: enabled && !saving ? (v) => change(v ?? '') : null,
  );
  Future<void> chooseDue() async {
    final day = await showDatePicker(
      context: context,
      initialDate: due ?? DateTime.now().add(const Duration(days: 1)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
    );
    if (day == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: due == null
          ? const TimeOfDay(hour: 17, minute: 0)
          : TimeOfDay.fromDateTime(due!),
    );
    if (time != null && mounted) {
      setState(
        () => due = DateTime(
          day.year,
          day.month,
          day.day,
          time.hour,
          time.minute,
        ),
      );
    }
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    if (due == null || !due!.isAfter(DateTime.now())) {
      _asError(context, 'Choose a future due date and time.');
      return;
    }
    if (recipients.isEmpty) {
      _asError(context, 'Select at least one eligible student.');
      return;
    }
    setState(() => saving = true);
    try {
      for (final file in files) {
        setState(() => progress = 'Uploading ${file.name}…');
        uploaded[file] ??= await _asUpload(widget.api, file);
      }
      setState(
        () => progress =
            'Creating assignment and notifying students and parents…',
      );
      await widget.api.createAssignment({
        'course_level': level,
        'program_code': course,
        'academic_year_code': year,
        'section_code': section.isEmpty ? null : section,
        'teacher_code': teacher,
        'subject_code': subject.isEmpty ? null : subject,
        'semester_number': _asRows(options?['subjects'])
            .where((s) => s['subject_code'] == subject)
            .firstOrNull?['semester_number'],
        'title': title.text.trim(),
        'description': description.text,
        'due_at': due!.toUtc().toIso8601String(),
        'max_marks': marks.text,
        'recipient_student_codes': recipients.toList(),
        'attachments': files.map((f) => uploaded[f]!['code']).toList(),
        'allow_late': late,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) _asError(context, e);
    } finally {
      if (mounted) {
        setState(() {
          saving = false;
          progress = '';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final students = _asRows(options?['students']);
    return Scaffold(
      appBar: AppBar(title: const Text('Add assignment')),
      body: Form(
        key: form,
        child: AbsorbPointer(
          absorbing: saving,
          child: ListView(
            padding: const EdgeInsets.all(18),
            children: [
              const Text(
                'Choose the academic batch, select the students, then set their work.',
              ),
              const SizedBox(height: 18),
              select(
                'Inter or Degree',
                level,
                [
                  {'code': 'intermediate', 'name': 'Intermediate'},
                  {'code': 'degree', 'name': 'Degree'},
                ],
                (v) {
                  setState(() {
                    level = v;
                    course = '';
                    year = '';
                    section = '';
                    recipients = {};
                  });
                  load();
                },
              ),
              const SizedBox(height: 14),
              select(
                'Course',
                course,
                _asRows(
                  options?['courses'],
                ).where((p) => p['course_level'] == level).toList(),
                (v) {
                  setState(() {
                    course = v;
                    year = '';
                    section = '';
                    recipients = {};
                  });
                  load();
                },
              ),
              const SizedBox(height: 14),
              select(
                'Academic batch',
                year,
                _asRows(
                  options?['academic_years'],
                ).where((p) => p['program_code'] == course).toList(),
                (v) {
                  setState(() {
                    year = v;
                    section = '';
                    recipients = {};
                  });
                  load();
                },
                enabled: course.isNotEmpty,
              ),
              const SizedBox(height: 14),
              select(
                'Section',
                section,
                _asRows(options?['sections']),
                (v) {
                  setState(() {
                    section = v;
                    recipients = {};
                  });
                  load();
                },
                required: false,
                enabled: year.isNotEmpty && !loading,
              ),
              const SizedBox(height: 14),
              if (_asRows(options?['subjects']).isNotEmpty)
                select(
                  'Subject / semester',
                  _asRows(
                        options?['subjects'],
                      ).any((s) => s['subject_code'] == subject)
                      ? subject
                      : '',
                  _asRows(options?['subjects'])
                      .map(
                        (s) => {
                          ...s,
                          'code': s['subject_code'],
                          'name':
                              'Semester ${s['semester_number']} · ${s['name']}',
                        },
                      )
                      .toList(),
                  (v) => setState(() => subject = v),
                ),
              if (options?['teacher_locked'] == true)
                InputDecorator(
                  decoration: const InputDecoration(labelText: 'Teacher'),
                  child: Text(
                    _asText(_asRows(options?['teachers']).firstOrNull?['name']),
                  ),
                )
              else
                select(
                  'Teacher',
                  teacher,
                  _asRows(options?['teachers']),
                  (v) => setState(() => teacher = v),
                ),
              if (loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: LinearProgressIndicator(),
                ),
              if (year.isNotEmpty) ...[
                const SizedBox(height: 20),
                Text(
                  'Students · ${recipients.length} / ${students.length} selected',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Select all students'),
                  value:
                      students.isNotEmpty &&
                      recipients.length == students.length,
                  onChanged: (v) => setState(
                    () => recipients = v == true
                        ? students.map((s) => _asText(s['code'])).toSet()
                        : {},
                  ),
                ),
                if (students.isEmpty && !loading)
                  const Text('No active students in this batch or section.'),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 260),
                  child: SingleChildScrollView(
                    child: Column(
                      children: students
                          .map(
                            (s) => CheckboxListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(_asText(s['name'])),
                              subtitle: Text(_asText(s['admission_number'])),
                              value: recipients.contains(s['code']),
                              onChanged: (v) => setState(() {
                                if (v == true) {
                                  recipients.add(_asText(s['code']));
                                } else {
                                  recipients.remove(s['code']);
                                }
                              }),
                            ),
                          )
                          .toList(),
                    ),
                  ),
                ),
                const Text(
                  'Only selected students and their linked parents receive this assignment.',
                ),
              ],
              const SizedBox(height: 24),
              TextFormField(
                controller: title,
                decoration: const InputDecoration(
                  labelText: 'Assignment name *',
                ),
                maxLength: 200,
                validator: (v) => v == null || v.trim().isEmpty
                    ? 'Enter an assignment name'
                    : null,
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: description,
                decoration: const InputDecoration(
                  labelText: 'Description / instructions',
                ),
                minLines: 3,
                maxLines: 6,
                maxLength: 10000,
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: chooseDue,
                icon: const Icon(Icons.event),
                label: Text(
                  due == null
                      ? 'Choose due date and time *'
                      : _asDate(due!.toIso8601String()),
                ),
              ),
              const SizedBox(height: 14),
              TextFormField(
                controller: marks,
                decoration: const InputDecoration(labelText: 'Maximum marks *'),
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                validator: (v) {
                  final n = double.tryParse(v ?? '');
                  return n == null || !n.isFinite || n <= 0 || n > 10000
                      ? 'Enter marks between 0.01 and 10000'
                      : null;
                },
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Accept late submissions'),
                subtitle: const Text('Late work is clearly labelled.'),
                value: late,
                onChanged: (v) => setState(() => late = v),
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.attach_file),
                label: const Text('Attach PDF or images'),
                onPressed: () async {
                  try {
                    final picked = await _asPickFiles();
                    if (mounted && picked.isNotEmpty) {
                      setState(() => files = picked);
                    }
                  } catch (e) {
                    if (context.mounted) _asError(context, e);
                  }
                },
              ),
              const Text('Up to 10 files, 10 MB each. Files remain private.'),
              ...files.map(
                (file) => ListTile(
                  dense: true,
                  leading: const Icon(Icons.description_outlined),
                  title: Text(file.name),
                  trailing: IconButton(
                    tooltip: 'Remove file',
                    icon: const Icon(Icons.close),
                    onPressed: () => setState(() => files.remove(file)),
                  ),
                ),
              ),
              if (progress.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(progress),
                ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: saving || loading || options?['can_create'] != true
                    ? null
                    : save,
                child: Text(saving ? 'Saving…' : 'Create assignment'),
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}

class AssignmentReview extends StatefulWidget {
  const AssignmentReview({
    super.key,
    required this.api,
    required this.code,
    this.student = '',
  });
  final CollegeApi api;
  final String code, student;
  @override
  State<AssignmentReview> createState() => _AssignmentReviewState();
}

class _AssignmentReviewState extends State<AssignmentReview> {
  final form = GlobalKey<FormState>();
  Json? data;
  String filter = 'All', progress = '';
  String? error;
  bool busy = false, saving = false;
  List<XFile> files = [];
  final edits = <String, Json>{}, uploaded = <XFile, Json>{};
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => busy = true);
    try {
      final value = Map<String, dynamic>.from(
        await widget.api.assignmentDetails(
              widget.code,
              studentCode: widget.student,
            )
            as Map,
      );
      if (mounted) {
        setState(() {
          data = value;
          busy = false;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          busy = false;
        });
      }
    }
  }

  Json draft(Json student) =>
      edits[_asText(student['code'])] ??
      {
        'student_code': student['code'],
        'completed': student['submission']?['completed'] == true,
        'marks': student['submission']?['marks'],
        'feedback': student['submission']?['feedback'] ?? '',
        'revision': student['submission']?['revision'] ?? 0,
      };
  Future<void> saveReview() async {
    if (!form.currentState!.validate()) return;
    setState(() => saving = true);
    try {
      await widget.api.reviewAssignment(widget.code, {
        'students': edits.values.toList(),
      });
      edits.clear();
      await load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Review saved. Marks and feedback are visible to the student.',
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) _asError(context, e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> submit() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Review your submission'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Assignment: ${_asText(data?['title'])}'),
              Text('Due: ${_asDate(data?['due_at'])}'),
              const SizedBox(height: 12),
              const Text('Files to post'),
              ...files.map(
                (file) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.description_outlined),
                  title: Text(
                    file.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
              const Text(
                'After posting, your teacher can review these files and add marks and feedback.',
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Go back'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Post submission'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => saving = true);
    try {
      for (final file in files) {
        setState(() => progress = 'Uploading ${file.name}…');
        uploaded[file] ??= await _asUpload(
          widget.api,
          file,
          assignment: widget.code,
        );
      }
      await widget.api.submitAssignment(widget.code, {
        'attachments': files.map((f) => uploaded[f]!['code']).toList(),
        'revision': data?['my_submission']?['revision'] ?? 0,
      });
      files = [];
      await load();
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Assignment submitted.')));
      }
    } catch (e) {
      if (mounted) _asError(context, e);
    } finally {
      if (mounted) {
        setState(() {
          saving = false;
          progress = '';
        });
      }
    }
  }

  Widget _pill(BuildContext context, String label, Color tint, IconData icon) =>
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: tint,
          borderRadius: BorderRadius.circular(99),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: EduTints.ink(tint)),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: EduTints.ink(tint),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      );

  Widget _panel({required Widget child, Color color = collegeIvory}) =>
      Container(
        width: double.infinity,
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: EduWorkspace.border),
        ),
        child: child,
      );

  Widget _heading(BuildContext context, String title, IconData icon) => Row(
    children: [
      Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
      const SizedBox(width: 8),
      Expanded(
        child: Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        ),
      ),
    ],
  );

  /// Status of the signed-in student's work, used for the header pill.
  ({String label, Color tint, IconData icon}) _myStatus(Json a, dynamic sub) {
    final due = DateTime.tryParse(_asText(a['due_at']))?.toLocal();
    if (sub?['completed'] == true) {
      return (
        label: sub?['marks'] == null ? 'Reviewed' : 'Marks given',
        tint: EduTints.sage,
        icon: Icons.verified_outlined,
      );
    }
    if (sub?['submitted_at'] != null) {
      return (
        label: sub?['late'] == true ? 'Submitted late' : 'Submitted',
        tint: EduTints.mist,
        icon: Icons.upload_file_outlined,
      );
    }
    if (due != null && due.isBefore(DateTime.now())) {
      return (
        label: 'Past due',
        tint: EduTints.clay,
        icon: Icons.error_outline,
      );
    }
    return (
      label: 'To do',
      tint: EduTints.gold,
      icon: Icons.pending_actions_outlined,
    );
  }

  @override
  Widget build(BuildContext context) {
    final a = data, submission = a?['my_submission'];
    final text = Theme.of(context).textTheme;
    final students = _asRows(a?['students']).where((s) {
      final v = s['submission'];
      return filter == 'All' ||
          filter == 'Submitted' && v?['submitted_at'] != null ||
          filter == 'Awaiting upload' && v?['submitted_at'] == null ||
          filter == 'Completed' && v?['completed'] == true ||
          filter == 'Not completed' && v?['completed'] != true;
    }).toList();
    return PopScope(
      canPop: !saving,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            _asText(a?['title']).isEmpty ? 'Assignment' : _asText(a?['title']),
          ),
          actions: [
            IconButton(
              onPressed: busy || saving ? null : load,
              icon: const Icon(Icons.refresh),
              tooltip: 'Refresh assignment',
            ),
          ],
        ),
        body: Form(
          key: form,
          child: ListView(
            padding: const EdgeInsets.all(18),
            children: [
              if (busy && a == null) ...[
                const EduCardSkeleton(height: 170),
                const SizedBox(height: 14),
                const EduCardSkeleton(height: 120),
              ] else if (busy)
                const LinearProgressIndicator(minHeight: 3),
              if (error != null)
                WorkspaceMessage(
                  icon: Icons.cloud_off_outlined,
                  title: 'Could not load this assignment',
                  message: error!,
                  onRetry: load,
                ),
              if (a != null) ...[
                // Summary: subject/class, due date, marks and the current status.
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xffeef3ea), Color(0xffe6eef1)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: EduWorkspace.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _asText(a['title']),
                        style: text.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${a['course_name']} · ${a['batch_name']}',
                        style: text.bodyMedium,
                      ),
                      const SizedBox(height: 10),
                      if (a['can_review'] != true)
                        Builder(
                          builder: (context) {
                            final st = _myStatus(a, submission);
                            return _pill(context, st.label, st.tint, st.icon);
                          },
                        ),
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: .8),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Wrap(
                          spacing: 18,
                          runSpacing: 10,
                          children: [
                            for (final (icon, label, value) in [
                              (
                                Icons.event_outlined,
                                'Due',
                                _asDate(a['due_at']),
                              ),
                              (
                                Icons.grade_outlined,
                                'Maximum marks',
                                _asText(a['max_marks']),
                              ),
                              if (_asText(a['teacher_name']).isNotEmpty)
                                (
                                  Icons.person_outline,
                                  'Teacher',
                                  _asText(a['teacher_name']),
                                ),
                            ])
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(icon, size: 18, color: collegeMuted),
                                  const SizedBox(width: 6),
                                  Flexible(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(label, style: text.labelSmall),
                                        Text(
                                          value,
                                          style: text.titleSmall?.copyWith(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ],
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
                _panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _heading(context, 'Instructions', Icons.subject_rounded),
                      const SizedBox(height: 8),
                      SelectableText(
                        _asText(a['description']),
                        style: text.bodyMedium?.copyWith(height: 1.5),
                      ),
                      if (_asRows(a['attachments']).isNotEmpty) ...[
                        const SizedBox(height: 10),
                        _asAttachments(context, widget.api, a['attachments']),
                      ],
                    ],
                  ),
                ),
                if (a['can_review'] == true) ...[
                  const SizedBox(height: 22),
                  _heading(
                    context,
                    'Student review',
                    Icons.rate_review_outlined,
                  ),
                  const Text(
                    'Check completed work, including paper submissions, and allocate marks.',
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: filter,
                    decoration: const InputDecoration(
                      labelText: 'Review status',
                    ),
                    items:
                        [
                              'All',
                              'Submitted',
                              'Awaiting upload',
                              'Completed',
                              'Not completed',
                            ]
                            .map(
                              (v) => DropdownMenuItem(value: v, child: Text(v)),
                            )
                            .toList(),
                    onChanged: (v) => setState(() => filter = v ?? 'All'),
                  ),
                  ...students.map((student) {
                    final value = draft(student),
                        code = _asText(student['code']),
                        s = student['submission'];
                    return Container(
                      margin: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        color: collegeIvory,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: EduWorkspace.border),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _asText(student['name']),
                              style: text.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              _asText(student['admission_number']),
                              style: text.bodySmall,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              s?['submitted_at'] == null
                                  ? 'Not uploaded'
                                  : 'Submitted ${_asDate(s['submitted_at'])}${s['late'] == true ? ' · Late' : ''}',
                              style: text.labelMedium?.copyWith(
                                color: s?['submitted_at'] == null
                                    ? collegeMuted
                                    : s['late'] == true
                                    ? EduTints.ink(EduTints.clay)
                                    : EduTints.ink(EduTints.sage),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            _asAttachments(
                              context,
                              widget.api,
                              s?['attachments'],
                            ),
                            // Own Material so the tile's ink is not hidden by the card colour.
                            Material(
                              type: MaterialType.transparency,
                              child: CheckboxListTile(
                                contentPadding: EdgeInsets.zero,
                                title: const Text('Completed'),
                                value: value['completed'] == true,
                                onChanged: saving || a['can_grade'] != true
                                    ? null
                                    : (v) => setState(
                                        () => edits[code] = {
                                          ...value,
                                          'completed': v ?? false,
                                          'marks': v == true
                                              ? value['marks']
                                              : null,
                                        },
                                      ),
                              ),
                            ),
                            TextFormField(
                              key: ValueKey(
                                'marks:$code:${value['completed']}',
                              ),
                              initialValue: _asText(value['marks']),
                              enabled:
                                  !saving &&
                                  a['can_grade'] == true &&
                                  value['completed'] == true,
                              decoration: InputDecoration(
                                labelText: 'Marks / ${a['max_marks']}',
                              ),
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                    decimal: true,
                                  ),
                              validator: (v) {
                                if (v == null || v.isEmpty) return null;
                                final n = double.tryParse(v);
                                return n == null ||
                                        !n.isFinite ||
                                        n < 0 ||
                                        n >
                                            double.parse(
                                              _asText(a['max_marks']),
                                            )
                                    ? 'Enter marks within the maximum'
                                    : null;
                              },
                              onChanged: (v) => edits[code] = {
                                ...draft(student),
                                'marks': v.isEmpty ? null : v,
                              },
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              key: ValueKey('feedback:$code'),
                              initialValue: _asText(value['feedback']),
                              enabled: !saving && a['can_grade'] == true,
                              decoration: const InputDecoration(
                                labelText: 'Feedback',
                              ),
                              minLines: 1,
                              maxLines: 4,
                              maxLength: 2000,
                              onChanged: (v) => edits[code] = {
                                ...draft(student),
                                'feedback': v,
                              },
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                  if (a['can_grade'] == true)
                    FilledButton.icon(
                      onPressed: saving
                          ? null
                          : () {
                              if (edits.isNotEmpty) saveReview();
                            },
                      icon: const Icon(Icons.done_all),
                      label: Text(saving ? 'Saving…' : 'Save review and marks'),
                    ),
                ] else ...[
                  if (submission?['completed'] == true)
                    _panel(
                      color: const Color(0xfff1f6ee),
                      child: Row(
                        children: [
                          EduRing(
                            value: () {
                              final m = num.tryParse(
                                _asText(submission?['marks']),
                              );
                              final max = num.tryParse(_asText(a['max_marks']));
                              return m == null || max == null || max == 0
                                  ? 1.0
                                  : (m / max).toDouble();
                            }(),
                            size: 76,
                            color: collegePine,
                            center: const Icon(
                              Icons.emoji_events_outlined,
                              color: collegePine,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Result', style: text.labelLarge),
                                Text(
                                  submission?['marks'] == null
                                      ? 'Completed'
                                      : '${submission['marks']} / ${a['max_marks']}',
                                  style: text.headlineSmall?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                if (_asText(
                                  submission?['feedback'],
                                ).isNotEmpty) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    '“${_asText(submission?['feedback'])}”',
                                    style: text.bodyMedium?.copyWith(
                                      fontStyle: FontStyle.italic,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  _panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _heading(
                          context,
                          'Your submission',
                          Icons.assignment_turned_in_outlined,
                        ),
                        const SizedBox(height: 8),
                        if (submission?['submitted_at'] != null)
                          Text(
                            'Submitted ${_asDate(submission['submitted_at'])}${submission['late'] == true ? ' · Late' : ''}',
                            style: text.bodyMedium,
                          )
                        else
                          Text(
                            a['can_submit'] == true
                                ? 'Nothing submitted yet. Upload a PDF or photos of your work.'
                                : 'Nothing submitted yet.',
                            style: text.bodyMedium?.copyWith(
                              color: collegeMuted,
                            ),
                          ),
                        _asAttachments(
                          context,
                          widget.api,
                          submission?['attachments'],
                        ),
                        if (a['can_submit'] == true &&
                            submission?['completed'] != true &&
                            submission?['marks'] == null) ...[
                          const SizedBox(height: 10),
                          // Upload area.
                          Material(
                            color: collegeCanvas,
                            borderRadius: BorderRadius.circular(16),
                            clipBehavior: Clip.antiAlias,
                            child: InkWell(
                              onTap: saving
                                  ? null
                                  : () async {
                                      try {
                                        final picked = await _asPickFiles();
                                        if (mounted && picked.isNotEmpty) {
                                          setState(() => files = picked);
                                        }
                                      } catch (e) {
                                        if (context.mounted) {
                                          _asError(context, e);
                                        }
                                      }
                                    },
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 18,
                                  horizontal: 14,
                                ),
                                child: Column(
                                  children: [
                                    Icon(
                                      Icons.cloud_upload_outlined,
                                      size: 30,
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.primary,
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      'Choose PDF or multiple images',
                                      textAlign: TextAlign.center,
                                      style: text.titleSmall?.copyWith(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    Text(
                                      'Up to 10 files, 10 MB each.',
                                      style: text.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          for (final f in files)
                            Container(
                              margin: const EdgeInsets.only(top: 8),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: EduWorkspace.border),
                              ),
                              child: ListTile(
                                dense: true,
                                leading: const Icon(Icons.description_outlined),
                                title: Text(
                                  f.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                trailing: IconButton(
                                  tooltip: 'Remove file',
                                  icon: const Icon(Icons.close),
                                  onPressed: saving
                                      ? null
                                      : () => setState(() => files.remove(f)),
                                ),
                              ),
                            ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: FilledButton.icon(
                              onPressed: saving || files.isEmpty
                                  ? null
                                  : submit,
                              icon: const Icon(Icons.send_rounded),
                              label: Text(
                                saving
                                    ? 'Uploading…'
                                    : submission?['submitted_at'] != null
                                    ? 'Replace submission'
                                    : 'Submit assignment',
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                if (progress.isNotEmpty) Text(progress),
                const SizedBox(height: 30),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
