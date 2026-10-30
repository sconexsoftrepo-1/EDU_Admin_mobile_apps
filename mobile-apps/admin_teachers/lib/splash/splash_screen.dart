import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'splash_assets.dart';
import 'splash_book_animation.dart';
import 'splash_brand_footer.dart';
import 'splash_timeline.dart';

/// Startup readiness and the visual introduction are separate gates. Neither
/// a fast API nor a slow API can shorten, restart or duplicate the normal intro.
class CinematicSplashScreen extends StatefulWidget {
  final SplashConfiguration configuration;
  final bool ready;
  final String? startupError;
  final VoidCallback onComplete;
  final Future<void> Function() onRetry;
  const CinematicSplashScreen({
    super.key,
    required this.configuration,
    required this.ready,
    required this.onComplete,
    required this.onRetry,
    this.startupError,
  });
  @override
  State<CinematicSplashScreen> createState() => _CinematicSplashScreenState();
}

class _CinematicSplashScreenState extends State<CinematicSplashScreen>
    with SingleTickerProviderStateMixin {
  late final SplashTimeline timeline;
  late final ImageProvider icon;
  final ImageProvider logo = const AssetImage(SplashAssets.company);
  bool assetsReady = false,
      preparing = false,
      reduced = false,
      completionQueued = false;
  String? assetError;
  @override
  void initState() {
    super.initState();
    timeline = SplashTimeline(this);
    icon = ResizeImage(AssetImage(widget.configuration.icon), width: 768);
    timeline.controller.addStatusListener(onStatus);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    reduced =
        MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.accessibleNavigationOf(context);
    if (assetsReady && reduced && !timeline.controller.isCompleted) {
      timeline.controller.stop();
      timeline.controller.value = 1;
    }
    if (!assetsReady && !preparing && assetError == null) {
      prepareAssets();
    }
    completeWhenReady();
  }

  @override
  void didUpdateWidget(CinematicSplashScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    completeWhenReady();
  }

  Future<void> cacheRaster(ImageProvider image) async {
    Object? failure;
    await precacheImage(image, context, onError: (e, stack) => failure = e);
    if (failure != null) {
      throw StateError('Brand image could not load');
    }
  }

  Future<void> prepareAssets() async {
    preparing = true;
    try {
      await Future.wait<void>([
        cacheRaster(icon),
        cacheRaster(logo),
        for (final name in SplashAssets.illustrations)
          SvgAssetLoader(
            SplashAssets.svg(name),
          ).loadBytes(context).then<void>((_) {}),
      ]);
      if (!mounted) return;
      setState(() {
        assetsReady = true;
        preparing = false;
        assetError = null;
      });
      if (reduced) {
        timeline.controller.value = 1;
      } else {
        timeline.controller.forward();
      }
      completeWhenReady();
    } catch (_) {
      if (mounted) {
        setState(() {
          preparing = false;
          assetError = 'Splash artwork could not load. Please try again.';
        });
      }
    }
  }

  void onStatus(AnimationStatus status) {
    if (status == AnimationStatus.completed) {
      completeWhenReady();
    }
  }

  void completeWhenReady() {
    if (!mounted ||
        completionQueued ||
        !assetsReady ||
        !timeline.controller.isCompleted ||
        !widget.ready ||
        widget.startupError != null) {
      return;
    }
    completionQueued = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (widget.ready && widget.startupError == null) {
        widget.onComplete();
      } else {
        completionQueued = false;
      }
    });
    // A ready update can arrive while the final frame is held, with no ticker.
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  @override
  void dispose() {
    timeline.controller.removeStatusListener(onStatus);
    timeline.dispose();
    super.dispose();
  }

  Widget svg(String name, {double? height}) => SvgPicture.asset(
    SplashAssets.svg(name),
    height: height,
    fit: BoxFit.contain,
    excludeFromSemantics: true,
    errorBuilder: (context, error, stack) => const SizedBox.shrink(),
  );
  Widget reveal(double p, Widget child, {double rise = 12}) => Opacity(
    opacity: p.clamp(0, 1),
    child: Transform.translate(
      offset: Offset(0, reduced ? 0 : (1 - p) * rise),
      child: child,
    ),
  );
  Widget brand(double p, bool compact, bool enlarged) => reveal(
    p,
    Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          'EduNexa',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: compact ? 32 : 40,
            height: 1.12,
            fontWeight: FontWeight.w800,
            letterSpacing: -1.3,
            color: widget.configuration.family
                ? SplashColors.forest
                : SplashColors.ink,
          ),
        ),
        const SizedBox(height: 7),
        Text(
          widget.configuration.subtitle,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: SplashColors.ink,
            height: 1.35,
          ),
        ),
        if (!enlarged) ...[
          const SizedBox(height: 9),
          Text(
            widget.configuration.tagline,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 11,
              color: widget.configuration.accent,
              height: 1.4,
            ),
          ),
        ],
      ],
    ),
  );
  Widget illustration(double height, bool compact) {
    final t = timeline.value;
    final book = timeline.phase(SplashPhase.book, curve: Curves.linear);
    final iconP = timeline.phase(SplashPhase.icon);
    final spring = Curves.easeOutBack.transform(
      timeline.phase(SplashPhase.icon, curve: Curves.linear),
    );
    return SizedBox(
      height: height,
      child: ExcludeSemantics(
        child: RepaintBoundary(
          child: LayoutBuilder(
            builder: (context, c) => Stack(
              alignment: Alignment.center,
              children: [
                Positioned.fill(
                  child: Opacity(
                    opacity: .22 * book,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: RadialGradient(
                          colors: [
                            SplashColors.gold.withValues(alpha: .32),
                            SplashColors.ivory.withValues(alpha: 0),
                          ],
                          radius: .8,
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned.fill(
                  child: Opacity(opacity: .35 * book, child: svg('golden_arc')),
                ),
                for (var i = 0; i < (compact ? 3 : 7); i++)
                  Builder(
                    builder: (context) {
                      final p = Curves.easeOutCubic.transform(
                        ((t - i * .018) / .70).clamp(0.0, 1.0),
                      );
                      final side = i.isEven ? -1.0 : 1.0;
                      final x =
                          c.maxWidth * .5 +
                          side * (c.maxWidth * (.18 + (i % 3) * .07));
                      final y = c.maxHeight * (.83 - p * (.50 + (i % 3) * .13));
                      return Positioned(
                        left: x,
                        top: y,
                        child: Opacity(
                          opacity: (math.sin(p * math.pi) * .65).clamp(0, 1),
                          child: Transform.rotate(
                            angle:
                                side *
                                (.2 + p * .6) *
                                (widget.configuration.family ? 1 : -1),
                            child: SizedBox(
                              width: i % 3 == 0 ? 15 : 23,
                              height: 30,
                              child: svg(
                                i % 3 == 0
                                    ? 'floating_paper'
                                    : i.isEven
                                    ? 'floating_leaf_01'
                                    : 'floating_leaf_02',
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Opacity(
                    opacity: (1 - iconP * .72).clamp(0, 1),
                    child: SizedBox(
                      height: height * .78,
                      child: SplashBookAnimation(
                        opening: book,
                        progress: t,
                        family: widget.configuration.family,
                        reducedMotion: reduced,
                      ),
                    ),
                  ),
                ),
                if (!compact)
                  Positioned(
                    left: c.maxWidth * .15,
                    top: height * .19,
                    child: Opacity(
                      opacity: book * .45,
                      child: svg('light_particle', height: 15),
                    ),
                  ),
                Opacity(
                  opacity: iconP,
                  child: Transform.scale(
                    scale: reduced ? 1 : .88 + .12 * spring,
                    child: Semantics(
                      label: 'EduNexa ${widget.configuration.subtitle} icon',
                      image: true,
                      child: Image(
                        key: const ValueKey('splash-app-icon'),
                        errorBuilder: (context, error, stack) =>
                            const SizedBox.shrink(),
                        image: icon,
                        width: height * .78,
                        height: height * .78,
                        fit: BoxFit.contain,
                        filterQuality: FilterQuality.medium,
                      ),
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

  Widget campus(double p, double height) => reveal(
    p,
    RepaintBoundary(
      child: Transform.translate(
        offset: Offset(
          reduced ? 0 : (1 - p) * (widget.configuration.family ? -6 : 6),
          0,
        ),
        child: svg('college_campus', height: height),
      ),
    ),
    rise: 22,
  );
  Widget recovery() {
    final error = assetError ?? widget.startupError;
    if (error != null &&
        (timeline.controller.isCompleted || assetError != null)) {
      return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Semantics(
          liveRegion: true,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Couldn’t prepare your workspace',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: SplashColors.ink,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                error,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 12, color: SplashColors.muted),
              ),
              TextButton(
                onPressed: preparing
                    ? null
                    : () async {
                        if (assetError != null) {
                          setState(() => assetError = null);
                          await prepareAssets();
                        } else {
                          await widget.onRetry();
                        }
                      },
                child: const Text('Try again'),
              ),
            ],
          ),
        ),
      );
    }
    if (timeline.controller.isCompleted && !widget.ready) {
      return SizedBox(
        height: 32,
        child: Center(
          child: Semantics(
            liveRegion: true,
            child: const Text(
              'Preparing your workspace…',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: SplashColors.muted,
                fontSize: 12,
                height: 1.4,
              ),
            ),
          ),
        ),
      );
    }
    return const SizedBox(height: 32);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: SplashColors.ivory,
    body: SafeArea(
      child: LayoutBuilder(
        builder: (context, bounds) {
          final compact = bounds.maxHeight < 650;
          final enlarged = MediaQuery.textScalerOf(context).scale(14) > 20;
          final landscape = bounds.maxWidth > bounds.maxHeight * 1.35;
          final height = enlarged
              ? (compact ? 116.0 : 160.0)
              : (compact ? 150.0 : 216.0);
          return AnimatedBuilder(
            animation: timeline.controller,
            builder: (context, _) => Stack(
              children: [
                Positioned.fill(
                  child: IgnorePointer(
                    child: Opacity(
                      opacity: .30,
                      child: svg('background_clouds'),
                    ),
                  ),
                ),
                Positioned(
                  left: -40,
                  right: -40,
                  bottom: 0,
                  height: bounds.maxHeight * .38,
                  child: IgnorePointer(
                    child: Opacity(
                      opacity: .10,
                      child: svg('background_academic'),
                    ),
                  ),
                ),
                SingleChildScrollView(
                  key: const ValueKey('cinematic-splash'),
                  padding: EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: compact ? 14 : 24,
                  ),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: math.max(
                        0,
                        bounds.maxHeight - (compact ? 28 : 48),
                      ),
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 700),
                        child: landscape
                            ? Row(
                                crossAxisAlignment: CrossAxisAlignment.center,
                                children: [
                                  Expanded(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        illustration(height, true),
                                        campus(
                                          timeline.phase(SplashPhase.campus),
                                          enlarged ? 56 : 90,
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 24),
                                  Expanded(
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        brand(
                                          timeline.phase(SplashPhase.title),
                                          true,
                                          enlarged,
                                        ),
                                        const SizedBox(height: 24),
                                        reveal(
                                          timeline.phase(SplashPhase.footer),
                                          SplashBrandFooter(logo: logo),
                                        ),
                                        recovery(),
                                      ],
                                    ),
                                  ),
                                ],
                              )
                            : Column(
                                mainAxisSize: MainAxisSize.min,
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Transform.translate(
                                    offset: Offset(
                                      0,
                                      reduced
                                          ? 0
                                          : (1 -
                                                    timeline.phase(
                                                      SplashPhase.icon,
                                                    )) *
                                                bounds.maxHeight *
                                                (compact ? .23 : .30),
                                    ),
                                    child: illustration(height, compact),
                                  ),
                                  const SizedBox(height: 8),
                                  brand(
                                    timeline.phase(SplashPhase.title),
                                    compact,
                                    enlarged,
                                  ),
                                  const SizedBox(height: 12),
                                  campus(
                                    timeline.phase(SplashPhase.campus),
                                    enlarged
                                        ? (compact ? 56 : 86)
                                        : (compact ? 100 : 160),
                                  ),
                                  const SizedBox(height: 12),
                                  reveal(
                                    timeline.phase(SplashPhase.footer),
                                    SplashBrandFooter(logo: logo),
                                  ),
                                  recovery(),
                                ],
                              ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    ),
  );
}
