import 'package:flutter/material.dart';

/// هوية بصرية: كحلي ملكي مع ذهبي التاج 👑.
class AppColors {
  const AppColors._();

  static const Color navy = Color(0xFF14213D);
  static const Color navySoft = Color(0xFF233457);
  static const Color gold = Color(0xFFE3A72F);
  static const Color goldSoft = Color(0xFFFFF1D0);
  static const Color paper = Color(0xFFF7F4EE);
  static const Color ink = Color(0xFF1B2333);
  static const Color muted = Color(0xFF5F6B7E);
  static const Color line = Color(0xFFE3DED3);
  static const Color concurrent = Color(0xFF2E7D6B);
}

ThemeData buildAppTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.navy,
    primary: AppColors.navy,
    secondary: AppColors.gold,
    surface: Colors.white,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.paper,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.navy,
      foregroundColor: Colors.white,
      centerTitle: false,
      elevation: 0,
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
