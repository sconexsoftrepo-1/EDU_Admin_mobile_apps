import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// One motion vocabulary, with the OS accessibility preference taking priority.
abstract final class EduMotion {
  static const press = Duration(milliseconds: 130);
  static const tab = Duration(milliseconds: 220);
  static const page = Duration(milliseconds: 280);
  static bool reduced(BuildContext context) =>
      MediaQuery.disableAnimationsOf(context) ||
      MediaQuery.accessibleNavigationOf(context);
  static Duration duration(BuildContext context, Duration value) =>
      reduced(context) ? Duration.zero : value;
}

class EduPageTransitions extends PageTransitionsBuilder {
  const EduPageTransitions();
  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (EduMotion.reduced(context)) return child;
    final curve = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
    );
    return FadeTransition(
      opacity: curve,
      child: SlideTransition(
        position: Tween(
          begin: const Offset(.025, .035),
          end: Offset.zero,
        ).animate(curve),
        child: child,
      ),
    );
  }
}

class EduPress extends StatefulWidget {
  final Widget child;
  const EduPress({super.key, required this.child});
  @override
  State<EduPress> createState() => _EduPressState();
}

class _EduPressState extends State<EduPress> {
  bool pressed = false;
  @override
  Widget build(BuildContext context) => Listener(
    onPointerDown: (_) => setState(() => pressed = true),
    onPointerUp: (_) => setState(() => pressed = false),
    onPointerCancel: (_) => setState(() => pressed = false),
    child: AnimatedScale(
      scale: pressed && !EduMotion.reduced(context) ? .98 : 1,
      duration: EduMotion.duration(context, EduMotion.press),
      curve: Curves.easeOut,
      child: widget.child,
    ),
  );
}

class EduReveal extends StatelessWidget {
  final Widget child;
  final int order;
  const EduReveal({super.key, required this.child, this.order = 0});
  @override
  Widget build(BuildContext context) {
    if (EduMotion.reduced(context)) return child;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 320 + order.clamp(0, 4) * 45),
      curve: Curves.easeOutCubic,
      child: child,
      builder: (_, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, (1 - value) * 12),
          child: child,
        ),
      ),
    );
  }
}

class EduProgress extends StatelessWidget {
  final double value;
  final Color? color;
  const EduProgress({super.key, required this.value, this.color});
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: value.clamp(0, 1)),
    duration: EduMotion.duration(context, const Duration(milliseconds: 450)),
    curve: Curves.easeOutCubic,
    builder: (_, v, _) => LinearProgressIndicator(
      value: v,
      minHeight: 7,
      color: color ?? Theme.of(context).colorScheme.primary,
      backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(8),
    ),
  );
}

