part of 'edunexa_client.dart';

const _assignmentRoot = '/academics/assignment-workspace';
List<Json> _asRows(dynamic value) => (value as List? ?? [])
    .map((e) => Map<String, dynamic>.from(e as Map))
    .toList();
String _asText(dynamic value) => value == null ? '' : value.toString();
String _asDate(dynamic value) {
  final date = DateTime.tryParse(_asText(value))?.toLocal();
  if (date == null) return '—';
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
}

Future<Json> _asUpload(CollegeApi api, XFile file, {String? assignment, bool resource = false, bool event = false}) async {
  final size = await file.length();
  if (size == 0 || size > 10 * 1024 * 1024) {
    throw const FormatException('Choose files up to 10 MB each.');
  }
  final started = Map<String, dynamic>.from(
    await api.post('$_assignmentRoot/files/start', {
          'filename': file.name,
          'size_bytes': size,
          'assignment_code': assignment,
          if (resource) 'resource_upload': true,
          if (event) 'event_upload': true,
        })
        as Map,
  );
  final bytes = await file.readAsBytes();
  final chunkSize = started['chunk_size'] as int;
  for (int offset = 0, index = 0; offset < size; offset += chunkSize, index++) {
    final end = (offset + chunkSize).clamp(0, size);
    await api.post('$_assignmentRoot/files/${started['code']}/chunk', {
      'index': index,
      'content_base64': base64Encode(bytes.sublist(offset, end)),
    });
  }
  return Map<String, dynamic>.from(
    await api.post('$_assignmentRoot/files/${started['code']}/finish', {})
        as Map,
  );
}

Future<List<XFile>> _asPickFiles() async {
  final files = await openFiles(
    acceptedTypeGroups: [
      const XTypeGroup(
        label: 'PDF and images',
        extensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
        mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        uniformTypeIdentifiers: [
          'com.adobe.pdf',
          'public.jpeg',
          'public.png',
          'org.webmproject.webp',
        ],
      ),
    ],
  );
  if (files.length > 10) throw const FormatException('Choose up to 10 files.');
  for (final file in files) {
    if (await file.length() > 10 * 1024 * 1024) {
      throw const FormatException('Each file must be 10 MB or smaller.');
    }
  }
  return files;
}

void _asError(BuildContext context, Object error) => ScaffoldMessenger.of(
  context,
).showSnackBar(SnackBar(content: Text(error.toString())));
Future<void> _asPreview(BuildContext context, CollegeApi api, Json file) async {
  try {
    final bytes = await api.assignmentFile(_asText(file['code']));
    if (!context.mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text(_asText(file['filename']))),
          body: file['mime_type'] == 'application/pdf'
              ? PdfViewer.data(bytes, sourceName: _asText(file['code']))
              : Center(
                  child: InteractiveViewer(
                    minScale: .5,
                    maxScale: 6,
                    child: Image.memory(
                      bytes,
                      errorBuilder: (_, _, _) =>
                          const Text('This image could not be decoded.'),
                    ),
                  ),
                ),
        ),
      ),
    );
  } catch (e) {
    if (context.mounted) _asError(context, e);
  }
}

