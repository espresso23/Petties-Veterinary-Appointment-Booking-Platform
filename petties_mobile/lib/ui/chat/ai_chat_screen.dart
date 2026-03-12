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
  final Set<String> _feedbackSentForMessages = <String>{};
  List<AiChatSession> _recentSessions = const [];

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
    FocusManager.instance.primaryFocus?.unfocus();
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
      await _loadRecentSessions();
      await _connectToSession(session.sessionId);
      _reconnectAttempts = 0;
    } on AiChatException catch (error) {
      if (error.type == AiChatErrorType.sessionNotFound ||
          error.type == AiChatErrorType.forbidden) {
        await _recoverInvalidSession();
        return;
      }
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

  Future<void> _recoverInvalidSession() async {
    try {
      final session = await _aiChatService.createFreshSession();
      if (!mounted) return;
      _replaceMessages(session.messages);
      _sessionId = session.sessionId;
      await _loadRecentSessions();
      await _connectToSession(session.sessionId);
      _reconnectAttempts = 0;
      setState(() {
        _error = null;
      });
    } on AiChatException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Không thể khởi tạo lại phiên chat AI';
      });
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
      await _loadRecentSessions();
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

  Future<void> _loadRecentSessions() async {
    try {
      final sessions = await _aiChatService.listSessions(limit: 20);
      if (!mounted) return;
      setState(() {
        _recentSessions = sessions;
      });
    } on AiChatException {
      // Không cần hiển thị lỗi riêng cho danh sách session, chỉ giữ trống
    } catch (_) {
      // ignore
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
        _appendStreamingReactStep(event);
        setState(() {
          _agentStatus = event.content ?? 'Trợ lý đang suy luận...';
        });
        break;
      case AiChatSocketEventType.toolCall:
        _appendStreamingReactStep(event);
        setState(() {
          _agentStatus = event.toolName != null
              ? 'Đang gọi công cụ ${event.toolName}'
              : 'Đang gọi công cụ hỗ trợ';
        });
        break;
      case AiChatSocketEventType.toolResult:
        _appendStreamingReactStep(event);
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
              messageId: message.messageId,
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

  List<dynamic> _mergeReactTrace(List<dynamic>? current, List<dynamic>? incoming) {
    final merged = <dynamic>[];
    final seenKeys = <String>{};

    void addStep(dynamic step) {
      if (step is! Map) return;
      final map = Map<String, dynamic>.from(step);
      final key = [
        map['step_index']?.toString() ?? '',
        map['step_type']?.toString() ?? '',
        map['tool_name']?.toString() ?? '',
        map['content']?.toString() ?? '',
      ].join('|');
      if (seenKeys.add(key)) {
        merged.add(map);
      }
    }

    for (final step in current ?? const []) {
      addStep(step);
    }
    for (final step in incoming ?? const []) {
      addStep(step);
    }

    return merged;
  }

  Map<String, dynamic>? _socketEventToReactStep(AiChatSocketEvent event) {
    if (event.reactStep != null) {
      final normalized = Map<String, dynamic>.from(event.reactStep!);
      if (event.stepIndex != null) {
        normalized['step_index'] = event.stepIndex;
      }
      return normalized;
    }

    switch (event.type) {
      case AiChatSocketEventType.thinking:
        return {
          'step_index': event.stepIndex,
          'step_type': 'thought',
          'content': event.content ?? '',
          'tool_name': event.toolName,
          'tool_params': event.toolParams,
        };
      case AiChatSocketEventType.toolCall:
        return {
          'step_index': event.stepIndex,
          'step_type': 'action',
          'content': event.content ?? '',
          'tool_name': event.toolName,
          'tool_params': event.toolParams,
        };
      case AiChatSocketEventType.toolResult:
        return {
          'step_index': event.stepIndex,
          'step_type': 'observation',
          'content': event.content ?? '',
          'tool_name': event.toolName,
          'tool_result': event.result,
        };
      default:
        return null;
    }
  }

  void _appendStreamingReactStep(AiChatSocketEvent event) {
    final reactStep = _socketEventToReactStep(event);
    if (reactStep == null) return;

    setState(() {
      _error = null;
      if (_messages.isNotEmpty && _messages.last.role == 'assistant') {
        final last = _messages.removeLast();
        _messages.add(
          last.copyWith(
            isStreaming: true,
            reactTrace: _mergeReactTrace(last.reactTrace, [reactStep]),
          ),
        );
      } else {
        _messages.add(
          _UiChatMessage(
            id: UniqueKey().toString(),
            messageId: null,
            role: 'assistant',
            content: '',
            timestamp: DateTime.now(),
            isStreaming: true,
            reactTrace: [reactStep],
          ),
        );
      }
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
            reactTrace: _mergeReactTrace(last.reactTrace, reactTrace),
          ),
        );
      } else {
        _messages.add(
          _UiChatMessage(
            id: UniqueKey().toString(),
            messageId: null,
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

  Future<void> _showSessionListSheet() async {
    if (_isInitializing) return;

    if (_recentSessions.isEmpty) {
      await _loadRecentSessions();
    }

    if (!mounted) return;

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.7,
          minChildSize: 0.5,
          maxChildSize: 0.9,
          builder: (context, scrollController) {
            return Container(
              decoration: BoxDecoration(
                color: AppColors.primaryBackground,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(20),
                  topRight: Radius.circular(20),
                ),
                border: const Border(
                  top: BorderSide(color: AppColors.stone900, width: 2),
                  left: BorderSide(color: AppColors.stone900, width: 2),
                  right: BorderSide(color: AppColors.stone900, width: 2),
                ),
                boxShadow: const [
                  BoxShadow(
                    color: AppColors.stone900,
                    offset: Offset(0, -4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Container(
                    margin: const EdgeInsets.only(top: 10, bottom: 8),
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.stone400,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Lịch sử phiên chat',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          color: AppColors.stone900,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Expanded(
                    child: _recentSessions.isEmpty
                        ? const Center(
                            child: Text(
                              'Chưa có phiên chat AI nào.',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.stone600,
                              ),
                            ),
                          )
                        : ListView.builder(
                            controller: scrollController,
                            itemCount: _recentSessions.length,
                            itemBuilder: (context, index) {
                              final session = _recentSessions[index];
                              final isCurrent = session.sessionId == _sessionId;
                              return ListTile(
                                leading: Container(
                                  width: 32,
                                  height: 32,
                                  decoration: BoxDecoration(
                                    color: AppColors.primarySurface,
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: AppColors.stone900,
                                      width: 1.5,
                                    ),
                                  ),
                                  child: const Icon(
                                    Icons.chat_bubble_outline,
                                    size: 18,
                                    color: AppColors.primary,
                                  ),
                                ),
                                title: Text(
                                  session.title ?? 'Trợ lý AI',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.stone900,
                                  ),
                                ),
                                subtitle: Text(
                                  _formatSessionTime(session),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: AppColors.stone600,
                                  ),
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (isCurrent)
                                      const Padding(
                                        padding: EdgeInsets.only(right: 8),
                                        child: Text(
                                          'Đang mở',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                            color: AppColors.primaryDark,
                                          ),
                                        ),
                                      ),
                                    IconButton(
                                      icon: const Icon(
                                        Icons.delete_outline,
                                        size: 20,
                                        color: AppColors.error,
                                      ),
                                      tooltip: 'Xóa phiên chat',
                                      onPressed: () {
                                        Navigator.of(context).pop();
                                        _confirmDeleteSession(session);
                                      },
                                    ),
                                  ],
                                ),
                                onTap: () {
                                  Navigator.of(context).pop();
                                  _switchToSession(session);
                                },
                              );
                            },
                          ),
                  ),
                  Padding(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: SizedBox(
                      width: double.infinity,
                      height: 40,
                      child: ElevatedButton.icon(
                        onPressed: _startNewSession,
                        icon: const Icon(Icons.add_comment_outlined, size: 16),
                        label: const Text(
                          'PHIÊN CHAT MỚI',
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
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  String _formatSessionTime(AiChatSession session) {
    final time = session.updatedAt ?? session.createdAt;
    if (time == null) return '';
    final now = DateTime.now();
    if (now.difference(time).inDays == 0) {
      return 'Hôm nay • ${_formatTime(time)}';
    }
    return '${time.day.toString().padLeft(2, '0')}/${time.month.toString().padLeft(2, '0')} • ${_formatTime(time)}';
  }

  Future<void> _switchToSession(AiChatSession session) async {
    if (session.sessionId.isEmpty) return;

    setState(() {
      _isInitializing = true;
      _error = null;
      _agentStatus = 'Đang tải phiên chat...';
    });

    try {
      final loaded = await _aiChatService.getSession(session.sessionId);
      if (!mounted) return;
      _sessionId = loaded.sessionId;
      _replaceMessages(loaded.messages);
      await _connectToSession(loaded.sessionId);
      await _loadRecentSessions();
    } on AiChatException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Không thể mở phiên chat AI này';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isInitializing = false;
          _agentStatus = null;
        });
      }
    }
  }

  Future<void> _confirmDeleteSession(AiChatSession session) async {
    if (!mounted) return;

    final shouldDelete = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text(
            'Xóa phiên chat AI',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.stone900,
            ),
          ),
          content: const Text(
            'Bạn có chắc muốn xóa phiên chat AI này? Bạn sẽ không xem lại được hội thoại cũ nữa.',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.stone700,
              height: 1.4,
            ),
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AppColors.stone900, width: 2),
          ),
          actionsPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text(
                'HỦY',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone700,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                foregroundColor: AppColors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: const BorderSide(color: AppColors.stone900, width: 2),
                ),
              ),
              child: const Text(
                'XÓA',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        );
      },
    );

    if (shouldDelete != true) return;

    try {
      await _aiChatService.deleteSession(session.sessionId);
      await _loadRecentSessions();

      if (!mounted) return;

      // Nếu đang ở chính session vừa xóa, tạo phiên mới để tránh treo UI
      if (_sessionId == session.sessionId) {
        await _startNewSession();
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Đã xóa phiên chat AI'),
          backgroundColor: AppColors.success,
        ),
      );
    } on AiChatException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: AppColors.error,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không thể xóa phiên chat AI'),
          backgroundColor: AppColors.error,
        ),
      );
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

  Widget _buildFeedbackButtons(_UiChatMessage message) {
    final hasSent = message.messageId != null &&
        _feedbackSentForMessages.contains(message.messageId);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _FeedbackIconButton(
          icon: Icons.thumb_up_alt_outlined,
          label: 'Hài lòng',
          isSelected: hasSent,
          color: AppColors.successDark,
          onTap: hasSent
              ? null
              : () => _handleFeedback(message, AiFeedbackType.thumbsUp),
        ),
        const SizedBox(width: 6),
        _FeedbackIconButton(
          icon: Icons.thumb_down_alt_outlined,
          label: 'Chưa ổn',
          isSelected: hasSent,
          color: AppColors.coral,
          onTap: hasSent
              ? null
              : () => _handleFeedback(message, AiFeedbackType.thumbsDown),
        ),
      ],
    );
  }

  Future<void> _handleFeedback(
    _UiChatMessage message,
    AiFeedbackType type,
  ) async {
    if (_sessionId == null || message.messageId == null) return;

    final msgId = message.messageId!;
    if (_feedbackSentForMessages.contains(msgId)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Bạn đã gửi phản hồi cho câu trả lời này rồi'),
          backgroundColor: AppColors.stone600,
        ),
      );
      return;
    }

    try {
      await _aiChatService.sendFeedback(
        messageId: msgId,
        sessionId: _sessionId!,
        type: type,
      );

      if (!mounted) return;
      setState(() {
        _feedbackSentForMessages.add(msgId);
      });

      final successText = type == AiFeedbackType.thumbsUp
          ? 'Cảm ơn bạn, hệ thống đã ghi nhận phản hồi tích cực.'
          : 'Cảm ơn bạn, hệ thống sẽ xem xét phản hồi của bạn.';

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(successText),
          backgroundColor:
              type == AiFeedbackType.thumbsUp ? AppColors.success : AppColors.error,
        ),
      );
    } on AiChatException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.message),
          backgroundColor: AppColors.error,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không gửi được phản hồi cho trợ lý AI'),
          backgroundColor: AppColors.error,
        ),
      );
    }
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
          onPressed: () {
            FocusManager.instance.primaryFocus?.unfocus();
            context.pop();
          },
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
            onPressed: _isInitializing ? null : _showSessionListSheet,
            tooltip: 'Lịch sử phiên chat',
            icon: const Icon(Icons.history),
          ),
          IconButton(
            onPressed: _isInitializing ? null : _startNewSession,
            tooltip: 'Phiên chat mới',
            icon: const Icon(Icons.add_comment_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _buildStatusBar(),
            Expanded(child: _buildContent()),
            _buildComposer(horizontalPadding),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBar() {
    if (_agentStatus == null && !_isReconnecting && !_isSending) {
      return const SizedBox.shrink();
    }

    final String label;
    final Color bgColor;
    final Color fgColor;
    final IconData icon;

    if (_isReconnecting) {
      label = 'Đang kết nối lại...';
      bgColor = AppColors.blue100;
      fgColor = AppColors.blue600;
      icon = Icons.sync;
    } else if (_isSending) {
      label = _agentStatus ?? 'Đang xử lý...';
      bgColor = AppColors.primarySurface;
      fgColor = AppColors.primaryDark;
      icon = Icons.bolt;
    } else {
      label = _agentStatus ?? '';
      bgColor = AppColors.successLight;
      fgColor = AppColors.successDark;
      icon = Icons.check_circle_outline;
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: bgColor,
        border: const Border(
          bottom: BorderSide(color: AppColors.stone200, width: 1),
        ),
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: fgColor),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: fgColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickPromptChips() {
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _quickPrompts.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final prompt = _quickPrompts[index];
          return GestureDetector(
            onTap: _isSending || _isReconnecting
                ? null
                : () => _sendMessage(prompt),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.white,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: AppColors.stone900, width: 1.5),
                boxShadow: const [
                  BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
                ],
              ),
              child: Text(
                prompt,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.stone900,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildContent() {
    if (_isInitializing) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _AiLoadingHero(),
            SizedBox(height: 12),
            Text(
              'Đang chuẩn bị trợ lý AI...',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
              ),
            ),
          ],
        ),
      );
    }

    if (_error != null && _messages.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: AppColors.errorLight,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.stone900, width: 2),
                ),
                child: const Icon(
                  Icons.cloud_off_outlined,
                  color: AppColors.error,
                  size: 28,
                ),
              ),
              const SizedBox(height: 12),
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
              const SizedBox(height: 16),
              SizedBox(
                height: 40,
                child: ElevatedButton.icon(
                  onPressed: _startNewSession,
                  icon: const Icon(Icons.refresh, size: 16),
                  label: const Text(
                    'THỬ LẠI',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: AppColors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: const BorderSide(color: AppColors.stone900, width: 2),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_messages.isEmpty) {
      return Column(
        children: [
          const Spacer(),
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: AppColors.primarySurface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.stone900, width: 2),
            ),
            child: const Icon(Icons.auto_awesome, color: AppColors.primary, size: 28),
          ),
          const SizedBox(height: 12),
          const Text(
            'Hỏi bất cứ điều gì!',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.stone900,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Đặt lịch, hỏi về sức khoẻ thú cưng, tìm phòng khám...',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.stone600,
            ),
          ),
          const SizedBox(height: 20),
          _buildQuickPromptChips(),
          const Spacer(),
        ],
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      itemCount: _messages.length,
      itemBuilder: (context, index) => _buildMessageBubble(_messages[index]),
    );
  }

  Widget _buildMessageBubble(_UiChatMessage message) {
    final isUser = message.role == 'user';
    final displayContent = !isUser && message.content.isEmpty && message.isStreaming
        ? 'Trợ lý đang suy luận...'
        : message.content;
    final bookingDraft = !isUser
        ? extractBookingConfirmationDraft(
            content: displayContent,
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
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: isUser ? AppColors.primary : AppColors.white,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(14),
                      topRight: const Radius.circular(14),
                      bottomLeft: Radius.circular(isUser ? 14 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 14),
                    ),
                    border: Border.all(
                      color: isBookingReady ? AppColors.successDark : AppColors.stone900,
                      width: 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: isBookingReady ? AppColors.successDark : AppColors.stone900,
                        offset: const Offset(2, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment:
                        isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                    children: [
                      if (isBookingReady) ...[
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            _BookingReadyBadge(),
                          ],
                        ),
                        const SizedBox(height: 8),
                        const _BookingReadyBanner(),
                        const SizedBox(height: 8),
                      ],
                      Text(
                        displayContent,
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
                        _buildTracePanel(
                          message.reactTrace!,
                          initiallyExpanded: message.isStreaming,
                        ),
                      ],
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment:
                            isUser ? MainAxisAlignment.end : MainAxisAlignment.spaceBetween,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (!isUser && message.messageId != null)
                            _buildFeedbackButtons(message),
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

  Widget _buildTracePanel(List<dynamic> trace, {bool initiallyExpanded = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.stone100,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone200, width: 1.5),
      ),
      child: ExpansionTile(
        initiallyExpanded: initiallyExpanded,
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
      padding: EdgeInsets.fromLTRB(horizontalPadding, 8, horizontalPadding, 8),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(
          top: BorderSide(color: AppColors.stone900, width: 2),
        ),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_error != null && _messages.isNotEmpty) ...[
              Container(
                width: double.infinity,
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.errorLight,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.error, width: 1.5),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded,
                        color: AppColors.error, size: 16),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        _error!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: AppColors.errorDark,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
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
                    constraints: const BoxConstraints(maxHeight: 100),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.stone900, width: 2),
                      boxShadow: const [
                        BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
                      ],
                    ),
                    child: TextField(
                      controller: _messageController,
                      minLines: 1,
                      maxLines: 3,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => _sendMessage(),
                      style: const TextStyle(fontSize: 14),
                      decoration: const InputDecoration(
                        hintText: 'Nhập câu hỏi cho trợ lý AI...',
                        hintStyle: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.stone400,
                        ),
                        border: InputBorder.none,
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _isSending || _isReconnecting ? null : _sendMessage,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: 46,
                    height: 46,
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
                                  offset: Offset(2, 2)),
                            ],
                    ),
                    child: Icon(
                      _isReconnecting
                          ? Icons.sync
                          : _isSending
                              ? Icons.hourglass_top
                              : Icons.send_rounded,
                      color: AppColors.white,
                      size: 20,
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
    if (message.contains('Không tìm thấy API trợ lý AI')) {
      return 'Ứng dụng không kết nối đúng tới AI service. Cần kiểm tra lại cấu hình địa chỉ AI service.';
    }

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

class _FeedbackIconButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;
  final Color color;
  final VoidCallback? onTap;

  const _FeedbackIconButton({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bgColor = isSelected ? color.withValues(alpha: 0.12) : Colors.transparent;
    final borderColor =
        isSelected ? color : AppColors.stone300.withValues(alpha: 0.9);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: borderColor,
            width: 1.3,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 14,
              color: color,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: AppColors.stone800,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
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
  final String? messageId;
  final String role;
  final String content;
  final DateTime? timestamp;
  final bool isStreaming;
  final List<dynamic>? reactTrace;

  const _UiChatMessage({
    required this.id,
    this.messageId,
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
      messageId: messageId,
      role: role,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      isStreaming: isStreaming ?? this.isStreaming,
      reactTrace: reactTrace ?? this.reactTrace,
    );
  }
}
