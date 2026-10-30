import 'package:flutter/material.dart';
import 'splash_assets.dart';

class SplashBrandFooter extends StatelessWidget {
  final ImageProvider logo;
  const SplashBrandFooter({super.key, required this.logo});
  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      const Text(
        'Pragathi College',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: SplashColors.ink,
          height: 1.3,
        ),
      ),
      const SizedBox(height: 7),
      const Text(
        'Designed & Developed by',
        textAlign: TextAlign.center,
        style: TextStyle(fontSize: 11, color: SplashColors.muted, height: 1.4),
      ),
      const SizedBox(height: 8),
      Semantics(
        label: 'Sconex Soft',
        image: true,
        child: ExcludeSemantics(
          child: Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 9,
            children: [
              Image(
                image: logo,
                errorBuilder: (context, error, stack) =>
                    const SizedBox.shrink(),
                width: 55,
                height: 32,
                fit: BoxFit.contain,
                filterQuality: FilterQuality.medium,
              ),
              const Text(
                'Sconex Soft',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: SplashColors.ink,
                ),
              ),
            ],
          ),
        ),
      ),
    ],
  );
}
