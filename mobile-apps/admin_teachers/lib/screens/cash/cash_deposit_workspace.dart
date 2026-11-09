part of '../../app/edunexa_client.dart';

/// Cash clerk: accept cash handed over by the admin, record what was deposited at the bank and
/// photograph the bank slip. The admin confirms the deposit on the dashboard.
class CashDepositWorkspace extends StatefulWidget {
  final CollegeApi api;
  const CashDepositWorkspace({super.key, required this.api});
  @override
  State<CashDepositWorkspace> createState() => _CashDepositWorkspaceState();
}

class _CashDepositWorkspaceState extends State<CashDepositWorkspace> {
  Json? overview;
  bool busy = true, saving = false;
  String? error;
  final picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    load();
  }

  List<Json> get transfers => (overview?['transfers'] as List? ?? [])
      .cast<Json>()
      .where((t) => t['clerk_account'] == overview?['account_code'])
      .toList();

  Future<void> load() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = Map<String, dynamic>.from(
        await widget.api.cashOverview() as Map,
      );
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

  void toast(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

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

  Future<void> deposited(Json transfer) async {
    final amount = TextEditingController(
      text: '${transfer['can_deposit'] ?? ''}'.replaceAll('.00', ''),
    );
    final reference = TextEditingController();
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheet) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          4,
          20,
          20 + MediaQuery.viewInsetsOf(sheet).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Amount deposited at the bank',
              style: Theme.of(sheet).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(
              'Enter exactly what you deposited. You can deposit up to ${money(transfer['can_deposit'])}.',
              style: Theme.of(sheet).textTheme.bodySmall,
            ),
            const SizedBox(height: 16),
            TextField(
              controller: amount,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
              ],
              decoration: const InputDecoration(
                labelText: 'Amount deposited (₹)',
                prefixText: '₹ ',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reference,
              decoration: const InputDecoration(
                labelText: 'Bank slip / reference number (optional)',
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => Navigator.pop(sheet, true),
              child: const Text('Mark as deposited'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    final value = num.tryParse(amount.text.trim());
    if (value == null || value <= 0) {
      toast('Enter the amount you deposited.');
      return;
    }
    final today = DateTime.now();
    await run(
      () => widget.api.cashDeposited('${transfer['code']}', {
        'amount': value.toStringAsFixed(2),
        'deposited_on':
            '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}',
        if (reference.text.trim().isNotEmpty)
          'bank_reference': reference.text.trim(),
      }),
      'Deposit recorded. Now upload the bank slip.',
    );
  }

  Future<void> uploadSlip(Json transfer, Json deposit) async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Capture bank slip'),
              onTap: () => Navigator.pop(sheet, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(sheet, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    // Kept small so the upload stays within the server's request limit.
    final photo = await picker.pickImage(
      source: source,
      maxWidth: 1400,
      maxHeight: 1400,
      imageQuality: 60,
    );
    if (photo == null) return;
    final bytes = await photo.readAsBytes();
    if (!mounted) return;
    if (bytes.length > 690000) {
      toast('The photo is too large. Take it again a little further away.');
      return;
    }
    // Show the slip first; nothing is sent until the clerk presses Submit.
    final choice = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Check the bank slip', style: Theme.of(sheet).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(
                'Make sure the amount, date and bank stamp are readable. Deposit of ${money(deposit['amount'])}.',
                style: Theme.of(sheet).textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(14),
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(sheet).height * .5),
                  child: Image.memory(bytes, key: const ValueKey('slip-preview'), fit: BoxFit.contain),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => Navigator.pop(sheet, 'retake'),
                      icon: const Icon(Icons.refresh_rounded),
                      label: const Text('Retake'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      key: const ValueKey('submit-slip'),
                      onPressed: () => Navigator.pop(sheet, 'submit'),
                      icon: const Icon(Icons.send_rounded),
                      label: const Text('Submit slip'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (choice == 'retake') return uploadSlip(transfer, deposit);
    if (choice != 'submit') return;
    await run(
      () => widget.api
          .cashDepositProof('${transfer['code']}', '${deposit['code']}', {
            'filename': photo.name,
            'mime_type': 'image/jpeg',
            'content_base64': base64Encode(bytes),
          }),
      'Slip submitted. The admin will confirm the deposit.',
    );
  }

  String statusText(String status) => switch (status) {
    'assigned' => 'Waiting for you to collect',
    'collected' => 'Collected · deposit at the bank',
    'deposited' => 'Deposited · upload the bank slip',
    'awaiting_review' => 'Slip sent · waiting for admin',
    'settled' => 'Completed',
    'cancelled' => 'Cancelled by admin',
    _ => status,
  };

  String depositText(String status) => switch (status) {
    'awaiting_proof' => 'Upload the bank slip',
    'awaiting_review' => 'Waiting for admin',
    'accepted' => 'Confirmed by admin',
    'rejected' => 'Slip rejected · upload again',
    _ => status,
  };

  Widget transferCard(Json t) {
    final text = Theme.of(context).textTheme;
    final status = '${t['status']}';
    final deposits = (t['deposits'] as List? ?? []).cast<Json>();
    final open = !{'assigned', 'cancelled', 'settled'}.contains(status);
    final room = num.tryParse('${t['can_deposit']}') ?? 0;
    // Finished handovers lead with what was actually deposited, not what was handed over.
    final finished = {'settled', 'cancelled'}.contains(status);
    return Card(
      key: ValueKey('transfer-${t['code']}'),
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).push<void>(MaterialPageRoute(
          builder: (_) => DepositHistoryDetailsScreen(api: widget.api, transfer: t),
        )),
        child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Amount and stage wrap onto two lines on narrow screens or large text.
            Wrap(
              spacing: 8,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  finished ? '${money(t['accepted_amount'])} deposited' : money(t['amount']),
                  style: text.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Chip(
                  label: Text(statusText(status), softWrap: true),
                  visualDensity: VisualDensity.compact,
                ),
              ],
            ),
            if (finished)
              Text(
                [
                  'of ${money(t['amount'])} handed over',
                  if ((num.tryParse('${t['returned_amount']}') ?? 0) > 0) '${money(t['returned_amount'])} refunded to admin',
                ].join(' · '),
                style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
            Text(
              'Assigned by ${t['assigned_by_name'] ?? 'admin'} · ${prettyDate(DateTime.parse('${t['assigned_at']}').toLocal())}',
              style: text.bodySmall,
            ),
            if ('${t['note'] ?? ''}'.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('${t['note']}', style: text.bodySmall),
              ),
            if (open) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 16,
                runSpacing: 4,
                children: [
                  Text(
                    'With you: ${money(t['with_clerk'])}',
                    style: text.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    'Confirmed deposits: ${money(t['accepted_amount'])}',
                    style: text.bodySmall,
                  ),
                ],
              ),
            ],
            for (final d in deposits)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: Icon(
                  d['status'] == 'accepted'
                      ? Icons.verified_outlined
                      : Icons.receipt_long_outlined,
                ),
                title: Text(
                  '${money(d['amount'])} deposited on ${d['deposited_on']}',
                ),
                subtitle: Text(
                  [
                    depositText('${d['status']}'),
                    if ('${d['review_note'] ?? ''}'.isNotEmpty)
                      '${d['review_note']}',
                  ].join(' · '),
                ),
                trailing: d['has_proof'] == true
                    ? CashSlipThumb(api: widget.api, transfer: '${t['code']}', deposit: d)
                    : null,
              ),
            for (final d in deposits.where((d) => {'awaiting_proof', 'rejected'}.contains(d['status'])))
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: FilledButton.tonalIcon(
                  key: ValueKey('upload-slip-${d['code']}'),
                  onPressed: saving ? null : () => uploadSlip(t, d),
                  icon: const Icon(Icons.photo_camera_outlined),
                  label: Text(d['status'] == 'rejected' ? 'Upload the slip again' : 'Upload bank slip'),
                ),
              ),
            const SizedBox(height: 8),
            if (status == 'assigned')
              FilledButton.icon(
                onPressed: saving
                    ? null
                    : () => run(
                        () => widget.api.cashCollect('${t['code']}'),
                        'Marked as collected.',
                      ),
                icon: const Icon(Icons.how_to_reg_outlined),
                label: const Text('Accept · I have collected this cash'),
              ),
            if (open && room > 0)
              FilledButton.icon(
                onPressed: saving ? null : () => deposited(t),
                icon: const Icon(Icons.account_balance_outlined),
                label: const Text('Deposited at bank'),
              ),
          ],
        ),
      ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (busy && overview == null) return const EduCardSkeleton(height: 180);
    if (error != null && overview == null) {
      return Column(
        children: [
          Text(
            'Cash deposits could not be loaded.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          TextButton(onPressed: load, child: const Text('Try again')),
        ],
      );
    }
    final all = transfers;
    final active = all
        .where((t) => !{'settled', 'cancelled'}.contains(t['status']))
        .toList();
    final history = all
        .where((t) => {'settled', 'cancelled'}.contains(t['status']))
        .toList();
    final toUpload = active.fold<int>(
      0,
      (n, t) =>
          n +
          (t['deposits'] as List? ?? [])
              .where(
                (d) => {'awaiting_proof', 'rejected'}.contains(d['status']),
              )
              .length,
    );
    return RefreshIndicator(
      onRefresh: load,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: EduStatCard(
                  label: 'Cash with you',
                  value: money(overview?['my_in_hand']),
                  icon: Icons.account_balance_wallet_outlined,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: EduStatCard(
                  label: 'Slips to upload',
                  value: '$toUpload',
                  icon: Icons.receipt_long_outlined,
                  tint: EduTints.gold,
                ),
              ),
            ],
          ),
          const SectionHeading(title: 'Cash to deposit'),
          if (active.isEmpty)
            Text(
              'Nothing assigned to you right now.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ...active.map(transferCard),
          if (history.isNotEmpty) ...[
            const SectionHeading(title: 'Deposit history'),
            Text('Tap a deposit for its details and bank slip.', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            ...history.map(transferCard),
          ],
        ],
      ),
    );
  }
}


