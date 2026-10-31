import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'splash_assets.dart';

/// All movement is derived from the master clock, including each turning page.
class SplashBookAnimation extends StatelessWidget {
  final double opening, progress;
  final bool family, reducedMotion;
  const SplashBookAnimation({
    super.key,
    required this.opening,
    required this.progress,
    required this.family,
    required this.reducedMotion,
  });
  @override
  Widget build(BuildContext context) {
    final q = Curves.easeInOutCubic.transform(opening.clamp(0, 1));
    return ExcludeSemantics(
      child: RepaintBoundary(
        child: LayoutBuilder(
          builder: (context, c) => Stack(
            alignment: Alignment.center,
            children: [
              Opacity(
                opacity: (1 - q).clamp(0, 1),
                child: SvgPicture.asset(
                  SplashAssets.svg('academic_book_closed'),
                  fit: BoxFit.contain,
                ),
              ),
              Opacity(
                opacity: q,
                child: Transform(
                  alignment: Alignment.bottomCenter,
                  transform: Matrix4.identity()
                    ..setEntry(3, 2, .001)
                    ..rotateX((1 - q) * .38)
                    ..scaleByDouble(.22 + .78 * q, 1.0, 1.0, 1.0),
                  child: SvgPicture.asset(
                    SplashAssets.svg('academic_book_open'),
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              if (!reducedMotion)
                for (var i = 0; i < 3; i++)
                  Builder(
                    builder: (context) {
                      final p = ((opening - i * .13) / .72).clamp(0.0, 1.0);
                      if (p <= 0 || p >= 1) return const SizedBox.shrink();
                      return Positioned(
                        left: c.maxWidth * .5,
                        top: c.maxHeight * .24,
                        width: c.maxWidth * .19,
                        height: c.maxHeight * .49,
                        child: Opacity(
                          opacity: math.sin(p * math.pi).clamp(0, 1),
                          child: Transform(
                            alignment: Alignment.centerLeft,
                            transform: Matrix4.identity()
                              ..setEntry(3, 2, .003)
                              ..rotateY(-p * math.pi),
                            child: SvgPicture.asset(
                              SplashAssets.svg('academic_book_page'),
                              fit: BoxFit.fill,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
              if (q > .1)
                Positioned(
                  right: c.maxWidth * .12,
                  bottom: c.maxHeight * .16,
                  child: Transform.rotate(
                    angle:
                        (family ? -.5 : .3) +
                        (reducedMotion
                            ? 0
                            : math.sin(progress * math.pi) * .12),
                    child: SvgPicture.asset(
                      SplashAssets.svg('academic_pencil'),
                      height: c.maxHeight * .35,
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
