part of '../../app/edunexa_client.dart';

abstract final class EduAuthPalette {
  static const background = Color(0xfff8f2e9), surface = Color(0xfffffdf8);
  static const terracotta = Color(0xffc56f4e), clay = Color(0xffa34e35);
  static const forest = Color(0xff2f6b4f), sage = Color(0xffa7b89f);
  static const peach = Color(0xfff5d8c3), border = Color(0xffe9d9c6);
  static const ink = Color(0xff342d28), muted = Color(0xff776f67);
  static Color accent(MobileRole role) =>
      role == MobileRole.parent || role == MobileRole.teacher ? forest : clay;
}

Widget authIllustration(String name, {double? width, double? height}) =>
    ExcludeSemantics(
      child: SvgPicture.asset(
        'assets/illustrations/auth/$name.svg',
        width: width,
        height: height,
        fit: BoxFit.contain,
      ),
    );

/// One entrance clock, with cached widget children and no perpetual movement.
class EduAuthEntrance extends StatelessWidget {
  final Animation<double> animation;
  final double start, end, rise;
  final Widget child;
  const EduAuthEntrance({
    super.key,
    required this.animation,
    required this.child,
    this.start = 0,
    this.end = 1,
    this.rise = 10,
  });
  @override
  Widget build(BuildContext context) {
    if (EduMotion.reduced(context)) return child;
    return AnimatedBuilder(
      animation: animation,
      child: child,
      builder: (context, child) {
        final v = Interval(
          start,
          end,
          curve: Curves.easeOutCubic,
        ).transform(animation.value);
        return IgnorePointer(
          ignoring: v < .05,
          child: Opacity(
            opacity: v,
            child: Transform.translate(
              offset: Offset(0, (1 - v) * rise),
              child: child,
            ),
          ),
        );
      },
    );
  }
}

class EduAuthBrandHeader extends StatelessWidget {
  final bool staff, compact;
  final Animation<double> animation;
  const EduAuthBrandHeader({
    super.key,
    required this.staff,
    required this.animation,
    this.compact = false,
  });
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      EduAuthEntrance(
        animation: animation,
        start: .10,
        end: .48,
        rise: 0,
        child: AnimatedBuilder(
          animation: animation,
          child: Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: EduAuthPalette.surface,
              borderRadius: BorderRadius.circular(23),
              border: Border.all(color: EduAuthPalette.border),
              boxShadow: [
                BoxShadow(
                  color: EduAuthPalette.ink.withValues(alpha: .07),
                  blurRadius: 18,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Image.asset(
              'assets/icons/image.png',
              key: const ValueKey('auth-original-icon'),
              width: compact ? 62 : 72,
              height: compact ? 62 : 72,
              cacheWidth: 384,
              fit: BoxFit.contain,
              semanticLabel: staff
                  ? 'EduNexa Admin & Teacher app icon'
                  : 'EduNexa Parent & Student app icon',
            ),
          ),
          builder: (context, child) => Transform.scale(
            scale: EduMotion.reduced(context)
                ? 1
                : .90 + .10 * Curves.easeOutCubic.transform(animation.value),
            child: child,
          ),
        ),
      ),
      const SizedBox(height: 9),
      EduAuthEntrance(
        animation: animation,
        start: .19,
        end: .59,
        child: const Text(
          'EduNexa',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            letterSpacing: -1,
            color: EduAuthPalette.ink,
            height: 1.1,
          ),
        ),
      ),
      const SizedBox(height: 3),
      EduAuthEntrance(
        animation: animation,
        start: .25,
        end: .64,
        rise: 5,
        child: Text(
          staff ? 'Admin & Teacher' : 'Parent & Student',
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 12,
            color: EduAuthPalette.muted,
            height: 1.35,
          ),
        ),
      ),
    ],
  );
}

