import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:petties_mobile/routing/app_routes.dart';
import 'package:petties_mobile/ui/chat/ai_chat_bubble.dart';
import 'package:petties_mobile/ui/common/pet_owner_bottom_nav.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('hiển thị bubble AI và có thể điều hướng', (tester) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const Scaffold(
            body: Center(child: AiChatBubble()),
          ),
        ),
        GoRoute(
          path: AppRoutes.aiChat,
          builder: (context, state) => const Scaffold(
            body: Text('AI CHAT SCREEN'),
          ),
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));

    expect(find.text('PETTIES AI'), findsOneWidget);
    await tester.tap(find.text('PETTIES AI'));
    await tester.pumpAndSettle();

    expect(find.text('AI CHAT SCREEN'), findsOneWidget);
  });

  testWidgets('bubble trong bottom nav có thể kéo và giữ vị trí sau rebuild', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          bottomNavigationBar: PetOwnerBottomNav(
            currentIndex: 0,
            onTap: (_) {},
          ),
        ),
      ),
    );

    await tester.pump(const Duration(milliseconds: 200));

    final bubbleFinder = find.text('PETTIES AI');
    expect(bubbleFinder, findsOneWidget);

    final before = tester.getTopLeft(bubbleFinder);
    final gesture = await tester.startGesture(tester.getCenter(bubbleFinder));
    await gesture.moveBy(const Offset(-120, -10));
    await gesture.up();
    await tester.pump(const Duration(milliseconds: 250));

    final afterDrag = tester.getTopLeft(bubbleFinder);
    expect(afterDrag.dx, lessThanOrEqualTo(before.dx));
    expect(afterDrag.dx, lessThan(before.dx + 1));

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          bottomNavigationBar: PetOwnerBottomNav(
            currentIndex: 0,
            onTap: (_) {},
          ),
        ),
      ),
    );

    await tester.pump(const Duration(milliseconds: 250));

    final afterRebuild = tester.getTopLeft(bubbleFinder);
    expect((afterRebuild.dx - afterDrag.dx).abs(), lessThan(6));
  });
}
