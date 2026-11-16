part of '../../app/edunexa_client.dart';

/// First sign-in for students and parents: login ID (admission or reference number) + the email
/// registered with the college -> a 6-digit code by email -> create password -> signed in.
/// The parent receives the login ID and password by email afterwards.
class FirstTimeSetupScreen extends StatefulWidget {
  final CollegeApi api;
  final MobileRole role;
  final String initialLogin;
  final Future<void> Function() onDone;
  const FirstTimeSetupScreen({
    super.key,
    required this.api,
    required this.role,
    required this.onDone,
    this.initialLogin = '',
  });

  @override
  State<FirstTimeSetupScreen> createState() => _FirstTimeSetupScreenState();
}

class _FirstTimeSetupScreenState extends State<FirstTimeSetupScreen> {
  final form = GlobalKey<FormState>();
  late final login = TextEditingController(text: widget.initialLogin);
  final email = TextEditingController(),
      code = TextEditingController(),
      password = TextEditingController(),
      confirm = TextEditingController();
  bool busy = false, codeSent = false, hidden = true;
  String? error;
  int resendIn = 0;
  Timer? timer;

  @override
  void dispose() {
    timer?.cancel();
    for (final c in [login, email, code, password, confirm]) {
      c.dispose();
    }
    super.dispose();
  }

  void startTimer() {
    timer?.cancel();
    setState(() => resendIn = 60);
    timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => resendIn = resendIn > 0 ? resendIn - 1 : 0);
      if (resendIn == 0) t.cancel();
    });
  }

  Future<void> sendCode() async {
    if (busy) return;
    if (login.text.trim().isEmpty || !email.text.contains('@')) {
      setState(() => error = 'Enter your admission or reference number and your registered email');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.requestFirstTimeCode(login.text.trim(), email.text.trim());
      if (!mounted) return;
      setState(() {
        codeSent = true;
        code.clear();
      });
      startTimer();
    } catch (e) {
      if (mounted) {
        setState(() => error = e is ApiException && e.status == 429
            ? 'Too many requests. Please wait a while and try again.'
            : e.toString());
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> create() async {
    if (busy || !form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.completeFirstTime(
        login.text.trim(),
        email.text.trim(),
        code.text.trim(),
        password.text,
      );
      if (!mounted) return;
      Navigator.of(context).pop();
      await widget.onDone();
    } catch (e) {
      if (mounted) {
        setState(() => error = e is ApiException && e.status == 401
            ? 'The code is wrong or has expired. Request a new code.'
            : e.toString());
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  String? passwordRule(String? v) {
    final value = v ?? '';
    if (value.length < 8) return 'Use at least 8 characters';
    if (!value.contains(RegExp(r'[A-Za-z]')) || !value.contains(RegExp(r'[0-9]'))) {
      return 'Use letters and numbers';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final accent = EduAuthPalette.accent(widget.role);
    final text = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: EduAuthPalette.background,
      appBar: AppBar(
        backgroundColor: EduAuthPalette.background,
        foregroundColor: EduAuthPalette.ink,
        elevation: 0,
        title: const Text('Create your password'),
      ),
      body: SafeArea(
        child: Form(
          key: form,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
            children: [
              Text(
                codeSent
                    ? 'Enter the code we emailed you, then choose your password.'
                    : 'First time here? Enter your admission or reference number and the email registered with the college. We will email you a 6-digit code.',
                style: text.bodyMedium?.copyWith(color: EduAuthPalette.muted, height: 1.45),
              ),
              const SizedBox(height: 18),
              EduAuthTextField(
                key: const ValueKey('setup-login'),
                controller: login,
                label: 'Admission / reference number',
                icon: 'login_id',
                enabled: !busy && !codeSent,
                action: TextInputAction.next,
                autofill: const [AutofillHints.username],
                validator: (v) => (v ?? '').trim().isEmpty ? 'Enter your admission or reference number' : null,
              ),
              const SizedBox(height: 14),
              EduAuthTextField(
                key: const ValueKey('setup-email'),
                controller: email,
                label: 'Registered email',
                icon: 'login_id',
                enabled: !busy && !codeSent,
                action: TextInputAction.done,
                autofill: const [AutofillHints.email],
                keyboard: TextInputType.emailAddress,
                validator: (v) => (v ?? '').contains('@') ? null : 'Enter your registered email',
              ),
              if (codeSent) ...[
                const SizedBox(height: 14),
                EduAuthTextField(
                  key: const ValueKey('setup-code'),
                  controller: code,
                  label: '6-digit code from your email',
                  icon: 'password',
                  enabled: !busy,
                  action: TextInputAction.next,
                  autofill: const [AutofillHints.oneTimeCode],
                  keyboard: TextInputType.number,
                  validator: (v) => RegExp(r'^\d{6}$').hasMatch((v ?? '').trim()) ? null : 'Enter the 6-digit code',
                ),
                const SizedBox(height: 14),
                EduAuthTextField(
                  key: const ValueKey('setup-password'),
                  controller: password,
                  label: 'New password',
                  icon: 'password',
                  enabled: !busy,
                  obscure: hidden,
                  action: TextInputAction.next,
                  autofill: const [AutofillHints.newPassword],
                  validator: passwordRule,
                  suffix: IconButton(
                    tooltip: hidden ? 'Show password' : 'Hide password',
                    onPressed: () => setState(() => hidden = !hidden),
                    icon: Icon(hidden ? Icons.visibility_outlined : Icons.visibility_off_outlined, size: 20),
                  ),
                ),
                const SizedBox(height: 14),
                EduAuthTextField(
                  key: const ValueKey('setup-confirm'),
                  controller: confirm,
                  label: 'Confirm password',
                  icon: 'password',
                  enabled: !busy,
                  obscure: hidden,
                  action: TextInputAction.done,
                  autofill: const [AutofillHints.newPassword],
                  validator: (v) => v == password.text ? null : 'The passwords do not match',
                  onSubmitted: (_) => create(),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'At least 8 characters with letters and numbers. Parents use the same login ID and password.',
                    style: text.bodySmall?.copyWith(color: EduAuthPalette.muted),
                  ),
                ),
              ],
              if (error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 14),
                  child: Semantics(
                    liveRegion: true,
                    child: Text(error!, style: const TextStyle(color: collegeError, height: 1.4)),
                  ),
                ),
              const SizedBox(height: 18),
              AnimatedAuthButton(
                label: busy
                    ? (codeSent ? 'Creating…' : 'Sending code…')
                    : (codeSent ? 'Create password' : 'Send code'),
                busy: busy,
                color: accent,
                onPressed: busy ? null : (codeSent ? create : sendCode),
              ),
              if (codeSent)
                Wrap(
                  alignment: WrapAlignment.center,
                  children: [
                    TextButton(
                      onPressed: busy || resendIn > 0 ? null : sendCode,
                      child: Text(resendIn > 0 ? 'Resend in ${resendIn}s' : 'Resend code'),
                    ),
                    TextButton(
                      onPressed: busy
                          ? null
                          : () => setState(() {
                              codeSent = false;
                              code.clear();
                              error = null;
                            }),
                      child: const Text('Change details'),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}
