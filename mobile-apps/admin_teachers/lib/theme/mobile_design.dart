import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../utils/mobile_motion.dart';

export '../utils/mobile_motion.dart';

// Warm academic palette. Semantic ink variants meet contrast on ivory surfaces.
const collegeCaramel = Color(0xffc56f4e);
const collegeClayInk = Color(0xff98482f);
const collegeSage = Color(0xff74866b);
const collegePine = Color(0xff365b45);
const collegeEspresso = Color(0xff352d28);
const collegeCanvas = Color(0xfff6f1e8);
const collegeMuted = Color(0xff6e645b);
const collegeWarmGray = Color(0xff81776d);
const collegeLine = Color(0xffe3d9cc);
const collegeCard = Color(0xffede4d7);
const collegeIvory = Color(0xfffffdf8);
const collegeFieldFill = collegeIvory;
const collegeGold = Color(0xffc69b52);
const collegeError = Color(0xffb64d42);
// Compatibility aliases for the retained crest geometry, with warm values.
const collegeNavy = collegeEspresso;
const collegeBronze = collegeCaramel;

/// Shared sizes, so every tile, button and bar lines up on every screen.
abstract final class EduSizes {
  static const double button = 52;
  static const double compactButton = 48;
  static const double moduleTile = 124;
  static const double compactModuleTile = 112;
  static const double metricTile = 128;
  static const double navBar = 72;
  static const double navIcon = 40;
  static const double radius = 16;

  /// [base] grown with the reader's text size, so enlarged text never clips inside a tile.
  static double scaled(BuildContext context, double base) =>
      base * (MediaQuery.textScalerOf(context).scale(16) / 16).clamp(1.0, 2.6);
}

/// Smooth, iOS-like scrolling everywhere; lists stay pullable for refresh even when short.
class EduScrollBehavior extends MaterialScrollBehavior {
  const EduScrollBehavior();
  @override
  ScrollPhysics getScrollPhysics(BuildContext context) =>
      const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());
}

