part of '../../app/edunexa_client.dart';

class CertificateMobileWorkspace extends StatefulWidget {
  final CollegeApi api;
  final MobileRole role;
  final String? studentCode;
  const CertificateMobileWorkspace({super.key, required this.api, required this.role, this.studentCode});
  @override
  State<CertificateMobileWorkspace> createState() => _CertificateMobileWorkspaceState();
}

class _CertificateMobileWorkspaceState extends State<CertificateMobileWorkspace> {
  List<Json> requests = [], certificates = [], templates = [], documents = [];
  bool busy = true, saving = false;
  String? error, filesError;
  int view = 0;
  bool get admin => widget.role == MobileRole.admin;

  @override
  void initState() { super.initState(); load(); }

  /// The student whose file is shown: the selected child, or the student's own record.
  String? get studentCode => widget.studentCode?.isNotEmpty == true
      ? widget.studentCode
      : requests.map((r) => r['student_code']?.toString()).whereType<String>().firstOrNull;

  Future<void> load() async {
    setState(() { busy = true; error = null; });
    try {
      final result = Map<String, dynamic>.from(await widget.api.certificates(studentCode: widget.studentCode ?? '') as Map);
      final options = Map<String, dynamic>.from(await widget.api.certificateOptions() as Map);
      if (!mounted) return;
      setState(() { requests = (result['items'] as List? ?? []).cast<Json>(); certificates = (result['certificates'] as List? ?? []).cast<Json>(); templates = (options['templates'] as List? ?? []).cast<Json>(); busy = false; });
    } catch (e) { if (mounted) setState(() { error = e.toString(); busy = false; }); }
    if (!admin) await loadFiles();
  }

  /// Enrollment documents (and admission documents) on the student's file.
  Future<void> loadFiles() async {
    final code = studentCode;
    if (code == null) return;
    try {
      final result = Map<String, dynamic>.from(await widget.api.studentFiles(code) as Map);
      if (!mounted) return;
      setState(() {
        filesError = null;
        documents = (result['items'] as List? ?? []).cast<Json>().where((d) => d['download_kind'] == 'document' || d['download_kind'] == 'admission-document').toList();
      });
    } catch (e) { if (mounted) setState(() => filesError = e.toString()); }
  }

