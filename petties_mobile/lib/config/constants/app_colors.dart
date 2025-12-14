import 'package:flutter/material.dart';

/// Application color palette - Neobrutalism Style
/// Matching web design (Amber/Orange + Stone palette)
class AppColors {
  AppColors._();

  // ===== NEOBRUTALISM PRIMARY - Amber/Orange =====
  static const Color primary = Color(0xFFD97706);       // amber-600 - Primary accent
  static const Color primaryLight = Color(0xFFF59E0B);  // amber-500 - Lighter accent
  static const Color primaryDark = Color(0xFFB45309);   // amber-700 - Hover/pressed state
  static const Color primarySurface = Color(0xFFFEF3C7); // amber-100 - Light backgrounds
  static const Color primaryBackground = Color(0xFFFFFBEB); // amber-50 - Card backgrounds
  static const Color amber50 = Color(0xFFFFFBEB); // amber-50 - Alias for direct use

  // ===== NEOBRUTALISM NEUTRALS - Stone =====
  static const Color stone50 = Color(0xFFFAFAF9);   // Page background
  static const Color stone100 = Color(0xFFF5F5F4);  // Light surfaces
  static const Color stone200 = Color(0xFFE7E5E4);  // Dividers
  static const Color stone300 = Color(0xFFD6D3D1);  // Light borders
  static const Color stone400 = Color(0xFFA8A29E);  // Secondary text, icons
  static const Color stone500 = Color(0xFF78716C);  // Placeholder text
  static const Color stone600 = Color(0xFF57534E);  // Body text secondary
  static const Color stone700 = Color(0xFF44403C);  // Body text
  static const Color stone900 = Color(0xFF1C1917);  // BRUTAL Border, shadow, headings

  // ===== LEGACY COLORS (for backward compatibility) =====
  static const Color secondary = Color(0xFFFF6B9D);
  static const Color secondaryLight = Color(0xFFFF9AB8);
  static const Color secondaryDark = Color(0xFFCC4973);

  // Neutral Colors (mapped to stone)
  static const Color black = Color(0xFF000000);
  static const Color white = Color(0xFFFFFFFF);
  static const Color grey = stone400;
  static const Color greyLight = stone200;
  static const Color greyDark = stone600;

  // Background Colors
  static const Color background = stone50;
  static const Color surface = white;
  static const Color cardBackground = white;

  // Status Colors
  static const Color success = Color(0xFF4CAF50);
  static const Color error = Color(0xFFF44336);
  static const Color warning = Color(0xFFFF9800);
  static const Color info = Color(0xFF2196F3);

  // Text Colors (mapped to stone)
  static const Color textPrimary = stone900;
  static const Color textSecondary = stone600;
  static const Color textHint = stone500;
  static const Color textDisabled = stone400;

  // Border Colors
  static const Color border = stone200;
  static const Color divider = stone200;
  static const Color brutalBorder = stone900; // 4px thick border for Neobrutalism

  // Transparent
  static const Color transparent = Colors.transparent;
}