Widget _asAttachments(BuildContext context, CollegeApi api, dynamic files) =>
    Wrap(
      spacing: 8,
      runSpacing: 6,
      children: _asRows(files)
          .map(
            (file) => OutlinedButton.icon(
              icon: const Icon(Icons.description_outlined, size: 18),
              label: Text(
                _asText(file['filename']),
                overflow: TextOverflow.ellipsis,
              ),
              onPressed: () => _asPreview(context, api, file),
            ),
          )
          .toList(),
    );

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
        await widget.api.get(
              '$_assignmentRoot${child.isEmpty ? '' : '?student_code=${Uri.encodeQueryComponent(child)}'}',
            )
            as Map,
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
      floatingActionButton: (data?['can_create'] == true || data == null && (widget.role == MobileRole.admin || widget.role == MobileRole.teacher))
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
      final params = Uri(
        queryParameters: {
          if (course.isNotEmpty) 'program_code': course,
          if (year.isNotEmpty) 'academic_year_code': year,
          if (section.isNotEmpty) 'section_code': section,
        },
      ).query;
      final value = Map<String, dynamic>.from(
        await widget.api.get('$_assignmentRoot/options?$params') as Map,
      );
      if (!mounted || current != ticket) return;
      setState(() {
        options = value;
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
      await widget.api.post(_assignmentRoot, {
        'course_level': level,
        'program_code': course,
        'academic_year_code': year,
        'section_code': section.isEmpty ? null : section,
        'teacher_code': teacher,
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
        await widget.api.get(
              '$_assignmentRoot/${widget.code}${widget.student.isEmpty ? '' : '?student_code=${Uri.encodeQueryComponent(widget.student)}'}',
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
      await widget.api.post('$_assignmentRoot/${widget.code}/review', {
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
              ...files.map((file) => ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.description_outlined),
                title: Text(file.name, maxLines: 1, overflow: TextOverflow.ellipsis),
              )),
              const Text('After posting, your teacher can review these files and add marks and feedback.'),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Go back')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Post submission')),
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
      await widget.api.post('$_assignmentRoot/${widget.code}/submit', {
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

  @override
  Widget build(BuildContext context) {
    final a = data, submission = a?['my_submission'];
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
              if (busy) const LinearProgressIndicator(),
              if (error != null) Text(error!),
              if (a != null) ...[
                Text(
                  '${a['course_name']} · ${a['batch_name']}',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text('Due ${_asDate(a['due_at'])}'),
                Text('${a['teacher_name']} · Maximum ${a['max_marks']} marks'),
                const SizedBox(height: 18),
                SelectableText(_asText(a['description'])),
                const SizedBox(height: 12),
                _asAttachments(context, widget.api, a['attachments']),
                if (a['can_review'] == true) ...[
                  const SizedBox(height: 20),
                  Text(
                    'Student review',
                    style: Theme.of(context).textTheme.titleLarge,
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
                    return Card(
                      margin: const EdgeInsets.symmetric(vertical: 10),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _asText(student['name']),
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            Text(_asText(student['admission_number'])),
                            Text(
                              s?['submitted_at'] == null
                                  ? 'Not uploaded'
                                  : 'Submitted ${_asDate(s['submitted_at'])}${s['late'] == true ? ' · Late' : ''}',
                            ),
                            _asAttachments(
                              context,
                              widget.api,
                              s?['attachments'],
                            ),
                            CheckboxListTile(
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
                  const SizedBox(height: 20),
                  Text(
                    'Your submission',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  if (submission?['submitted_at'] != null)
                    Text(
                      'Submitted ${_asDate(submission['submitted_at'])}${submission['late'] == true ? ' · Late' : ''}',
                    ),
                  _asAttachments(
                    context,
                    widget.api,
                    submission?['attachments'],
                  ),
                  if (submission?['completed'] == true)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              submission?['marks'] == null
                                  ? 'Completed'
                                  : '${submission['marks']} / ${a['max_marks']}',
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                            Text(_asText(submission?['feedback'])),
                          ],
                        ),
                      ),
                    ),
                  if (a['can_submit'] == true &&
                      submission?['completed'] != true &&
                      submission?['marks'] == null) ...[
                    OutlinedButton.icon(
                      onPressed: saving
                          ? null
                          : () async {
                              try {
                                final picked = await _asPickFiles();
                                if (mounted && picked.isNotEmpty) {
                                  setState(() => files = picked);
                                }
                              } catch (e) {
                                if (context.mounted) _asError(context, e);
                              }
                            },
                      icon: const Icon(Icons.upload_file),
                      label: const Text('Choose PDF or multiple images'),
                    ),
                    const Text('Up to 10 files, 10 MB each.'),
                    ...files.map(
                      (f) => ListTile(
                        title: Text(f.name),
                        trailing: IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: saving
                              ? null
                              : () => setState(() => files.remove(f)),
                        ),
                      ),
                    ),
                    FilledButton(
                      onPressed: saving || files.isEmpty ? null : submit,
                      child: Text(
                        saving
                            ? 'Uploading…'
                            : submission?['submitted_at'] != null
                            ? 'Replace submission'
                            : 'Submit assignment',
                      ),
                    ),
                  ],
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

const _syllabusRoot = '/academics/syllabus-workspace';

class SyllabusHub extends StatefulWidget {
  const SyllabusHub({super.key, required this.api, required this.role, this.title = 'Syllabus & resources'});
  final CollegeApi api;
  final MobileRole role;
  final String title;
  @override
  State<SyllabusHub> createState() => _SyllabusHubState();
}

class _SyllabusHubState extends State<SyllabusHub> {
  Json? data;
  String child = '', query = '', error = '';
  bool busy = true;
  @override
  void initState() { super.initState(); load(); }
  Future<void> load() async {
    setState(() { busy = true; error = ''; });
    try {
      final result = Map<String, dynamic>.from(await widget.api.get('$_syllabusRoot${child.isEmpty ? '' : '?student_code=${Uri.encodeQueryComponent(child)}'}') as Map);
      if (!mounted) return;
      setState(() { data = result; busy = false; });
      final students = _asRows(result['students']);
      if (widget.role == MobileRole.parent && child.isEmpty && students.isNotEmpty) { child = _asText(students.first['code']); await load(); }
    } catch (e) { if (mounted) setState(() { busy = false; error = e.toString(); }); }
  }
  @override
  Widget build(BuildContext context) {
    final items = _asRows(data?['items']).where((r) => '${r['syllabus_name']} ${r['course_name']} ${r['specialization']} ${r['batch_name']}'.toLowerCase().contains(query.toLowerCase())).toList();
    final students = _asRows(data?['students']);
    final canCreate = data?['can_create'] == true || data == null && (widget.role == MobileRole.admin || widget.role == MobileRole.teacher);
    return Scaffold(
      appBar: AppBar(title: Text(widget.title), automaticallyImplyLeading: false, actions: [IconButton(onPressed: busy ? null : load, tooltip: 'Refresh resources', icon: const Icon(Icons.refresh))]),
      floatingActionButton: canCreate ? FloatingActionButton.extended(onPressed: () async { final saved = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => SyllabusComposer(api: widget.api))); if (saved == true && mounted) await load(); }, icon: const Icon(Icons.add), label: const Text('Add resource')) : null,
      body: RefreshIndicator(onRefresh: load, child: ListView(padding: const EdgeInsets.fromLTRB(16, 16, 16, 100), children: [
        if (error.isNotEmpty) Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [Text(error), TextButton(onPressed: load, child: const Text('Retry'))]))),
        if (busy) const LinearProgressIndicator(),
        if (students.length > 1) DropdownButtonFormField<String>(key: ValueKey(child), initialValue: child.isEmpty ? null : child, decoration: const InputDecoration(labelText: 'Student'), items: students.map((s) => DropdownMenuItem(value: _asText(s['code']), child: Text(_asText(s['name'])))).toList(), onChanged: (value) { child = value ?? ''; load(); }),
        TextField(decoration: const InputDecoration(prefixIcon: Icon(Icons.search), labelText: 'Search shared resources'), onChanged: (v) => setState(() => query = v)),
        const SizedBox(height: 14),
        if (items.isEmpty && !busy) const Padding(padding: EdgeInsets.symmetric(vertical: 45), child: Column(children: [Icon(Icons.menu_book_outlined, size: 36), SizedBox(height: 8), Text('No resources shared for this academic year yet.') ])),
        ...items.map((r) => Card(margin: const EdgeInsets.only(bottom: 12), child: InkWell(borderRadius: BorderRadius.circular(14), onTap: () => Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => SyllabusDetail(api: widget.api, code: _asText(r['code']), student: child))), child: Padding(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${r['course_name']} · ${r['specialization']} · ${r['batch_name']}', style: Theme.of(context).textTheme.labelLarge), const SizedBox(height: 8), Text(_asText(r['syllabus_name']), style: Theme.of(context).textTheme.titleMedium), if (_asText(r['description']).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(_asText(r['description']), maxLines: 3, overflow: TextOverflow.ellipsis)), const SizedBox(height: 10), Text('${_asRows(r['attachments']).length} downloadable file(s)')]))))),
      ])),
    );
  }
}

class SyllabusDetail extends StatefulWidget {
  const SyllabusDetail({super.key, required this.api, required this.code, this.student = ''});
  final CollegeApi api;
  final String code, student;
  @override
  State<SyllabusDetail> createState() => _SyllabusDetailState();
}
class _SyllabusDetailState extends State<SyllabusDetail> {
  Json? data; String? error; bool busy = true;
  @override
  void initState() { super.initState(); load(); }
  Future<void> load() async { try { final d = Map<String,dynamic>.from(await widget.api.get('$_syllabusRoot/${Uri.encodeComponent(widget.code)}') as Map); if(mounted) setState(() {data=d; busy=false;}); } catch(e) { if(mounted) setState(() {error=e.toString(); busy=false;}); } }
  Future<void> download(Json file) async { try { final bytes=await widget.api.assignmentFile(_asText(file['code'])); if(!mounted)return; final box=context.findRenderObject() as RenderBox?; await SharePlus.instance.share(ShareParams(files:[XFile.fromData(bytes,name:_asText(file['filename']),mimeType:_asText(file['mime_type']))],fileNameOverrides:[_asText(file['filename'])],sharePositionOrigin:box==null?null:box.localToGlobal(Offset.zero)&box.size)); } catch(e) { if(mounted)_asError(context,e); } }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(_asText(data?['syllabus_name']).isEmpty ? 'Shared resource' : _asText(data?['syllabus_name']))), body: ListView(padding: const EdgeInsets.all(18), children: [if(busy) const LinearProgressIndicator(), if(error != null) Text(error!), if(data != null) ...[Text('${data!['course_name']} · ${data!['specialization']}', style: Theme.of(context).textTheme.titleMedium), Text(_asText(data!['batch_name'])), const SizedBox(height: 18), SelectableText(_asText(data!['description'])), const SizedBox(height: 18), Text('Files', style: Theme.of(context).textTheme.titleLarge), ..._asRows(data!['attachments']).map((f) => Card(child: ListTile(leading: const Icon(Icons.description_outlined), title: Text(_asText(f['filename'])), subtitle: Text('${((f['size_bytes'] as num?)?.toInt() ?? 0) ~/ 1024} KB'), trailing: Wrap(mainAxisSize:MainAxisSize.min,children:[IconButton(tooltip:'Preview',icon:const Icon(Icons.open_in_new),onPressed:()=>_asPreview(context,widget.api,f)),IconButton(tooltip:'Download or save',icon:const Icon(Icons.download_outlined),onPressed:()=>download(f))]), onTap: () => _asPreview(context, widget.api, f))))]]));
}

class SyllabusComposer extends StatefulWidget {
  const SyllabusComposer({super.key, required this.api}); final CollegeApi api;
  @override State<SyllabusComposer> createState() => _SyllabusComposerState();
}

class EventDetailScreen extends StatelessWidget {
  const EventDetailScreen({super.key, required this.api, required this.event});
  final CollegeApi api;
  final Json event;
  String date(dynamic value) {
    final parsed = DateTime.tryParse(_asText(value))?.toLocal();
    return parsed == null ? '—' : '${parsed.day} ${_month(parsed.month)} ${parsed.year} · ${parsed.hour.toString().padLeft(2, '0')}:${parsed.minute.toString().padLeft(2, '0')}';
  }
  String _month(int month) => const ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1];
  @override
  Widget build(BuildContext context) {
    final imageCode = _asText(event['image_code']);
    return Scaffold(appBar: AppBar(title: const Text('Event details')), body: ListView(padding: const EdgeInsets.all(18), children: [
      if (imageCode.isNotEmpty) FutureBuilder<Uint8List>(future: api.assignmentFile(imageCode), builder: (context, snapshot) => snapshot.hasData ? ClipRRect(borderRadius: BorderRadius.circular(18), child: Image.memory(snapshot.data!, height: 240, fit: BoxFit.cover)) : snapshot.hasError ? const SizedBox.shrink() : const SizedBox(height:180, child: Center(child:CircularProgressIndicator()))),
      const SizedBox(height:18), Text(_asText(event['title']), style: Theme.of(context).textTheme.headlineSmall),
      const SizedBox(height:12), Text('${date(event['starts_at'])}${event['ends_at'] != event['starts_at'] ? ' – ${date(event['ends_at'])}' : ' · One day'}'),
      if (_asText(event['place']).isNotEmpty) Padding(padding:const EdgeInsets.only(top:8),child:Text('Place: ${event['place']}')),
      if (_asText(event['short_description']).isNotEmpty) Card(margin:const EdgeInsets.symmetric(vertical:16),child:Padding(padding:const EdgeInsets.all(16),child:Text(_asText(event['short_description']),style:Theme.of(context).textTheme.titleMedium))),
      Text(_asText(event['description']).isEmpty?'No additional details.':_asText(event['description']), style:Theme.of(context).textTheme.bodyLarge),
    ]));
  }
}

const _calendarRoot = '/academics/calendar-workspace';
class CalendarHub extends StatefulWidget {
  const CalendarHub({super.key, required this.api, required this.role, this.title='Academic calendar'});
  final CollegeApi api; final MobileRole role; final String title;
  @override State<CalendarHub> createState()=>_CalendarHubState();
}
class _CalendarHubState extends State<CalendarHub> {
  Json? data; String child='', error=''; bool busy=true;
  DateTime selected=DateUtils.dateOnly(DateTime.now()), month=DateTime(DateTime.now().year,DateTime.now().month);
  @override void initState(){super.initState();load();}
  Future<void> load() async {setState(()=>busy=true);try{var value=Map<String,dynamic>.from(await widget.api.get('$_calendarRoot${child.isEmpty?'':'?student_code=${Uri.encodeQueryComponent(child)}'}') as Map);if(!mounted)return;setState(()=>data=value);final children=_asRows(value['students']);if(widget.role==MobileRole.parent&&child.isEmpty&&children.isNotEmpty){child=_asText(children.first['code']);await load();return;}}catch(e){if(mounted)setState(()=>error=e.toString());}finally{if(mounted)setState(()=>busy=false);}}
  @override Widget build(BuildContext context){final all=_asRows(data?['items']);final events=all.where((r){final start=DateTime.tryParse(_asText(r['starts_at']));final end=DateTime.tryParse(_asText(r['ends_at']))??start;return start!=null&&!selected.isBefore(DateUtils.dateOnly(start.toLocal()))&&!selected.isAfter(DateUtils.dateOnly(end!.toLocal()));}).toList();final students=_asRows(data?['students']);final canCreate=data?['can_create']==true||data==null&&widget.role==MobileRole.admin;return Scaffold(appBar:AppBar(title:Text(widget.title),automaticallyImplyLeading:false,actions:[IconButton(onPressed:busy?null:load,icon:const Icon(Icons.refresh))]),floatingActionButton:canCreate?FloatingActionButton.extended(onPressed:()async{final saved=await Navigator.of(context).push<bool>(MaterialPageRoute(builder:(_)=>CalendarComposer(api:widget.api)));if(saved==true&&mounted)await load();},icon:const Icon(Icons.add),label:const Text('Add event')):null,body:RefreshIndicator(onRefresh:load,child:ListView(padding:const EdgeInsets.fromLTRB(16,16,16,100),children:[if(error.isNotEmpty)Card(child:Padding(padding:const EdgeInsets.all(16),child:Column(children:[Text(error),TextButton(onPressed:load,child:const Text('Retry'))]))),if(busy)const LinearProgressIndicator(),if(students.length>1)DropdownButtonFormField<String>(key:ValueKey(child),initialValue:child.isEmpty?null:child,decoration:const InputDecoration(labelText:'Student'),items:students.map((s)=>DropdownMenuItem(value:_asText(s['code']),child:Text(_asText(s['name'])))).toList(),onChanged:(v){child=v??'';load();}),CampusCalendar(month:month,selected:selected,events:all,onMonth:(v){setState(()=>month=v);load();},onDay:(v)=>setState(()=>selected=v)),Padding(padding:const EdgeInsets.symmetric(vertical:14),child:Text('Agenda · ${selected.day} ${_monthName(selected.month)} ${selected.year}',style:Theme.of(context).textTheme.titleLarge)),if(events.isEmpty)const Padding(padding:EdgeInsets.symmetric(vertical:24),child:Text('No events scheduled for this date.',textAlign:TextAlign.center)),...events.map((e)=>Card(child:ListTile(leading:Icon(e['image_code']!=null?Icons.image_outlined:Icons.event_outlined),title:Text(_asText(e['title'])),subtitle:Text('${_asText(e['place'])} · ${_asText(e['short_description'])}',maxLines:2,overflow:TextOverflow.ellipsis),trailing:const Icon(Icons.info_outline),onTap:()=>Navigator.of(context).push<void>(MaterialPageRoute(builder:(_)=>EventDetailScreen(api:widget.api,event:e)))))])));}
  String _monthName(int month)=>const ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1];
}

class CalendarComposer extends StatefulWidget { const CalendarComposer({super.key,required this.api}); final CollegeApi api; @override State<CalendarComposer> createState()=>_CalendarComposerState(); }
class _CalendarComposerState extends State<CalendarComposer>{
  final form=GlobalKey<FormState>(),title=TextEditingController(),place=TextEditingController(),short=TextEditingController(),description=TextEditingController();Json? options;String kind='academic',audience='all',audienceCode='';DateTime? start,end;XFile? image;bool loading=true,saving=false;String progress='';
  @override void initState(){super.initState();load();}
  @override void dispose(){title.dispose();place.dispose();short.dispose();description.dispose();super.dispose();}
  Future<void> load()async{try{final result=Map<String,dynamic>.from(await widget.api.get('$_calendarRoot/options') as Map);if(mounted)setState(()=>options=result);}catch(e){if(mounted)_asError(context,e);}finally{if(mounted)setState(()=>loading=false);}}
  Future<DateTime?> pickDateTime(DateTime? initial)async{final day=await showDatePicker(context:context,initialDate:initial??DateTime.now().add(const Duration(days:1)),firstDate:DateTime.now(),lastDate:DateTime.now().add(const Duration(days:3650)));if(day==null||!mounted)return null;final time=await showTimePicker(context:context,initialTime:initial==null?const TimeOfDay(hour:9,minute:0):TimeOfDay.fromDateTime(initial));return time==null?null:DateTime(day.year,day.month,day.day,time.hour,time.minute);}
  Future<void> chooseImage()async{try{final file=await openFile(acceptedTypeGroups:[const XTypeGroup(label:'Event image',extensions:['jpg','jpeg','png','webp'],mimeTypes:['image/jpeg','image/png','image/webp'])]);if(file==null)return;final size=await file.length();if(size>10*1024*1024)throw const FormatException('Event image must be 10 MB or smaller.');if(mounted)setState(()=>image=file);}catch(e){if(mounted)_asError(context,e);}}
  Future<void> publish()async{if(!form.currentState!.validate())return;if(start==null){_asError(context,'Choose the event start date and time.');return;}if(end!=null&&end!.isBefore(DateUtils.dateOnly(start!))){_asError(context,'End date must be on or after the start date.');return;}setState(()=>saving=true);try{Json? uploaded;if(image!=null){setState(()=>progress='Uploading event picture…');uploaded=await _asUpload(widget.api,image!,event:true);}setState(()=>progress='Publishing event and notifying selected families…');final endAt=end==null?start!:DateTime(end!.year,end!.month,end!.day,start!.hour,start!.minute);await widget.api.post(_calendarRoot,{'title':title.text.trim(),'place':place.text.trim(),'event_type':kind,'starts_at':start!.toUtc().toIso8601String(),'ends_at':endAt.toUtc().toIso8601String(),'short_description':short.text.trim(),'description':description.text.trim(),'audience_type':audience,'audience_code':['department','program'].contains(audience)?audienceCode:null,'image_code':uploaded?['code']});if(mounted)Navigator.pop(context,true);}catch(e){if(mounted)_asError(context,e);}finally{if(mounted)setState(()=>saving=false);}}
  Widget scopeSelect(String label,String value,List<Json> rows,ValueChanged<String> onChanged)=>DropdownButtonFormField<String>(key:ValueKey('$label:$value'),initialValue:value.isEmpty?null:value,decoration:InputDecoration(labelText:label),validator:(v)=>v==null?'Select $label':null,items:rows.map((r)=>DropdownMenuItem(value:_asText(r['code']),child:Text(label=='Course specialization'?'${r['course_level']} · ${r['name']} · ${r['specialization']}':_asText(r['name'])))).toList(),onChanged:(v)=>onChanged(v??''));
  @override Widget build(BuildContext context){final departments=_asRows(options?['departments']),courses=_asRows(options?['courses']);final filtered=courses.where((c)=>audience=='intermediate'?c['course_level']=='intermediate':audience=='degree'?c['course_level']=='degree':true).toList();return Scaffold(appBar:AppBar(title:const Text('Add academic calendar event')),body:Form(key:form,child:ListView(padding:const EdgeInsets.all(18),children:[TextFormField(controller:title,decoration:const InputDecoration(labelText:'Event name *'),validator:(v)=>v==null||v.trim().isEmpty?'Enter event name':null,maxLength:200),TextFormField(controller:place,decoration:const InputDecoration(labelText:'Place'),maxLength:200),DropdownButtonFormField<String>(initialValue:kind,decoration:const InputDecoration(labelText:'Event type'),items:(options?['event_types'] as List? ?? ['academic','cultural','sports','meeting','holiday']).map((v)=>DropdownMenuItem(value:v.toString(),child:Text('${v.toString()[0].toUpperCase()}${v.toString().substring(1)}'))).toList(),onChanged:(v)=>setState(()=>kind=v??'academic')),OutlinedButton.icon(onPressed:()=>pickDateTime(start).then((v){if(v!=null)setState(()=>start=v);}),icon:const Icon(Icons.calendar_month_outlined),label:Text(start==null?'Start date and time *':_asDate(start!.toIso8601String()))),OutlinedButton.icon(onPressed:()=>pickDateTime(end??start).then((v){if(v!=null)setState(()=>end=v);}),icon:const Icon(Icons.event_available_outlined),label:Text(end==null?'End date (optional · one day if empty)':_asDate(end!.toIso8601String()))),const SizedBox(height:20),Text('Audience',style:Theme.of(context).textTheme.titleLarge),DropdownButtonFormField<String>(initialValue:audience,decoration:const InputDecoration(labelText:'Who should see this event?'),items:const [DropdownMenuItem(value:'all',child:Text('All departments and courses')),DropdownMenuItem(value:'department',child:Text('One department')),DropdownMenuItem(value:'intermediate',child:Text('All Intermediate courses')),DropdownMenuItem(value:'degree',child:Text('All Degree courses')),DropdownMenuItem(value:'program',child:Text('One course specialization'))],onChanged:(v){setState((){audience=v??'all';audienceCode='';});}),if(audience=='department')scopeSelect('Department',audienceCode,departments,(v)=>setState(()=>audienceCode=v)),if(audience=='program')scopeSelect('Course specialization',audienceCode,filtered,(v)=>setState(()=>audienceCode=v)),TextFormField(controller:short,decoration:const InputDecoration(labelText:'Short description *'),maxLength:300,validator:(v)=>v==null||v.trim().isEmpty?'Add a short notification message':null),TextFormField(controller:description,decoration:const InputDecoration(labelText:'Detailed description'),minLines:3,maxLines:6,maxLength:10000),OutlinedButton.icon(onPressed:saving?null:chooseImage,icon:const Icon(Icons.add_photo_alternate_outlined),label:Text(image==null?'Add event picture':image!.name)),const Text('Choose a JPG, PNG, or WebP image up to 10 MB.'),if(progress.isNotEmpty)Padding(padding:const EdgeInsets.all(12),child:Text(progress)),const SizedBox(height:14),FilledButton.icon(onPressed:saving||loading||options?['can_create']!=true?null:publish,icon:const Icon(Icons.publish),label:Text(saving?'Publishing…':'Publish event'))])));}
}

String _monthName(int month)=>const ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1];
class _SyllabusComposerState extends State<SyllabusComposer> {
  final form = GlobalKey<FormState>(), name = TextEditingController(), description = TextEditingController();
  Json? options; String level='intermediate', course='', specialization='', year='', progress=''; bool loading=true, saving=false; List<XFile> files=[];
  @override void initState(){super.initState();load();}
  @override void dispose(){name.dispose();description.dispose();super.dispose();}
  Future<void> load() async {setState(()=>loading=true);try{final query=Uri(queryParameters:{'course_level':level,if(course.isNotEmpty)'program_code':course}).query;final result=Map<String,dynamic>.from(await widget.api.get('$_syllabusRoot/options?$query') as Map);if(mounted)setState(()=>options=result);}catch(e){if(mounted)_asError(context,e);}finally{if(mounted)setState(()=>loading=false);}}
  Future<void> publish() async {if(!form.currentState!.validate()||files.isEmpty)return;setState(()=>saving=true);try{final uploaded=<Json>[];for(final file in files){setState(()=>progress='Uploading ${file.name}…');uploaded.add(await _asUpload(widget.api,file,resource:true));}setState(()=>progress='Sharing resource and notifying students and parents…');await widget.api.post(_syllabusRoot,{'course_level':level,'program_code':course,'specialization':specialization,'academic_year_code':year,'syllabus_name':name.text.trim(),'description':description.text.trim(),'attachments':uploaded.map((e)=>e['code']).toList()});if(mounted)Navigator.pop(context,true);}catch(e){if(mounted)_asError(context,e);}finally{if(mounted)setState(()=>saving=false);}}
  @override Widget build(BuildContext context){final courses=_asRows(options?['courses']), years=_asRows(options?['academic_years']).where((y)=>y['program_code']==course).toList();final selected=courses.where((c)=>c['code']==course).firstOrNull;return Scaffold(appBar:AppBar(title:const Text('Share syllabus or resource')),body:Form(key:form,child:ListView(padding:const EdgeInsets.all(18),children:[Text('Course audience',style:Theme.of(context).textTheme.titleLarge),DropdownButtonFormField<String>(initialValue:level,decoration:const InputDecoration(labelText:'Course level'),items:const [DropdownMenuItem(value:'intermediate',child:Text('Intermediate')),DropdownMenuItem(value:'degree',child:Text('Degree'))],onChanged:(v){level=v??'intermediate';course='';specialization='';year='';load();}),DropdownButtonFormField<String>(key:ValueKey('course:$course'),initialValue:course.isEmpty?null:course,decoration:const InputDecoration(labelText:'Course'),validator:(v)=>v==null?'Select a course':null,items:courses.where((c)=>c['course_level']==level).map((c)=>DropdownMenuItem(value:_asText(c['code']),child:Text(_asText(c['name'])))).toList(),onChanged:(v){course=v??'';specialization='';year='';load();}),DropdownButtonFormField<String>(key:ValueKey('spec:$specialization:$course'),initialValue:specialization.isEmpty?null:specialization,decoration:const InputDecoration(labelText:'Course specialization'),validator:(v)=>v==null?'Select a specialization':null,items:selected==null?[]:[DropdownMenuItem(value:_asText(selected['specialization']),child:Text(_asText(selected['specialization'])))],onChanged:(v)=>setState(()=>specialization=v??'')),DropdownButtonFormField<String>(key:ValueKey('year:$year:$course'),initialValue:year.isEmpty?null:year,decoration:const InputDecoration(labelText:'Academic year'),validator:(v)=>v==null?'Select an academic year':null,items:years.map((y)=>DropdownMenuItem(value:_asText(y['code']),child:Text(_asText(y['name'])))).toList(),onChanged:(v)=>setState(()=>year=v??'')),const SizedBox(height:22),Text('Resource details',style:Theme.of(context).textTheme.titleLarge),TextFormField(controller:name,decoration:const InputDecoration(labelText:'Syllabus name *'),validator:(v)=>v==null||v.trim().isEmpty?'Enter a syllabus name':null,maxLength:200),TextFormField(controller:description,decoration:const InputDecoration(labelText:'Description'),minLines:3,maxLines:6,maxLength:10000),const SizedBox(height:12),OutlinedButton.icon(onPressed:saving?null:()async{try{final picked=await _asPickFiles();if(mounted)setState(()=>files=picked);}catch(e){if(mounted)_asError(context,e);}},icon:const Icon(Icons.attach_file),label:const Text('Upload multiple PDFs or images')),const Text('Up to 10 files, 10 MB each. Students and linked parents will be notified.'),...files.map((f)=>ListTile(dense:true,title:Text(f.name),trailing:IconButton(onPressed:()=>setState(()=>files.remove(f)),icon:const Icon(Icons.close)))),if(progress.isNotEmpty)Padding(padding:const EdgeInsets.all(12),child:Text(progress)),const SizedBox(height:18),FilledButton.icon(onPressed:saving||loading||options?['can_create']!=true?null:publish,icon:const Icon(Icons.publish),label:Text(saving?'Publishing…':'Publish to this academic year'))])));}
}
