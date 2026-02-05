import 'package:flutter/material.dart';

/// Application color palette - Modern Soft UI Design
/// Matching the new timeline-based schedule design
class AppColors {
  AppColors._();

  // ===== PRIMARY - Amber/Orange (Petties Brand) =====
  static const Color primary = Color(0xFFD97706); // amber-600 - Main brand
  static const Color primaryLight = Color(0xFFF59E0B); // amber-500 - Lighter
  static const Color primaryDark = Color(0xFFB45309); // amber-700 - Pressed
  static const Color primarySurface = Color(0xFFFEF3C7); // amber-100 - Card bg
  static const Color primaryBackground =
      Color(0xFFFFFBEB); // amber-50 - Page bg
  static const Color amber50 = Color(0xFFFFFBEB);

  // ===== NEUTRALS - Stone Palette =====
  static const Color stone50 = Color(0xFFFAFAF9);
  static const Color stone100 = Color(0xFFF5F5F4);
  static const Color stone200 = Color(0xFFE7E5E4);
  static const Color stone300 = Color(0xFFD6D3D1);
  static const Color stone400 = Color(0xFFA8A29E);
  static const Color stone500 = Color(0xFF78716C);
  static const Color stone600 = Color(0xFF57534E);
  static const Color stone700 = Color(0xFF44403C);
  static const Color stone800 = Color(0xFF292524);
  static const Color stone900 = Color(0xFF1C1917);

  // ===== STATUS COLORS =====
  static const Color success = Color(0xFF22C55E); // green-500
  static const Color successLight = Color(0xFFDCFCE7); // green-100
  static const Color successDark = Color(0xFF16A34A); // green-600

  static const Color error = Color(0xFFEF4444); // red-500
  static const Color errorLight = Color(0xFFFEE2E2); // red-100
  static const Color errorDark = Color(0xFFDC2626); // red-600

  static const Color warning = Color(0xFFF59E0B); // amber-500
  static const Color warningLight = Color(0xFFFEF3C7); // amber-100

  static const Color info = Color(0xFF3B82F6); // blue-500
  static const Color infoLight = Color(0xFFDBEAFE); // blue-100

  // ===== SEMANTIC COLORS =====
  static const Color black = Color(0xFF000000);
  static const Color white = Color(0xFFFFFFFF);
  static const Color transparent = Colors.transparent;

  // Background & Surface
  static const Color background = white;
  static const Color surface = white;
  static const Color cardBackground = white;
  static const Color scaffoldBackground = stone50;

  // Text Colors
  static const Color textPrimary = stone900;
  static const Color textSecondary = stone600;
  static const Color textTertiary = stone500;
  static const Color textHint = stone400;
  static const Color textDisabled = stone300;
  static const Color textOnPrimary = white;

  // Border & Divider
  static const Color border = stone200;
  static const Color borderLight = stone100;
  static const Color borderDark = stone300;
  static const Color divider = stone200;

  // ===== LEGACY ALIASES (backward compat) =====
  static const Color secondary = Color(0xFFFF6B9D);
  static const Color secondaryLight = Color(0xFFFF9AB8);
  static const Color secondaryDark = Color(0xFFCC4973);
  static const Color grey = stone400;
  static const Color greyLight = stone200;
  static const Color greyDark = stone600;
  static const Color brutalBorder = stone900;

  // ===== NEOBRUTALISM COLORS =====
  static const Color coral = Color(0xFFFF6B6B);
  
  // Teal
  static const Color teal100 = Color(0xFFCCFBF1);
  static const Color teal600 = Color(0xFF0D9488);
  static const Color teal700 = Color(0xFF0F766E);
  
  // Blue  
  static const Color blue100 = Color(0xFFDBEAFE);
  static const Color blue600 = Color(0xFF2563EB);
  
  // Pink
  static const Color pink500 = Color(0xFFEC4899);
  
  // Purple
  static const Color purple500 = Color(0xFF8B5CF6);
  
  // Yellow
  static const Color yellow600 = Color(0xFFCA8A04);
}

