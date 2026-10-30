part of '../../app/edunexa_client.dart';

String moduleGroup(String key) => switch (key) {
  'overview' ||
  'dues' ||
  'collections' ||
  'expenses' ||
  'reports' ||
  'fees' ||
  'payments' => 'Finance',
  'students' ||
  'admissions' ||
  'employees' ||
  'children' ||
  'activity' => 'People & administration',
  'classes' ||
  'timetable' ||
  'attendance' ||
  'assignments' ||
  'submissions' ||
  'syllabus' ||
  'results' => 'Academic life',
  'calendar' ||
  'announcements' ||
  'notifications' ||
  'messages' => 'College & communication',
  _ => 'Services & account',
};

/// A duration is displayed only when the returned same-day times are valid.
String? periodDuration(Json record) {
  int? minutes(dynamic value) {
    final match = RegExp(r'^(\d{1,2}):(\d{2})(?::00)?$').firstMatch('$value');
    if (match == null) {
      return null;
    }
    final hour = int.parse(match[1]!), minute = int.parse(match[2]!);
    return hour < 24 && minute < 60 ? hour * 60 + minute : null;
  }

  final start = minutes(record['start_time']),
      end = minutes(record['end_time']);
  if (start == null || end == null || end <= start) {
    return null;
  }
  return '${end - start} min';
}