  /// Slide-up request form: certificate type, reason and submit.
  Future<void> openRequestForm() async {
    final pendingTypes = {for (final r in requests) if (r['status'] == 'pending' || r['status'] == 'approved') r['type_code']?.toString()};
    final sent = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      useSafeArea: true,
      builder: (_) => _CertificateRequestSheet(
        api: widget.api,
        templates: templates,
        unavailable: pendingTypes,
        studentCode: widget.studentCode,
      ),
    );
    if (sent == true && mounted) {
      setState(() => view = 1);
      await load();
      if (mounted) _toast('Certificate request sent. Administration has been notified.');
    }
  }

  Future<void> decide(Json row, bool approve) async {
    setState(() => saving = true);
    try { await widget.api.decideCertificate(row['code'].toString(), approve: approve); await load(); }
    catch (e) { if (mounted) _toast(e.toString()); }
    finally { if (mounted) setState(() => saving = false); }
  }

  Future<void> preview(Json certificate) async {
    try {
      final bytes = await widget.api.download('certificate', certificate['code'].toString());
      if (!mounted) return;
      await Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => CertificatePdfScreen(bytes: bytes, title: 'Certificate ${certificate['certificate_number'] ?? certificate['code']}')));
    } catch (e) { if (mounted) _toast(e.toString()); }
  }

  /// Opens a file in the app (PDF viewer or zoomable image), with download/share in its header.
  Future<void> openFile(String kind, String code, String title, String? mime) async {
    try {
      final bytes = await widget.api.download(kind, code);
      if (!mounted) return;
      await Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => DocumentViewerScreen(bytes: bytes, title: title, mime: mime ?? 'application/pdf')));
    } catch (e) { if (mounted) _toast(e.toString()); }
  }

  /// Saves or shares a file straight away through the system share sheet.
  Future<void> shareFile(String kind, String code, String title, String? mime) async {
    try {
      final bytes = await widget.api.download(kind, code);
      if (!mounted) return;
      await _shareBytes(context, bytes, title, mime ?? 'application/pdf');
    } catch (e) { if (mounted) _toast(e.toString()); }
  }

  void _toast(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  @override
  Widget build(BuildContext context) => admin ? approvals(context) : personal(context);

  /// Administrator view (unchanged): every request with approve / reject.
  Widget approvals(BuildContext context) {
    final issuedByRequest = {for (final c in certificates) c['request_code']?.toString(): c};
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeading(title: 'Certificate approvals'),
      if (error != null) MaterialBanner(content: Text(error!), actions: [TextButton(onPressed: load, child: const Text('Retry'))]),
      if (busy) const Center(child: Padding(padding: EdgeInsets.all(28), child: CircularProgressIndicator())),
      if (!busy && requests.isEmpty) const QuietEmpty(icon: Icons.workspace_premium_outlined, title: 'No certificate requests', message: 'Requests and issued certificates will appear here.'),
      ...requests.map((row) {
        final certificate = issuedByRequest[row['code']?.toString()];
        return Padding(padding: const EdgeInsets.only(bottom: 10), child: CampusRecord(record: row, screen: 'certificates', onPrimary: certificate == null ? null : () => preview(certificate), primaryLabel: certificate == null ? null : 'Preview / download'));
      }),
      if (requests.any((r) => r['status'] == 'pending'))
        ...requests.where((r) => r['status'] == 'pending').map((row) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Row(children: [Expanded(child: OutlinedButton.icon(onPressed: saving ? null : () => decide(row, false), icon: const Icon(Icons.close), label: const Text('Reject'))), const SizedBox(width: 8), Expanded(child: FilledButton.icon(onPressed: saving ? null : () => decide(row, true), icon: const Icon(Icons.check), label: const Text('Approve & issue')))]))),
      OutlinedButton.icon(onPressed: busy ? null : load, icon: const Icon(Icons.refresh), label: const Text('Refresh certificates')),
    ]);
  }

  /// Parent / student view: request form, then issued, pending, rejected and submitted documents.
  Widget personal(BuildContext context) {
    final byRequest = {for (final c in certificates) c['request_code']?.toString(): c};
    final issued = requests.where((r) => byRequest[r['code']?.toString()] != null).toList();
    final pending = requests.where((r) => r['status'] == 'pending' || (r['status'] == 'approved' && byRequest[r['code']?.toString()] == null)).toList();
    final rejected = requests.where((r) => r['status'] == 'rejected').toList();
    final tabs = ['Issued (${issued.length})', 'Pending (${pending.length})', 'Rejected (${rejected.length})', 'Submitted (${documents.length})'];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      EduGrid(fold: 4, children: [
        EduStatCard(loading: busy, label: 'Issued', value: '${issued.length}', icon: Icons.workspace_premium_outlined, tint: EduTints.sage, onTap: () => setState(() => view = 0)),
        EduStatCard(loading: busy, label: 'Pending', value: '${pending.length}', icon: Icons.hourglass_top_rounded, tint: EduTints.gold, onTap: () => setState(() => view = 1)),
        EduStatCard(loading: busy, label: 'Rejected', value: '${rejected.length}', icon: Icons.block_outlined, tint: EduTints.clay, onTap: () => setState(() => view = 2)),
        EduStatCard(loading: busy, label: 'Submitted documents', value: '${documents.length}', icon: Icons.folder_open_outlined, tint: EduTints.mist, onTap: () => setState(() => view = 3)),
      ]),
      const SizedBox(height: 16),
      FilledButton.icon(
        key: const ValueKey('request-certificate'),
        onPressed: busy || templates.isEmpty ? null : openRequestForm,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Request a certificate'),
      ),
      const SizedBox(height: 20),
      EduPillTabs(labels: tabs, selected: view, onSelected: (i) => setState(() => view = i)),
      const SizedBox(height: 14),
      if (error != null) WorkspaceMessage(icon: Icons.cloud_off_outlined, title: 'Certificates unavailable', message: error!, onRetry: load),
      if (busy) const EduLoadingSkeleton()
      else if (view == 0) ...(issued.isEmpty
          ? [const QuietEmpty(icon: Icons.workspace_premium_outlined, title: 'No certificates issued yet', message: 'Approved certificates appear here to view and download.')]
          : issued.map((r) { final c = byRequest[r['code']?.toString()]!; final title = '${r['template_name'] ?? 'Certificate'}'; return _CertificateCard(
              icon: Icons.workspace_premium_outlined, tint: EduTints.sage, title: title,
              subtitle: 'No. ${c['certificate_number'] ?? c['code']} · Issued ${_shortDate(c['issued_on'] ?? r['decided_at'])}',
              status: c['revoked_on'] != null ? 'Revoked' : 'Issued',
              onView: c['revoked_on'] != null ? null : () => openFile('certificate', '${c['code']}', title, 'application/pdf'),
              onDownload: c['revoked_on'] != null ? null : () => shareFile('certificate', '${c['code']}', title, 'application/pdf'));
            }))
      else if (view == 1) ...(pending.isEmpty
          ? [const QuietEmpty(icon: Icons.hourglass_empty_rounded, title: 'No pending requests', message: 'Requests waiting for the college office appear here.')]
          : pending.map((r) => _CertificateCard(icon: Icons.hourglass_top_rounded, tint: EduTints.gold, title: '${r['template_name'] ?? 'Certificate'}',
              subtitle: 'Requested ${_shortDate(r['requested_on'])}', status: r['status'] == 'approved' ? 'Being prepared' : 'Under review',
              note: '${r['reason'] ?? ''}'.isEmpty ? null : 'Reason: ${r['reason']}')))
      else if (view == 2) ...(rejected.isEmpty
          ? [const QuietEmpty(icon: Icons.verified_outlined, title: 'No rejected requests', message: 'Requests the office could not approve appear here with their note.')]
          : rejected.map((r) => _CertificateCard(icon: Icons.block_outlined, tint: EduTints.clay, title: '${r['template_name'] ?? 'Certificate'}',
              subtitle: 'Requested ${_shortDate(r['requested_on'])}', status: 'Rejected',
              note: '${r['decision_message'] ?? ''}'.isEmpty ? 'Please contact the college office.' : '${r['decision_message']}')))
      else ...[
        if (filesError != null) WorkspaceMessage(icon: Icons.cloud_off_outlined, title: 'Documents unavailable', message: filesError!, onRetry: loadFiles),
        if (studentCode == null)
          const QuietEmpty(icon: Icons.person_search_outlined, title: 'Select a student', message: 'Choose a student to see the documents on their file.')
        else if (documents.isEmpty && filesError == null)
          const QuietEmpty(icon: Icons.folder_open_outlined, title: 'No submitted documents', message: 'Certificates and documents handed in at enrollment appear here.')
        else ...documents.map((d) { final title = _documentTitle(d); return _CertificateCard(
            icon: (d['mime_type'] ?? '').toString().startsWith('image/') ? Icons.image_outlined : Icons.description_outlined,
            tint: EduTints.mist, title: title,
            subtitle: 'Submitted ${_shortDate(d['uploaded_at'] ?? d['created_at'])}${d['original_filename'] == null ? '' : ' · ${d['original_filename']}'}',
            status: 'On file',
            onView: () => openFile('${d['download_kind']}', '${d['code']}', title, d['mime_type']?.toString()),
            onDownload: () => shareFile('${d['download_kind']}', '${d['code']}', title, d['mime_type']?.toString()));
          }),
      ],
    ]);
  }
}

