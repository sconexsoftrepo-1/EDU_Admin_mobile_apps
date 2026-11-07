part of '../../app/edunexa_client.dart';

/// Fee collection analytics for the admin: how much came in, by payment method, by semester
/// (students paid and amount) and by fee head, with a day-by-day progress chart.
class CollectionAnalyticsWorkspace extends StatefulWidget {
  final CollegeApi api;
  const CollectionAnalyticsWorkspace({super.key, required this.api});
  @override
  State<CollectionAnalyticsWorkspace> createState() => _CollectionAnalyticsWorkspaceState();
}

class _CollectionAnalyticsWorkspaceState extends State<CollectionAnalyticsWorkspace> {
  static const periods = ['Today', 'This week', 'This month', 'This year'];
  int period = 2;
  Json? data;
  String? error;
  bool busy = true;

  @override
  void initState() {
    super.initState();
    load();
  }

  String iso(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  (DateTime, DateTime) range() {
    final today = DateUtils.dateOnly(DateTime.now());
    return switch (period) {
      0 => (today, today),
      1 => (today.subtract(Duration(days: today.weekday - 1)), today),
      2 => (DateTime(today.year, today.month), today),
      _ => (DateTime(today.year), today),
    };
  }

  Future<void> load() async {
    setState(() {
      busy = true;
      error = null;
    });
    final (start, end) = range();
    try {
      final result = Map<String, dynamic>.from(await widget.api.feeAnalytics(start: iso(start), end: iso(end)) as Map);
      if (!mounted) return;
      setState(() {
        data = result;
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

  List<Json> list(String key) => (data?[key] as List? ?? []).cast<Json>();

  /// Rows of label · figure with a bar sized against the largest amount.
  Widget breakdown(String title, List<Json> rows, String Function(Json) label, {String Function(Json)? detail}) {
    final text = Theme.of(context).textTheme;
    final top = rows.fold<num>(0, (m, r) => math.max(m, num.tryParse('${r['amount']}') ?? 0));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      SectionHeading(title: title),
      if (rows.isEmpty)
        Text('No payments in this period.', style: text.bodySmall)
      else
        for (final r in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text(label(r), style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w600))),
                Text(money(r['amount']), style: text.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
              ]),
              if (detail != null) Text(detail(r), style: text.bodySmall),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  minHeight: 8,
                  value: top <= 0 ? 0 : (num.tryParse('${r['amount']}') ?? 0) / top,
                  backgroundColor: EduTints.mist,
                ),
              ),
            ]),
          ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final summary = (data?['summary'] as Map?)?.cast<String, dynamic>();
    final daily = list('daily');
    final peak = daily.fold<num>(0, (m, r) => math.max(m, num.tryParse('${r['amount']}') ?? 0));
    final shownDays = daily.length > 14 ? daily.sublist(daily.length - 14) : daily;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      EduPillTabs(
        labels: periods,
        selected: period,
        onSelected: (i) {
          setState(() => period = i);
          load();
        },
      ),
      const SizedBox(height: 14),
      if (error != null && data == null)
        Column(children: [
          Text('Analytics could not be loaded.', style: text.bodyMedium),
          TextButton(onPressed: load, child: const Text('Try again')),
        ])
      else ...[
        Row(children: [
          Expanded(
            child: EduStatCard(
              label: 'Collected',
              value: money(summary?['amount']),
              icon: Icons.savings_outlined,
              loading: busy && data == null,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: EduStatCard(
              label: 'Payments',
              value: '${summary?['payments'] ?? 0}',
              icon: Icons.receipt_long_outlined,
              tint: EduTints.gold,
              loading: busy && data == null,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: EduStatCard(
              label: 'Students',
              value: '${summary?['payers'] ?? 0}',
              icon: Icons.groups_outlined,
              tint: EduTints.mist,
              loading: busy && data == null,
            ),
          ),
        ]),
        if (shownDays.length > 1) ...[
          const SectionHeading(title: 'Collection progress'),
          EduPillBars(
            height: 150,
            bars: [
              for (final r in shownDays)
                ('${r['date']}'.substring(8), peak <= 0 ? 0 : ((num.tryParse('${r['amount']}') ?? 0) / peak * 100).round()),
            ],
          ),
        ],
        breakdown('By payment method', list('by_method'), (r) => '${r['label'] ?? r['method']}',
            detail: (r) => '${r['payments']} payment${r['payments'] == 1 ? '' : 's'}'),
        breakdown('By semester', list('by_semester'), (r) => '${r['label']}',
            detail: (r) => '${r['payers']} student${r['payers'] == 1 ? '' : 's'} paid · ${r['payments']} payments'),
        breakdown('By fee head', list('by_head').take(6).toList(), (r) => '${r['name']}'),
      ],
    ]);
  }
}
