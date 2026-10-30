part of '../../app/edunexa_client.dart';


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
      final result = Map<String, dynamic>.from(await widget.api.syllabus(studentCode: child) as Map);
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
  Future<void> load() async { try { final d = Map<String,dynamic>.from(await widget.api.syllabusDetails(widget.code) as Map); if(mounted) setState(() {data=d; busy=false;}); } catch(e) { if(mounted) setState(() {error=e.toString(); busy=false;}); } }
  Future<void> download(Json file) async { try { final bytes=await widget.api.assignmentFile(_asText(file['code'])); if(!mounted)return; final box=context.findRenderObject() as RenderBox?; await SharePlus.instance.share(ShareParams(files:[XFile.fromData(bytes,name:_asText(file['filename']),mimeType:_asText(file['mime_type']))],fileNameOverrides:[_asText(file['filename'])],sharePositionOrigin:box==null?null:box.localToGlobal(Offset.zero)&box.size)); } catch(e) { if(mounted)_asError(context,e); } }
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(_asText(data?['syllabus_name']).isEmpty ? 'Shared resource' : _asText(data?['syllabus_name']))), body: ListView(padding: const EdgeInsets.all(18), children: [if(busy) const LinearProgressIndicator(), if(error != null) Text(error!), if(data != null) ...[Text('${data!['course_name']} · ${data!['specialization']}', style: Theme.of(context).textTheme.titleMedium), Text(_asText(data!['batch_name'])), const SizedBox(height: 18), SelectableText(_asText(data!['description'])), const SizedBox(height: 18), Text('Files', style: Theme.of(context).textTheme.titleLarge), ..._asRows(data!['attachments']).map((f) => Card(child: ListTile(leading: const Icon(Icons.description_outlined), title: Text(_asText(f['filename'])), subtitle: Text('${((f['size_bytes'] as num?)?.toInt() ?? 0) ~/ 1024} KB'), trailing: Wrap(children:[IconButton(tooltip:'Preview',icon:const Icon(Icons.open_in_new),onPressed:()=>_asPreview(context,widget.api,f)),IconButton(tooltip:'Download or save',icon:const Icon(Icons.download_outlined),onPressed:()=>download(f))]), onTap: () => _asPreview(context, widget.api, f))))]]));
}

class SyllabusComposer extends StatefulWidget {
  const SyllabusComposer({super.key, required this.api}); final CollegeApi api;
  @override State<SyllabusComposer> createState() => _SyllabusComposerState();
}


