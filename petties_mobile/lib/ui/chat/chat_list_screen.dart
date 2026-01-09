import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../config/constants/app_colors.dart';
import '../../data/models/chat.dart';
import '../../data/services/chat_service.dart';
import '../../routing/app_routes.dart';
import 'widgets/chat_box_item.dart';

/// Màn hình danh sách tin nhắn - Pet Owner
class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  final ChatService _chatService = ChatService();
  final TextEditingController _searchController = TextEditingController();

  List<ChatBox> _chatBoxes = [];
  List<ChatBox> _filteredChatBoxes = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchChatBoxes();
    _searchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _searchController.removeListener(_onSearchChanged);
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      if (query.isEmpty) {
        _filteredChatBoxes = _chatBoxes;
      } else {
        _filteredChatBoxes = _chatBoxes
            .where((c) =>
                (c.clinicName?.toLowerCase().contains(query) ?? false) ||
                (c.lastMessage?.toLowerCase().contains(query) ?? false))
            .toList();
      }
    });
  }

  Future<void> _fetchChatBoxes() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final chatBoxes = await _chatService.getChatBoxes();
      setState(() {
        _chatBoxes = chatBoxes;
        _filteredChatBoxes = chatBoxes;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Không thể tải danh sách tin nhắn';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.stone50,
      appBar: _buildAppBar(),
      body: Column(
        children: [
          _buildSearchBar(),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  AppBar _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.primary,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back, color: AppColors.white),
        onPressed: () => context.pop(),
      ),
      title: const Text(
        'TIN NHẮN',
        style: TextStyle(
          fontWeight: FontWeight.w800,
          letterSpacing: 2,
          color: AppColors.white,
          fontSize: 18,
        ),
      ),
      centerTitle: true,
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: AppColors.white,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.stone100,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.stone900, width: 2),
          boxShadow: const [
            BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
          ],
        ),
        child: TextField(
          controller: _searchController,
          decoration: InputDecoration(
            hintText: 'Tìm kiếm phòng khám...',
            hintStyle: TextStyle(color: AppColors.stone400),
            prefixIcon: const Icon(Icons.search, color: AppColors.stone600),
            border: InputBorder.none,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.primary),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: AppColors.stone400),
            const SizedBox(height: 16),
            Text(
              _error!,
              style: TextStyle(color: AppColors.stone600, fontSize: 16),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _fetchChatBoxes,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: AppColors.white,
              ),
              child: const Text('THỬ LẠI'),
            ),
          ],
        ),
      );
    }

    if (_filteredChatBoxes.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.chat_bubble_outline,
                size: 80, color: AppColors.stone300),
            const SizedBox(height: 16),
            Text(
              _searchController.text.isEmpty
                  ? 'Chưa có tin nhắn nào'
                  : 'Không tìm thấy kết quả',
              style: TextStyle(
                color: AppColors.stone600,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _searchController.text.isEmpty
                  ? 'Hãy liên hệ với phòng khám để bắt đầu trò chuyện'
                  : 'Thử tìm kiếm với từ khóa khác',
              style: TextStyle(color: AppColors.stone400, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _fetchChatBoxes,
      color: AppColors.primary,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _filteredChatBoxes.length,
        itemBuilder: (context, index) {
          final chatBox = _filteredChatBoxes[index];
          return ChatBoxItem(
            chatBox: chatBox,
            onTap: () => _openChat(chatBox),
          );
        },
      ),
    );
  }

  void _openChat(ChatBox chatBox) {
    context.push(
      '${AppRoutes.chatDetail}?chatBoxId=${chatBox.id}',
    );
  }
}