ThemeData collegeTheme(Color accent) {
  final primary = accent == collegeCaramel ? collegeClayInk : collegePine;
  final scheme = ColorScheme.light(
    primary: primary,
    onPrimary: collegeIvory,
    primaryContainer: const Color(0xfff2ded1),
    onPrimaryContainer: collegeEspresso,
    secondary: collegePine,
    onSecondary: collegeIvory,
    secondaryContainer: const Color(0xffe1e7d9),
    onSecondaryContainer: collegePine,
    tertiary: const Color(0xff805f26),
    onTertiary: collegeIvory,
    tertiaryContainer: const Color(0xfff1e5cb),
    onTertiaryContainer: collegeEspresso,
    error: collegeError,
    onError: collegeIvory,
    errorContainer: const Color(0xfff6e1db),
    onErrorContainer: collegeError,
    surface: collegeIvory,
    onSurface: collegeEspresso,
    surfaceContainerLowest: collegeIvory,
    surfaceContainerLow: collegeCanvas,
    surfaceContainer: collegeCanvas,
    surfaceContainerHigh: collegeCard,
    surfaceContainerHighest: collegeCard,
    onSurfaceVariant: collegeMuted,
    outline: collegeWarmGray,
    outlineVariant: collegeLine,
    inverseSurface: collegeEspresso,
    onInverseSurface: collegeIvory,
    inversePrimary: const Color(0xffe9b59c),
    surfaceTint: Colors.transparent,
    shadow: collegeEspresso,
  );
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamily: 'Roboto',
  );
  return base.copyWith(
    scaffoldBackgroundColor: collegeCanvas,
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: EduPageTransitions(),
        TargetPlatform.iOS: EduPageTransitions(),
        TargetPlatform.macOS: EduPageTransitions(),
        TargetPlatform.windows: EduPageTransitions(),
        TargetPlatform.linux: EduPageTransitions(),
      },
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: collegeIvory,
      surfaceTintColor: Colors.transparent,
      modalBackgroundColor: collegeIvory,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: collegeEspresso,
      contentTextStyle: const TextStyle(color: collegeIvory),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: collegeIvory,
      selectedColor: primary,
      checkmarkColor: collegeIvory,
      side: const BorderSide(color: collegeLine),
      // Selected chips read as clearly highlighted: filled accent with bold light text.
      labelStyle: WidgetStateTextStyle.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? const TextStyle(
                color: collegeIvory,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              )
            : const TextStyle(
                color: collegeEspresso,
                fontSize: 13,
                fontWeight: FontWeight.w500,
              ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: primary,
      linearTrackColor: collegeCard,
    ),
    textSelectionTheme: TextSelectionThemeData(
      cursorColor: primary,
      selectionColor: collegeCaramel.withValues(alpha: .22),
      selectionHandleColor: primary,
    ),
    textTheme: base.textTheme
        .apply(bodyColor: collegeEspresso, displayColor: collegeEspresso)
        .copyWith(
          headlineMedium: const TextStyle(
            fontFamily: 'Roboto',
            color: collegeEspresso,
            fontSize: 28,
            height: 1.18,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.8,
          ),
          headlineSmall: const TextStyle(
            fontFamily: 'Roboto',
            color: collegeEspresso,
            fontSize: 24,
            height: 1.22,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.5,
          ),
          titleLarge: const TextStyle(
            fontFamily: 'Roboto',
            color: collegeEspresso,
            fontSize: 18,
            height: 1.3,
            fontWeight: FontWeight.w700,
          ),
          titleMedium: const TextStyle(
            fontFamily: 'Roboto',
            color: collegeEspresso,
            fontSize: 16,
            height: 1.35,
            fontWeight: FontWeight.w600,
          ),
          bodyMedium: const TextStyle(
            fontFamily: 'Roboto',
            fontSize: 14,
            height: 1.5,
            color: collegeEspresso,
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
      foregroundColor: collegeEspresso,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontFamily: 'Roboto',
        fontSize: 17,
        fontWeight: FontWeight.w700,
        color: collegeEspresso,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: collegeFieldFill,
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
        borderSide: BorderSide(color: primary, width: 2),
      ),
    ),
    cardTheme: CardThemeData(
      color: collegeIvory,
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
        minimumSize: const Size(48, EduSizes.button),
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
        minimumSize: const Size(48, EduSizes.button),
        side: const BorderSide(color: collegeLine),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(
          fontFamily: 'Roboto',
          fontSize: 14,
          fontWeight: FontWeight.w600,
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        minimumSize: const Size(48, EduSizes.compactButton),
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
        minimumSize: const WidgetStatePropertyAll(
          Size(48, EduSizes.compactButton),
        ),
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
              states.contains(WidgetState.selected) ? primary : collegeIvory,
        ),
        foregroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? Colors.white
              : collegeMuted,
        ),
      ),
    ),
    listTileTheme: ListTileThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      selectedColor: primary,
      selectedTileColor: accent.withValues(alpha: 0.08),
      iconColor: collegeMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    ),
    // The bar itself is drawn by EduFloatingNavBar; the selected item is its raised round icon.
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      shadowColor: Colors.transparent,
      elevation: 0,
      height: EduSizes.navBar,
      indicatorColor: Colors.transparent,
      labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      labelTextStyle: WidgetStateTextStyle.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? TextStyle(
                fontFamily: 'Roboto',
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: primary,
              )
            : const TextStyle(
                fontFamily: 'Roboto',
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: collegeMuted,
              ),
      ),
    ),
    dividerTheme: const DividerThemeData(color: collegeLine, space: 24),
    dialogTheme: DialogThemeData(
      backgroundColor: collegeIvory,
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
              'Edu-Pragathi',
              style: TextStyle(
                fontFamily: 'Roboto',
                fontSize: 23,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.8,
                height: 1.15,
                color: collegeEspresso,
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

// Reuses the shield and mortarboard geometry of Edu-Pragathi's college crest.
class CollegeCrest extends StatelessWidget {
  const CollegeCrest({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Edu-Pragathi college crest',
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
      color: Theme.of(context).colorScheme.primary,
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
            color: collegeIvory,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          description,
          style: const TextStyle(
            fontFamily: 'Roboto',
            color: Color(0xfff5ead8),
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
  final bool compact;
  const ModuleShortcut({
    super.key,
    required this.title,
    required this.icon,
    required this.onTap,
    this.compact = false,
  });
  @override
  Widget build(BuildContext context) => EduPress(
    child: Material(
      color: collegeIvory,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: collegeLine),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          // Every tile in a grid has the same height, whatever the title length.
          height: EduSizes.scaled(
            context,
            compact ? EduSizes.compactModuleTile : EduSizes.moduleTile,
          ),
          padding: EdgeInsets.all(compact ? 14 : 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: collegeCard,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: EduModuleIcon(icon: icon, size: 23),
                  ),
                  const Spacer(),
                  const Icon(
                    Icons.arrow_outward_rounded,
                    size: 15,
                    color: collegeMuted,
                  ),
                ],
              ),
              Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  height: 1.3,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
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
      color: collegeIvory,
      border: Border.all(color: collegeLine),
      borderRadius: BorderRadius.circular(18),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        EduArtwork(
          name: onRetry == null
              ? 'illustrations/books_and_stationery'
              : 'empty_states/no_internet',
          height: 82,
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

class EduArtwork extends StatelessWidget {
  final String name;
  final double height;
  const EduArtwork({super.key, required this.name, this.height = 120});
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SvgPicture.asset(
      'assets/$name.svg',
      height: height,
      fit: BoxFit.contain,
    ),
  );
}

/// Maps the existing semantic module icons to the original SVG family.
class EduModuleIcon extends StatelessWidget {
  final IconData icon;
  final double size;
  final Color? color;
  const EduModuleIcon({
    super.key,
    required this.icon,
    this.size = 24,
    this.color,
  });
  @override
  Widget build(BuildContext context) {
    final tint = color ?? Theme.of(context).colorScheme.primary;
    final name = {
      Icons.home_outlined: 'dashboard',
      Icons.home_rounded: 'dashboard',
      Icons.analytics_outlined: 'finance',
      Icons.payments_outlined: 'finance',
      Icons.account_balance_wallet_outlined: 'finance',
      Icons.receipt_long_outlined: 'finance',
      Icons.groups_outlined: 'students',
      Icons.people_outline: 'teachers',
      Icons.badge_outlined: 'teachers',
      Icons.event_outlined: 'timetable',
      Icons.menu_book_outlined: 'assignments',
      Icons.description_outlined: 'certificates',
      Icons.calendar_month_outlined: 'timetable',
      Icons.fact_check_outlined: 'attendance',
      Icons.assignment_outlined: 'assignments',
      Icons.quiz_outlined: 'examinations',
      Icons.school_outlined: 'certificates',
      Icons.directions_bus_outlined: 'transport',
      Icons.notifications_outlined: 'notifications',
      Icons.inbox_outlined: 'notifications',
      Icons.chat_bubble_outline: 'communication',
    }[icon];
    return name == null
        ? Icon(icon, size: size, color: tint)
        : SvgPicture.asset(
            'assets/icons/$name.svg',
            width: size,
            height: size,
            colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
          );
  }
}

class EduGreeting extends StatelessWidget {
  final String name, greeting, role, description, date, artwork;
  final VoidCallback? onProfile;
  const EduGreeting({
    super.key,
    required this.name,
    required this.greeting,
    required this.role,
    required this.description,
    required this.date,
    required this.artwork,
    this.onProfile,
  });
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: collegeIvory,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: collegeLine),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(date, style: Theme.of(context).textTheme.bodySmall),
            ),
            if (onProfile != null)
              IconButton(
                tooltip: 'My profile',
                onPressed: onProfile,
                icon: const Icon(
                  Icons.account_circle_outlined,
                  color: collegePine,
                ),
              ),
          ],
        ),
        LayoutBuilder(
          builder: (context, c) => Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                flex: 3,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$greeting,',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      name.isEmpty ? role : name,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 10),
                    RolePill(role: role),
                  ],
                ),
              ),
              if (c.maxWidth > 300 &&
                  MediaQuery.textScalerOf(context).scale(14) < 21)
                Expanded(
                  flex: 2,
                  child: EduArtwork(
                    name: 'illustrations/$artwork',
                    height: 106,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text(description, style: Theme.of(context).textTheme.bodySmall),
      ],
    ),
  );
}

