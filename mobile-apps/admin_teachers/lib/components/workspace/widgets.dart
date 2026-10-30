part of '../../app/edunexa_client.dart';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
String prettyDate(DateTime d) =>
    '${d.day} ${monthNames[d.month - 1]} ${d.year}';
DateTime? eventStart(Json r) =>
    DateTime.tryParse('${r['starts_at'] ?? r['date'] ?? ''}')?.toLocal();
DateTime? eventEnd(Json r) =>
    DateTime.tryParse('${r['ends_at'] ?? r['starts_at'] ?? ''}')?.toLocal();
String money(dynamic value) {
  final n = num.tryParse('$value');
  if (n == null) return '—';
  final parts = n.abs().toStringAsFixed(2).split('.');
  final digits = parts.first;
  final groups = <String>[];
  var end = digits.length;
  var group = 3;
  while (end > 0) {
    final start = (end - group).clamp(0, end);
    groups.insert(0, digits.substring(start, end));
    end = start;
    group = 2;
  }
  return '${n < 0 ? '−' : ''}₹${groups.join(',')}${parts[1] == '00' ? '' : '.${parts[1]}'}';
}

String emptyTitle(String screen) => switch (screen) {
  'notifications' => 'All caught up',
  'calendar' => 'No events on this day',
  'timetable' => 'No classes on this day',
  'payments' || 'collections' => 'No payments yet',
  'assignments' => 'No assignments yet',
  'messages' => 'Start a conversation',
  'fees' => 'No fee charges to display',
  'leave' => 'No leave requests yet',
  _ => 'Nothing here yet',
};
String emptyDescription(String screen) => switch (screen) {
  'notifications' => 'Important alerts and college updates will appear here.',
  'calendar' => 'Choose another day or check back for college updates.',
  'timetable' => 'Select another date to see your class schedule.',
  'payments' ||
  'collections' => 'Confirmed payments and receipt downloads appear here.',
  'messages' =>
    'Use the message form to contact someone connected to your college profile.',
  'fees' =>
    'Assigned fees and outstanding balances appear here when published by the college.',
  _ =>
    'College records will appear here when they are available. Pull down to refresh.',
};
IconData actionIcon(String key) => switch (key) {
  'make_payment' => Icons.lock_outline,
  'send_message' || 'start_thread' => Icons.send_outlined,
  'change_password' => Icons.password_outlined,
  'request_leave' || 'request_student_leave' => Icons.event_available_outlined,
  'record_attendance' => Icons.fact_check_outlined,
  _ => Icons.add,
};

class SectionHeading extends StatelessWidget {
  final String title;
  final String? action;
  final VoidCallback? onAction;
  const SectionHeading({
    super.key,
    required this.title,
    this.action,
    this.onAction,
  });
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 24, bottom: 14),
    child: Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 12,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        if (action != null)
          TextButton(onPressed: onAction, child: Text(action!)),
      ],
    ),
  );
}

class QuietEmpty extends StatelessWidget {
  final IconData icon;
  final String title, message;
  const QuietEmpty({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(22),
    margin: const EdgeInsets.symmetric(vertical: 8),
    decoration: BoxDecoration(
      border: Border.all(color: collegeLine),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EduArtwork(
          name: switch (icon) {
            Icons.assignment_outlined => 'empty_states/no_assignments',
            Icons.notifications_outlined => 'empty_states/no_notifications',
            Icons.chat_bubble_outline => 'empty_states/no_messages',
            Icons.quiz_outlined => 'empty_states/no_results',
            Icons.calendar_month_outlined ||
            Icons.event_outlined ||
            Icons.event_available_outlined ||
            Icons.wb_sunny_outlined => 'empty_states/no_events',
            Icons.cloud_off_outlined => 'empty_states/no_internet',
            _ => 'empty_states/no_documents',
          },
          height: 76,
        ),
        const SizedBox(height: 14),
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        Text(message, style: Theme.of(context).textTheme.bodySmall),
      ],
    ),
  );
}

class MetricStrip extends StatelessWidget {
  final List<(String, String, IconData)> metrics;
  const MetricStrip({super.key, required this.metrics});
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      final width =
          c.maxWidth < 330 || MediaQuery.textScalerOf(context).scale(14) > 20
          ? c.maxWidth
          : (c.maxWidth - 12) / 2;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: metrics
            .map(
              (m) => Container(
                width: width,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: collegeIvory,
                  border: Border.all(color: collegeLine),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      m.$3,
                      color: Theme.of(context).colorScheme.primary,
                      size: 20,
                    ),
                    const SizedBox(height: 14),
                    AnimatedSwitcher(
                      duration: EduMotion.duration(context, EduMotion.tab),
                      child: Text(
                        m.$2,
                        key: ValueKey(m.$2),
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(m.$1, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
            )
            .toList(),
      );
    },
  );
}

