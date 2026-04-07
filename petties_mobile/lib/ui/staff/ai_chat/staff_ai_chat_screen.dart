import 'package:flutter/material.dart';

import '../../chat/ai_chat/ai_chat_screen.dart';

class StaffAiChatScreen extends StatelessWidget {
  const StaffAiChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AiChatScreen(bookingAssistantEnabled: false);
  }
}