/// A bank slip a clerk submitted: small preview that opens full screen.
class CashSlipThumb extends StatelessWidget {
  final CollegeApi api;
  final String transfer;
  final Json deposit;
  final double size;
  const CashSlipThumb({super.key, required this.api, required this.transfer, required this.deposit, this.size = 52});

  @override
  Widget build(BuildContext context) {
    if ('${deposit['proof_mime'] ?? ''}' == 'application/pdf') {
      return const Tooltip(message: 'PDF slip submitted', child: Icon(Icons.picture_as_pdf_outlined));
    }
    return FutureBuilder<Uint8List>(
      future: api.cashSlip(transfer, '${deposit['code']}'),
      builder: (context, snap) {
        final bytes = snap.data;
        final box = ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: SizedBox(
            width: size,
            height: size,
            child: bytes == null
                ? ColoredBox(
                    color: EduTints.mist,
                    child: Icon(snap.hasError ? Icons.broken_image_outlined : Icons.receipt_long_outlined, size: 20),
                  )
                : Image.memory(bytes, fit: BoxFit.cover),
          ),
        );
        if (bytes == null) return box;
        return Semantics(
          button: true,
          label: 'Open bank slip',
          child: InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: () => showDialog<void>(
              context: context,
              builder: (dialog) => Dialog.fullscreen(
                backgroundColor: Colors.black,
                child: Stack(children: [
                  Positioned.fill(child: InteractiveViewer(child: Center(child: Image.memory(bytes)))),
                  SafeArea(
                    child: Align(
                      alignment: Alignment.topRight,
                      child: IconButton(
                        tooltip: 'Close',
                        color: Colors.white,
                        onPressed: () => Navigator.pop(dialog),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ),
                  ),
                ]),
              ),
            ),
            child: box,
          ),
        );
      },
    );
  }
}