/// A finite warm shimmer: no idle ticker or endless decorative loop.
class EduLoadingSkeleton extends StatelessWidget {
  const EduLoadingSkeleton({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Loading college records',
    liveRegion: true,
    child: TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: EduMotion.duration(context, const Duration(milliseconds: 1100)),
      builder: (_, v, _) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) => LinearGradient(
          begin: Alignment(-3 + v * 6, 0),
          end: Alignment(-1 + v * 6, 0),
          colors: const [
            Color(0x00fffdf8),
            Color(0x99fffdf8),
            Color(0x00fffdf8),
          ],
        ).createShader(bounds),
        child: Column(
          children: List.generate(
            3,
            (i) => Container(
              height: i == 0 ? 100 : 68,
              margin: const EdgeInsets.symmetric(vertical: 8),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Theme.of(
                        context,
                      ).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          height: 10,
                          width: 140,
                          color: Theme.of(
                            context,
                          ).colorScheme.surfaceContainerHighest,
                        ),
                        const SizedBox(height: 10),
                        Container(
                          height: 8,
                          width: 90,
                          color: Theme.of(
                            context,
                          ).colorScheme.surfaceContainerHighest,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/// Uses the existing RefreshIndicator gesture/state machine and its real request
/// future. Only this overlay rebuilds during dragging; [child] stays stable.
class EduNexaAnimatedRefresh extends StatefulWidget {
  final Widget child;
  final Future<void> Function() onRefresh;
  const EduNexaAnimatedRefresh({
    super.key,
    required this.child,
    required this.onRefresh,
  });
  @override
  State<EduNexaAnimatedRefresh> createState() => _EduNexaAnimatedRefreshState();
}

class _EduNexaAnimatedRefreshState extends State<EduNexaAnimatedRefresh>
    with SingleTickerProviderStateMixin {
  late final AnimationController pages;
  @override
  void initState() {
    super.initState();
    pages = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1150),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (EduMotion.reduced(context)) {
      pages.stop();
    } else if (loading && !pages.isAnimating) {
      pages.repeat();
    }
  }

  double pull = 0;
  bool loading = false, visible = false;
  bool? succeeded;
  bool armed = false;
  @override
  void dispose() {
    pages.dispose();
    super.dispose();
  }

  Future<void> refresh() async {
    if (loading) return;
    setState(() {
      loading = true;
      visible = true;
      pull = 1;
      succeeded = null;
    });
    if (!EduMotion.reduced(context)) pages.repeat();
    try {
      await widget.onRefresh();
      if (mounted) setState(() => succeeded = true);
    } catch (_) {
      if (mounted) setState(() => succeeded = false);
    } finally {
      if (mounted) pages.stop();
      if (mounted) {
        setState(() => loading = false);
        // Completion feedback follows the real result; never drives the request.
        await Future<void>.delayed(
          EduMotion.duration(context, const Duration(milliseconds: 380)),
        );
        if (mounted) {
          setState(() {
            visible = false;
            pull = 0;
          });
        }
      }
    }
  }

  @override
  Widget build(
    BuildContext context,
  ) => NotificationListener<ScrollNotification>(
    onNotification: (n) {
      if (n.depth != 0 || loading || succeeded != null) return false;
      double? next;
      if (n is OverscrollNotification && n.overscroll < 0) {
        next = (pull - n.overscroll / 100).clamp(0, 1);
      } else if (n is ScrollUpdateNotification && n.metrics.pixels < 0) {
        next = (-n.metrics.pixels / 100).clamp(0, 1);
      }
      if (next != null) {
        setState(() {
          pull = next!;
          visible = pull > .02;
        });
      }
      return false;
    },
    child: Stack(
      children: [
        RefreshIndicator.noSpinner(
          onRefresh: refresh,
          onStatusChange: (status) {
            if (status == RefreshIndicatorStatus.drag && succeeded != null) {
              setState(() {
                succeeded = null;
                pull = 0;
              });
            }
            if (status == RefreshIndicatorStatus.armed && !armed) {
              armed = true;
              if (!EduMotion.reduced(context)) HapticFeedback.selectionClick();
            }
            if (status == null) {
              armed = false;
              if (!loading && succeeded == null) {
                setState(() {
                  visible = false;
                  pull = 0;
                });
              }
            }
          },
          child: widget.child,
        ),
        if (visible)
          Positioned(
            top: 4,
            left: 0,
            right: 0,
            child: IgnorePointer(
              child: Center(
                child: Semantics(
                  liveRegion: true,
                  label: loading
                      ? 'Refreshing college records'
                      : succeeded == true
                      ? 'Refresh complete'
                      : succeeded == false
                      ? 'Refresh failed. Use retry.'
                      : 'Pull to refresh',
                  child: RepaintBoundary(
                    child: AnimatedBuilder(
                      animation: pages,
                      builder: (_, _) => Transform.scale(
                        scale: .7 + pull * .3,
                        child: Container(
                          width: 100,
                          height: 86,
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.surface,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: Theme.of(
                                context,
                              ).colorScheme.outlineVariant,
                            ),
                          ),
                          child: Stack(
                            alignment: Alignment.center,
                            children: [
                              SizedBox(
                                width: 74,
                                height: 74,
                                child: CircularProgressIndicator(
                                  value: loading && !EduMotion.reduced(context)
                                      ? null
                                      : pull,
                                  strokeWidth: 1.5,
                                  color: succeeded == false
                                      ? Theme.of(context).colorScheme.error
                                      : Theme.of(context).colorScheme.secondary,
                                ),
                              ),
                              if (succeeded == true)
                                SvgPicture.asset(
                                  'assets/motion/success_check.svg',
                                  width: 42,
                                )
                              else if (succeeded == false)
                                Icon(
                                  Icons.sync_problem_outlined,
                                  color: Theme.of(context).colorScheme.error,
                                  size: 34,
                                )
                              else ...[
                                Transform(
                                  alignment: Alignment.center,
                                  transform: Matrix4.identity()
                                    ..rotateY(
                                      loading
                                          ? math.sin(
                                                  pages.value * math.pi * 2,
                                                ) *
                                                .22
                                          : (1 - pull) * .5,
                                    ),
                                  child: SvgPicture.asset(
                                    'assets/motion/refresh_book.svg',
                                    width: 55,
                                  ),
                                ),
                                if (loading || armed)
                                  SizedBox(
                                    width: 55,
                                    height: 48,
                                    child: CustomPaint(
                                      painter: _TurningPagePainter(
                                        loading ? pages.value : .1,
                                      ),
                                    ),
                                  ),
                                Positioned(
                                  right: 12,
                                  top: 10,
                                  child: Transform.rotate(
                                    angle:
                                        -.3 +
                                        (loading
                                            ? math.sin(
                                                    pages.value * math.pi * 2,
                                                  ) *
                                                  .12
                                            : pull * .18),
                                    child: SvgPicture.asset(
                                      'assets/motion/refresh_pencil.svg',
                                      height: 40,
                                    ),
                                  ),
                                ),
                                Positioned(
                                  left: 14,
                                  top: 12,
                                  child: Opacity(
                                    opacity: pull,
                                    child: SvgPicture.asset(
                                      'assets/motion/refresh_sparkles.svg',
                                      width: 13,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    ),
  );
}

class _TurningPagePainter extends CustomPainter {
  final double progress;
  const _TurningPagePainter(this.progress);
  @override
  void paint(Canvas canvas, Size size) {
    final x = size.width / 2;
    final spread = math.cos(progress * math.pi * 2) * size.width * .38;
    final lift = math.sin(progress * math.pi * 2).abs() * 12;
    final page = Path()
      ..moveTo(x, 7)
      ..quadraticBezierTo(x + spread * .5, 2 - lift, x + spread, 8)
      ..lineTo(x + spread, size.height - 9)
      ..quadraticBezierTo(
        x + spread * .5,
        size.height - 16 - lift,
        x,
        size.height - 6,
      )
      ..close();
    canvas.drawPath(page, Paint()..color = const Color(0xffede4d7));
    canvas.drawPath(
      page,
      Paint()
        ..color = const Color(0xff74866b)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2,
    );
  }

  @override
  bool shouldRepaint(_TurningPagePainter oldDelegate) =>
      oldDelegate.progress != progress;
}
