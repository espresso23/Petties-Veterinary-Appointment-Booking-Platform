import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:petties_mobile/routing/app_routes.dart';
import 'package:petties_mobile/ui/staff/widgets/staff_ai_chat_bubble.dart';

void main() {
  testWidgets('staff bubble điều hướng tới màn AI của staff', (
    tester,
  ) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const Scaffold(
            body: Center(child: Text('HOME')),
            floatingActionButton: StaffAiChatBubble(),
            floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
          ),
        ),
        GoRoute(
          path: AppRoutes.staffAiChat,
          builder: (context, state) => const Scaffold(
            body: Text('STAFF AI CHAT SCREEN'),
          ),
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));

    expect(find.text('AI Hỗ trợ'), findsOneWidget);
    await tester.tap(find.text('AI Hỗ trợ'));
    await tester.pumpAndSettle();

    expect(find.text('STAFF AI CHAT SCREEN'), findsOneWidget);
  });
}
