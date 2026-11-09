part of '../../app/edunexa_client.dart';

/// "7 Nov 2026, 2:45 pm" in the phone's time zone, or null.
String? cashStamp(Object? value) {
  final at = DateTime.tryParse('${value ?? ''}')?.toLocal();
  if (at == null) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final hour = at.hour % 12 == 0 ? 12 : at.hour % 12;
  return '${at.day} ${months[at.month - 1]} ${at.year}, $hour:${at.minute.toString().padLeft(2, '0')} ${at.hour < 12 ? 'am' : 'pm'}';
}

/// One cash handover in full: what was handed over, deposited and accepted (with dates and times),
/// what is still in hand, whether cash was refunded to the admin, and each deposit's bank slip.
class DepositHistoryDetailsScreen extends StatelessWidget {
  final CollegeApi api;
  final Json transfer;
  const DepositHistoryDetailsScreen({super.key, required this.api, required this.transfer});

  static const _deposit = {
    'awaiting_proof': 'Slip not uploaded yet',
    'awaiting_review': 'Slip submitted · waiting for admin',
    'accepted': 'Accepted by admin',
    'rejected': 'Slip rejected',
  };

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final t = transfer;
    final deposits = (t['deposits'] as List? ?? []).cast<Json>();
    final returns = (t['returns'] as List? ?? []).cast<Json>();
    final refunded = num.tryParse('${t['returned_amount']}') ?? 0;
    final inHand = num.tryParse('${t['with_clerk']}') ?? 0;
    final accepted = deposits.where((d) => d['status'] == 'accepted').toList();
    Widget row(String label, String value, {bool strong = false}) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Text(label, style: text.bodyMedium?.copyWith(color: EduWorkspace.muted))),
            const SizedBox(width: 12),
            Flexible(
              child: Text(value,
                  textAlign: TextAlign.right,
                  style: strong ? text.titleSmall?.copyWith(fontWeight: FontWeight.w800) : text.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
            ),
          ]),
        );
    Widget card(String title, List<Widget> children) => Card(
          margin: const EdgeInsets.only(bottom: 14),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(title, style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              ...children,
            ]),
          ),
        );
    return Scaffold(
      appBar: AppBar(title: const Text('Deposit details')),
      body: ListView(
        key: const ValueKey('deposit-history-details'),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          card('Summary', [
            row('Handed over', money(t['amount'])),
            row('Deposited & accepted', money(t['accepted_amount']), strong: true),
            if ((num.tryParse('${t['pending_amount']}') ?? 0) > 0) row('Waiting for admin', money(t['pending_amount'])),
            row('Cash remaining in hand', money(inHand), strong: inHand > 0),
            row('Refunded to admin', refunded > 0 ? money(refunded) : 'Not refunded'),
            row('Status', switch ('${t['status']}') {
              'assigned' => 'Waiting to be collected',
              'collected' => 'Collected · deposit due',
              'deposited' => 'Deposited · slip to upload',
              'awaiting_review' => 'Slip with admin',
              'settled' => 'Completed',
              'cancelled' => 'Cancelled by admin',
              final other => other,
            }),
          ]),
          card('Dates & times', [
            row('Handed over', [cashStamp(t['assigned_at']), if (t['assigned_by_name'] != null) 'by ${t['assigned_by_name']}'].whereType<String>().join(' · ')),
            if (cashStamp(t['collected_at']) != null) row('Collected', cashStamp(t['collected_at'])!),
            for (final d in deposits) row('Deposited ${money(d['amount'])}', cashStamp(d['recorded_at']) ?? '${d['deposited_on']}'),
            for (final d in accepted) row('Accepted ${money(d['amount'])}', cashStamp(d['reviewed_at']) ?? '—'),
            for (final r in returns) row('Refunded ${money(r['amount'])}', cashStamp(r['recorded_at']) ?? '${r['returned_on']}'),
          ]),
          if (deposits.isEmpty)
            const QuietEmpty(icon: Icons.receipt_long_outlined, title: 'No deposit yet', message: 'Deposits and their bank slips appear here.'),
          for (final (i, d) in deposits.indexed)
            card('Deposit ${i + 1} · ${money(d['amount'])}', [
              row('Status', _deposit['${d['status']}'] ?? '${d['status']}'),
              row('Deposited on', '${d['deposited_on']}'),
              if ('${d['bank_reference'] ?? ''}'.isNotEmpty) row('Bank reference', '${d['bank_reference']}'),
              if (cashStamp(d['proof_uploaded_at']) != null) row('Slip uploaded', cashStamp(d['proof_uploaded_at'])!),
              if (cashStamp(d['reviewed_at']) != null)
                row(d['status'] == 'rejected' ? 'Rejected' : 'Reviewed',
                    [cashStamp(d['reviewed_at']), d['reviewed_by_name']].whereType<String>().join(' · ')),
              if ('${d['review_note'] ?? ''}'.isNotEmpty) row('Admin note', '${d['review_note']}'),
              const SizedBox(height: 8),
              Text('Proof of deposit', style: text.labelLarge?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              if (d['has_proof'] == true)
                CashSlipCard(api: api, transfer: '${t['code']}', deposit: d)
              else
                Text('No slip uploaded yet.', style: text.bodySmall),
              const SizedBox(height: 6),
            ]),
        ],
      ),
    );
  }
}

/// The bank slip at full width; tap to zoom.
class CashSlipCard extends StatelessWidget {
  final CollegeApi api;
  final String transfer;
  final Json deposit;
  const CashSlipCard({super.key, required this.api, required this.transfer, required this.deposit});

  @override
  Widget build(BuildContext context) {
    if ('${deposit['proof_mime'] ?? ''}' == 'application/pdf') {
      return const ListTile(contentPadding: EdgeInsets.zero, leading: Icon(Icons.picture_as_pdf_outlined), title: Text('PDF slip submitted'));
    }
    return FutureBuilder<Uint8List>(
      future: api.cashSlip(transfer, '${deposit['code']}'),
      builder: (context, snap) {
        final bytes = snap.data;
        if (bytes == null) {
          return Container(
            height: 160,
            decoration: BoxDecoration(color: EduTints.mist, borderRadius: BorderRadius.circular(14)),
            alignment: Alignment.center,
            child: snap.hasError ? const Text('The slip could not be loaded.') : const CircularProgressIndicator(),
          );
        }
        return Semantics(
          button: true,
          label: 'Open bank slip full screen',
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
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
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 320),
                child: Image.memory(bytes, key: const ValueKey('slip-card-image'), fit: BoxFit.contain, width: double.infinity),
              ),
            ),
          ),
        );
      },
    );
  }
}