String _shortDate(dynamic value) {
  final date = DateTime.tryParse('${value ?? ''}');
  return date == null ? '—' : prettyDate(date);
}

String _documentTitle(Json d) {
  final type = '${d['document_type'] ?? d['document_label'] ?? ''}'.replaceAll('_', ' ').trim();
  if (type.isEmpty) return '${d['original_filename'] ?? 'Document'}';
  return type[0].toUpperCase() + type.substring(1);
}

Future<void> _shareBytes(BuildContext context, Uint8List bytes, String title, String mime) async {
  final box = context.findRenderObject() as RenderBox?;
  final extension = mime == 'image/png' ? 'png' : mime.startsWith('image/') ? 'jpg' : 'pdf';
  await SharePlus.instance.share(ShareParams(files: [XFile.fromData(bytes, name: '$title.$extension', mimeType: mime)], fileNameOverrides: ['$title.$extension'], sharePositionOrigin: box == null ? null : box.localToGlobal(Offset.zero) & box.size));
}

/// One certificate or document: tinted icon, title, status pill, optional note and actions.
class _CertificateCard extends StatelessWidget {
  final IconData icon;
  final Color tint;
  final String title, subtitle, status;
  final String? note;
  final VoidCallback? onView, onDownload;
  const _CertificateCard({required this.icon, required this.tint, required this.title, required this.subtitle, required this.status, this.note, this.onView, this.onDownload});
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final ink = EduTints.ink(tint);
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: collegeIvory, borderRadius: BorderRadius.circular(20), border: Border.all(color: collegeLine)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: 44, height: 44, decoration: BoxDecoration(color: tint, shape: BoxShape.circle), child: Icon(icon, color: ink, size: 22)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Text(subtitle, style: text.bodySmall),
          ])),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(99)),
            child: Text(status, style: text.labelMedium?.copyWith(color: ink, fontWeight: FontWeight.w700)),
          ),
        ]),
        if (note != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: collegeCanvas, borderRadius: BorderRadius.circular(12)),
            child: Text(note!, style: text.bodyMedium),
          ),
        ],
        if (onView != null || onDownload != null) ...[
          const SizedBox(height: 12),
          Row(children: [
            if (onView != null) Expanded(child: FilledButton.tonalIcon(onPressed: onView, icon: const Icon(Icons.visibility_outlined), label: const Text('View'))),
            if (onView != null && onDownload != null) const SizedBox(width: 10),
            if (onDownload != null) Expanded(child: OutlinedButton.icon(onPressed: onDownload, icon: const Icon(Icons.download_outlined), label: const Text('Download'))),
          ]),
        ],
      ]),
    );
  }
}

