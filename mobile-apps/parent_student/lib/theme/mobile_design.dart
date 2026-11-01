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
const collegeCanvas = Color(0xfff4f4f2);
// Page background for every screen (white).
const collegePage = Colors.white;
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
  static const double statTile = 132;
  static const double quickAction = 60;
  static const double pillTab = 42;

  /// [base] grown with the reader's text size, so enlarged text never clips inside a tile.
  static double scaled(BuildContext context, double base) =>
      base * (MediaQuery.textScalerOf(context).scale(16) / 16).clamp(1.0, 2.6);
}

/// Layout breakpoints: phones, unfolded phones / small tablets, and tablets.
abstract final class EduBreakpoints {
  static const double fold = 600;
  static const double tablet = 900;

  /// Grid columns for [width]: [phone] on phones, more on folds and tablets, one at large text.
  static int columns(
    BuildContext context,
    double width, {
    int phone = 2,
    int fold = 3,
    int tablet = 4,
  }) {
    if (MediaQuery.textScalerOf(context).scale(16) > 24 || width < 300) {
      return 1;
    }
    return width >= EduBreakpoints.tablet
        ? tablet
        : width >= EduBreakpoints.fold
        ? fold
        : phone;
  }
}

/// Soft tints of the college palette for category cards, each with a readable ink.
abstract final class EduTints {
  static const clay = Color(0xfff6e3d9);
  static const sage = Color(0xffe2eadb);
  static const gold = Color(0xfff6ecd3);
  static const mist = Color(0xffdfe7ea);
  static const plum = Color(0xffebe2ea);
  static const all = [clay, sage, gold, mist, plum];
  static Color ink(Color tint) => switch (tint) {
    sage => collegePine,
    gold => const Color(0xff7a5a22),
    mist => const Color(0xff3b5966),
    plum => const Color(0xff5f4560),
    _ => collegeClayInk,
  };
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
    scaffoldBackgroundColor: collegePage,
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
      // Selected chips: filled accent with light text; unselected: dark text on ivory.
      // The colour resolves per state (a state-resolved TextStyle left unselected labels light).
      labelStyle: TextStyle(
        fontFamily: 'Roboto',
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: WidgetStateColor.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? collegeIvory
              : collegeEspresso,
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
      backgroundColor: collegePage,
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
    child: Center(
      heightFactor: 1,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 620),
        child: _bar(context),
      ),
    ),
  );

  Widget _bar(BuildContext context) => DecoratedBox(
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
      // Tab labels stay on one line: standard size on narrow phones, slightly larger elsewhere.
      child: MediaQuery.withClampedTextScaling(
        maxScaleFactor: MediaQuery.sizeOf(context).width < 360 ? 1.0 : 1.2,
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

/// Equal-width responsive grid: phones, unfolded phones and tablets get more columns.
class EduGrid extends StatelessWidget {
  final List<Widget> children;
  final int phone, fold, tablet;
  final double spacing;
  const EduGrid({
    super.key,
    required this.children,
    this.phone = 2,
    this.fold = 3,
    this.tablet = 4,
    this.spacing = 12,
  });
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final columns = EduBreakpoints.columns(
        context,
        constraints.maxWidth,
        phone: phone,
        fold: fold,
        tablet: tablet,
      );
      final width = (constraints.maxWidth - (columns - 1) * spacing) / columns;
      return Wrap(
        spacing: spacing,
        runSpacing: spacing,
        children: [
          for (final child in children) SizedBox(width: width, child: child),
        ],
      );
    },
  );
}

