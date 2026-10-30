part of '../../app/edunexa_client.dart';

class ActionForm extends StatefulWidget {
  final Json action, lookups, initial;
  const ActionForm({
    super.key,
    required this.action,
    required this.lookups,
    this.initial = const {},
  });
  @override
  State<ActionForm> createState() => _ActionFormState();
}

class _ActionFormState extends State<ActionForm> {
  final form = GlobalKey<FormState>();
  final values = <String, dynamic>{};
  final controllers = <String, TextEditingController>{};
  List<Json> get fields => (widget.action['fields'] as List).cast<Json>();
  @override
  void initState() {
    super.initState();
    values.addAll(widget.initial);
    for (final f in fields) {
      final key = f['key'] as String;
      controllers[key] = TextEditingController(
        text: values[key]?.toString() ?? '',
      );
    }
  }

  @override
  void dispose() {
    for (final c in controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  List<Json> choices(String key) {
    final ref = {
      'offering_code': 'offerings',
      'student_code': 'students',
      'leave_type_code': 'leave_types',
      'type_code': 'certificate_types',
      'recipient_user_code': 'contacts',
      'charge_code': 'charges',
      'assignment_code': 'assignments',
      'submission_code': 'submissions',
      'session_code': 'sessions',
      'paper_code': 'papers',
      'thread_code': 'threads',
      'slot_code': 'slots',
      'target_slot_code': 'swap_slots',
      'campus_code': 'campuses',
    }[key];
    return ref == null ? [] : (widget.lookups[ref] as List? ?? []).cast<Json>();
  }

  Future<void> pick(Json f) async {
    final key = f['key'] as String, type = f['type'];
    var day =
        DateTime.tryParse(values[key]?.toString() ?? '')?.toLocal() ??
        DateTime.now();
    if (type != 'time') {
      final picked = await showDatePicker(
        context: context,
        initialDate: day,
        firstDate: DateTime(2000),
        lastDate: DateTime(2100),
      );
      if (picked == null || !mounted) return;
      day = picked;
    }
    TimeOfDay? time;
    if (type == 'time' || type == 'datetime-local') {
      time = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.fromDateTime(day),
      );
      if (time == null || !mounted) return;
    }
    final date =
        '${day.year}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
    final clock = time == null
        ? ''
        : '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}:00';
    final result = type == 'date'
        ? date
        : type == 'time'
        ? clock
        : DateTime(
            day.year,
            day.month,
            day.day,
            time!.hour,
            time.minute,
          ).toUtc().toIso8601String();
    setState(() {
      values[key] = result;
      controllers[key]!.text = type == 'datetime-local'
          ? friendlyValue(result)
          : result;
    });
  }

  String? validate(Json f, String? value) {
    if (f['required'] == true && (value == null || value.trim().isEmpty)) {
      return 'Enter ${f['label'].toString().toLowerCase()}';
    }
    if (value == null || value.isEmpty) return null;
    if ({'number', 'integer', 'decimal'}.contains(f['type'])) {
      final n = num.tryParse(value);
      if (n == null || !n.isFinite) return 'Enter a valid number';
      if (['amount', 'max_marks'].contains(f['key']) && n <= 0) {
        return 'Enter an amount greater than zero';
      }
    }
    if (f['key'] == 'new_password' && value.length < 12) {
      return 'Use at least 12 characters';
    }
    if (f['key'].toString().endsWith('_url')) {
      final uri = Uri.tryParse(value);
      if (uri == null || uri.scheme != 'https' || uri.host.isEmpty) {
        return 'Enter a secure https:// link';
      }
    }
    if (['end_date', 'return_at', 'ends_at'].contains(f['key'])) {
      final start =
          values[{
            'end_date': 'start_date',
            'return_at': 'leave_at',
            'ends_at': 'starts_at',
          }[f['key']]];
      final a = DateTime.tryParse('$start'),
          b = DateTime.tryParse(values[f['key']]?.toString() ?? value);
      if (a != null && b != null && b.isBefore(a)) {
        return 'Choose a date after the start';
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final payment = widget.action['key'] == 'make_payment';
    return Scaffold(
      appBar: AppBar(title: Text(widget.action['label'])),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: Form(
              key: form,
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  Icon(
                    actionIcon(widget.action['key']),
                    size: 36,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    payment ? 'Review your payment' : 'Complete the details',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    payment
                        ? 'Continue to secure checkout. Your receipt appears after the provider confirms payment.'
                        : 'Fields marked * are required.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 28),
                  ...fields.map((f) {
                    final key = f['key'] as String, type = f['type'];
                    final label =
                        '${f['label']}${f['required'] == true ? ' *' : ''}';
                    if (type == 'boolean') {
                      return SwitchListTile.adaptive(
                        title: Text(label),
                        value: values[key] == true,
                        onChanged: (v) => setState(() => values[key] = v),
                      );
                    }
                    final options = (f['options'] as List? ?? [])
                        .map(
                          (v) => {'code': v.toString(), 'name': v.toString()},
                        )
                        .toList();
                    final lookups = choices(key);
                    final choicesList = lookups.isEmpty ? options : lookups;
                    // Preserve a contextual record selection even if it is outside a paginated lookup.
                    if (values[key] != null &&
                        choicesList.isNotEmpty &&
                        !choicesList.any(
                          (c) => c['code'].toString() == values[key].toString(),
                        )) {
                      choicesList.add({
                        'code': values[key].toString(),
                        'name': 'Selected record (${values[key]})',
                      });
                    }
                    if (key == 'status' &&
                        choicesList.isNotEmpty &&
                        choicesList.length <= 4) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 20),
                        child: FormField<String>(
                          initialValue: values[key]?.toString(),
                          validator: (v) => validate(f, v),
                          builder: (state) => Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                label,
                                style: Theme.of(context).textTheme.titleSmall,
                              ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: choicesList
                                    .map(
                                      (c) => ChoiceChip(
                                        label: Text('${c['name']}'),
                                        selected:
                                            state.value == c['code'].toString(),
                                        onSelected: (_) {
                                          values[key] = c['code'].toString();
                                          state.didChange(c['code'].toString());
                                        },
                                      ),
                                    )
                                    .toList(),
                              ),
                              if (state.hasError)
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(
                                    state.errorText!,
                                    style: const TextStyle(color: collegeError),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      );
                    }
                    if (choicesList.isNotEmpty) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 20),
                        child: DropdownButtonFormField<String>(
                          initialValue: values[key]?.toString(),
                          isExpanded: true,
                          decoration: InputDecoration(labelText: label),
                          items: choicesList
                              .map(
                                (c) => DropdownMenuItem<String>(
                                  value: c['code'].toString(),
                                  child: Text(
                                    '${c['name'] ?? c['title'] ?? c['subject'] ?? c['code']}',
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: (v) => values[key] = v,
                          validator: (v) => validate(f, v),
                        ),
                      );
                    }
                    final picker = [
                      'date',
                      'datetime-local',
                      'time',
                    ].contains(type);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 20),
                      child: TextFormField(
                        controller: controllers[key],
                        obscureText: type == 'password',
                        autocorrect: type != 'password',
                        enableSuggestions: type != 'password',
                        readOnly: picker,
                        onTap: picker ? () => pick(f) : null,
                        maxLines: type == 'textarea' ? 4 : 1,
                        keyboardType:
                            {'number', 'integer', 'decimal'}.contains(type)
                            ? const TextInputType.numberWithOptions(
                                decimal: true,
                              )
                            : key.endsWith('_url')
                            ? TextInputType.url
                            : TextInputType.text,
                        decoration: InputDecoration(
                          labelText: label,
                          suffixIcon: picker
                              ? Icon(
                                  type == 'time'
                                      ? Icons.schedule
                                      : Icons.calendar_today_outlined,
                                )
                              : null,
                        ),
                        onChanged: (v) => values[key] = v,
                        validator: (v) => validate(f, v),
                      ),
                    );
                  }),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: () {
                      if (!form.currentState!.validate()) return;
                      for (final f in fields) {
                        if (f['type'] == 'boolean') {
                          values.putIfAbsent(f['key'], () => false);
                        }
                      }
                      Navigator.pop(context, values);
                    },
                    icon: Icon(payment ? Icons.lock_outline : Icons.check),
                    label: Text(
                      payment
                          ? 'Continue to secure payment'
                          : 'Save ${widget.action['label'].toString().toLowerCase()}',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
