import 'package:flutter/material.dart';

const collegeNavy = Color(0xff18384b);
const collegeBronze = Color(0xff886022);
const collegeCanvas = Color(0xfff3f6f8);
const collegeMuted = Color(0xff5e707e);
const collegeLine = Color(0xffdfe6eb);

ThemeData collegeTheme(Color accent) {
  final scheme = ColorScheme.fromSeed(seedColor: accent).copyWith(
    primary: accent,
    onPrimary: Colors.white,
    surface: Colors.white,
    onSurface: collegeNavy,
    onSurfaceVariant: collegeMuted,
    outline: const Color(0xff7b8b96),
    outlineVariant: collegeLine,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme);
  return base.copyWith(
    scaffoldBackgroundColor: collegeCanvas,
    textTheme: base.textTheme
        .apply(bodyColor: collegeNavy, displayColor: collegeNavy)
        .copyWith(
          headlineMedium: const TextStyle(
            fontFamily: 'Roboto',
            color: collegeNavy,
            fontSize: 28,
            height: 1.18,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.8,
          ),
          headlineSmall: const TextStyle(
            fontFamily: 'Roboto',
            color: collegeNavy,
            fontSize: 24,
            height: 1.22,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
          titleLarge: const TextStyle(
            fontFamily: 'Roboto',
            color: collegeNavy,
            fontSize: 20,
            height: 1.3,
            fontWeight: FontWeight.w700,
          ),
          titleMedium: const TextStyle(
            fontFamily: 'Roboto',
            color: collegeNavy,
            fontSize: 16,
            height: 1.35,
            fontWeight: FontWeight.w600,
          ),
          bodyMedium: const TextStyle(
            fontFamily: 'Roboto',
            fontSize: 14,
            height: 1.5,
            color: collegeNavy,
          ),
          bodySmall: const TextStyle(
            fontFamily: 'Roboto',
            fontSize: 12,
            height: 1.45,
            color: collegeMuted,
          ),
          labelMedium: const TextStyle(
            fontFamily: 'Roboto',
            fontSize: 12,
            height: 1.4,
            fontWeight: FontWeight.w500,
            color: collegeMuted,
          ),
        )
        .apply(fontFamily: 'Roboto'),
    appBarTheme: const AppBarTheme(
      backgroundColor: collegeCanvas,
      foregroundColor: collegeNavy,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontFamily: 'Roboto',
        fontSize: 17,
        fontWeight: FontWeight.w700,
        color: collegeNavy,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xfff8fafb),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
      labelStyle: const TextStyle(fontFamily: 'Roboto', color: collegeMuted),
      prefixIconColor: collegeMuted,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: collegeLine),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: accent, width: 2),
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: const EdgeInsets.symmetric(vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: collegeLine),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 54),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(
          fontFamily: 'Roboto',
          fontSize: 15,
          fontWeight: FontWeight.w700,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 48),
        side: const BorderSide(color: collegeLine),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(
          fontFamily: 'Roboto',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        minimumSize: const WidgetStatePropertyAll(Size(48, 50)),
        visualDensity: VisualDensity.standard,
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        side: const WidgetStatePropertyAll(BorderSide(color: collegeLine)),
        textStyle: const WidgetStatePropertyAll(
          TextStyle(
            fontFamily: 'Roboto',
            fontSize: 14,
            fontWeight: FontWeight.w700,
          ),
        ),
        backgroundColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.selected) ? accent : Colors.white,
        ),
        foregroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? Colors.white
              : collegeMuted,
        ),
      ),
    ),
    drawerTheme: const DrawerThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
    ),
    listTileTheme: ListTileThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      selectedColor: accent,
      selectedTileColor: accent.withValues(alpha: 0.08),
      iconColor: collegeMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      indicatorColor: accent.withValues(alpha: 0.12),
      labelTextStyle: const WidgetStatePropertyAll(
        TextStyle(
          fontFamily: 'Roboto',
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    dividerTheme: const DividerThemeData(color: collegeLine, space: 24),
    dialogTheme: DialogThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
  );
}

class CollegeBrand extends StatelessWidget {
  final String subtitle;
  const CollegeBrand({super.key, required this.subtitle});
  @override
  Widget build(BuildContext context) => Row(
    children: [
      const CollegeCrest(),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'EduNexa',
              style: TextStyle(
                fontFamily: 'Roboto',
                fontSize: 23,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.8,
                height: 1.15,
              ),
            ),
            const SizedBox(height: 3),
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    ],
  );
}