class EduAuthBackdrop extends StatelessWidget {
  const EduAuthBackdrop({super.key});
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: IgnorePointer(
      child: RepaintBoundary(
        child: Stack(
          children: [
            Positioned(
              right: -23,
              top: 8,
              child: Opacity(
                opacity: .40,
                child: Transform.rotate(
                  angle: .32,
                  child: authIllustration('academic_leaves', height: 140),
                ),
              ),
            ),
            Positioned(
              left: -29,
              bottom: 10,
              child: Opacity(
                opacity: .43,
                child: Transform.rotate(
                  angle: -.18,
                  child: authIllustration('academic_leaves', height: 170),
                ),
              ),
            ),
            Positioned(
              top: 100,
              left: -18,
              right: -18,
              child: Opacity(
                opacity: .30,
                child: authIllustration('academic_clouds', height: 120),
              ),
            ),
            Positioned(
              left: -60,
              top: 240,
              child: Opacity(
                opacity: .22,
                child: authIllustration('role_selection_accents', width: 185),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class AnimatedRoleTile extends StatefulWidget {
  final MobileRole role;
  final bool selected, enabled;
  final VoidCallback onTap;
  const AnimatedRoleTile({
    super.key,
    required this.role,
    required this.selected,
    required this.onTap,
    this.enabled = true,
  });
  @override
  State<AnimatedRoleTile> createState() => _AnimatedRoleTileState();
}

class _AnimatedRoleTileState extends State<AnimatedRoleTile> {
  bool pressed = false;
  @override
  Widget build(BuildContext context) {
    final accent = EduAuthPalette.accent(widget.role);
    final selected = widget.selected;
    return Semantics(
      button: true,
      selected: selected,
      enabled: widget.enabled,
      child: Listener(
        onPointerDown: widget.enabled
            ? (_) => setState(() => pressed = true)
            : null,
        onPointerUp: (_) => setState(() => pressed = false),
        onPointerCancel: (_) => setState(() => pressed = false),
        child: AnimatedScale(
          scale: pressed && !EduMotion.reduced(context) ? .98 : 1,
          duration: EduMotion.duration(
            context,
            const Duration(milliseconds: 150),
          ),
          child: AnimatedContainer(
            duration: EduMotion.duration(
              context,
              const Duration(milliseconds: 260),
            ),
            curve: Curves.easeOutCubic,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(23),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: selected
                    ? (accent == EduAuthPalette.forest
                          ? [const Color(0xff438060), EduAuthPalette.forest]
                          : [const Color(0xffb75d3d), EduAuthPalette.clay])
                    : [EduAuthPalette.surface, const Color(0xfffbf3e8)],
              ),
              border: Border.all(
                color: selected ? accent : EduAuthPalette.border,
                width: selected ? 1.5 : 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: accent.withValues(
                    alpha: pressed
                        ? .025
                        : selected
                        ? .16
                        : .045,
                  ),
                  offset: Offset(
                    0,
                    pressed
                        ? 1
                        : selected
                        ? 7
                        : 3,
                  ),
                  blurRadius: pressed
                      ? 5
                      : selected
                      ? 18
                      : 10,
                ),
              ],
            ),
            child: Material(
              type: MaterialType.transparency,
              borderRadius: BorderRadius.circular(23),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: widget.enabled ? widget.onTap : null,
                borderRadius: BorderRadius.circular(23),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: LayoutBuilder(
                    builder: (context, c) {
                      final enlarged =
                          MediaQuery.textScalerOf(context).scale(14) > 20;
                      final artWidth = enlarged
                          ? 62.0
                          : c.maxWidth < 270
                          ? 82.0
                          : 100.0;
                      return ConstrainedBox(
                        constraints: const BoxConstraints(minHeight: 100),
                        child: Row(
                          children: [
                            TweenAnimationBuilder<double>(
                              tween: Tween(begin: 0, end: selected ? 1 : 0),
                              duration: EduMotion.duration(
                                context,
                                const Duration(milliseconds: 420),
                              ),
                              curve: Curves.easeOutCubic,
                              child: authIllustration(
                                '${widget.role.name}_role',
                                width: artWidth,
                                height: enlarged ? 90 : 110,
                              ),
                              builder: (context, v, child) =>
                                  Transform.translate(
                                    offset: Offset(0, -3 * v),
                                    child: Transform.rotate(
                                      angle: EduMotion.reduced(context)
                                          ? 0
                                          : -.018 * v,
                                      child: child,
                                    ),
                                  ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          widget.role.label,
                                          style: TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.w700,
                                            height: 1.25,
                                            color: selected
                                                ? EduAuthPalette.surface
                                                : EduAuthPalette.ink,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 5),
                                      AnimatedSwitcher(
                                        duration: EduMotion.duration(
                                          context,
                                          const Duration(milliseconds: 210),
                                        ),
                                        transitionBuilder: (child, animation) =>
                                            ScaleTransition(
                                              scale: animation,
                                              child: FadeTransition(
                                                opacity: animation,
                                                child: child,
                                              ),
                                            ),
                                        child: Container(
                                          key: ValueKey(
                                            'role-${widget.role.name}-$selected',
                                          ),
                                          width: 27,
                                          height: 27,
                                          decoration: BoxDecoration(
                                            color: selected
                                                ? EduAuthPalette.surface
                                                : accent.withValues(alpha: .08),
                                            shape: BoxShape.circle,
                                          ),
                                          child: selected
                                              ? TweenAnimationBuilder<double>(
                                                  tween: Tween(
                                                    begin: 0,
                                                    end: 1,
                                                  ),
                                                  duration: EduMotion.duration(
                                                    context,
                                                    const Duration(
                                                      milliseconds: 220,
                                                    ),
                                                  ),
                                                  builder: (context, v, _) =>
                                                      CustomPaint(
                                                        painter:
                                                            _EduAuthCheckPainter(
                                                              v,
                                                              accent,
                                                            ),
                                                      ),
                                                )
                                              : Icon(
                                                  Icons.arrow_forward_rounded,
                                                  color: accent,
                                                  size: 17,
                                                ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 7),
                                  Text(
                                    widget.role.description,
                                    style: TextStyle(
                                      fontSize: 13,
                                      height: 1.4,
                                      color: selected
                                          ? EduAuthPalette.surface
                                          : EduAuthPalette.muted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _EduAuthCheckPainter extends CustomPainter {
  final double progress;
  final Color color;
  const _EduAuthCheckPainter(this.progress, this.color);
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * .27, size.height * .51)
      ..lineTo(size.width * .44, size.height * .67)
      ..lineTo(size.width * .75, size.height * .33);
    final metric = path.computeMetrics().first;
    canvas.drawPath(
      metric.extractPath(0, metric.length * progress),
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(_EduAuthCheckPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.color != color;
}

class AnimatedRoleSwitcher extends StatelessWidget {
  final List<MobileRole> roles;
  final MobileRole selected;
  final ValueChanged<MobileRole> onChanged;
  final bool enabled;
  const AnimatedRoleSwitcher({
    super.key,
    required this.roles,
    required this.selected,
    required this.onChanged,
    this.enabled = true,
  });
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      final vertical = MediaQuery.textScalerOf(context).scale(14) > 20;
      Widget option(MobileRole role) => Semantics(
        selected: selected == role,
        child: TextButton(
          onPressed: enabled ? () => onChanged(role) : null,
          style: TextButton.styleFrom(
            minimumSize: const Size(48, 48),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
            foregroundColor: role == selected
                ? EduAuthPalette.surface
                : EduAuthPalette.ink,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(role.icon, size: 18),
              const SizedBox(width: 7),
              Flexible(
                child: Text(
                  role.label,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
      if (vertical) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: roles
              .map(
                (r) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: AnimatedContainer(
                    duration: EduMotion.duration(context, EduMotion.tab),
                    decoration: BoxDecoration(
                      color: r == selected
                          ? EduAuthPalette.accent(r)
                          : EduAuthPalette.surface,
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(color: EduAuthPalette.border),
                    ),
                    child: option(r),
                  ),
                ),
              )
              .toList(),
        );
      }
      return Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(
          color: const Color(0xfff0e6d9),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: EduAuthPalette.border),
        ),
        child: Stack(
          children: [
            Positioned.fill(
              child: AnimatedAlign(
                alignment: Alignment(
                  roles.length < 2
                      ? 0
                      : -1 + 2 * roles.indexOf(selected) / (roles.length - 1),
                  0,
                ),
                duration: EduMotion.duration(
                  context,
                  const Duration(milliseconds: 250),
                ),
                curve: Curves.easeOutCubic,
                child: FractionallySizedBox(
                  widthFactor: 1 / roles.length,
                  heightFactor: 1,
                  child: AnimatedContainer(
                    duration: EduMotion.duration(context, EduMotion.tab),
                    decoration: BoxDecoration(
                      color: EduAuthPalette.accent(selected),
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ),
            Row(
              children: roles.map((r) => Expanded(child: option(r))).toList(),
            ),
          ],
        ),
      );
    },
  );
}

class EduAuthTextField extends StatefulWidget {
  final TextEditingController controller;
  final String label, icon;
  final bool enabled, obscure;
  final Widget? suffix;
  final String? Function(String?) validator;
  final TextInputAction action;
  final Iterable<String> autofill;
  final ValueChanged<String>? onSubmitted, onChanged;
  const EduAuthTextField({
    super.key,
    required this.controller,
    required this.label,
    required this.icon,
    required this.validator,
    required this.action,
    required this.autofill,
    this.enabled = true,
    this.obscure = false,
    this.suffix,
    this.onSubmitted,
    this.onChanged,
  });
  @override
  State<EduAuthTextField> createState() => _EduAuthTextFieldState();
}

class _EduAuthTextFieldState extends State<EduAuthTextField> {
  final focus = FocusNode();
  @override
  void initState() {
    super.initState();
    focus.addListener(updateFocus);
  }

  void updateFocus() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    focus.removeListener(updateFocus);
    focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedContainer(
    duration: EduMotion.duration(context, const Duration(milliseconds: 170)),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(16),
      boxShadow: focus.hasFocus
          ? [
              BoxShadow(
                color: Theme.of(
                  context,
                ).colorScheme.primary.withValues(alpha: .10),
                blurRadius: 12,
                offset: const Offset(0, 3),
              ),
            ]
          : [],
    ),
    child: TextFormField(
      controller: widget.controller,
      focusNode: focus,
      enabled: widget.enabled,
      obscureText: widget.obscure,
      autocorrect: false,
      enableSuggestions: false,
      textInputAction: widget.action,
      autofillHints: widget.autofill,
      keyboardType: TextInputType.text,
      textCapitalization: TextCapitalization.none,
      scrollPadding: const EdgeInsets.fromLTRB(20, 24, 20, 96),
      onFieldSubmitted: widget.onSubmitted,
      onChanged: widget.onChanged,
      validator: widget.validator,
      style: const TextStyle(fontSize: 14, color: EduAuthPalette.ink),
      decoration: InputDecoration(
        labelText: widget.label,
        filled: true,
        fillColor: EduAuthPalette.surface,
        labelStyle: const TextStyle(fontSize: 13, color: EduAuthPalette.muted),
        floatingLabelStyle: TextStyle(
          color: Theme.of(context).colorScheme.primary,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 15,
          vertical: 17,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: EduAuthPalette.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: EduAuthPalette.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: Theme.of(context).colorScheme.primary,
            width: 1.7,
          ),
        ),
        prefixIcon: Padding(
          padding: const EdgeInsets.all(15),
          child: SvgPicture.asset(
            'assets/illustrations/auth/${widget.icon}.svg',
            width: 20,
            height: 20,
            colorFilter: ColorFilter.mode(
              focus.hasFocus
                  ? Theme.of(context).colorScheme.primary
                  : EduAuthPalette.muted,
              BlendMode.srcIn,
            ),
          ),
        ),
        suffixIcon: widget.suffix,
      ),
    ),
  );
}

class AnimatedAuthButton extends StatefulWidget {
  final String label;
  final bool busy;
  final Color color;
  final VoidCallback? onPressed;
  const AnimatedAuthButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.color = EduAuthPalette.clay,
  });
  @override
  State<AnimatedAuthButton> createState() => _AnimatedAuthButtonState();
}

class _AnimatedAuthButtonState extends State<AnimatedAuthButton> {
  bool pressed = false;
  @override
  Widget build(BuildContext context) => Listener(
    onPointerDown: widget.onPressed == null
        ? null
        : (_) => setState(() => pressed = true),
    onPointerUp: (_) => setState(() => pressed = false),
    onPointerCancel: (_) => setState(() => pressed = false),
    child: AnimatedScale(
      scale: pressed && !EduMotion.reduced(context) ? .98 : 1,
      duration: EduMotion.duration(context, const Duration(milliseconds: 140)),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          boxShadow: widget.onPressed == null
              ? []
              : [
                  BoxShadow(
                    color: widget.color.withValues(alpha: pressed ? .06 : .16),
                    blurRadius: pressed ? 4 : 12,
                    offset: Offset(0, pressed ? 1 : 5),
                  ),
                ],
        ),
        child: FilledButton(
          onPressed: widget.onPressed,
          style: FilledButton.styleFrom(
            backgroundColor: widget.color,
            foregroundColor: EduAuthPalette.surface,
            minimumSize: const Size(double.infinity, 54),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            textStyle: const TextStyle(
              fontFamily: 'Roboto',
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.busy) ...[
                const SizedBox(
                  width: 17,
                  height: 17,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: EduAuthPalette.surface,
                  ),
                ),
                const SizedBox(width: 11),
              ],
              Flexible(child: Text(widget.label)),
              if (!widget.busy) ...[
                const SizedBox(width: 10),
                AnimatedSlide(
                  offset: pressed && !EduMotion.reduced(context)
                      ? const Offset(.2, 0)
                      : Offset.zero,
                  duration: EduMotion.duration(
                    context,
                    const Duration(milliseconds: 150),
                  ),
                  child: const Icon(Icons.arrow_forward_rounded, size: 19),
                ),
              ],
            ],
          ),
        ),
      ),
    ),
  );
}

class SconexAuthFooter extends StatelessWidget {
  const SconexAuthFooter({super.key});
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      const Text(
        'Designed & Developed by',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 10,
          color: EduAuthPalette.muted,
          height: 1.4,
        ),
      ),
      const SizedBox(height: 5),
      Semantics(
        label: 'Sconex Soft',
        image: true,
        child: ExcludeSemantics(
          child: Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 7,
            children: [
              Image.asset(
                'assets/branding/sconexlogo.webp',
                width: 41,
                height: 24,
                fit: BoxFit.contain,
              ),
              const Text(
                'Sconex Soft',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: EduAuthPalette.ink,
                ),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}