class SummaryPanel extends StatelessWidget {
  final Json summary;
  final bool financial, compact;
  const SummaryPanel({
    super.key,
    required this.summary,
    this.financial = false,
    this.compact = false,
  });
  @override
  Widget build(BuildContext context) {
    final values = summary['totals'] is Map
        ? Map<String, dynamic>.from(summary['totals'])
        : summary;
    final metrics = <(String, String, IconData)>[];
    final ordered = [
      'outstanding',
      'paid',
      'gross',
      ...values.keys.where(
        (k) => ![
          'outstanding',
          'paid',
          'gross',
          'currency',
          'student_code',
        ].contains(k),
      ),
    ];
    for (final key in ordered) {
      final value = values[key];
      if (value == null || value is Map || value is List) continue;
      final currency =
          financial &&
          num.tryParse('$value') != null &&
          key != 'count' &&
          !key.endsWith('_count');
      metrics.add((
        key == 'outstanding'
            ? 'Outstanding balance'
            : key == 'paid'
            ? 'Fees paid'
            : label(key),
        currency ? money(value) : display(value),
        key == 'paid'
            ? Icons.check_circle_outline
            : Icons.account_balance_wallet_outlined,
      ));
    }
    if (compact) {
      {
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: MetricStrip(metrics: metrics.take(2).toList()),
        );
      }
    }
    final paid = num.tryParse('${values['paid']}') ?? 0;
    final outstanding = num.tryParse('${values['outstanding']}') ?? 0;
    final total = paid + outstanding;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (financial && values.containsKey('outstanding')) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: collegeEspresso,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Outstanding balance',
                    style: TextStyle(color: Colors.white70),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    money(outstanding),
                    style: const TextStyle(
                      color: collegeIvory,
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 18),
                  LinearProgressIndicator(
                    value: total <= 0
                        ? 0
                        : (paid / total).clamp(0, 1).toDouble(),
                    color: collegeGold,
                    backgroundColor: Colors.white24,
                    minHeight: 6,
                    borderRadius: BorderRadius.circular(4),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    '${money(paid)} paid of ${money(total)} net fees',
                    style: const TextStyle(color: Colors.white70),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            MetricStrip(
              metrics: metrics
                  .where((m) => m.$1 != 'Outstanding balance')
                  .take(2)
                  .toList(),
            ),
            ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: const Text('Fee breakdown'),
              children: [
                ...metrics
                    .skip(3)
                    .map(
                      (m) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(m.$1),
                        trailing: Text(m.$2),
                      ),
                    ),
              ],
            ),
          ] else
            MetricStrip(metrics: metrics),
          ...values.entries
              .where((e) => e.value is Map)
              .map(
                (e) => ExpansionTile(
                  title: Text(label(e.key)),
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Text(display(e.value)),
                    ),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

class AttendanceSummary extends StatelessWidget {
  final List<Json> items;
  const AttendanceSummary({super.key, required this.items});
  @override
  Widget build(BuildContext context) {
    final present = items
        .where((r) => r['status'] == 'present' || r['status'] == 'late')
        .length;
    final percentage = items.isEmpty ? null : present / items.length;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.fact_check_outlined),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Attendance · loaded records',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Text(
              percentage == null
                  ? 'No attendance recorded'
                  : '${(percentage * 100).toStringAsFixed(0)}% of loaded records',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            EduProgress(value: percentage ?? 0, color: collegePine),
            const SizedBox(height: 10),
            Text(
              '$present present or late / ${items.length} loaded records',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class ProfileHeader extends StatelessWidget {
  final Json record;
  final String role;
  const ProfileHeader({super.key, required this.record, required this.role});
  @override
  Widget build(BuildContext context) {
    final name = [
      record['first_name'],
      record['last_name'],
    ].where((v) => v != null).join(' ');
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 30,
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              child: Text(
                name.isEmpty ? role[0] : name[0],
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              name.isEmpty ? role : name,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            RolePill(role: role),
            if (record['email'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(record['email']),
              ),
          ],
        ),
      ),
    );
  }
}

class CampusRecord extends StatelessWidget {
  final Json record;
  final String screen;
  final VoidCallback? onTap, onDownload, onRead, onPrimary;
  final String? primaryLabel;
  const CampusRecord({
    super.key,
    required this.record,
    required this.screen,
    this.onTap,
    this.onDownload,
    this.onRead,
    this.onPrimary,
    this.primaryLabel,
  });
  String get title {
    if (screen == 'leave') return 'Leave request';
    if (screen == 'payslips') return 'Salary statement';
    if (screen == 'payments' || screen == 'collections') {
      return 'Payment ${record['transaction_reference'] ?? record['code'] ?? ''}';
    }
    if (screen == 'attendance') {
      return (record['student_name'] ??
              record['subject'] ??
              'Attendance record')
          .toString();
    }
    if (screen == 'results' && record['subject'] == null) return 'Exam result';
    for (final key in [
      'title',
      'subject',
      'name',
      'fee_head',
      'description',
      'receipt_number',
      'admission_number',
      'first_name',
      'code',
    ]) {
      final value = record[key];
      if (value != null && value.toString().isNotEmpty) {
        {
          return key == 'first_name'
              ? '$value ${record['last_name'] ?? ''}'
              : value.toString();
        }
      }
    }
    return label(screen);
  }

  @override
  Widget build(BuildContext context) {
    final status = record['status'] ?? record['event_type'] ?? record['grade'];
    final amount =
        record['outstanding'] ??
        record['amount'] ??
        record['net_pay'] ??
        record['net_amount'];
    final unread = screen == 'notifications' && record['status'] != 'read';
    final detail =
        record['body'] ??
        record['instructions'] ??
        record['reason'] ??
        record['designation'];
    final date =
        record['starts_at'] ??
        record['paid_on'] ??
        record['due_at'] ??
        record['start_date'] ??
        record['session_date'] ??
        record['sent_at'] ??
        record['published_at'];
    final directory = {
      'students',
      'employees',
      'children',
      'profile',
    }.contains(screen);
    final audit = screen == 'activity';
    return EduPress(
      child: Card(
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: onTap ?? () => showDetails(context),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (directory)
                      CircleAvatar(
                        backgroundColor: collegeCard,
                        foregroundColor: collegePine,
                        child: Text(
                          title.isEmpty
                              ? '?'
                              : title.substring(0, 1).toUpperCase(),
                        ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: audit ? const Color(0xffe1e7d9) : collegeCard,
                          borderRadius: BorderRadius.circular(audit ? 24 : 12),
                        ),
                        child: EduModuleIcon(
                          icon: moduleIcon(screen),
                          size: 21,
                        ),
                      ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  fontSize: 15,
                                  fontWeight: unread
                                      ? FontWeight.w800
                                      : FontWeight.w600,
                                ),
                          ),
                          if (date != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                friendlyValue(date),
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                          if (directory)
                            Text(
                              '${record['admission_number'] ?? record['employee_type'] ?? record['email'] ?? ''}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          if (audit)
                            Text(
                              '${record['action'] ?? ''} ${record['resource'] ?? ''}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 4),
                    if (unread)
                      const Badge()
                    else
                      const Icon(
                        Icons.chevron_right,
                        size: 18,
                        color: collegeMuted,
                      ),
                  ],
                ),
                if (detail != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      '$detail',
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: collegeMuted, height: 1.5),
                    ),
                  ),
                if (record['start_time'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      children: [
                        const Icon(
                          Icons.schedule_outlined,
                          size: 17,
                          color: collegePine,
                        ),
                        Text(
                          '${record['start_time']} – ${record['end_time'] ?? ''}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        if (periodDuration(record) != null)
                          Text(
                            periodDuration(record)!,
                            style: const TextStyle(color: collegeMuted),
                          ),
                        if (record['section_code'] != null)
                          Text(
                            '${record['section_code']}',
                            style: const TextStyle(color: collegeMuted),
                          ),
                      ],
                    ),
                  ),
                if (screen == 'results' && record['marks'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      'Marks  ${record['marks']}',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                if (screen == 'assignments' && record['my_submission'] != null)
                  const Padding(
                    padding: EdgeInsets.only(top: 10),
                    child: StatusBadge(status: 'submitted'),
                  ),
                if (amount != null || status != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Wrap(
                      spacing: 12,
                      runSpacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        if (amount != null)
                          Text(
                            money(amount),
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                        if (status != null)
                          StatusBadge(status: status.toString()),
                      ],
                    ),
                  ),
                if (onDownload != null || onRead != null || onPrimary != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (onPrimary != null)
                          FilledButton.tonal(
                            onPressed: onPrimary,
                            child: Text(primaryLabel ?? 'Continue'),
                          ),
                        if (onRead != null)
                          TextButton.icon(
                            onPressed: onRead,
                            icon: const Icon(Icons.done_all, size: 18),
                            label: const Text('Mark as read'),
                          ),
                        if (onDownload != null)
                          OutlinedButton.icon(
                            onPressed: onDownload,
                            icon: const Icon(Icons.download_outlined, size: 18),
                            label: const Text('Download / share PDF'),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void showDetails(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    useSafeArea: true,
    sheetAnimationStyle: AnimationStyle(
      duration: EduMotion.duration(context, const Duration(milliseconds: 300)),
      reverseDuration: EduMotion.duration(
        context,
        const Duration(milliseconds: 240),
      ),
    ),
    builder: (context) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: .76,
      maxChildSize: .95,
      minChildSize: .35,
      builder: (context, controller) => SingleChildScrollView(
        controller: controller,
        padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
        child: EduRecordDetails(title: title, record: record),
      ),
    ),
  );
}

String friendlyValue(dynamic value) {
  if (value is String) {
    final date = DateTime.tryParse(value);
    if (date != null && value.contains('-')) {
      final local = date.toLocal();
      return '${prettyDate(local)}${value.contains('T') ? ' • ${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}' : ''}';
    }
  }
  return display(value);
}

class StatusBadge extends StatelessWidget {
  final String status;
  const StatusBadge({super.key, required this.status});
  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();
    final color =
        {
          'paid',
          'approved',
          'present',
          'published',
          'read',
          'active',
          'submitted',
        }.contains(normalized)
        ? collegePine
        : {'failed', 'absent', 'rejected', 'overdue'}.contains(normalized)
        ? collegeError
        : collegeCaramel;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .09),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label(status),
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class CampusCalendar extends StatelessWidget {
  final DateTime month, selected;
  final List<Json> events;
  final ValueChanged<DateTime> onMonth, onDay;
  const CampusCalendar({
    super.key,
    required this.month,
    required this.selected,
    required this.events,
    required this.onMonth,
    required this.onDay,
  });
  @override
  Widget build(BuildContext context) {
    final first = DateTime(month.year, month.month);
    final count = DateTime(month.year, month.month + 1, 0).day;
    final offset = first.weekday - 1;
    final cells = ((count + offset) / 7).ceil() * 7;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              children: [
                IconButton(
                  tooltip: 'Previous month',
                  onPressed: () =>
                      onMonth(DateTime(month.year, month.month - 1)),
                  icon: const Icon(Icons.chevron_left),
                ),
                Expanded(
                  child: Text(
                    '${monthNames[month.month - 1]} ${month.year}',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                IconButton(
                  tooltip: 'Next month',
                  onPressed: () =>
                      onMonth(DateTime(month.year, month.month + 1)),
                  icon: const Icon(Icons.chevron_right),
                ),
              ],
            ),
            TextButton(
              onPressed: () {
                final now = DateUtils.dateOnly(DateTime.now());
                onMonth(DateTime(now.year, now.month));
                onDay(now);
              },
              child: const Text('Today'),
            ),
            Row(
              children: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
                  .map(
                    (v) => Expanded(
                      child: Center(
                        child: Text(
                          v,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 8),
            LayoutBuilder(
              builder: (context, c) => Wrap(
                children: List.generate(cells, (index) {
                  final day = index - offset + 1;
                  if (day < 1 || day > count) {
                    {
                      return SizedBox(
                        width: c.maxWidth / 7,
                        height: MediaQuery.textScalerOf(
                          context,
                        ).scale(24).clamp(52.0, 100.0),
                      );
                    }
                  }
                  final date = DateTime(month.year, month.month, day);
                  final active = DateUtils.isSameDay(date, selected);
                  final event = events.any((e) {
                    final start = eventStart(e), end = eventEnd(e);
                    return start != null &&
                        !date.isBefore(DateUtils.dateOnly(start)) &&
                        !date.isAfter(DateUtils.dateOnly(end ?? start));
                  });
                  return SizedBox(
                    width: c.maxWidth / 7,
                    height: MediaQuery.textScalerOf(
                      context,
                    ).scale(24).clamp(52.0, 100.0),
                    child: Semantics(
                      selected: active,
                      label: prettyDate(date),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () => onDay(date),
                        child: AnimatedContainer(
                          duration: EduMotion.duration(context, EduMotion.tab),
                          margin: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: active
                                ? Theme.of(context).colorScheme.primary
                                : null,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  '$day',
                                  maxLines: 1,
                                  style: TextStyle(
                                    color: active ? Colors.white : null,
                                    fontWeight: active ? FontWeight.w700 : null,
                                  ),
                                ),
                              ),
                              if (event)
                                Container(
                                  width: 4,
                                  height: 4,
                                  decoration: BoxDecoration(
                                    color: active ? Colors.white : collegePine,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
            const Divider(),
            Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Text(
                  prettyDate(selected),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
