import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:web_socket_channel/io.dart';

import '../../config/constants/app_colors.dart';
import '../../data/models/ai_chat.dart';
import '../../data/services/ai_chat_service.dart';
import 'utils/ai_booking_confirmation.dart';

class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  static const int _maxReconnectAttempts = 2;

  final AiChatService _aiChatService = AiChatService();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<String> _quickPrompts = const [
    'Bé nhà tôi cần tiêm mũi nào tiếp theo?',
    'Gợi ý phòng khám gần tôi có dịch vụ tiêm chủng',
    'Đặt lịch khám tổng quát cần chuẩn bị gì?',
    'Phòng khám nào còn slot trống cuối tuần này?',
    'Tôi muốn đặt lịch tiêm phòng cho chó',
  ];

  IOWebSocketChannel? _channel;
  StreamSubscription? _socketSubscription;

  List<_UiChatMessage> _messages = [];
  String? _sessionId;
  String? _error;
  String? _agentStatus;
  bool _isInitializing = true;
  bool _isSending = false;
  bool _shouldIgnoreSocketClose = false;
  bool _isReconnecting = false;
  int _reconnectAttempts = 0;
  final Set<String> _confirmedMessageIds = <String>{};

  @override
  void initState() {
    super.initState();
    _initializeChat();
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    _channel?.sink.close();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initializeChat() async {
    setState(() {
      _isInitializing = true;
      _error = null;
    });

    try {
      final session = await _aiChatService.getOrCreateSession();
      _replaceMessages(session.messages);
      _sessionId = session.sessionId;
      await _connectToSession(session.sessionId);
      _reconnectAttempts = 0;
    } on AiChatException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Không thể khởi tạo trợ lý AI';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isInitializing = false;
        });
      }
    }
  }

  Future<void> _startNewSession() async {
    setState(() {
      _isInitializing = true;
      _error = null;
      _agentStatus = null;
    });

    try {
      await _aiChatService.clearStoredSession();
      _shouldIgnoreSocketClose = true;
      await _socketSubscription?.cancel();
      await _channel?.sink.close();
      _shouldIgnoreSocketClose = false;
      final session = await _aiChatService.createFreshSession();
      _sessionId = session.sessionId;
      _replaceMessages([]);
      await _connectToSession(session.sessionId);
      _reconnectAttempts = 0;
    } on AiChatException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Không tạo được phiên chat AI mới';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isInitializing = false;
        });
      }
    }
  }

  Future<void> _connectToSession(String sessionId) async {
    _shouldIgnoreSocketClose = true;
    await _socketSubscription?.cancel();
    await _channel?.sink.close();
    _shouldIgnoreSocketClose = false;

    final channel = await _aiChatService.connectToSession(sessionId);
    _channel = channel;

    _socketSubscription = channel.stream.listen(
      (payload) => _handleSocketEvent(_aiChatService.parseSocketEvent(payload)),
      onError: (_) {
        _handleConnectionInterrupted();
      },
      onDone: () {
        if (!mounted) return;
        if (_shouldIgnoreSocketClose) {
          _shouldIgnoreSocketClose = false;
          return;
        }
        _handleConnectionInterrupted(
          reason: AiChatException.fromWebSocket(
            closeCode: _channel?.closeCode,
            closeReason: _channel?.closeReason,
          ).message,
        );
      },
      cancelOnError: false,
    );
  }

  Future<void> _handleConnectionInterrupted({String? reason}) async {
    if (!mounted || _sessionId == null) {
      return;
    }

    if (_reconnectAttempts >= _maxReconnectAttempts) {
      setState(() {
        _error = reason ?? 'Kết nối trợ lý AI bị gián đoạn';
        _agentStatus = null;
        _isSending = false;
        _isReconnecting = false;
      });
      return;
    }

    final attempt = _reconnectAttempts + 1;
    setState(() {
      _reconnectAttempts = attempt;
      _isReconnecting = true;
      _agentStatus = 'Đang kết nối lại trợ lý AI... ($attempt/$_maxReconnectAttempts)';
      _error = null;
    });

    await Future<void>.delayed(Duration(milliseconds: 400 * attempt));

    if (!mounted || _sessionId == null) {
      return;
    }

    try {
      await _connectToSession(_sessionId!);
      if (!mounted) return;
      setState(() {
        _isReconnecting = false;
        _agentStatus = 'Đã kết nối lại trợ lý AI';
      });
    } on AiChatException catch (error) {
      if (!mounted) return;
      setState(() {
        _isReconnecting = false;
        _error = error.message;
        _agentStatus = null;
        _isSending = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isReconnecting = false;
        _error = reason ?? 'Kết nối trợ lý AI bị gián đoạn';
        _agentStatus = null;
        _isSending = false;
      });
    }
  }

  void _handleSocketEvent(AiChatSocketEvent event) {
    if (!mounted) return;

    switch (event.type) {
      case AiChatSocketEventType.connected:
        setState(() {
          _error = null;
          _isReconnecting = false;
          _reconnectAttempts = 0;
          _agentStatus = 'Đã kết nối trợ lý AI';
        });
        break;
      case AiChatSocketEventType.history:
        _replaceMessages(event.messages);
        break;
      case AiChatSocketEventType.ack:
        setState(() {
          _agentStatus = event.message ?? 'Trợ lý đã nhận câu hỏi';
        });
        break;
      case AiChatSocketEventType.thinking:
        setState(() {
          _agentStatus = event.content ?? 'Trợ lý đang suy luận...';
        });
        break;
      case AiChatSocketEventType.toolCall:
        setState(() {
          _agentStatus = event.toolName != null
              ? 'Đang gọi công cụ ${event.toolName}'
              : 'Đang gọi công cụ hỗ trợ';
        });
        break;
      case AiChatSocketEventType.toolResult:
        setState(() {
          _agentStatus = 'Đã lấy dữ liệu, đang tổng hợp phản hồi...';
        });
        break;
      case AiChatSocketEventType.stream:
        _appendAssistantChunk(event.content ?? '');
        break;
      case AiChatSocketEventType.complete:
        _completeAssistantMessage(
          event.fullResponse ?? '',
          reactTrace: event.reactTrace,
        );
        break;
      case AiChatSocketEventType.error:
        setState(() {
          _error = _mapAgentErrorMessage(event.error);
          _agentStatus = null;
          _isSending = false;
        });
        break;
      case AiChatSocketEventType.unknown:
        break;
    }
  }

  void _replaceMessages(List<AiChatMessage> source) {
    setState(() {
      _messages = source
          .where((message) => message.role == 'user' || message.role == 'assistant')
          .map(
            (message) => _UiChatMessage(
              id: message.messageId ?? UniqueKey().toString(),
              role: message.role,
              content: message.content,
              timestamp: message.timestamp,
              reactTrace: message.reactTrace,
            ),
          )
          .toList();
    });
    _scrollToBottom();
  }

  void _appendAssistantChunk(String chunk) {
    if (chunk.isEmpty) return;

    setState(() {
      _error = null;
      _isSending = true;
      if (_messages.isNotEmpty &&
          _messages.last.role == 'assistant' &&
          _messages.last.isStreaming) {
        final last = _messages.removeLast();
        _messages.add(last.copyWith(content: '${last.content}$chunk'));
      } else {
        _messages.add(
          _UiChatMessage(
            id: UniqueKey().toString(),
            role: 'assistant',
            content: chunk,
            timestamp: DateTime.now(),
            isStreaming: true,
          ),
        );
      }
    });
    _scrollToBottom();
  }

  void _completeAssistantMessage(String fullResponse, {List<dynamic>? reactTrace}) {
    setState(() {
      _agentStatus = null;
      _isSending = false;

      if (_messages.isNotEmpty &&
          _messages.last.role == 'assistant' &&
          _messages.last.isStreaming) {
        final last = _messages.removeLast();
        _messages.add(
          last.copyWith(
            content: fullResponse.isNotEmpty ? fullResponse : last.content,
            isStreaming: false,
            reactTrace: reactTrace,
          ),
        );
      } else {
        _messages.add(
          _UiChatMessage(
            id: UniqueKey().toString(),
            role: 'assistant',
            content: fullResponse,
            timestamp: DateTime.now(),
            reactTrace: reactTrace,
          ),
        );
      }
    });
    _scrollToBottom();
  }

  Future<void> _sendMessage([String? preset]) async {
    final message = (preset ?? _messageController.text).trim();
    if (message.isEmpty || _sessionId == null || _channel == null || _isReconnecting) {
      return;
    }

    setState(() {
      _messages.add(
        _UiChatMessage(
          id: UniqueKey().toString(),
          role: 'user',
          content: message,
          timestamp: DateTime.now(),
        ),
      );
      _error = null;
      _agentStatus = 'Đang gửi câu hỏi cho trợ lý AI...';
      _isSending = true;
    });

    _messageController.clear();
    _scrollToBottom();

    try {
      _channel!.sink.add(_aiChatService.encodeOutgoingMessage(message));
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Không gửi được câu hỏi tới trợ lý AI';
        _agentStatus = null;
        _isSending = false;
      });
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent + 120,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final screenWidth = mediaQuery.size.width;
    final horizontalPadding = screenWidth < 380 ? 12.0 : 16.0;

    return Scaffold(
      backgroundColor: AppColors.primaryBackground,
      appBar: AppBar(
        backgroundColor: AppColors.primary,
        foregroundColor: AppColors.stone900,
        elevation: 0,
        leading: IconButton(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.close),
        ),
        title: const Text(
          'TRỢ LÝ AI',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
          ),
        ),
        actions: [
          IconButton(
            onPressed: _isInitializing ? null : _startNewSession,
            tooltip: 'Phiên chat mới',
            icon: const Icon(Icons.add_comment_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: Stack(
          children: [
            _buildBackgroundAccents(),
            Column(
              children: [
                _buildHeaderCard(horizontalPadding),
                _buildQuickPromptBar(horizontalPadding),
                Expanded(child: _buildContent()),
                _buildComposer(horizontalPadding),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBackgroundAccents() {
    return IgnorePointer(
      child: Stack(
        children: [
          Positioned(
            top: -42,
            right: -28,
            child: Container(
              width: 168,
              height: 168,
              decoration: BoxDecoration(
                color: AppColors.warningLight.withValues(alpha: 0.65),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            top: 108,
            left: -36,
            child: Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: AppColors.infoLight.withValues(alpha: 0.55),
                borderRadius: BorderRadius.circular(20),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeaderCard(double horizontalPadding) {
    return Container(
      width: double.infinity,
      margin: EdgeInsets.fromLTRB(horizontalPadding, 12, horizontalPadding, 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.96),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: AppColors.primarySurface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.stone900, width: 2),
                ),
                child: const Icon(Icons.auto_awesome, color: AppColors.primary),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                     Text(
                       'Trợ lý chăm sóc & đặt lịch',
                       style: TextStyle(
                         fontSize: 16,
                         fontWeight: FontWeight.w800,
                         color: AppColors.stone900,
                       ),
                    ),
                    SizedBox(height: 2),
                     Text(
                       'Phản hồi nhanh, gợi ý rõ ràng, xác nhận ngay trong chat',
                       style: TextStyle(
                         fontSize: 12,
                         fontWeight: FontWeight.w600,
                         color: AppColors.stone600,
                         height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: _isSending ? AppColors.blue100 : AppColors.successLight,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: AppColors.stone900, width: 1.5),
                ),
                child: Text(
                  _isReconnecting
                      ? 'ĐANG KẾT NỐI'
                      : _isSending
                          ? 'ĐANG XỬ LÝ'
                          : 'SẴN SÀNG',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: _isReconnecting
                        ? AppColors.blue600
                        : _isSending
                            ? AppColors.blue600
                            : AppColors.successDark,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.primaryBackground,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.stone200),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  _agentStatus != null ? Icons.bolt : Icons.chat_bubble_outline,
                  size: 16,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _agentStatus ??
                        'Bạn có thể hỏi về đặt lịch, lịch tiêm, dịch vụ phòng khám và các bước tiếp theo.',
                    style: const TextStyle(
                      fontSize: 12,
                      height: 1.4,
                      color: AppColors.stone700,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickPromptBar(double horizontalPadding) {
    return Padding(
      padding: EdgeInsets.fromLTRB(horizontalPadding, 0, horizontalPadding, 8),
      child: Align(
        alignment: Alignment.centerLeft,
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _quickPrompts
              .take(3)
              .map(
                (prompt) => _QuickPromptCard(
                  prompt: prompt,
                  onTap: _isSending || _isReconnecting ? null : () => _sendMessage(prompt),
                ),
              )
              .toList(),
        ),
      ),
    );
  }

  Widget _buildContent() {
    if (_isInitializing) {
      return Center(
        child: SingleChildScrollView(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 20),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.stone900, width: 2),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(4, 4)),
              ],
            ),
            child: const Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _AiLoadingHero(),
                SizedBox(height: 14),
                Text(
                  'Đang chuẩn bị trợ lý AI...',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone900,
                  ),
                ),
                SizedBox(height: 14),
                _LoadingMessageSkeleton(),
              ],
            ),
          ),
        ),
      );
    }

     if (_error != null && _messages.isEmpty) {
       return Center(
         child: SingleChildScrollView(
           padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
           child: Container(
             width: double.infinity,
             padding: const EdgeInsets.all(20),
             decoration: BoxDecoration(
               color: AppColors.white.withValues(alpha: 0.98),
               borderRadius: BorderRadius.circular(20),
               border: Border.all(color: AppColors.stone900, width: 2),
               boxShadow: const [
                 BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
               ],
             ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppColors.stone900, width: 2),
                  ),
                  child: const Icon(
                    Icons.cloud_off_outlined,
                    color: AppColors.error,
                    size: 34,
                  ),
                ),
                 const SizedBox(height: 12),
                 const Text(
                   'Không thể khôi phục phiên chat',
                   textAlign: TextAlign.center,
                   style: TextStyle(
                     fontSize: 16,
                     fontWeight: FontWeight.w800,
                     color: AppColors.stone900,
                   ),
                 ),
                 const SizedBox(height: 10),
                 Text(
                   _friendlyErrorMessage(_error!),
                   textAlign: TextAlign.center,
                   style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.stone700,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 44,
                  child: ElevatedButton.icon(
                    onPressed: _startNewSession,
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text(
                      'THỬ LẠI',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: AppColors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                        side: const BorderSide(
                          color: AppColors.stone900,
                          width: 2,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

     return ListView.builder(
       controller: _scrollController,
       padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
       itemCount: _messages.length,
       itemBuilder: (context, index) => _buildMessageBubble(_messages[index]),
     );
   }

  Widget _buildMessageBubble(_UiChatMessage message) {
    final isUser = message.role == 'user';
    final bookingDraft = !isUser
        ? extractBookingConfirmationDraft(
            content: message.content,
            reactTrace: message.reactTrace,
          )
        : null;
    final isBookingReady = !isUser && bookingDraft != null;

    return TweenAnimationBuilder<double>(
      key: ValueKey('${message.id}_${message.isStreaming}_${message.content.length}'),
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutBack,
      builder: (context, value, child) {
        return Opacity(
          opacity: value.clamp(0, 1),
          child: Transform.translate(
            offset: Offset(0, (1 - value) * 18),
            child: child,
          ),
        );
      },
      child: Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Row(
          mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!isUser) ...[
              _MessageAvatar(
                icon: isBookingReady ? Icons.event_available : Icons.smart_toy_outlined,
                backgroundColor:
                    isBookingReady ? AppColors.successLight : AppColors.primarySurface,
                iconColor: isBookingReady ? AppColors.successDark : AppColors.primary,
              ),
              const SizedBox(width: 10),
            ],
            Flexible(
              child: ConstrainedBox(
                 constraints: BoxConstraints(
                   maxWidth: MediaQuery.of(context).size.width < 390
                       ? MediaQuery.of(context).size.width * 0.76
                       : MediaQuery.of(context).size.width * 0.8,
                 ),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isUser ? AppColors.primary : AppColors.white,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isUser ? 16 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 16),
                    ),
                    border: Border.all(
                      color: isBookingReady ? AppColors.successDark : AppColors.stone900,
                      width: 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: isBookingReady ? AppColors.successDark : AppColors.stone900,
                        offset: const Offset(3, 3),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment:
                        isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                    children: [
                       Wrap(
                         spacing: 8,
                         runSpacing: 8,
                         crossAxisAlignment: WrapCrossAlignment.center,
                         children: [
                           Container(
                             padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                             decoration: BoxDecoration(
                              color: isUser
                                  ? AppColors.white.withValues(alpha: 0.18)
                                  : isBookingReady
                                      ? AppColors.successLight
                                      : AppColors.primarySurface,
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: isUser
                                    ? AppColors.white
                                    : isBookingReady
                                        ? AppColors.successDark
                                        : AppColors.stone900,
                                width: 1.5,
                              ),
                            ),
                            child: Text(
                              isUser ? 'BẠN' : 'TRỢ LÝ PETTIES',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: isUser
                                    ? AppColors.white
                                    : isBookingReady
                                        ? AppColors.successDark
                                        : AppColors.primaryDark,
                                letterSpacing: 0.4,
                              ),
                            ),
                          ),
                           if (isBookingReady) const _BookingReadyBadge(),
                         ],
                       ),
                      if (isBookingReady) ...[
                        const SizedBox(height: 10),
                        const _BookingReadyBanner(),
                      ],
                      const SizedBox(height: 10),
                      Text(
                        message.content,
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.55,
                          color: isUser ? AppColors.white : AppColors.stone900,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      if (message.isStreaming) ...[
                        const SizedBox(height: 8),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const _AiTypingDots(),
                            const SizedBox(width: 8),
                            Text(
                              'Đang trả lời...',
                              style: TextStyle(
                                fontSize: 11,
                                color: isUser
                                    ? AppColors.white.withValues(alpha: 0.7)
                                    : AppColors.stone500,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (!isUser && _extractSourceSummary(message.reactTrace) != null) ...[
                        const SizedBox(height: 10),
                        _buildSourceSummaryChip(_extractSourceSummary(message.reactTrace)!),
                      ],
                      if (!isUser && bookingDraft != null) ...[
                        const SizedBox(height: 10),
                        _buildBookingConfirmationCard(message.id, bookingDraft),
                      ],
                      if (!isUser && (message.reactTrace?.isNotEmpty ?? false)) ...[
                        const SizedBox(height: 10),
                        _buildTracePanel(message.reactTrace!),
                      ],
                      const SizedBox(height: 8),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.access_time,
                            size: 12,
                            color: isUser
                                ? AppColors.white.withValues(alpha: 0.82)
                                : AppColors.stone500,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            _formatTime(message.timestamp),
                            style: TextStyle(
                              fontSize: 10,
                              color: isUser
                                  ? AppColors.white.withValues(alpha: 0.82)
                                  : AppColors.stone500,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (isUser) ...[
              const SizedBox(width: 10),
              const _MessageAvatar(
                icon: Icons.person_outline,
                backgroundColor: AppColors.stone100,
                iconColor: AppColors.stone700,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTracePanel(List<dynamic> trace) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.stone100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200, width: 1.5),
      ),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: EdgeInsets.zero,
        collapsedIconColor: AppColors.stone500,
        iconColor: AppColors.stone700,
        title: const Text(
          'Chi tiết suy luận',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: AppColors.stone700,
          ),
        ),
        children: trace.take(6).map((step) {
          if (step is! Map) {
            return const SizedBox.shrink();
          }

          final stepType = step['step_type']?.toString() ?? step['type']?.toString() ?? 'step';
          final content = step['content']?.toString() ?? '';
          return Container(
            width: double.infinity,
            margin: const EdgeInsets.only(bottom: 6),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.stone200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  stepType.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: AppColors.stone600,
                  ),
                ),
                if (content.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    content,
                    style: const TextStyle(
                      fontSize: 11,
                      height: 1.4,
                      color: AppColors.stone700,
                    ),
                  ),
                ],
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildSourceSummaryChip(_SourceSummary summary) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            color: AppColors.primarySurface,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: AppColors.stone900, width: 1.5),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.layers_outlined, size: 14, color: AppColors.primaryDark),
              const SizedBox(width: 6),
              Text(
                'Dựa trên ${summary.sourcesUsed} nguồn dữ liệu',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone900,
                ),
              ),
            ],
          ),
        ),
        if (summary.toolNames.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: AppColors.blue100,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: AppColors.blue600, width: 1.5),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.build_circle_outlined, size: 14, color: AppColors.blue600),
                const SizedBox(width: 6),
                Text(
                  summary.toolNames.take(2).join(' • '),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.blue600,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildBookingConfirmationCard(
    String messageId,
    AiBookingConfirmationDraft draft,
  ) {
    final isConfirmed = _confirmedMessageIds.contains(messageId);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primaryBackground,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
        boxShadow: const [
          BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.stone900, width: 1.5),
            ),
            child: const Row(
              children: [
                Icon(Icons.event_note, size: 16, color: AppColors.primary),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'XÁC NHẬN THÔNG TIN ĐẶT LỊCH',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.stone900,
                      letterSpacing: 0.6,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _BookingMetaPill(
                icon: Icons.schedule,
                label: draft.startTime ?? 'Chưa rõ giờ',
                backgroundColor: AppColors.blue100,
                foregroundColor: AppColors.blue600,
              ),
              _BookingMetaPill(
                icon: Icons.calendar_month,
                label: _formatBookingDate(draft.bookingDate),
                backgroundColor: AppColors.successLight,
                foregroundColor: AppColors.successDark,
              ),
              if (draft.services.isNotEmpty)
                _BookingMetaPill(
                  icon: Icons.medical_services_outlined,
                  label: '${draft.services.length} dịch vụ',
                  backgroundColor: AppColors.primarySurface,
                  foregroundColor: AppColors.primaryDark,
                ),
            ],
          ),
          const SizedBox(height: 12),
          _buildBookingInfoRow('Ngày khám', _formatBookingDate(draft.bookingDate)),
          _buildBookingInfoRow('Giờ bắt đầu', draft.startTime ?? 'Chưa rõ'),
          if (draft.clinicName != null)
            _buildBookingInfoRow('Phòng khám', draft.clinicName!),
          if (draft.petName != null)
            _buildBookingInfoRow('Thú cưng', draft.petName!),
          _buildBookingInfoRow('Dịch vụ', draft.services.join(', ')),
          const SizedBox(height: 10),
          const Text(
            'Nhấn xác nhận để AI tiếp tục tạo booking thật. Nếu chưa đúng, bạn có thể yêu cầu chỉnh lại thông tin.',
            style: TextStyle(
              fontSize: 11,
              height: 1.4,
              color: AppColors.stone700,
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton(
                  onPressed: isConfirmed || _isSending || _isReconnecting
                      ? null
                      : () => _confirmBookingDraft(messageId, draft),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.white,
                    elevation: 0,
                    shadowColor: AppColors.transparent,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: const BorderSide(
                        color: AppColors.stone900,
                        width: 2,
                      ),
                    ),
                  ),
                  child: Text(
                    isConfirmed ? 'ĐÃ GỬI XÁC NHẬN' : 'XÁC NHẬN ĐẶT LỊCH',
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: OutlinedButton(
                  onPressed: _isSending || _isReconnecting
                      ? null
                      : () => _sendMessage(
                            'Tôi muốn chỉnh lại thông tin booking trước khi xác nhận.',
                          ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.stone900,
                    side: const BorderSide(color: AppColors.stone900, width: 2),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    backgroundColor: AppColors.white,
                  ),
                  child: const Text(
                    'CHỈNH LẠI',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBookingInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: AppColors.white.withValues(alpha: 0.9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.stone200),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              _iconForBookingLabel(label),
              size: 15,
              color: AppColors.primary,
            ),
            const SizedBox(width: 8),
            SizedBox(
              width: 80,
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone600,
                ),
              ),
            ),
            Expanded(
              child: Text(
                value,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone900,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _iconForBookingLabel(String label) {
    switch (label) {
      case 'Ngày khám':
        return Icons.calendar_month;
      case 'Giờ bắt đầu':
        return Icons.schedule;
      case 'Phòng khám':
        return Icons.local_hospital_outlined;
      case 'Thú cưng':
        return Icons.pets_outlined;
      case 'Dịch vụ':
        return Icons.medical_services_outlined;
      default:
        return Icons.info_outline;
    }
  }

  Future<void> _confirmBookingDraft(
    String messageId,
    AiBookingConfirmationDraft draft,
  ) async {
    setState(() {
      _confirmedMessageIds.add(messageId);
    });

    final buffer = StringBuffer()
      ..write('Tôi xác nhận đặt lịch. ')
      ..write('Vui lòng tiến hành tạo booking ngay với thông tin sau: ')
      ..write('ngày ${_formatBookingDate(draft.bookingDate)}, ')
      ..write('giờ ${draft.startTime}. ');

    if (draft.clinicName != null) {
      buffer.write('Phòng khám ${draft.clinicName}. ');
    }

    if (draft.petName != null) {
      buffer.write('Thú cưng ${draft.petName}. ');
    }

    if (draft.services.isNotEmpty) {
      buffer.write('Dịch vụ: ${draft.services.join(', ')}. ');
    }

    buffer.write('Đây là xác nhận rõ ràng từ tôi.');

    await _sendMessage(buffer.toString());
  }

  String _formatBookingDate(String? value) {
    if (value == null || value.isEmpty) {
      return 'Chưa rõ';
    }

    final parts = value.split('-');
    if (parts.length == 3) {
      return '${parts[2]}/${parts[1]}/${parts[0]}';
    }

    return value;
  }

  Widget _buildComposer(double horizontalPadding) {
    return Container(
      padding: EdgeInsets.fromLTRB(horizontalPadding, 8, horizontalPadding, 12),
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.98),
        border: Border(top: BorderSide(color: AppColors.stone900, width: 2)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_error != null && _messages.isNotEmpty) ...[
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.errorLight,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.stone900, width: 2),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          color: AppColors.errorDark,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.stone900, width: 2),
                      boxShadow: const [
                        BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.fromLTRB(12, 10, 12, 0),
                          child: Row(
                            children: [
                              Icon(Icons.tips_and_updates_outlined,
                                  size: 14, color: AppColors.primary),
                              SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Mô tả rõ nhu cầu để AI hỗ trợ nhanh hơn',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.stone600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        TextField(
                          controller: _messageController,
                          minLines: 1,
                          maxLines: 3,
                          textInputAction: TextInputAction.send,
                          onSubmitted: (_) => _sendMessage(),
                          decoration: const InputDecoration(
                            hintText: 'Ví dụ: Tôi muốn đặt lịch tiêm phòng cho mèo vào cuối tuần này',
                            border: InputBorder.none,
                            contentPadding: EdgeInsets.fromLTRB(12, 10, 12, 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                 GestureDetector(
                   onTap: _isSending || _isReconnecting ? null : _sendMessage,
                   child: AnimatedContainer(
                     duration: const Duration(milliseconds: 180),
                     width: 52,
                     height: 52,
                    decoration: BoxDecoration(
                     color: _isSending || _isReconnecting
                         ? AppColors.stone300
                         : AppColors.primary,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.stone900, width: 2),
                      boxShadow: _isSending
                          ? null
                          : const [
                              BoxShadow(
                                color: AppColors.stone900,
                                offset: Offset(3, 3),
                              ),
                            ],
                    ),
                     child: Icon(
                       _isReconnecting
                           ? Icons.sync
                           : _isSending
                               ? Icons.hourglass_top
                               : Icons.send_rounded,
                       color: AppColors.white,
                     ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime? value) {
    final date = value ?? DateTime.now();
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  String _mapAgentErrorMessage(String? rawError) {
    final message = (rawError ?? '').trim();
    if (message.isEmpty) {
      return 'Trợ lý AI gặp lỗi';
    }

    if (message.contains('Authentication required') ||
        message.contains('Invalid authentication')) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }

    if (message.contains('Session does not belong')) {
      return 'Phiên chat AI không còn hợp lệ với tài khoản hiện tại.';
    }

    return message;
  }

  String _friendlyErrorMessage(String message) {
    if (message.contains('Không tìm thấy phiên chat AI')) {
      return 'Phiên chat cũ không còn khả dụng. Hệ thống sẽ tạo phiên mới khi bạn thử lại.';
    }

    if (message.contains('không còn hợp lệ')) {
      return 'Phiên chat hiện tại không còn hợp lệ. Hãy tạo phiên mới để tiếp tục.';
    }

    return message;
  }
}

_SourceSummary? _extractSourceSummary(List<dynamic>? trace) {
  if (trace == null || trace.isEmpty) {
    return null;
  }

  int sourcesUsed = 0;
  final toolNames = <String>[];

  for (final step in trace) {
    if (step is! Map) {
      continue;
    }

    final rawToolName = step['tool_name']?.toString();
    if (rawToolName != null && rawToolName.isNotEmpty && !toolNames.contains(rawToolName)) {
      toolNames.add(rawToolName);
    }

    final toolResult = step['tool_result'];
    if (toolResult is Map && toolResult['sources_used'] is num) {
      sourcesUsed += (toolResult['sources_used'] as num).toInt();
    }
  }

  if (sourcesUsed <= 0 && toolNames.isEmpty) {
    return null;
  }

  return _SourceSummary(
    sourcesUsed: sourcesUsed > 0 ? sourcesUsed : toolNames.length,
    toolNames: toolNames,
  );
}

class _SourceSummary {
  final int sourcesUsed;
  final List<String> toolNames;

  const _SourceSummary({
    required this.sourcesUsed,
    required this.toolNames,
  });
}

class _QuickPromptCard extends StatelessWidget {
  final String prompt;
  final VoidCallback? onTap;

  const _QuickPromptCard({
    required this.prompt,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final maxWidth = screenWidth < 390 ? screenWidth - 40 : 280.0;

    return Material(
      color: AppColors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: BoxConstraints(maxWidth: maxWidth),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          decoration: BoxDecoration(
            color: AppColors.white.withValues(alpha: 0.96),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.stone900, width: 2),
            boxShadow: const [
              BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.primarySurface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.stone900, width: 1.5),
                ),
                child: const Icon(
                  Icons.flash_on_outlined,
                  color: AppColors.primary,
                  size: 14,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  prompt,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    height: 1.3,
                    color: AppColors.stone900,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MessageAvatar extends StatelessWidget {
  final IconData icon;
  final Color backgroundColor;
  final Color iconColor;

  const _MessageAvatar({
    required this.icon,
    required this.backgroundColor,
    required this.iconColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 34,
      height: 34,
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
      ),
      child: Icon(icon, size: 18, color: iconColor),
    );
  }
}

class _BookingMetaPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  const _BookingMetaPill({
    required this.icon,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.stone900, width: 1.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: foregroundColor),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: foregroundColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _BookingReadyBadge extends StatelessWidget {
  const _BookingReadyBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.successLight,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.successDark, width: 1.5),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.check_circle_outline, size: 13, color: AppColors.successDark),
          SizedBox(width: 5),
          Text(
            'SẴN SÀNG BOOKING',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: AppColors.successDark,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _BookingReadyBanner extends StatelessWidget {
  const _BookingReadyBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.successLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.successDark, width: 1.5),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.auto_awesome, color: AppColors.successDark, size: 16),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'AI đã tổng hợp đủ thông tin để bạn xác nhận đặt lịch ngay trong đoạn chat này.',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: AppColors.successDark,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AiLoadingHero extends StatefulWidget {
  const _AiLoadingHero();

  @override
  State<_AiLoadingHero> createState() => _AiLoadingHeroState();
}

class _AiLoadingHeroState extends State<_AiLoadingHero>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final scale = 0.94 + (_controller.value * 0.08);

        return Transform.scale(
          scale: scale,
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.stone900, width: 2),
              boxShadow: const [
                BoxShadow(color: AppColors.stone900, offset: Offset(3, 3)),
              ],
            ),
            child: const Icon(
              Icons.auto_awesome,
              color: AppColors.primary,
              size: 34,
            ),
          ),
        );
      },
    );
  }
}

class _LoadingMessageSkeleton extends StatelessWidget {
  const _LoadingMessageSkeleton();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.stone50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.stone200),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SkeletonBar(widthFactor: 0.42),
          SizedBox(height: 10),
          _SkeletonBar(widthFactor: 1),
          SizedBox(height: 8),
          _SkeletonBar(widthFactor: 0.84),
          SizedBox(height: 8),
          _SkeletonBar(widthFactor: 0.58),
        ],
      ),
    );
  }
}

class _SkeletonBar extends StatelessWidget {
  final double widthFactor;

  const _SkeletonBar({required this.widthFactor});

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;

    return Container(
      width: (screenWidth - 120) * widthFactor,
      height: 10,
      decoration: BoxDecoration(
        color: AppColors.stone200,
        borderRadius: BorderRadius.circular(999),
      ),
    );
  }
}

class _AiTypingDots extends StatefulWidget {
  const _AiTypingDots();

  @override
  State<_AiTypingDots> createState() => _AiTypingDotsState();
}

class _AiTypingDotsState extends State<_AiTypingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Row(
          children: List.generate(3, (index) {
            final phase = (_controller.value + (index * 0.18)) % 1.0;
            final isActive = phase > 0.2 && phase < 0.7;

            return Container(
              width: 8,
              height: 8,
              margin: EdgeInsets.only(right: index == 2 ? 0 : 4),
              decoration: BoxDecoration(
                color: isActive ? AppColors.primary : AppColors.stone300,
                shape: BoxShape.circle,
              ),
            );
          }),
        );
      },
    );
  }
}

class _UiChatMessage {
  final String id;
  final String role;
  final String content;
  final DateTime? timestamp;
  final bool isStreaming;
  final List<dynamic>? reactTrace;

  const _UiChatMessage({
    required this.id,
    required this.role,
    required this.content,
    this.timestamp,
    this.isStreaming = false,
    this.reactTrace,
  });

  _UiChatMessage copyWith({
    String? content,
    DateTime? timestamp,
    bool? isStreaming,
    List<dynamic>? reactTrace,
  }) {
    return _UiChatMessage(
      id: id,
      role: role,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      isStreaming: isStreaming ?? this.isStreaming,
      reactTrace: reactTrace ?? this.reactTrace,
    );
  }
}