class _SyllabusComposerState extends State<SyllabusComposer> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController();
  final description = TextEditingController();
  Json? options;
  String level = 'intermediate', courseName = '', programCode = '', specialization = '', year = '', progress = '';
  bool loading = true, saving = false;
  List<XFile> files = [];

  @override
  void initState() { super.initState(); load(); }
  @override
  void dispose() { name.dispose(); description.dispose(); super.dispose(); }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final result = Map<String, dynamic>.from(
        await widget.api.syllabusOptions(courseLevel: level) as Map,
      );
      if (mounted) setState(() => options = result);
    } catch (e) {
      if (mounted) _asError(context, e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> publish() async {
    if (!form.currentState!.validate() || files.isEmpty) return;
    setState(() => saving = true);
    try {
      final uploaded = <Json>[];
      for (final file in files) {
        setState(() => progress = 'Uploading ${file.name}…');
        uploaded.add(await _asUpload(widget.api, file, resource: true));
      }
      setState(() => progress = 'Sharing resource and notifying students and parents…');
      await widget.api.createSyllabus({
        'course_level': level,
        'program_code': programCode,
        'specialization': specialization,
        'academic_year_code': year,
        'syllabus_name': name.text.trim(),
        'description': description.text.trim(),
        'attachments': uploaded.map((file) => file['code']).toList(),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) _asError(context, e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final programs = _asRows(options?['courses']).where((course) => course['course_level'] == level).toList();
    final courseNames = programs.map((course) => _asText(course['name'])).toSet().toList();
    final specializations = programs.where((course) => course['name'] == courseName).toList();
    final years = _asRows(options?['academic_years']).where((item) => item['program_code'] == programCode).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Share syllabus or resource')),
      body: Form(key: form, child: ListView(padding: const EdgeInsets.all(18), children: [
        Text('Course audience', style: Theme.of(context).textTheme.titleLarge),
        DropdownButtonFormField<String>(
          initialValue: level,
          decoration: const InputDecoration(labelText: 'Course level'),
          items: const [DropdownMenuItem(value: 'intermediate', child: Text('Intermediate')), DropdownMenuItem(value: 'degree', child: Text('Degree'))],
          onChanged: (value) { setState(() { level = value ?? 'intermediate'; courseName = ''; programCode = ''; specialization = ''; year = ''; }); load(); },
        ),
        DropdownButtonFormField<String>(
          key: ValueKey('course:$courseName'),
          initialValue: courseName.isEmpty ? null : courseName,
          decoration: const InputDecoration(labelText: 'Course'),
          validator: (value) => value == null ? 'Select a course' : null,
          items: courseNames.map((course) => DropdownMenuItem(value: course, child: Text(course))).toList(),
          onChanged: (value) => setState(() { courseName = value ?? ''; programCode = ''; specialization = ''; year = ''; }),
        ),
        DropdownButtonFormField<String>(
          key: ValueKey('specialization:$programCode:$courseName'),
          initialValue: programCode.isEmpty ? null : programCode,
          decoration: const InputDecoration(labelText: 'Course specialization'),
          validator: (value) => value == null ? 'Select a specialization' : null,
          items: specializations.map((course) => DropdownMenuItem(value: _asText(course['code']), child: Text(_asText(course['specialization'])))).toList(),
          onChanged: (value) => setState(() { programCode = value ?? ''; specialization = _asText(specializations.where((course) => course['code'] == value).firstOrNull?['specialization']); year = ''; }),
        ),
        DropdownButtonFormField<String>(
          key: ValueKey('year:$year:$programCode'),
          initialValue: year.isEmpty ? null : year,
          decoration: const InputDecoration(labelText: 'Academic year'),
          validator: (value) => value == null ? 'Select an academic year' : null,
          items: years.map((item) => DropdownMenuItem(value: _asText(item['code']), child: Text(_asText(item['name'])))).toList(),
          onChanged: (value) => setState(() => year = value ?? ''),
        ),
        const SizedBox(height: 22),
        Text('Resource details', style: Theme.of(context).textTheme.titleLarge),
        TextFormField(controller: name, decoration: const InputDecoration(labelText: 'Syllabus name *'), validator: (value) => value == null || value.trim().isEmpty ? 'Enter a syllabus name' : null, maxLength: 200),
        TextFormField(controller: description, decoration: const InputDecoration(labelText: 'Description'), minLines: 3, maxLines: 6, maxLength: 10000),
        const SizedBox(height: 12),
        OutlinedButton.icon(onPressed: saving ? null : () async { try { final picked = await _asPickFiles(); if (mounted) setState(() => files = picked); } catch (e) { if (mounted) _asError(context, e); } }, icon: const Icon(Icons.attach_file), label: const Text('Upload multiple PDFs or images')),
        const Text('Up to 10 files, 10 MB each. Students and linked parents will be notified.'),
        ...files.map((file) => ListTile(dense: true, title: Text(file.name), trailing: IconButton(onPressed: () => setState(() => files.remove(file)), icon: const Icon(Icons.close)))),
        if (progress.isNotEmpty) Padding(padding: const EdgeInsets.all(12), child: Text(progress)),
        const SizedBox(height: 18),
        FilledButton.icon(onPressed: saving || loading || options?['can_create'] != true ? null : publish, icon: const Icon(Icons.publish), label: Text(saving ? 'Publishing…' : 'Publish to this academic year')),
      ])),
    );
  }
}
