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
  List<Json> requests = [], certificates = [], templates = [];
  bool busy = true, saving = false;
  String? error, template;
  bool get admin => widget.role == MobileRole.admin;

  @override
  void initState() { super.initState(); load(); }

  Future<void> load() async {
    setState(() { busy = true; error = null; });
    try {
      final result = Map<String, dynamic>.from(await widget.api.certificates(studentCode: widget.studentCode ?? '') as Map);
      final options = Map<String, dynamic>.from(await widget.api.certificateOptions() as Map);
      if (!mounted) return;
      setState(() { requests = (result['items'] as List? ?? []).cast<Json>(); certificates = (result['certificates'] as List? ?? []).cast<Json>(); templates = (options['templates'] as List? ?? []).cast<Json>(); template ??= templates.isEmpty ? null : templates.first['code']?.toString(); busy = false; });
    } catch (e) { if (mounted) setState(() { error = e.toString(); busy = false; }); }
  }

  Future<void> ask() async {
    if (template == null) return;
    setState(() => saving = true);
    try { await widget.api.requestCertificate(template!, studentCode: widget.studentCode); await load(); if (mounted) _toast('Certificate request sent. Administration has been notified.'); }
    catch (e) { if (mounted) _toast(e.toString()); }
    finally { if (mounted) setState(() => saving = false); }
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

  void _toast(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  @override
  Widget build(BuildContext context) {
    final issuedByRequest = {for (final c in certificates) c['request_code']?.toString(): c};
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeading(title: admin ? 'Certificate approvals' : 'My certificates'),
      if (!admin) ...[
        DropdownButtonFormField<String>(initialValue: template, decoration: const InputDecoration(labelText: 'Certificate type'), items: templates.map((t) => DropdownMenuItem(value: t['code']?.toString(), child: Text(t['name']?.toString() ?? 'Certificate'))).toList(), onChanged: saving ? null : (v) => setState(() => template = v)),
        const SizedBox(height: 8),
        FilledButton.icon(onPressed: saving ? null : ask, icon: const Icon(Icons.add), label: Text(saving ? 'Sending…' : 'Request certificate')),
        const SizedBox(height: 20),
      ],
      if (error != null) MaterialBanner(content: Text(error!), actions: [TextButton(onPressed: load, child: const Text('Retry'))]),
      if (busy) const Center(child: Padding(padding: EdgeInsets.all(28), child: CircularProgressIndicator())),
      if (!busy && requests.isEmpty) const QuietEmpty(icon: Icons.workspace_premium_outlined, title: 'No certificate requests', message: 'Requests and issued certificates will appear here.'),
      ...requests.map((row) {
        final certificate = issuedByRequest[row['code']?.toString()];
        final status = row['status']?.toString() ?? 'pending';
        return Card(margin: const EdgeInsets.only(bottom: 10), child: ExpansionTile(leading: Icon(status == 'issued' ? Icons.verified_outlined : status == 'rejected' ? Icons.cancel_outlined : Icons.pending_actions_outlined), title: Text(row['template_name']?.toString() ?? 'Certificate request'), subtitle: Text('${row['student_name'] ?? 'Student'} · ${status.toUpperCase()}'), childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16), children: [if (row['admission_number'] != null) Align(alignment: Alignment.centerLeft, child: Text('Admission number: ${row['admission_number']}')), if ((row['reason'] ?? '').toString().isNotEmpty) Align(alignment: Alignment.centerLeft, child: Text('Reason: ${row['reason']}')), if ((row['decision_message'] ?? '').toString().isNotEmpty) Align(alignment: Alignment.centerLeft, child: Padding(padding: const EdgeInsets.only(top: 8), child: Text(row['decision_message'].toString()))), if (certificate != null) Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: () => preview(certificate), icon: const Icon(Icons.picture_as_pdf_outlined), label: const Text('Preview / download certificate')))]));
      }),
      if (requests.any((r) => r['status'] == 'pending') && admin)
        ...requests.where((r) => r['status'] == 'pending').map((row) => Padding(padding: const EdgeInsets.only(bottom: 8), child: Row(children: [Expanded(child: OutlinedButton.icon(onPressed: saving ? null : () => decide(row, false), icon: const Icon(Icons.close), label: const Text('Reject'))), const SizedBox(width: 8), Expanded(child: FilledButton.icon(onPressed: saving ? null : () => decide(row, true), icon: const Icon(Icons.check), label: const Text('Approve & issue')))]))),
      if (requests.any((r) => r['status'] == 'rejected')) const Padding(padding: EdgeInsets.only(top: 8), child: Text('Rejected requests: Please contact the administrative chamber for certificates.')),
      OutlinedButton.icon(onPressed: busy ? null : load, icon: const Icon(Icons.refresh), label: const Text('Refresh certificates')),
    ]);
  }
}

class CertificatePdfScreen extends StatelessWidget {
  final Uint8List bytes;
  final String title;
  const CertificatePdfScreen({super.key, required this.bytes, required this.title});
  @override
  Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: Text(title), actions: [IconButton(tooltip: 'Download or share', onPressed: () async { final box = context.findRenderObject() as RenderBox?; await SharePlus.instance.share(ShareParams(files: [XFile.fromData(bytes, name: '$title.pdf', mimeType: 'application/pdf')], fileNameOverrides: ['$title.pdf'], sharePositionOrigin: box == null ? null : box.localToGlobal(Offset.zero) & box.size)); }, icon: const Icon(Icons.download_outlined))]), body: PdfViewer.data(bytes, sourceName: title));
}
