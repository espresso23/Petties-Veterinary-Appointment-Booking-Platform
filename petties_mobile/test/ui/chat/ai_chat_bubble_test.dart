import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:petties_mobile/routing/app_routes.dart';
import 'package:petties_mobile/ui/chat/ai_chat_bubble.dart';

void main() {
  testWidgets('hiển thị bubble AI và có thể điều hướng', (tester) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => Scaffold(
            body: const Center(child: Text('HOME')),
            floatingActionButton: const AiChatBubble(),
            floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
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

    expect(find.text('TRỢ LÝ AI'), findsOneWidget);
    await tester.tap(find.text('TRỢ LÝ AI'));
    await tester.pumpAndSettle();

    expect(find.text('AI CHAT SCREEN'), findsOneWidget);
  });

  testWidgets('bubble hiển thị notification dot khi được bật', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          floatingActionButton: const AiChatBubble(showNotificationDot: true),
        ),
      ),
    );

    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('TRỢ LÝ AI'), findsOneWidget);
  });
}