/// Pastel category tile: icon in a white circle, a large value, its label and, when tappable,
/// a round arrow button.
class EduStatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color tint;
  final VoidCallback? onTap;

  /// While true the value shows a shimmer placeholder instead of a figure.
  final bool loading;
  const EduStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.tint = EduTints.clay,
    this.onTap,
    this.loading = false,
  });
  @override
  Widget build(BuildContext context) {
    final ink = EduTints.ink(tint);
    final text = Theme.of(context).textTheme;
    return Semantics(
      button: onTap != null,
      label: loading ? '$label: loading' : '$label: $value',
      excludeSemantics: true,
      child: EduPress(
        child: Material(
          color: tint,
          borderRadius: BorderRadius.circular(22),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: Container(
              height: EduSizes.scaled(context, EduSizes.statTile),
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: const BoxDecoration(
                          color: collegeIvory,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(icon, size: 19, color: ink),
                      ),
                      const Spacer(),
                      if (onTap != null)
                        Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: collegeIvory.withValues(alpha: .75),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            Icons.arrow_outward_rounded,
                            size: 16,
                            color: ink,
                          ),
                        ),
                    ],
                  ),
                  if (loading)
                    EduShimmer(
                      child: EduSkeletonBox(
                        width: 72,
                        height: 26,
                        color: ink.withValues(alpha: .14),
                      ),
                    )
                  else
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        value,
                        maxLines: 1,
                        style: text.headlineSmall?.copyWith(
                          color: ink,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: text.labelMedium?.copyWith(
                      color: ink.withValues(alpha: .85),
                      fontWeight: FontWeight.w600,
                    ),
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

/// Circular progress ring with a centred label; [value] runs 0–1 (null shows an empty ring).
class EduRing extends StatelessWidget {
  final double? value;
  final double size;
  final Color? color;
  final Widget? center;
  const EduRing({
    super.key,
    required this.value,
    this.size = 84,
    this.color,
    this.center,
  });
  @override
  Widget build(BuildContext context) {
    final tone = color ?? Theme.of(context).colorScheme.primary;
    return SizedBox.square(
      dimension: size,
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: (value ?? 0).clamp(0, 1)),
        duration: EduMotion.duration(
          context,
          const Duration(milliseconds: 700),
        ),
        curve: Curves.easeOutCubic,
        builder: (context, v, child) => Stack(
          alignment: Alignment.center,
          children: [
            SizedBox.expand(
              child: CircularProgressIndicator(
                value: v,
                strokeWidth: size * .1,
                strokeCap: StrokeCap.round,
                color: tone,
                backgroundColor: tone.withValues(alpha: .14),
              ),
            ),
            // The centre label shrinks to stay inside the ring at large text sizes.
            if (child != null)
              Padding(
                padding: EdgeInsets.all(size * .17),
                child: FittedBox(fit: BoxFit.scaleDown, child: child),
              ),
          ],
        ),
        child: center,
      ),
    );
  }
}

/// Horizontal pill tabs: the selected pill is filled with light bold text, the others keep dark,
/// readable text. Pills share the full width when they fit, and scroll sideways when they do not.
class EduPillTabs extends StatelessWidget {
  final List<String> labels;
  final int selected;
  final ValueChanged<int>? onSelected;
  const EduPillTabs({
    super.key,
    required this.labels,
    required this.selected,
    required this.onSelected,
  });

  static const _gap = 8.0, _padding = 16.0;

  TextStyle _style(bool on) => TextStyle(
    fontFamily: 'Roboto',
    fontSize: 14,
    fontWeight: on ? FontWeight.w700 : FontWeight.w600,
    color: on ? collegeIvory : collegeEspresso,
  );

