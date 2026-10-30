import 'package:flutter/material.dart';

/// Static brand configuration only. No account or college records belong here.
@immutable
class SplashConfiguration {
  final bool family;
  final String subtitle, tagline, icon;
  const SplashConfiguration({
    required this.family,
    required this.subtitle,
    required this.tagline,
    this.icon = 'assets/icons/image.png',
  });
  static const staff = SplashConfiguration(
    family: false,
    subtitle: 'Admin & Teacher App',
    tagline: 'Manage · Teach · Track · Empower',
  );
  static const students = SplashConfiguration(
    family: true,
    subtitle: 'Parent & Student App',
    tagline: 'Learn · Track · Grow · Stay Connected',
  );
  Color get accent => family ? SplashColors.forest : SplashColors.terracotta;
}

abstract final class SplashColors {
  static const ivory = Color(0xfffff9ef);
  static const beige = Color(0xfff6f1e8);
  static const terracotta = Color(0xffc56f4e);
  static const orange = Color(0xffd97738);
  static const forest = Color(0xff365b45);
  static const sage = Color(0xff74866b);
  static const gold = Color(0xffd9aa60);
  static const ink = Color(0xff352d28);
  static const muted = Color(0xff6e645b);
}

abstract final class SplashAssets {
  static const company = 'assets/branding/sconexlogo.webp';
  static const illustrations = [
    'college_campus',
    'academic_book_closed',
    'academic_book_open',
    'academic_book_page',
    'floating_leaf_01',
    'floating_leaf_02',
    'floating_paper',
    'academic_pencil',
    'golden_arc',
    'light_particle',
    'background_clouds',
    'background_academic',
  ];
  static String svg(String name) => 'assets/splash/$name.svg';
}