// Reuses the shield and mortarboard geometry of EduNexa's college crest.
class CollegeCrest extends StatelessWidget {
  const CollegeCrest({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'EduNexa college crest',
    child: const SizedBox(
      width: 40,
      height: 44,
      child: CustomPaint(painter: _CrestPainter()),
    ),
  );
}

class _CrestPainter extends CustomPainter {
  const _CrestPainter();
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 80, size.height / 88);
    final shield = Path()
      ..moveTo(40, 3)
      ..lineTo(72, 15)
      ..lineTo(72, 44)
      ..cubicTo(72, 63, 54, 77, 40, 84)
      ..cubicTo(26, 77, 8, 63, 8, 44)
      ..lineTo(8, 15)
      ..close();
    canvas.drawPath(shield, Paint()..color = const Color(0xfffaf4e8));
    final stroke = Paint()
      ..color = collegeBronze
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(shield, stroke);
    final cap = Path()
      ..moveTo(20, 36)
      ..lineTo(40, 25)
      ..lineTo(60, 36)
      ..lineTo(40, 47)
      ..close()
      ..moveTo(25, 40)
      ..lineTo(25, 55)
      ..lineTo(40, 63)
      ..lineTo(55, 55)
      ..lineTo(55, 40)
      ..moveTo(40, 47)
      ..lineTo(40, 63)
      ..moveTo(24, 68)
      ..lineTo(56, 68)
      ..moveTo(40, 12)
      ..lineTo(40, 19);
    canvas.drawPath(cap, stroke);
  }

  @override
  bool shouldRepaint(_CrestPainter oldDelegate) => false;
}

class RolePill extends StatelessWidget {
  final String role;
  final bool inverse;
  const RolePill({super.key, required this.role, this.inverse = false});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
    decoration: BoxDecoration(
      color: inverse
          ? Colors.white.withValues(alpha: .12)
          : Theme.of(context).colorScheme.primary.withValues(alpha: .08),
      borderRadius: BorderRadius.circular(24),
    ),
    child: Text(
      '$role workspace',
      style: TextStyle(
        fontFamily: 'Roboto',
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: inverse ? Colors.white : Theme.of(context).colorScheme.primary,
      ),
    ),
  );
}

class WorkspaceWelcome extends StatelessWidget {
  final String role, description;
  const WorkspaceWelcome({
    super.key,
    required this.role,
    required this.description,
  });
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(
      color: collegeNavy,
      borderRadius: BorderRadius.circular(24),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RolePill(role: role, inverse: true),
        const SizedBox(height: 20),
        Text(
          switch (role) {
            'Admin' => 'Your college,\nat a glance.',
            'Teacher' => 'Ready for your\nnext class?',
            'Parent' => 'Closer to their\ncollege journey.',
            _ => 'Make room for\nyour next chapter.',
          },
          style: const TextStyle(
            fontFamily: 'Roboto',
            fontSize: 28,
            height: 1.2,
            fontWeight: FontWeight.w700,
            letterSpacing: -.7,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          description,
          style: const TextStyle(
            fontFamily: 'Roboto',
            color: Color(0xffd2e0e8),
            height: 1.5,
            fontSize: 14,
          ),
        ),
      ],
    ),
  );
}

class ModuleShortcut extends StatelessWidget {
  final String title;
  final IconData icon;
  final VoidCallback onTap;
  const ModuleShortcut({
    super.key,
    required this.title,
    required this.icon,
    required this.onTap,
  });
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(18),
      side: const BorderSide(color: collegeLine),
    ),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 148),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: Theme.of(
                  context,
                ).colorScheme.primary.withValues(alpha: .08),
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(
                icon,
                color: Theme.of(context).colorScheme.primary,
                size: 23,
              ),
            ),
            const SizedBox(height: 16),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      ),
    ),
  );
}

class WorkspaceMessage extends StatelessWidget {
  final IconData icon;
  final String title, message;
  final VoidCallback? onRetry;
  const WorkspaceMessage({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.onRetry,
  });
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.symmetric(vertical: 12),
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: collegeLine),
      borderRadius: BorderRadius.circular(18),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(
          icon,
          size: 30,
          color: onRetry == null
              ? Theme.of(context).colorScheme.primary
              : Theme.of(context).colorScheme.error,
        ),
        const SizedBox(height: 14),
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 6),
        Text(
          message,
          style: const TextStyle(
            fontFamily: 'Roboto',
            color: collegeMuted,
            height: 1.5,
          ),
        ),
        if (onRetry != null) ...[
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Try again'),
          ),
        ],
      ],
    ),
  );
}