  Widget _pill(BuildContext context, int i) {
    final on = i == selected;
    final accent = Theme.of(context).colorScheme.primary;
    return Semantics(
      selected: on,
      button: true,
      child: Material(
        color: on ? accent : collegeIvory,
        shape: StadiumBorder(
          side: BorderSide(color: on ? accent : collegeLine),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onSelected == null ? null : () => onSelected!(i),
          child: Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(horizontal: _padding),
            child: Text(labels[i], maxLines: 1, style: _style(on)),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    height: EduSizes.scaled(context, EduSizes.pillTab),
    child: LayoutBuilder(
      builder: (context, constraints) {
        final scaler = MediaQuery.textScalerOf(context);
        final widths = [
          for (final label in labels)
            (TextPainter(
                  text: TextSpan(text: label, style: _style(true)),
                  textDirection: TextDirection.ltr,
                  textScaler: scaler,
                  maxLines: 1,
                )..layout()).width +
                _padding * 2,
        ];
        final needed =
            widths.fold<double>(0, (a, b) => a + b) +
            _gap * (labels.length - 1);
        if (needed <= constraints.maxWidth) {
          // Fits: share the row, each pill growing in proportion to its label.
          return Row(
            children: [
              for (var i = 0; i < labels.length; i++) ...[
                if (i > 0) const SizedBox(width: _gap),
                Expanded(flex: widths[i].round(), child: _pill(context, i)),
              ],
            ],
          );
        }
        return ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: labels.length,
          separatorBuilder: (_, _) => const SizedBox(width: _gap),
          itemBuilder: _pill,
        );
      },
    ),
  );
}

/// Rounded pill bar chart: each bar fills from the bottom with a value badge; tap to select.
class EduPillBars extends StatelessWidget {
  /// (label, percentage 0–100 or null when pending).
  final List<(String, num?)> bars;
  final int? selected;
  final ValueChanged<int>? onSelected;
  final double height;
  const EduPillBars({
    super.key,
    required this.bars,
    this.selected,
    this.onSelected,
    this.height = 170,
  });
  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    final text = Theme.of(context).textTheme;
    return LayoutBuilder(
      builder: (context, constraints) {
        final width =
            ((constraints.maxWidth - (bars.length - 1) * 10) / bars.length)
                .clamp(36.0, 72.0);
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (var i = 0; i < bars.length; i++) ...[
                if (i > 0) const SizedBox(width: 10),
                Semantics(
                  button: onSelected != null,
                  selected: i == selected,
                  label:
                      '${bars[i].$1}: ${bars[i].$2 == null ? 'pending' : '${bars[i].$2}%'}',
                  excludeSemantics: true,
                  child: GestureDetector(
                    onTap: onSelected == null ? null : () => onSelected!(i),
                    child: Column(
                      children: [
                        Container(
                          width: width,
                          height: height,
                          alignment: Alignment.bottomCenter,
                          decoration: BoxDecoration(
                            color: (i == selected ? accent : collegeWarmGray)
                                .withValues(alpha: .1),
                            borderRadius: BorderRadius.circular(width / 2),
                          ),
                          child: AnimatedContainer(
                            duration: EduMotion.duration(
                              context,
                              EduMotion.page,
                            ),
                            curve: Curves.easeOutCubic,
                            width: width,
                            height: bars[i].$2 == null
                                ? width
                                : (height * (bars[i].$2! / 100).clamp(0, 1))
                                      .clamp(width, height)
                                      .toDouble(),
                            alignment: Alignment.topCenter,
                            padding: const EdgeInsets.only(top: 6),
                            decoration: BoxDecoration(
                              color: bars[i].$2 == null
                                  ? collegeCard
                                  : i == selected
                                  ? accent
                                  : EduTints.all[i % EduTints.all.length],
                              borderRadius: BorderRadius.circular(width / 2),
                            ),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: collegeEspresso,
                                borderRadius: BorderRadius.circular(99),
                              ),
                              child: Text(
                                bars[i].$2 == null ? '—' : '${bars[i].$2}',
                                style: text.labelSmall?.copyWith(
                                  color: collegeIvory,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          bars[i].$1,
                          style: text.labelMedium?.copyWith(
                            color: i == selected ? accent : collegeMuted,
                            fontWeight: i == selected
                                ? FontWeight.w800
                                : FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

/// Rounded quick-action pill: a tinted round icon and its label, all the same height.
class EduQuickAction extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color tint;
  final VoidCallback onTap;
  const EduQuickAction({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
    this.tint = EduTints.clay,
  });
  @override
  Widget build(BuildContext context) => EduPress(
    child: Material(
      color: collegeIvory,
      shape: const StadiumBorder(side: BorderSide(color: collegeLine)),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: EduSizes.scaled(context, EduSizes.quickAction),
          padding: const EdgeInsets.fromLTRB(8, 8, 14, 8),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
                alignment: Alignment.center,
                child: EduModuleIcon(
                  icon: icon,
                  size: 20,
                  color: EduTints.ink(tint),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    height: 1.2,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

/// Horizontally scrolling update card (announcements): tinted, dated, with a category chip.
class EduUpdateCard extends StatelessWidget {
  final String title, body, date, category;
  final Color tint;
  final VoidCallback? onTap;
  const EduUpdateCard({
    super.key,
    required this.title,
    required this.body,
    required this.date,
    this.category = 'Notice',
    this.tint = EduTints.sage,
    this.onTap,
  });
  @override
  Widget build(BuildContext context) {
    final ink = EduTints.ink(tint);
    final text = Theme.of(context).textTheme;
    return Material(
      color: tint,
      borderRadius: BorderRadius.circular(22),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: text.titleMedium?.copyWith(
                        color: ink,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(date, style: text.labelSmall?.copyWith(color: ink)),
                ],
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Text(
                  body,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: text.bodyMedium?.copyWith(color: collegeEspresso),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: collegeIvory.withValues(alpha: .8),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: Text(
                  category,
                  style: text.labelSmall?.copyWith(
                    color: ink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Looping shimmer for loading placeholders; still when the reader prefers reduced motion.
class EduShimmer extends StatefulWidget {
  final Widget child;
  const EduShimmer({super.key, required this.child});
  @override
  State<EduShimmer> createState() => _EduShimmerState();
}

class _EduShimmerState extends State<EduShimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController sweep = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (EduMotion.reduced(context)) {
      sweep.stop();
    } else if (!sweep.isAnimating) {
      sweep.repeat();
    }
  }

  @override
  void dispose() {
    sweep.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Loading',
    child: AnimatedBuilder(
      animation: sweep,
      child: widget.child,
      builder: (context, child) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) => LinearGradient(
          begin: Alignment(-3 + sweep.value * 6, 0),
          end: Alignment(-1 + sweep.value * 6, 0),
          colors: const [
            Color(0x00fffdf8),
            Color(0xaafffdf8),
            Color(0x00fffdf8),
          ],
        ).createShader(bounds),
        child: child,
      ),
    ),
  );
}

/// A rounded placeholder block used inside [EduShimmer].
class EduSkeletonBox extends StatelessWidget {
  final double? width;
  final double height;
  final double radius;
  final Color? color;
  const EduSkeletonBox({
    super.key,
    this.width,
    this.height = 14,
    this.radius = 8,
    this.color,
  });
  @override
  Widget build(BuildContext context) => Container(
    width: width,
    height: height,
    decoration: BoxDecoration(
      color: color ?? collegeCard,
      borderRadius: BorderRadius.circular(radius),
    ),
  );
}

/// Placeholder card shaped like an analytics card: a ring and a few lines.
class EduCardSkeleton extends StatelessWidget {
  final double height;
  const EduCardSkeleton({super.key, this.height = 140});
  @override
  Widget build(BuildContext context) => EduShimmer(
    child: Container(
      height: height,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: collegeIvory,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: collegeLine),
      ),
      child: const Row(
        children: [
          EduSkeletonBox(width: 84, height: 84, radius: 42),
          SizedBox(width: 16),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                EduSkeletonBox(width: 150, height: 14),
                SizedBox(height: 10),
                EduSkeletonBox(width: 110, height: 10),
                SizedBox(height: 10),
                EduSkeletonBox(width: 180, height: 10),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Workspace (More) screen components: compact, white, lightly bordered.

/// Tokens for the workspace screen; the accent always comes from the role theme.
abstract final class EduWorkspace {
  static const surface = Colors.white;
  static const border = Color(0xffe8eaf1);
  static const tile = Color(0xfff8f8fa);
  static const ink = Color(0xff17213b);
  static const muted = Color(0xff697386);
  static const shadow = [
    BoxShadow(color: Color(0x0d17213b), blurRadius: 12, offset: Offset(0, 3)),
  ];
}

/// Title text with every match of [query] in bold accent colour.
class EduHighlightText extends StatelessWidget {
  final String text, query;
  final TextStyle? style;
  final int maxLines;
  const EduHighlightText(
    this.text, {
    super.key,
    this.query = '',
    this.style,
    this.maxLines = 2,
  });
  @override
  Widget build(BuildContext context) {
    final q = query.trim().toLowerCase();
    final at = q.isEmpty ? -1 : text.toLowerCase().indexOf(q);
    if (at < 0) {
      return Text(
        text,
        maxLines: maxLines,
        overflow: TextOverflow.ellipsis,
        style: style,
      );
    }
    final accent = Theme.of(context).colorScheme.primary;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(text: text.substring(0, at)),
          TextSpan(
            text: text.substring(at, at + q.length),
            style: TextStyle(color: accent, fontWeight: FontWeight.w800),
          ),
          TextSpan(text: text.substring(at + q.length)),
        ],
      ),
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
      style: style,
    );
  }
}

/// Search field with a clear button and an optional filter button (with an active dot).
class EduSearchField extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String hint;
  final VoidCallback? onFilter;
  final bool filtered;
  const EduSearchField({
    super.key,
    required this.controller,
    required this.onChanged,
    this.hint = 'Search',
    this.onFilter,
    this.filtered = false,
  });
  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    final outline = OutlineInputBorder(
      borderRadius: BorderRadius.circular(15),
      borderSide: const BorderSide(color: EduWorkspace.border),
    );
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) => TextField(
        controller: controller,
        onChanged: onChanged,
        textInputAction: TextInputAction.search,
        onTapOutside: (_) => FocusScope.of(context).unfocus(),
        decoration: InputDecoration(
          hintText: hint,
          filled: true,
          fillColor: EduWorkspace.surface,
          isDense: false,
          contentPadding: const EdgeInsets.symmetric(vertical: 14),
          prefixIcon: const Icon(
            Icons.search_rounded,
            color: EduWorkspace.muted,
          ),
          border: outline,
          enabledBorder: outline,
          focusedBorder: outline.copyWith(
            borderSide: BorderSide(color: accent, width: 1.4),
          ),
          suffixIcon: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (value.text.isNotEmpty)
                IconButton(
                  tooltip: 'Clear search',
                  icon: const Icon(Icons.close_rounded, size: 20),
                  onPressed: () {
                    controller.clear();
                    onChanged('');
                  },
                ),
              if (onFilter != null)
                IconButton(
                  tooltip: 'Filter modules',
                  onPressed: onFilter,
                  icon: Badge(
                    isLabelVisible: filtered,
                    smallSize: 8,
                    backgroundColor: accent,
                    child: const Icon(Icons.tune_rounded, size: 21),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Square quick-action card: tinted icon box over a short label.
class EduActionCard extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color tint;
  final VoidCallback onTap;
  const EduActionCard({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
    this.tint = EduTints.clay,
  });
  @override
  Widget build(BuildContext context) => EduPress(
    child: Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: EduWorkspace.shadow,
      ),
      child: Material(
        color: EduWorkspace.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: EduWorkspace.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(6, 12, 6, 10),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: tint,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, size: 22, color: EduTints.ink(tint)),
                ),
                const SizedBox(height: 8),
                Text(
                  label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: EduWorkspace.ink,
                    fontWeight: FontWeight.w600,
                    height: 1.15,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

/// Compact module tile: icon box and title (wraps to two lines).
class EduModuleTile extends StatelessWidget {
  final String title, query;
  final IconData icon;
  final Color tint;
  final VoidCallback onTap;
  const EduModuleTile({
    super.key,
    required this.title,
    required this.icon,
    required this.onTap,
    this.query = '',
    this.tint = EduTints.clay,
  });
  @override
  Widget build(BuildContext context) {
    final accent = Theme.of(context).colorScheme.primary;
    return EduPress(
      child: Material(
        color: EduWorkspace.tile,
        borderRadius: BorderRadius.circular(12),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          highlightColor: accent.withValues(alpha: .06),
          splashColor: accent.withValues(alpha: .08),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 60),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 10, 8, 10),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: tint,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, size: 20, color: EduTints.ink(tint)),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        var style = Theme.of(context).textTheme.bodyMedium
                            ?.copyWith(
                              color: EduWorkspace.ink,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w600,
                              height: 1.2,
                            );
                        // Shrink slightly when one long word would otherwise break mid-word.
                        final scaler = MediaQuery.textScalerOf(context);
                        var widest = 0.0;
                        for (final word in title.split(' ')) {
                          final painter = TextPainter(
                            text: TextSpan(text: word, style: style),
                            textDirection: TextDirection.ltr,
                            textScaler: scaler,
                          )..layout();
                          if (painter.width > widest) widest = painter.width;
                        }
                        final room = constraints.maxWidth - 4;
                        if (widest > room && widest > 0) {
                          style = style?.copyWith(
                            fontSize: (13.5 * room / widest).clamp(10.5, 13.5),
                          );
                        }
                        return EduHighlightText(
                          title,
                          query: query,
                          style: style,
                        );
                      },
                    ),
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

/// Expandable category card: icon, title, module count and a rotating chevron over a
/// grid of [EduModuleTile]s (1 column on small or enlarged text, 2 on phones, 3 on tablets).
class EduCategorySection extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color tint;
  final bool expanded;
  final VoidCallback onToggle;
  final List<Widget> tiles;
  const EduCategorySection({
    super.key,
    required this.title,
    required this.icon,
    required this.expanded,
    required this.onToggle,
    required this.tiles,
    this.tint = EduTints.clay,
  });
  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final duration = EduMotion.duration(
      context,
      const Duration(milliseconds: 240),
    );
    return Container(
      decoration: BoxDecoration(
        color: EduWorkspace.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: EduWorkspace.border),
        boxShadow: EduWorkspace.shadow,
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            button: true,
            expanded: expanded,
            child: InkWell(
              onTap: onToggle,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: tint,
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: Icon(icon, size: 21, color: EduTints.ink(tint)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            style: text.titleMedium?.copyWith(
                              color: EduWorkspace.ink,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            '${tiles.length} module${tiles.length == 1 ? '' : 's'}',
                            style: text.bodySmall?.copyWith(
                              color: EduWorkspace.muted,
                            ),
                          ),
                        ],
                      ),
                    ),
                    AnimatedRotation(
                      turns: expanded ? .5 : 0,
                      duration: duration,
                      curve: Curves.easeOutCubic,
                      child: const Icon(
                        Icons.keyboard_arrow_down_rounded,
                        color: EduWorkspace.muted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          AnimatedSize(
            duration: duration,
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: !expanded
                ? const SizedBox(width: double.infinity)
                : Padding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final columns =
                            MediaQuery.textScalerOf(context).scale(16) > 22 ||
                                constraints.maxWidth < 300
                            ? 1
                            : constraints.maxWidth >= 560
                            ? 3
                            : 2;
                        final width =
                            (constraints.maxWidth - (columns - 1) * 10) /
                            columns;
                        return Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            for (final tile in tiles)
                              SizedBox(width: width, child: tile),
                          ],
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
