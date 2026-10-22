import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() => runApp(const EduNexaAdminApp());

String money(num value) {
  final absolute = value.abs().toStringAsFixed(2).split('.');
  var whole = absolute[0];
  if (whole.length > 3) {
    final tail = whole.substring(whole.length - 3);
    final head = whole.substring(0, whole.length - 3);
    whole =
        '${head.replaceAllMapped(RegExp(r'(\d)(?=(\d{2})+(?!\d))'), (m) => '${m[1]},')},$tail';
  }
  return '${value < 0 ? '-' : ''}₹$whole.${absolute[1]}';
}

class StudentAccount {
  final String code, name, course;
  final double fee, scholarship;
  const StudentAccount(
    this.code,
    this.name,
    this.course,
    this.fee,
    this.scholarship,
  );
}

class Transaction {
  final String code, studentCode, description, date, category;
  final double amount;
  const Transaction(
    this.code,
    this.studentCode,
    this.description,
    this.date,
    this.category,
    this.amount,
  );
}

const students = <StudentAccount>[
  StudentAccount('STU-0001', 'Ananya Rao', 'BCA', 75000, 5000),
  StudentAccount('STU-0002', 'Rahul Sharma', 'B.Com', 65000, 0),
  StudentAccount('STU-0003', 'Meera Nair', 'B.Sc', 80000, 10000),
  StudentAccount('STU-0004', 'Arjun Reddy', 'BCA', 75000, 0),
  StudentAccount('STU-0005', 'Kavya Iyer', 'BBA', 70000, 5000),
];
const receipts = <Transaction>[
  Transaction(
    'RCT-001',
    'STU-0001',
    'Ananya Rao',
    '2026-10-20',
    'Tuition',
    35000,
  ),
  Transaction(
    'RCT-002',
    'STU-0002',
    'Rahul Sharma',
    '2026-10-19',
    'Academic',
    40000,
  ),
  Transaction(
    'RCT-003',
    'STU-0003',
    'Meera Nair',
    '2026-10-05',
    'Tuition',
    70000,
  ),
  Transaction(
    'RCT-004',
    'STU-0004',
    'Arjun Reddy',
    '2026-09-22',
    'Tuition',
    25000,
  ),
  Transaction(
    'RCT-005',
    'STU-0005',
    'Kavya Iyer',
    '2026-09-10',
    'Academic',
    30000,
  ),
];
const expenditures = <Transaction>[
  Transaction(
    'EXP-001',
    '',
    'University remittance',
    '2026-10-20',
    'External',
    18000,
  ),
  Transaction('EXP-002', '', 'Hostel utilities', '2026-10-18', 'Hostel', 12000),
  Transaction(
    'EXP-003',
    '',
    'Employee salaries',
    '2026-09-30',
    'Payroll',
    60000,
  ),
];

class EduNexaAdminApp extends StatelessWidget {
  const EduNexaAdminApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'EduNexa Admin',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF24475D)),
      scaffoldBackgroundColor: Colors.white,
    ),
    home: const AdminHome(),
  );
}

class AdminHome extends StatefulWidget {
  const AdminHome({super.key});
  @override
  State<AdminHome> createState() => _AdminHomeState();
}

class _AdminHomeState extends State<AdminHome> {
  int tab = 0;
  String period = 'All records', search = '';
  final asOf = DateTime(2026, 10, 22);
  double paid(StudentAccount s) => receipts
      .where((p) => p.studentCode == s.code)
      .fold(0.0, (n, p) => n + p.amount);
  double outstanding(StudentAccount s) =>
      (s.fee - s.scholarship - paid(s)).clamp(0, double.infinity).toDouble();
  List<Transaction> selected(List<Transaction> rows) {
    final from = period == 'This month'
        ? DateTime(asOf.year, asOf.month)
        : period == 'Last 7 days'
        ? asOf.subtract(const Duration(days: 6))
        : DateTime(1900);
    return rows.where((p) {
      final date = DateTime.parse(p.date);
      return !date.isBefore(from) && !date.isAfter(asOf);
    }).toList();
  }

