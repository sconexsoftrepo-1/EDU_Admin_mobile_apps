import 'package:flutter/animation.dart';

/// The entire introduction has one clock. No scene timers or looping tickers.
enum SplashPhase { book, icon, campus, title, footer }

class SplashTimeline {
  static const duration = Duration(milliseconds: 3000);
  final AnimationController controller;
  SplashTimeline(TickerProvider vsync)
    : controller = AnimationController(
        vsync: vsync,
        duration: duration,
        animationBehavior: AnimationBehavior.preserve,
      ) {
    controller.addListener(finishAtBoundary);
  }
  // Flutter's interpolation reaches 1 at the boundary but normally marks itself
  // done on the following frame. Freeze at the actual 3000ms endpoint instead.
  void finishAtBoundary() {
    if (controller.isAnimating && controller.value >= controller.upperBound) {
      controller.value = controller.upperBound;
    }
  }

  double get value => controller.value;
  double phase(SplashPhase phase, {Curve curve = Curves.easeOutCubic}) {
    final start = phase.index / 5;
    return Interval(start, start + .2, curve: curve).transform(value);
  }

  void dispose() {
    controller.removeListener(finishAtBoundary);
    controller.dispose();
  }
}
