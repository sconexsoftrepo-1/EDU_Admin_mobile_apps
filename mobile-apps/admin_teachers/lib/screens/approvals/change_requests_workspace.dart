part of '../../app/edunexa_client.dart';

/// Edits staff made on the dashboard, waiting for the Super Admin: accept applies the change,
/// reject leaves the record as it was. Same list as the dashboard's Change requests screen.
class ChangeRequestsWorkspace extends StatefulWidget {
  final CollegeApi api;
  const ChangeRequestsWorkspace({super.key, required this.api});
  @override
  State<ChangeRequestsWorkspace> createState() => _ChangeRequestsWorkspaceState();
}

class _ChangeRequestsWorkspaceState extends State<ChangeRequestsWorkspace> {
  static const tabs = ['pending', 'accepted', 'rejected'];
  int tab = 0;
  List<Json> items = [];
  bool busy = true, canDecide = false;
  String? error, working;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = Map<String, dynamic>.from(await widget.api.editRequests() as Map);
      if (!mounted) return;
      setState(() {
        items = (result['items'] as List? ?? []).cast<Json>();
        canDecide = result['can_decide'] == true;
        busy = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e.toString();
          busy = false;
        });
      }
    }
  }

  bool inTab(Json r, int i) => i == 0 ? {'pending', 'applying'}.contains(r['status']) : r['status'] == tabs[i];

  void toast(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> decide(Json r, bool accept) async {
    String? note;
    if (!accept) {
      final controller = TextEditingController();
      final ok = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: const Text('Reject this change?'),
          content: TextField(
            controller: controller,
            maxLength: 500,
            decoration: const InputDecoration(labelText: 'Reason (optional)'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialog, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(dialog, true), child: const Text('Reject')),
          ],
        ),
      );
      if (ok != true) return;
      note = controller.text.trim();
    }
    setState(() => working = '${r['code']}');
    try {
      if (accept) {
        await widget.api.acceptEditRequest('${r['code']}', overNewer: (r['stale_fields'] as List? ?? []).isNotEmpty);
      } else {
        await widget.api.rejectEditRequest('${r['code']}', note: note);
      }
      await load();
      if (mounted) toast(accept ? 'Change accepted and applied.' : 'Change rejected. The record was not changed.');
    } catch (e) {
      if (mounted) toast(e.toString());
    } finally {
      if (mounted) setState(() => working = null);
    }
  }

  Widget card(Json r) {
    final text = Theme.of(context).textTheme;
    final changes = (r['changes'] as List? ?? []).cast<Json>();
    final stale = (r['stale_fields'] as List? ?? []).cast<Object>();
    final pending = r['status'] == 'pending';
    final when = DateTime.tryParse('${r['requested_at']}')?.toLocal();
    final decided = DateTime.tryParse('${r['decided_at'] ?? ''}')?.toLocal();
    return Card(
      key: ValueKey('change-${r['code']}'),
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('${r['target_label']}', style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          Text(
            [
              '${r['target_title']}',
              '${r['requester_name'] ?? 'Staff'}${r['requester_role'] != null ? ' (${r['requester_role']})' : ''}',
              if (when != null) prettyDate(when),
            ].join(' · '),
            style: text.bodySmall,
          ),
          const SizedBox(height: 10),
          if (changes.isEmpty) Text('An action on this record.', style: text.bodySmall),
          for (final c in changes)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${c['label']}', style: text.labelMedium?.copyWith(fontWeight: FontWeight.w700)),
                Text.rich(TextSpan(children: [
                  TextSpan(
                    text: '${c['from']}',
                    style: text.bodySmall?.copyWith(decoration: TextDecoration.lineThrough),
                  ),
                  const WidgetSpan(
                    alignment: PlaceholderAlignment.middle,
                    child: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 6),
                      child: Icon(Icons.arrow_forward_rounded, size: 14),
                    ),
                  ),
                  TextSpan(text: '${c['to']}', style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                ])),
              ]),
            ),
          if (pending && stale.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                'Changed since this request: ${stale.join(', ')}. Accepting replaces those newer values.',
                style: text.bodySmall?.copyWith(color: Theme.of(context).colorScheme.error),
              ),
            ),
          if ('${r['last_error'] ?? ''}'.isNotEmpty && pending)
            Text('Last attempt was not applied: ${r['last_error']}', style: text.bodySmall),
          if ('${r['decision_note'] ?? ''}'.isNotEmpty) Text('Note: ${r['decision_note']}', style: text.bodySmall),
          if (!pending && decided != null)
            Text('${r['status'] == 'accepted' ? 'Accepted' : 'Rejected'} ${prettyDate(decided)}', style: text.bodySmall),
          if (pending && canDecide) ...[
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: working != null ? null : () => decide(r, false),
                  icon: const Icon(Icons.close_rounded),
                  label: const Text('Reject'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  key: ValueKey('accept-change-${r['code']}'),
                  onPressed: working != null ? null : () => decide(r, true),
                  icon: const Icon(Icons.check_rounded),
                  label: Text(working == r['code'] ? 'Applying…' : stale.isNotEmpty ? 'Accept anyway' : 'Accept'),
                ),
              ),
            ]),
          ],
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (busy && items.isEmpty && error == null) return const EduCardSkeleton(height: 180);
    if (error != null && items.isEmpty) {
      return Column(children: [
        Text('Change requests could not be loaded.', style: Theme.of(context).textTheme.bodyMedium),
        TextButton(onPressed: load, child: const Text('Try again')),
      ]);
    }
    final shown = items.where((r) => inTab(r, tab)).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      EduPillTabs(
        labels: [
          for (var i = 0; i < tabs.length; i++)
            '${['Pending', 'Accepted', 'Rejected'][i]} (${items.where((r) => inTab(r, i)).length})',
        ],
        selected: tab,
        onSelected: (i) => setState(() => tab = i),
      ),
      const SizedBox(height: 14),
      if (shown.isEmpty)
        QuietEmpty(
          icon: Icons.fact_check_outlined,
          title: ['Nothing waiting', 'No accepted changes yet', 'No rejected changes'][tab],
          message: tab == 0 ? 'Edits staff make on the dashboard appear here for your approval.' : 'Decided requests are kept here.',
        ),
      ...shown.map(card),
    ]);
  }
}