/// Design Spacing - 4px base unit system
class AppSpacing {
  AppSpacing._();

  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 12.0;
  static const double lg = 16.0;
  static const double xl = 20.0;
  static const double xxl = 24.0;
  static const double xxxl = 32.0;

  // Screen Padding
  static const double screenPaddingHorizontal = 20.0;
  static const double screenPaddingVertical = 16.0;

  // Card Padding
  static const double cardPadding = 16.0;
  static const double cardPaddingLarge = 20.0;

  // Item Spacing
  static const double itemSpacing = 12.0;
  static const double sectionSpacing = 24.0;
}

/// Design Radius - Soft rounded corners
class AppRadius {
  AppRadius._();

  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 12.0;
  static const double lg = 16.0;
  static const double xl = 20.0;
  static const double xxl = 24.0;
  static const double full = 999.0;

  // Component-specific
  static const double button = 12.0;
  static const double card = 16.0;
  static const double input = 12.0;
  static const double chip = 20.0;
  static const double avatar = 24.0;
  static const double bottomSheet = 24.0;
}

/// Design Shadows - Subtle depth
class AppShadows {
  AppShadows._();

  static List<BoxShadow> get none => [];

  static List<BoxShadow> get xs => [
        BoxShadow(
          color: Colors.black.withOpacity(0.03),
          blurRadius: 2,
          offset: const Offset(0, 1),
        ),
      ];

  static List<BoxShadow> get sm => [
        BoxShadow(
          color: Colors.black.withOpacity(0.04),
          blurRadius: 4,
          offset: const Offset(0, 2),
        ),
      ];

  static List<BoxShadow> get md => [
        BoxShadow(
          color: Colors.black.withOpacity(0.06),
          blurRadius: 8,
          offset: const Offset(0, 4),
        ),
      ];

  static List<BoxShadow> get lg => [
        BoxShadow(
          color: Colors.black.withOpacity(0.08),
          blurRadius: 16,
          offset: const Offset(0, 8),
        ),
      ];

  static List<BoxShadow> get xl => [
        BoxShadow(
          color: Colors.black.withOpacity(0.1),
          blurRadius: 24,
          offset: const Offset(0, 12),
        ),
      ];

  // Card shadow
  static List<BoxShadow> get card => sm;

  // Timeline card shadow
  static List<BoxShadow> get timeline => [
        BoxShadow(
          color: Colors.black.withOpacity(0.04),
          blurRadius: 8,
          offset: const Offset(0, 2),
        ),
      ];
}

/// Typography Styles
class AppTypography {
  AppTypography._();

  // Font Family
  static const String fontFamily = 'SF Pro Display';

  // Display
  static const TextStyle displayLarge = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w800,
    color: AppColors.textPrimary,
    letterSpacing: -0.5,
  );

  static const TextStyle displayMedium = TextStyle(
    fontSize: 28,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
    letterSpacing: -0.3,
  );

  // Headings
  static const TextStyle h1 = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static const TextStyle h2 = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimary,
  );

  static const TextStyle h3 = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  static const TextStyle h4 = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  // Body
  static const TextStyle bodyLarge = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimary,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondary,
  );

  static const TextStyle bodySmall = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: AppColors.textTertiary,
  );

  // Labels
  static const TextStyle labelLarge = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimary,
  );

  static const TextStyle labelMedium = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.textSecondary,
  );

  static const TextStyle labelSmall = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    color: AppColors.textTertiary,
  );

  // Caption
  static const TextStyle caption = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w400,
    color: AppColors.textHint,
  );

  // Button
  static const TextStyle button = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AppColors.textOnPrimary,
  );
}

/// Icon Sizes
class AppIconSizes {
  AppIconSizes._();

  static const double xs = 14.0;
  static const double sm = 16.0;
  static const double md = 20.0;
  static const double lg = 24.0;
  static const double xl = 28.0;
  static const double xxl = 32.0;
}

/// Animation Durations
class AppDurations {
  AppDurations._();

  static const Duration fast = Duration(milliseconds: 150);
  static const Duration normal = Duration(milliseconds: 250);
  static const Duration slow = Duration(milliseconds: 350);
  static const Duration slower = Duration(milliseconds: 500);
}