/// Slide-up request form: choose a certificate type, give a reason and submit.
class _CertificateRequestSheet extends StatefulWidget {
  final CollegeApi api;
  final List<Json> templates;
  final Set<String?> unavailable;
  final String? studentCode;
  const _CertificateRequestSheet({required this.api, required this.templates, required this.unavailable, this.studentCode});
  @override
  State<_CertificateRequestSheet> createState() => _CertificateRequestSheetState();
}

class _CertificateRequestSheetState extends State<_CertificateRequestSheet> {
  final form = GlobalKey<FormState>();
  final reason = TextEditingController();
  String? type, error;
  bool sending = false;

  @override
  void initState() {
    super.initState();
    type = widget.templates.map((t) => t['code']?.toString()).where((c) => !widget.unavailable.contains(c)).firstOrNull;
  }

  @override
  void dispose() { reason.dispose(); super.dispose(); }

  Future<void> submit() async {
    if (type == null) { setState(() => error = 'Choose the certificate you need.'); return; }
    if (!form.currentState!.validate()) return;
    setState(() { sending = true; error = null; });
    try {
      await widget.api.requestCertificate(type!, studentCode: widget.studentCode, reason: reason.text.trim());
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() { error = e.toString(); sending = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final accent = Theme.of(context).colorScheme.primary;
    return Padding(
      // Keeps the reason field and Submit above the keyboard.
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
                Text('Request a certificate', style: text.headlineSmall),
                const SizedBox(height: 4),
                Text('The college office reviews each request and notifies you when it is ready.', style: text.bodySmall),
                const SizedBox(height: 18),
                Text('Certificate type', style: text.titleSmall),
                const SizedBox(height: 8),
                for (final t in widget.templates)
                  Builder(builder: (context) {
                    final code = t['code']?.toString();
                    final blocked = widget.unavailable.contains(code);
                    final on = type == code;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Material(
                        color: on ? accent.withValues(alpha: .08) : collegeIvory,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: on ? accent : collegeLine, width: on ? 1.5 : 1)),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: blocked || sending ? null : () => setState(() { type = code; error = null; }),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Row(children: [
                              Icon(on ? Icons.radio_button_checked : Icons.radio_button_off, color: blocked ? collegeLine : accent),
                              const SizedBox(width: 12),
                              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('${t['name'] ?? 'Certificate'}', style: text.titleSmall?.copyWith(fontWeight: FontWeight.w700, color: blocked ? collegeMuted : collegeEspresso)),
                                if ('${t['description'] ?? ''}'.isNotEmpty) Text('${t['description']}', style: text.bodySmall),
                                if (blocked) Text('Already requested', style: text.labelMedium?.copyWith(color: collegeClayInk, fontWeight: FontWeight.w700)),
                              ])),
                            ]),
                          ),
                        ),
                      ),
                    );
                  }),
                const SizedBox(height: 10),
                TextFormField(
                  key: const ValueKey('certificate-reason'),
                  controller: reason,
                  enabled: !sending,
                  minLines: 3,
                  maxLines: 5,
                  maxLength: 500,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(labelText: 'Reason for the request', hintText: 'For example: needed for a scholarship application', alignLabelWithHint: true, errorMaxLines: 2),
                  validator: (v) => (v ?? '').trim().length < 10 ? 'Tell the office why you need it (at least 10 characters).' : null,
                ),
                if (error != null) ...[
                  const SizedBox(height: 8),
                  Text(error!, style: text.bodySmall?.copyWith(color: collegeError)),
                ],
                const SizedBox(height: 12),
                FilledButton.icon(
                  key: const ValueKey('submit-certificate-request'),
                  onPressed: sending ? null : submit,
                  icon: sending ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.send_rounded),
                  label: Text(sending ? 'Sending…' : 'Submit request'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class CertificatePdfScreen extends StatelessWidget {
  final Uint8List bytes;
  final String title;
  const CertificatePdfScreen({super.key, required this.bytes, required this.title});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(title), actions: [IconButton(tooltip: 'Download or share', onPressed: () async { final box = context.findRenderObject() as RenderBox?; await SharePlus.instance.share(ShareParams(files: [XFile.fromData(bytes, name: '$title.pdf', mimeType: 'application/pdf')], fileNameOverrides: ['$title.pdf'], sharePositionOrigin: box == null ? null : box.localToGlobal(Offset.zero) & box.size)); }, icon: const Icon(Icons.download_outlined))]), body: PdfViewer.data(bytes, sourceName: title));
}

/// In-app viewer for a document: PDFs in the PDF viewer, images pinch-to-zoom; download in the header.
class DocumentViewerScreen extends StatelessWidget {
  final Uint8List bytes;
  final String title, mime;
  const DocumentViewerScreen({super.key, required this.bytes, required this.title, required this.mime});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis), actions: [
      Builder(builder: (context) => IconButton(tooltip: 'Download or share', onPressed: () => _shareBytes(context, bytes, title, mime), icon: const Icon(Icons.download_outlined))),
    ]),
    body: mime.startsWith('image/')
        ? InteractiveViewer(maxScale: 5, child: Center(child: Image.memory(bytes, fit: BoxFit.contain)))
        : PdfViewer.data(bytes, sourceName: title),
  );
}