  double sum(List<Transaction> rows) => rows.fold(0.0, (n, p) => n + p.amount);
  List<StudentAccount> get due =>
      students.where((s) => outstanding(s) > 0).toList()
        ..sort((a, b) => outstanding(b).compareTo(outstanding(a)));
  List<List<String>> report(String kind) {
    if (kind == 'Outstanding') {
      return [
        [
          'Student code',
          'Student',
          'Course',
          'Gross fee INR',
          'Scholarship INR',
          'Paid INR',
          'Outstanding INR',
        ],
        ...due.map(
          (s) => [
            s.code,
            s.name,
            s.course,
            s.fee.toStringAsFixed(2),
            s.scholarship.toStringAsFixed(2),
            paid(s).toStringAsFixed(2),
            outstanding(s).toStringAsFixed(2),
          ],
        ),
      ];
    }
    return [
      ['Reference', 'Date', 'Description', 'Category', 'Amount INR'],
      ...selected(kind == 'Collections' ? receipts : expenditures).map(
        (p) => [
          p.code,
          p.date,
          p.description,
          p.category,
          p.amount.toStringAsFixed(2),
        ],
      ),
    ];
  }

  Future<void> copyReport(String kind) async {
    final csv = report(kind)
        .map((row) => row.map((v) => '"${v.replaceAll('"', '""')}"').join(','))
        .join('\r\n');
    await Clipboard.setData(ClipboardData(text: csv));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$kind CSV report copied to clipboard.')),
    );
  }

  void viewReport(String kind) {
    final rows = report(kind);
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('$kind report'),
        content: SizedBox(
          width: 650,
          child: SingleChildScrollView(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columns: rows.first
                    .map((v) => DataColumn(label: Text(v)))
                    .toList(),
                rows: rows
                    .skip(1)
                    .map(
                      (row) => DataRow(
                        cells: row.map((v) => DataCell(Text(v))).toList(),
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
          FilledButton(
            onPressed: () => copyReport(kind),
            child: const Text('Copy CSV'),
          ),
        ],
      ),
    );
  }

  Widget amountRow(String label, double value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Row(
      children: [
        Expanded(child: Text(label)),
        Text(money(value), style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    ),
  );
  Widget overview() {
    final collected = sum(selected(receipts)),
        spent = sum(selected(expenditures));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF223D50),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Collected in selected period',
                style: TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 14),
              Text(
                money(collected),
                key: const Key('collected'),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 30,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '${selected(receipts).length} completed receipts',
                style: const TextStyle(color: Colors.white70),
              ),
              const Divider(height: 30, color: Colors.white24),
              TextButton(
                onPressed: () => setState(() => tab = 2),
                style: TextButton.styleFrom(
                  foregroundColor: Colors.white,
                  padding: EdgeInsets.zero,
                ),
                child: const Text('View collection report'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: const Text('Outstanding fees'),
          subtitle: const Text('All student balances, across all periods'),
          trailing: Text(
            money(due.fold(0.0, (n, s) => n + outstanding(s))),
            key: const Key('outstanding'),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          onTap: () => setState(() => tab = 1),
        ),
        Text(
          '${due.length} students with dues',
          style: const TextStyle(color: Color(0xFF647482)),
        ),
        const Divider(height: 30),
        const Text(
          'Where the money goes',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        ),
        amountRow('Paid expenses', spent),
        amountRow(
          'Paid to external parties',
          sum(
            selected(
              expenditures,
            ).where((p) => p.category == 'External').toList(),
          ),
        ),
        const Divider(),
        amountRow('Net cash movement', collected - spent),
        const Text(
          'External payments are included in expenses. Net movement is not a bank balance and excludes opening balances.',
          style: TextStyle(fontSize: 12, color: Color(0xFF647482)),
        ),
        const SizedBox(height: 14),
        amountRow('Total recorded fees', students.fold(0, (n, s) => n + s.fee)),
        amountRow(
          'Recorded scholarships',
          students.fold(0, (n, s) => n + s.scholarship),
        ),
      ],
    );
  }

  Widget dues() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      TextField(
        decoration: const InputDecoration(
          prefixIcon: Icon(Icons.search),
          labelText: 'Search student or course',
          border: OutlineInputBorder(),
        ),
        onChanged: (v) => setState(() => search = v),
      ),
      const SizedBox(height: 15),
      ...due
          .where(
            (s) => '${s.name} ${s.code} ${s.course}'.toLowerCase().contains(
              search.toLowerCase(),
            ),
          )
          .map(
            (s) => ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(s.name),
              subtitle: Text('${s.code} · ${s.course}\nPaid ${money(paid(s))}'),
              isThreeLine: true,
              trailing: Text(
                money(outstanding(s)),
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ),
      const SizedBox(height: 14),
      const Text(
        'Outstanding is not the same as overdue. Charge-level due dates are not included in this sample.',
        style: TextStyle(fontSize: 12, color: Color(0xFF647482)),
      ),
    ],
  );
  Widget reports() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'Collection and expense reports use the selected period. Outstanding uses all recorded balances.',
      ),
      ...['Collections', 'Outstanding', 'Expenses'].map(
        (kind) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.description_outlined),
                title: Text(kind),
                subtitle: Text(
                  kind == 'Outstanding'
                      ? 'Fees, scholarships, paid and remaining amounts.'
                      : 'Itemized transactions and major currency amounts.',
                ),
              ),
              Wrap(
                spacing: 10,
                children: [
                  OutlinedButton(
                    onPressed: () => viewReport(kind),
                    child: const Text('View report'),
                  ),
                  FilledButton.tonal(
                    onPressed: () => copyReport(kind),
                    child: const Text('Copy CSV'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      const Text(
        'CSV export copies report content to the clipboard. Secure file delivery and PDF downloads will be connected through the backend.',
        style: TextStyle(fontSize: 12, color: Color(0xFF647482)),
      ),
    ],
  );
  Widget activity() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const Text(
        'Management follow-up',
        style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
      ),
      ListTile(
        contentPadding: EdgeInsets.zero,
        leading: const Icon(Icons.account_balance_wallet_outlined),
        title: Text('${due.length} students have outstanding fees'),
        subtitle: const Text(
          'Review dues and approved scholarship allocations.',
        ),
        onTap: () => setState(() => tab = 1),
      ),
      const ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(Icons.notifications_none),
        title: Text('Reminder delivery is not connected'),
        subtitle: Text(
          'SMS and push alerts require the future Python backend.',
        ),
      ),
      const Divider(),
      const Text(
        'Recent sample receipts',
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
      ...selected(receipts).map(
        (p) => ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(p.description),
          subtitle: Text('${p.code} · ${p.date}'),
          trailing: Text(money(p.amount)),
        ),
      ),
      const Divider(),
      const ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Icon(Icons.shield_outlined),
        title: Text('Management access'),
        subtitle: Text(
          'This app uses fictional local records. Production login, campus permissions and data synchronization are not implemented.',
        ),
      ),
    ],
  );
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('EduNexa Admin'),
      actions: [
        IconButton(
          tooltip: 'View activity',
          onPressed: () => setState(() => tab = 3),
          icon: const Icon(Icons.notifications_none),
        ),
      ],
    ),
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 700),
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                [
                  'Your college, in focus.',
                  'Outstanding fees',
                  'Management reports',
                  'Activity',
                ][tab],
                style: const TextStyle(
                  fontSize: 27,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -.7,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Fictional demo snapshot · 22 October 2026\nNo connected backend or live banking.',
                style: TextStyle(fontSize: 12, color: Color(0xFF647482)),
              ),
              const SizedBox(height: 18),
              DropdownButtonFormField<String>(
                initialValue: period,
                decoration: const InputDecoration(
                  labelText: 'Collection period',
                  border: OutlineInputBorder(),
                ),
                items: ['All records', 'This month', 'Last 7 days']
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (p) {
                  if (p != null) setState(() => period = p);
                },
              ),
              const SizedBox(height: 22),
              [overview, dues, reports, activity][tab](),
            ],
          ),
        ),
      ),
    ),
    bottomNavigationBar: NavigationBar(
      selectedIndex: tab,
      onDestinationSelected: (v) => setState(() => tab = v),
      destinations: const [
        NavigationDestination(
          icon: Icon(Icons.home_outlined),
          label: 'Overview',
        ),
        NavigationDestination(
          icon: Icon(Icons.account_balance_wallet_outlined),
          label: 'Dues',
        ),
        NavigationDestination(
          icon: Icon(Icons.description_outlined),
          label: 'Reports',
        ),
        NavigationDestination(
          icon: Icon(Icons.notifications_none),
          label: 'Activity',
        ),
      ],
    ),
  );
}