class NextPeriodCard extends StatelessWidget {
  final List<Json> periods;
  final VoidCallback onOpen;
  const NextPeriodCard({
    super.key,
    required this.periods,
    required this.onOpen,
  });
  @override
  Widget build(BuildContext context) {
    final now = TimeOfDay.now();
    int minutes(dynamic raw) {
      final parts = '$raw'.split(':');
      return (int.tryParse(parts.first) ?? 0) * 60 +
          (parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0);
    }

    final next = periods
        .where((p) => minutes(p['start_time']) > now.hour * 60 + now.minute)
        .firstOrNull;
    return Card(
      child: ListTile(
        leading: const EduModuleIcon(icon: Icons.calendar_month_outlined),
        title: Text(
          next == null
              ? 'Today’s scheduled periods have started'
              : '${next['subject'] ?? next['title'] ?? 'Upcoming class'}',
        ),
        subtitle: Text(
          next == null
              ? 'Open the timetable for the full day.'
              : '${next['start_time']} – ${next['end_time'] ?? ''}',
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: onOpen,
      ),
    );
  }
}

/// Composition uses only comparable money amounts, not fabricated time series.
class FinanceComposition extends StatelessWidget {
  final Json summary;
  const FinanceComposition({super.key, required this.summary});
  @override
  Widget build(BuildContext context) {
    final values = (summary['totals'] as Json?) ?? summary;
    final paid = num.tryParse('${values['paid']}');
    final due = num.tryParse('${values['outstanding']}');
    if (paid == null || due == null || paid < 0 || due < 0 || paid + due <= 0) {
      return const SizedBox.shrink();
    }
    final portion = (paid / (paid + due)).toDouble();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Fee collection progress',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 14),
            EduProgress(value: portion, color: collegePine),
            const SizedBox(height: 12),
            Wrap(
              spacing: 16,
              runSpacing: 8,
              children: [
                Text('Paid  ${money(paid)}'),
                Text(
                  'Outstanding  ${money(due)}',
                  style: const TextStyle(color: collegeClayInk),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class TimetableDaySelector extends StatelessWidget {
  final DateTime selected;
  final ValueChanged<DateTime> onChanged;
  const TimetableDaySelector({
    super.key,
    required this.selected,
    required this.onChanged,
  });
  @override
  Widget build(BuildContext context) {
    final monday = DateUtils.dateOnly(
      selected,
    ).subtract(Duration(days: selected.weekday - 1));
    return Column(
      children: [
        Row(
          children: [
            IconButton(
              tooltip: 'Previous week',
              onPressed: () =>
                  onChanged(selected.subtract(const Duration(days: 7))),
              icon: const Icon(Icons.chevron_left),
            ),
            Expanded(
              child: Text(
                prettyDate(selected),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            IconButton(
              tooltip: 'Next week',
              onPressed: () => onChanged(selected.add(const Duration(days: 7))),
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: List.generate(7, (i) {
              final date = monday.add(Duration(days: i));
              final active = DateUtils.isSameDay(date, selected);
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: Semantics(
                  selected: active,
                  label: prettyDate(date),
                  child: EduPress(
                    child: InkWell(
                      onTap: () => onChanged(date),
                      borderRadius: BorderRadius.circular(14),
                      child: AnimatedContainer(
                        duration: EduMotion.duration(context, EduMotion.tab),
                        constraints: const BoxConstraints(
                          minWidth: 48,
                          minHeight: 64,
                        ),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: active ? collegePine : collegeIvory,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: collegeLine),
                        ),
                        child: Column(
                          children: [
                            Text(
                              [
                                'Mon',
                                'Tue',
                                'Wed',
                                'Thu',
                                'Fri',
                                'Sat',
                                'Sun',
                              ][i],
                              style: TextStyle(
                                color: active ? collegeIvory : collegeMuted,
                                fontSize: 12,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '${date.day}',
                              style: TextStyle(
                                color: active ? collegeIvory : collegeEspresso,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: selected,
                firstDate: DateTime(2020),
                lastDate: DateTime(2100),
              );
              if (date != null) onChanged(date);
            },
            icon: const Icon(Icons.date_range_outlined, size: 18),
            label: const Text('Choose date'),
          ),
        ),
      ],
    );
  }
}

class EduRecordDetails extends StatelessWidget {
  final String title;
  final Json record;
  const EduRecordDetails({
    super.key,
    required this.title,
    required this.record,
  });
  @override
  Widget build(BuildContext context) {
    final fields = record.entries.where(
      (e) =>
          e.value != null &&
          !{'user_code', 'sender_code', 'session_code'}.contains(e.key),
    );
    final groups = <String, List<MapEntry<String, dynamic>>>{};
    for (final e in fields) {
      final group = e.key == 'code' || e.key.endsWith('_code')
          ? 'Record references'
          : e.key.endsWith('_at') ||
                e.key.contains('date') ||
                e.key.endsWith('_time')
          ? 'Dates & schedule'
          : 'Details';
      groups.putIfAbsent(group, () => []).add(e);
    }
    Widget value(dynamic v) {
      if (v is String && Uri.tryParse(v)?.scheme == 'https') {
        return TextButton.icon(
          onPressed: () async {
            final opened = await launchUrl(
              Uri.parse(v),
              mode: LaunchMode.externalApplication,
            );
            if (!opened && context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Couldn’t open this link.')),
              );
            }
          },
          icon: const Icon(Icons.open_in_new, size: 18),
          label: const Text('Open resource'),
        );
      }
      if (v is Map) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: v.entries
              .map(
                (e) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text(
                    '${label('${e.key}')}: ${friendlyValue(e.value)}',
                  ),
                ),
              )
              .toList(),
        );
      }
      if (v is List) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: v
              .map(
                (e) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: value(e),
                ),
              )
              .toList(),
        );
      }
      return SelectableText(
        friendlyValue(v),
        style: Theme.of(context).textTheme.bodyMedium,
      );
    }

    Widget field(MapEntry<String, dynamic> e) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: LayoutBuilder(
        builder: (context, c) {
          final caption = Text(
            label(e.key),
            style: Theme.of(context).textTheme.bodySmall,
          );
          if (c.maxWidth < 400 ||
              MediaQuery.textScalerOf(context).scale(14) > 20) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [caption, const SizedBox(height: 5), value(e.value)],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 2, child: caption),
              const SizedBox(width: 20),
              Expanded(flex: 3, child: value(e.value)),
            ],
          );
        },
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                title,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
            IconButton(
              tooltip: 'Close details',
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close),
            ),
          ],
        ),
        const SizedBox(height: 8),
        for (final group in [
          'Details',
          'Dates & schedule',
          'Record references',
        ])
          if (groups[group] != null) ...[
            if (group == 'Record references')
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: Text(group),
                children: groups[group]!.map(field).toList(),
              )
            else ...[
              SectionHeading(title: group),
              ...groups[group]!.map(field),
            ],
            const Divider(),
          ],
      ],
    );
  }
}