/// One bottom-bar destination: its icon, label and an optional unread badge.
class EduNavItem {
  final IconData icon;
  final String label;
  final int badge;
  const EduNavItem(this.icon, this.label, {this.badge = 0});
}

/// iOS-style floating bottom bar: a rounded, raised capsule above the page edge. Each icon sits
/// in a round chip; the selected one becomes a filled accent circle with a soft lift.
class EduFloatingNavBar extends StatelessWidget {
  final int selectedIndex;
  final ValueChanged<int>? onDestinationSelected;
  final List<EduNavItem> items;
  const EduFloatingNavBar({
    super.key,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.items,
  });
  @override
  Widget build(BuildContext context) => SafeArea(
    top: false,
    minimum: const EdgeInsets.fromLTRB(14, 0, 14, 12),
    child: DecoratedBox(
      decoration: BoxDecoration(
        color: collegeIvory,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: collegeLine),
        boxShadow: [
          BoxShadow(
            color: collegeEspresso.withValues(alpha: .09),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
          BoxShadow(
            color: collegeEspresso.withValues(alpha: .05),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(30),
        child: NavigationBar(
          selectedIndex: selectedIndex,
          animationDuration: EduMotion.duration(context, EduMotion.tab),
          onDestinationSelected: onDestinationSelected,
          destinations: [
            for (final item in items)
              NavigationDestination(
                icon: _EduNavIcon(item: item, selected: false),
                selectedIcon: _EduNavIcon(item: item, selected: true),
                label: item.label,
              ),
          ],
        ),
      ),
    ),
  );
}

class _EduNavIcon extends StatelessWidget {
  final EduNavItem item;
  final bool selected;
  const _EduNavIcon({required this.item, required this.selected});
  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    return Badge(
      isLabelVisible: item.badge > 0,
      label: Text(item.badge > 99 ? '99+' : '${item.badge}'),
      offset: const Offset(4, -2),
      child: AnimatedContainer(
        duration: EduMotion.duration(context, EduMotion.tab),
        curve: Curves.easeOutCubic,
        width: EduSizes.navIcon,
        height: EduSizes.navIcon,
        transform: Matrix4.translationValues(0, selected ? -2 : 0, 0),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: selected ? accent : collegeCanvas,
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: accent.withValues(alpha: .35),
                    blurRadius: 12,
                    offset: const Offset(0, 5),
                  ),
                ]
              : const [],
        ),
        alignment: Alignment.center,
        child: EduModuleIcon(
          icon: item.icon,
          size: 21,
          color: selected ? collegeIvory : collegeMuted,
        ),
      ),
    );
  }
}
