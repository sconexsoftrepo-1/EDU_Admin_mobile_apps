part of '../../app/edunexa_client.dart';

/// Admin side of clerk cash: hand cash to a clerk, see each handover's stage, check the bank slip
/// a clerk submitted and accept or reject it, and record cash a clerk gives back.
class AdminCashWorkspace extends StatefulWidget {
  final CollegeApi api;
  const AdminCashWorkspace({super.key, required this.api});
  @override
  State<AdminCashWorkspace> createState() => _AdminCashWorkspaceState();
}

class _AdminCashWorkspaceState extends State<AdminCashWorkspace> {
  Json? overview;
  bool busy = true, saving = false;
  String? error;

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
      final result = Map<String, dynamic>.from(await widget.api.cashOverview() as Map);
      if (!mounted) return;
      setState(() {
        overview = result;
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

  void toast(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> run(Future<void> Function() action, String done) async {
    setState(() => saving = true);
    try {
      await action();
      await load();
      if (mounted) toast(done);
    } catch (e) {
      if (mounted) toast(e.toString());
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  List<Json> get transfers => (overview?['transfers'] as List? ?? []).cast<Json>();
  List<Json> get clerks => (overview?['clerks'] as List? ?? []).cast<Json>();

  String today() {
    final d = DateTime.now();
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  /// Bottom sheet with fields; returns the entered values or null when dismissed.
  Future<Map<String, String>?> sheet({
    required String title,
    required String help,
    required String submit,
    required List<(String key, String label, bool number)> fields,
    Widget? top,
    Map<String, String> initial = const {},
  }) {
    final controllers = {for (final f in fields) f.$1: TextEditingController(text: initial[f.$1] ?? '')};
    return showModalBottomSheet<Map<String, String>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheet) => Padding(
        padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + MediaQuery.viewInsetsOf(sheet).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: Theme.of(sheet).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(help, style: Theme.of(sheet).textTheme.bodySmall),
            if (top != null) ...[const SizedBox(height: 14), top],
            for (final f in fields) ...[
              const SizedBox(height: 12),
              TextField(
                controller: controllers[f.$1],
                keyboardType: f.$3 ? const TextInputType.numberWithOptions(decimal: true) : TextInputType.text,
                inputFormatters: f.$3 ? [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))] : null,
                decoration: InputDecoration(labelText: f.$2, prefixText: f.$3 ? '₹ ' : null),
              ),
            ],
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => Navigator.pop(sheet, {for (final e in controllers.entries) e.key: e.value.text.trim()}),
              child: Text(submit),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> handOver() async {
    if (clerks.isEmpty) {
      toast('No cash clerk login exists yet. Create one with the Cash Clerk role.');
      return;
    }
    var clerk = '${clerks.first['account_code']}';
    final values = await sheet(
      title: 'Hand cash to a clerk',
      help: 'Cash with you now: ${money(overview?['with_admin'])}. The clerk is notified to collect it.',
      submit: 'Hand over cash',
      top: StatefulBuilder(
        builder: (context, setLocal) => DropdownButtonFormField<String>(
          initialValue: clerk,
          decoration: const InputDecoration(labelText: 'Clerk'),
          items: [
            for (final c in clerks) DropdownMenuItem(value: '${c['account_code']}', child: Text('${c['name']}')),
          ],
          onChanged: (v) => setLocal(() => clerk = v ?? clerk),
        ),
      ),
      fields: [('amount', 'Amount (₹)', true), ('note', 'Note (optional)', false)],
    );
    if (values == null) return;
    final amount = num.tryParse(values['amount'] ?? '');
    if (amount == null || amount <= 0) return toast('Enter the amount to hand over.');
    await run(
      () => widget.api.cashAssign(clerk, amount.toStringAsFixed(2), note: values['note']),
      'Cash handed over. The clerk has been notified.',
    );
  }

  Future<void> reject(Json transfer, Json deposit) async {
    final values = await sheet(
      title: 'Reject the bank slip',
      help: 'Tell the clerk what is wrong; they will upload the slip again.',
      submit: 'Reject slip',
      fields: [('note', 'Reason', false)],
    );
    if (values == null) return;
    if ((values['note'] ?? '').isEmpty) return toast('Give the reason for rejecting the slip.');
    await run(
      () => widget.api.cashReview('${transfer['code']}', '${deposit['code']}', 'reject', note: values['note']),
      'Slip rejected. The clerk has been notified.',
    );
  }

  Future<void> recordReturn(Json transfer) async {
    final room = '${transfer['can_deposit'] ?? '0'}'.replaceAll('.00', '');
    final values = await sheet(
      title: 'Cash returned by the clerk',
      help: 'Record cash ${transfer['clerk_name']} gave back instead of depositing (at most ${money(transfer['can_deposit'])}).',
      submit: 'Record return',
      fields: [('amount', 'Amount returned (₹)', true)],
      initial: {'amount': room},
    );
    if (values == null) return;
    final amount = num.tryParse(values['amount'] ?? '');
    if (amount == null || amount <= 0) return toast('Enter the amount returned.');
    await run(() => widget.api.cashReturn('${transfer['code']}', amount.toStringAsFixed(2), today()), 'Return recorded.');
  }

  String stage(String status) => switch (status) {
    'assigned' => 'Waiting for the clerk to collect',
    'collected' => 'With the clerk · bank deposit due',
    'deposited' => 'Deposited · slip not yet submitted',
    'awaiting_review' => 'Slip submitted · review it',
    'settled' => 'Completed',
    'cancelled' => 'Cancelled',
    _ => status,
  };

  Widget reviewCard(Json t, Json d) {
    final text = Theme.of(context).textTheme;
    return Card(
      key: ValueKey('review-${d['code']}'),
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(money(d['amount']), style: text.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                Text('${t['clerk_name']} · deposited ${d['deposited_on']}', style: text.bodySmall),
                if ('${d['bank_reference'] ?? ''}'.isNotEmpty) Text('Reference ${d['bank_reference']}', style: text.bodySmall),
              ]),
            ),
            CashSlipThumb(api: widget.api, transfer: '${t['code']}', deposit: d, size: 84),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: saving ? null : () => reject(t, d),
                icon: const Icon(Icons.close_rounded),
                label: const Text('Reject'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                key: ValueKey('accept-${d['code']}'),
                onPressed: saving
                    ? null
                    : () => run(
                          () => widget.api.cashReview('${t['code']}', '${d['code']}', 'accept'),
                          'Deposit accepted. The clerk has been notified.',
                        ),
                icon: const Icon(Icons.check_rounded),
                label: const Text('Accept'),
              ),
            ),
          ]),
        ]),
      ),
    );
  }

  Widget transferCard(Json t) {
    final text = Theme.of(context).textTheme;
    final status = '${t['status']}';
    final open = !{'assigned', 'cancelled', 'settled'}.contains(status);
    final room = num.tryParse('${t['can_deposit']}') ?? 0;
    final assigned = DateTime.tryParse('${t['assigned_at']}')?.toLocal();
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push<void>(MaterialPageRoute(
          builder: (_) => DepositHistoryDetailsScreen(api: widget.api, transfer: t),
        )),
        child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Text('${money(t['amount'])} · ${t['clerk_name']}',
                  style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            ),
            if (status == 'assigned')
              TextButton(
                onPressed: saving ? null : () => run(() => widget.api.cashCancel('${t['code']}'), 'Handover cancelled.'),
                child: const Text('Cancel'),
              ),
          ]),
          Text(stage(status), style: text.bodyMedium),
          Text(
            [
              if (assigned != null) 'Handed over ${prettyDate(assigned)}',
              if (open) 'with the clerk ${money(t['with_clerk'])}',
              if ((num.tryParse('${t['accepted_amount']}') ?? 0) > 0) 'deposited ${money(t['accepted_amount'])}',
              if ((num.tryParse('${t['returned_amount']}') ?? 0) > 0) 'refunded ${money(t['returned_amount'])}',
            ].join(' · '),
            style: text.bodySmall,
          ),
          if (open && room > 0)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: saving ? null : () => recordReturn(t),
                icon: const Icon(Icons.undo_rounded, size: 18),
                label: const Text('Record cash returned'),
              ),
            ),
        ]),
      ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (busy && overview == null) return const EduCardSkeleton(height: 180);
    if (error != null && overview == null) {
      return Column(children: [
        Text('Cash records could not be loaded.', style: Theme.of(context).textTheme.bodyMedium),
        TextButton(onPressed: load, child: const Text('Try again')),
      ]);
    }
    final reviews = [
      for (final t in transfers)
        for (final d in (t['deposits'] as List? ?? []).cast<Json>())
          if (d['status'] == 'awaiting_review') (t, d),
    ];
    final active = transfers.where((t) => !{'settled', 'cancelled'}.contains(t['status'])).toList();
    final done = transfers.where((t) => {'settled', 'cancelled'}.contains(t['status'])).take(10).toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(
          child: EduStatCard(label: 'Cash with you', value: money(overview?['with_admin']), icon: Icons.account_balance_wallet_outlined),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: EduStatCard(
            label: 'With clerks',
            value: money(overview?['with_clerks']),
            icon: Icons.badge_outlined,
            tint: EduTints.gold,
          ),
        ),
      ]),
      const SizedBox(height: 12),
      FilledButton.icon(
        key: const ValueKey('hand-over-cash'),
        onPressed: saving ? null : handOver,
        icon: const Icon(Icons.send_to_mobile_outlined),
        label: const Text('Hand cash to a clerk'),
      ),
      SectionHeading(title: 'Slips to review${reviews.isEmpty ? '' : ' (${reviews.length})'}'),
      if (reviews.isEmpty)
        const QuietEmpty(
          icon: Icons.fact_check_outlined,
          title: 'No slips waiting',
          message: 'When a clerk submits a bank slip you are notified and it appears here.',
        ),
      for (final (t, d) in reviews) reviewCard(t, d),
      const SectionHeading(title: 'Cash with clerks'),
      if (active.isEmpty)
        const QuietEmpty(icon: Icons.payments_outlined, title: 'No open handovers', message: 'Cash you hand to a clerk is tracked here.'),
      ...active.map(transferCard),
      if (done.isNotEmpty) ...[
        const SectionHeading(title: 'Completed'),
        ...done.map(transferCard),
      ],
    ]);
  }
}
