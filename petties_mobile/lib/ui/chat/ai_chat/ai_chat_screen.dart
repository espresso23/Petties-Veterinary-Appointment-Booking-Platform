import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:web_socket_channel/io.dart';
import 'package:geolocator/geolocator.dart';

import '../../../config/constants/app_colors.dart';
import '../../../data/models/ai_chat.dart';
import '../../../data/services/ai_chat_service.dart';
import '../../../data/services/booking_service.dart';
import '../../../providers/auth_provider.dart';
import '../../../routing/app_routes.dart';
import 'utils/ai_booking_tracker.dart';
import 'utils/ai_chat_autocomplete.dart';
import 'utils/ai_booking_cards.dart';
import 'utils/ai_chat_panels.dart';
import 'utils/ai_chat_widgets.dart';
import 'widgets/web_search_results_card.dart';

class AiChatScreen extends StatefulWidget {
  const AiChatScreen({
    super.key,
    this.bookingAssistantEnabled = true,
  });

  final bool bookingAssistantEnabled;

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  static const int _maxReconnectAttempts = 2;
  static const List<String> _petOwnerQuickPrompts = [
    'Bé nhà tôi cần tiêm mũi nào tiếp theo?',
    'Gợi ý phòng khám gần tôi có dịch vụ tiêm chủng',
    'Đặt lịch khám tổng quát cần chuẩn bị gì?',
    'Phòng khám nào còn slot trống cuối tuần này?',
    'Tôi muốn đặt lịch cho thú cưng của tôi',
  ];
  static const List<String> _clinicCopilotQuickPrompts = [
    'Tóm tắt nhanh thú cưng tôi đang phụ trách hôm nay',
    'Kiểm tra lịch trống của phòng khám hôm nay',
    'Tra cứu bệnh án gần đây của bệnh nhân',
    'Kiểm tra tình trạng tiêm chủng của thú cưng',
    'Tóm tắt thông tin cần lưu ý cho ca khám này',
  ];

  final AiChatService _aiChatService = AiChatService();
  final BookingService _bookingService = BookingService();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  IOWebSocketChannel? _channel;
  StreamSubscription? _socketSubscription;

  String _streamBuffer = '';
  Timer? _streamFlushTimer;
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
  final Map<String, Set<String>> _selectedServiceIdsByMessage =
      <String, Set<String>>{};
  AiBookingTrackerSnapshot _bookingTracker = AiBookingTrackerSnapshot.empty;
  List<String> _composerSuggestions = const <String>[];
  final Set<String> _feedbackSentForMessages = <String>{};
  List<AiChatSession> _recentSessions = const [];
  List<AiClinic> _latestClinicOptions = const <AiClinic>[];
  List<AiBookingServiceOption> _latestServiceOptions =
      const <AiBookingServiceOption>[];
  List<String> _latestBookingDateOptions = const <String>[];
  List<String> _latestStartTimeOptions = const <String>[];
  final Map<String, Set<String>> _slotTimesByDate = <String, Set<String>>{};
  String? _latestKnownHomeAddress;
  double? _latestKnownHomeLat;
  double? _latestKnownHomeLong;
  Map<String, dynamic>? _lastLocationPayload;
  bool _isFetchingLocation = false;
  final List<Map<String, dynamic>> _liveReactTrace = <Map<String, dynamic>>[];
  bool _thinkingDetailsExpanded = false;
  String _resolvedRoleFromToken = '';
  bool _isRoleResolvedFromToken = false;

  bool get _bookingAssistantEnabled {
    if (_isRoleResolvedFromToken) {
      return _resolvedRoleFromToken == 'PET_OWNER';
    }
    return widget.bookingAssistantEnabled;
  }

  String get _assistantTitle =>
      _bookingAssistantEnabled ? 'TRỢ LÝ AI' : 'AI COPILOT';

  String get _assistantReadyMessage => _bookingAssistantEnabled
      ? 'Đang chuẩn bị trợ lý AI...'
      : 'Đang khởi tạo AI Copilot...';

  String get _emptyStateTitle => _bookingAssistantEnabled
      ? 'Hỏi bất cứ điều gì!'
      : 'Sẵn sàng hỗ trợ ca trực';

  String get _emptyStateSubtitle => _bookingAssistantEnabled
      ? 'Đặt lịch, hỏi về sức khoẻ thú cưng, tìm phòng khám...'
      : 'Tóm tắt hồ sơ bệnh án, kiểm tra lịch trống, chuẩn bị thông tin cho ca khám.';

  String get _composerHintText => _bookingAssistantEnabled
      ? 'Nhập câu hỏi cho trợ lý AI...'
      : 'Nhập yêu cầu cho AI Copilot phòng khám...';

  String get _sendingStatusMessage => _bookingAssistantEnabled
      ? 'Đang gửi câu hỏi cho trợ lý AI...'
      : 'Đang gửi yêu cầu cho AI Copilot...';

  String get _sendFailedMessage => _bookingAssistantEnabled
      ? 'Không gửi được câu hỏi tới trợ lý AI'
      : 'Không gửi được yêu cầu tới AI Copilot';

  Color get _assistantAccentColor =>
      _bookingAssistantEnabled ? AppColors.primary : AppColors.teal600;

  Color get _assistantSurfaceColor =>
      _bookingAssistantEnabled ? AppColors.primarySurface : AppColors.teal100;

  IconData get _assistantAvatarIcon => _bookingAssistantEnabled
      ? Icons.smart_toy_outlined
      : Icons.health_and_safety_outlined;

  String get _thinkingLabel => _bookingAssistantEnabled
      ? 'AI đang suy nghĩ...'
      : 'Copilot đang phân tích...';

  List<String> get _quickPrompts => _bookingAssistantEnabled
      ? _petOwnerQuickPrompts
      : _clinicCopilotQuickPrompts;

  AiBookingTrackerSnapshot get _activeTracker => _bookingAssistantEnabled
      ? _bookingTracker
      : AiBookingTrackerSnapshot.empty;

  @override
  void initState() {
    super.initState();
    _messageController.addListener(_handleComposerChanged);
    _initializeChat();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final authProvider = context.watch<AuthProvider>();
    final rawRole = (authProvider.user?.role ?? '').trim().toUpperCase();
    final hasRole = rawRole.isNotEmpty;

    if (!hasRole) {
      if (_isRoleResolvedFromToken) {
        setState(() {
          _isRoleResolvedFromToken = false;
          _resolvedRoleFromToken = '';
        });
        _refreshComposerSuggestions();
      }
      return;
    }

    final nextRole = rawRole;
    if (_resolvedRoleFromToken != nextRole || !_isRoleResolvedFromToken) {
      setState(() {
        _resolvedRoleFromToken = nextRole;
        _isRoleResolvedFromToken = true;
      });
      _refreshComposerSuggestions();
    }
  }

  @override
  void dispose() {
    _streamFlushTimer?.cancel();
    _socketSubscription?.cancel();
    _channel?.sink.close();
    _messageController.removeListener(_handleComposerChanged);
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
      _ensureLocationCached();
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
      _ensureLocationCached();
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
      _ensureLocationCached();
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
      // Không cần hiển thị lỗi riêng cho danh sách session, chỉ giữ trạng thái hiện tại.
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
      _agentStatus =
          'Đang kết nối lại trợ lý AI... ($attempt/$_maxReconnectAttempts)';
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

  String? _mapToolStatus(String? toolName) {
    final name = (toolName ?? '').trim();
    if (name.isEmpty) return null;

    switch (name) {
      case 'get_user_pets':
        return 'Đang lấy danh sách thú cưng...';
      case 'search_clinics_nearby':
        return 'Đang tìm phòng khám gần bạn...';
      case 'get_clinic_services':
        return 'Đang tải danh sách dịch vụ...';
      case 'check_available_slots':
        return 'Đang kiểm tra lịch trống...';
      case 'create_booking_for_user':
        return 'Đang tạo yêu cầu đặt lịch...';
      case 'pet_knowledge_search':
        return 'Đang tra cứu thông tin...';
      case 'web_search':
        return 'Đang tìm thêm thông tin...';
      default:
        return null;
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
          // ACK là tín hiệu hệ thống; không dùng để hiển thị lại nội dung user.
          _agentStatus = 'Đã nhận yêu cầu.';
        });
        break;
      case AiChatSocketEventType.thinkingStream:
        _captureReactStep(event);
        setState(() {
          _isSending = true;
          _agentStatus = event.content ?? 'Trợ lý đang suy luận...';
        });
        break;
      case AiChatSocketEventType.thinking:
        _captureReactStep(event);
        setState(() {
          _isSending = true;
          _agentStatus = event.content ?? 'Trợ lý đang suy luận...';
        });
        break;
      case AiChatSocketEventType.toolCall:
        _captureReactStep(event);
        setState(() {
          _isSending = true;
          _agentStatus = _mapToolStatus(event.toolName) ??
              (event.toolName != null ? 'Đang xử lý...' : 'Đang xử lý...');
        });
        break;
      case AiChatSocketEventType.toolResult:
        _captureReactStep(event);
        setState(() {
          _isSending = true;
          _agentStatus = 'Đang tổng hợp phản hồi...';
        });
        break;
      case AiChatSocketEventType.stream:
        _appendAssistantChunk(event.content ?? '');
        break;
      case AiChatSocketEventType.complete:
        _flushStreamBuffer();
        setState(() {
          _liveReactTrace.clear();
        });
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
      case AiChatSocketEventType.clinicSuggestion:
        if (event.clinicSuggestion != null &&
            event.clinicSuggestion!.clinics.isNotEmpty) {
          _addClinicSuggestions(event.clinicSuggestion!.clinics);
        }
        break;
      case AiChatSocketEventType.info:
        _appendAssistantText(event.message ?? event.content ?? '');
        break;
      case AiChatSocketEventType.suggestedPrompts:
      case AiChatSocketEventType.petCards:
      case AiChatSocketEventType.quickReplies:
      case AiChatSocketEventType.clinicCarousel:
      case AiChatSocketEventType.dateChips:
        break;
      case AiChatSocketEventType.serviceChips:
        if (event.serviceOptions.isNotEmpty) {
          final eventClinicId = event.raw['clinic_id']?.toString() ??
              event.raw['clinicId']?.toString();
          _addServiceOptions(
            event.serviceOptions,
            clinicId: eventClinicId,
            leadText: event.message ?? event.content,
          );
        }
        break;
      case AiChatSocketEventType.slotGrid:
        if (event.slotGrid != null) {
          _addSlotGrid(event.slotGrid!);
        }
        break;
      case AiChatSocketEventType.bookingSummary:
        if (event.bookingSummary != null) {
          _addBookingSummary(event.bookingSummary!);
        }
        break;
      case AiChatSocketEventType.bookingCreated:
        if (event.bookingCreated != null) {
          _addBookingCreated(event.bookingCreated!);
        }
        break;
      case AiChatSocketEventType.uiSchema:
        if (event.uiSchema != null) {
          _applyUiSchemaEvent(
            event.uiSchema!,
            fallbackMessage: event.message ?? event.content,
          );
        }
        break;
      case AiChatSocketEventType.bookingStateUpdate:
        if (event.bookingState != null) {
          _applyBookingStateUpdate(event.bookingState!);
        }
        break;
      case AiChatSocketEventType.multiPetBookingCreated:
        if (event.multiPetBookingCreated != null) {
          _addMultiPetBookingCreated(event.multiPetBookingCreated!);
        }
        break;
      case AiChatSocketEventType.unknown:
        break;
    }
  }

  void _replaceMessages(List<AiChatMessage> source) {
    setState(() {
      _bookingTracker = AiBookingTrackerSnapshot.empty;
      _latestClinicOptions = const <AiClinic>[];
      _latestServiceOptions = const <AiBookingServiceOption>[];
      _latestBookingDateOptions = const <String>[];
      _latestStartTimeOptions = const <String>[];
      _slotTimesByDate.clear();
      _latestKnownHomeAddress = null;
      _latestKnownHomeLat = null;
      _latestKnownHomeLong = null;
      _messages = source
          .where((message) =>
              message.role == 'user' || message.role == 'assistant')
          .map((message) {
        final schemaData = message.uiSchema != null
            ? _schemaToStructuredPayload(message.uiSchema!)
            : null;
        return _UiChatMessage(
          id: message.messageId ?? UniqueKey().toString(),
          messageId: message.messageId,
          role: message.role,
          content: message.content,
          timestamp: message.timestamp,
          reactTrace: message.reactTrace,
          clinicSuggestions: schemaData?.clinics,
          serviceOptions: schemaData?.serviceOptions,
          serviceClinicId: schemaData?.serviceClinicId,
          slotGrid: schemaData?.slotGrid,
          bookingSummary: schemaData?.bookingSummary,
          bookingCreated: schemaData?.bookingCreated,
          webSearchResults: schemaData?.webSearchResults,
          webSearchImages: schemaData?.webSearchImages,
          webSearchAnswer: schemaData?.webSearchAnswer,
          webSearchFollowUpQuestions: schemaData?.webSearchFollowUpQuestions,
        );
      }).toList();
    });

    for (final message in source) {
      if (_bookingAssistantEnabled && message.uiSchema != null) {
        _bookingTracker = _bookingTracker.mergeUiSchema(message.uiSchema);
        final payload = _schemaToStructuredPayload(message.uiSchema!);
        if (payload.clinics.isNotEmpty) {
          _latestClinicOptions =
              _mergeClinicOptions(_latestClinicOptions, payload.clinics);
        }
        if (payload.serviceOptions.isNotEmpty) {
          _latestServiceOptions = _mergeServiceOptions(
              _latestServiceOptions, payload.serviceOptions);
        }
        if (payload.slotGrid != null) {
          _cacheSlotOptions(payload.slotGrid!);
        }
        final summary = payload.bookingSummary;
        if (summary != null) {
          _cacheHomeVisitInfo(summary);
        }
      }
    }

    _refreshComposerSuggestions();
    _scrollToBottom();
  }

  void _applyBookingStateUpdate(Map<String, dynamic> bookingState) {
    if (!_bookingAssistantEnabled) {
      return;
    }

    final draft = bookingState['draft'] is Map
        ? Map<String, dynamic>.from(bookingState['draft'] as Map)
        : <String, dynamic>{};
    final mergedSummary = <String, dynamic>{
      ...draft,
      if (bookingState['status'] != null)
        'status': bookingState['status'].toString(),
      if (bookingState['stage'] != null)
        'stage': bookingState['stage'].toString(),
    };

    setState(() {
      _bookingTracker = _bookingTracker.mergeSummaryData(mergedSummary);
    });
    _refreshComposerSuggestions();
  }

  void _applyUiSchemaEvent(
    UiSchemaV1 schema, {
    String? fallbackMessage,
  }) {
    final payload = _schemaToStructuredPayload(schema);
    if (!payload.hasStructuredData) {
      return;
    }

    final normalizedSummary = payload.bookingSummary == null
        ? null
        : _normalizeBookingSummaryPayload(payload.bookingSummary!);

    setState(() {
      _agentStatus = null;
      if (payload.clinics.isNotEmpty) {
        _latestClinicOptions =
            _mergeClinicOptions(_latestClinicOptions, payload.clinics);
      }
      if (payload.serviceOptions.isNotEmpty) {
        _latestServiceOptions =
            _mergeServiceOptions(_latestServiceOptions, payload.serviceOptions);
      }
      if (payload.slotGrid != null) {
        _cacheSlotOptions(payload.slotGrid!);
      }
      if (normalizedSummary != null) {
        _cacheHomeVisitInfo(normalizedSummary);
      }
      if (_bookingAssistantEnabled && normalizedSummary != null) {
        _bookingTracker = _bookingTracker.mergeSummary(normalizedSummary);
      } else if (_bookingAssistantEnabled && payload.slotGrid != null) {
        _bookingTracker = _bookingTracker.mergeSlot(payload.slotGrid!, null);
      }

      _upsertAssistantMessage(
        content: payload.message ?? fallbackMessage ?? '',
        isStreaming: false,
        clinicSuggestions: payload.clinics.isNotEmpty ? payload.clinics : null,
        serviceOptions:
            payload.serviceOptions.isNotEmpty ? payload.serviceOptions : null,
        serviceClinicId: payload.serviceClinicId,
        slotGrid: payload.slotGrid,
        bookingSummary: normalizedSummary,
        bookingCreated: payload.bookingCreated,
        webSearchResults: payload.webSearchResults.isNotEmpty
            ? payload.webSearchResults
            : null,
        webSearchImages:
            payload.webSearchImages.isNotEmpty ? payload.webSearchImages : null,
        webSearchAnswer: payload.webSearchAnswer,
        webSearchFollowUpQuestions:
            payload.webSearchFollowUpQuestions.isNotEmpty
                ? payload.webSearchFollowUpQuestions
                : null,
        preferExistingContent: true,
      );
    });
    _refreshComposerSuggestions();
    _scrollToBottom();
  }

  _UiSchemaStructuredPayload _schemaToStructuredPayload(UiSchemaV1 schema) {
    final clinics = <AiClinic>[];
    final serviceOptions = <AiBookingServiceOption>[];
    final slotOptions = <AiBookingSlotOption>[];

    String? message;
    String? serviceClinicId;
    String? slotClinicId;
    String? slotBookingDate;
    List<String> slotServiceIds = const [];
    List<String> slotServiceNames = const [];
    AiBookingSummaryPayload? bookingSummary;
    AiBookingCreatedPayload? bookingCreated;
    final webSearchResults = <WebSearchResult>[];
    final webSearchImages = <WebSearchImage>[];
    final webSearchFollowUpQuestions = <String>[];
    String? webSearchAnswer;
    final suppressBookingUi = !_bookingAssistantEnabled;

    for (final component in schema.components) {
      final data = component.data;
      switch (component.type) {
        case 'text':
        case 'badge':
        case 'empty_state':
          final content =
              data['content']?.toString() ?? data['message']?.toString();
          if ((content ?? '').trim().isNotEmpty && message == null) {
            message = content!.trim();
          }
          final answer = data['answer']?.toString();
          if ((answer ?? '').trim().isNotEmpty &&
              (webSearchAnswer ?? '').trim().isEmpty) {
            webSearchAnswer = answer!.trim();
          }
          final questions = _extractFollowUpQuestionsFromSchemaData(data);
          for (final question in questions) {
            if (!webSearchFollowUpQuestions.contains(question)) {
              webSearchFollowUpQuestions.add(question);
            }
          }
          break;
        case 'clinic_card':
          if (suppressBookingUi) {
            break;
          }
          final clinic = AiClinic.fromJson(data);
          if (clinic.id.isNotEmpty || clinic.name.isNotEmpty) {
            clinics.add(clinic);
          }
          break;
        case 'service_chip':
        case 'service_card':
          if (suppressBookingUi) {
            break;
          }
          final service = AiBookingServiceOption.fromJson(
            _normalizeServiceDataFromSchema(data),
          );
          if (service.id.isNotEmpty || service.name.isNotEmpty) {
            serviceOptions.add(service);
          }
          final clinicId =
              data['clinic_id']?.toString() ?? data['clinicId']?.toString();
          if ((clinicId ?? '').trim().isNotEmpty) {
            serviceClinicId = clinicId!.trim();
          }
          break;
        case 'slot_button':
          if (suppressBookingUi) {
            break;
          }
          final slot =
              AiBookingSlotOption.fromJson(_normalizeSlotDataFromSchema(data));
          if (slot.startTime.isNotEmpty) {
            slotOptions.add(slot);
          }

          final clinicId =
              data['clinic_id']?.toString() ?? data['clinicId']?.toString();
          if ((clinicId ?? '').trim().isNotEmpty) {
            slotClinicId = clinicId!.trim();
          }
          final bookingDate = data['booking_date']?.toString() ??
              data['bookingDate']?.toString();
          if ((bookingDate ?? '').trim().isNotEmpty) {
            slotBookingDate = bookingDate!.trim();
          }

          slotServiceIds = ((data['service_ids'] as List<dynamic>?) ??
                  (data['serviceIds'] as List<dynamic>?) ??
                  const [])
              .map((item) => item.toString())
              .where((item) => item.trim().isNotEmpty)
              .toList();
          slotServiceNames = ((data['service_names'] as List<dynamic>?) ??
                  (data['serviceNames'] as List<dynamic>?) ??
                  const [])
              .map((item) => item.toString())
              .where((item) => item.trim().isNotEmpty)
              .toList();
          break;
        case 'booking_summary':
          if (suppressBookingUi) {
            break;
          }
          bookingSummary = AiBookingSummaryPayload.fromJson(data);
          if ((data['status']?.toString().toUpperCase() ?? '') == 'PENDING' &&
              data['id'] != null) {
            bookingCreated = AiBookingCreatedPayload.fromJson({
              'booking': {
                'id': data['id'],
                'booking_code': data['booking_code'],
                'status': data['status'],
                'pet_name': data['pet_name'],
                'clinic_name': data['clinic_name'],
                'date': data['booking_date'],
                'time': data['start_time'],
                'type': data['booking_type'],
                'services': data['service_names'] ??
                    data['serviceNames'] ??
                    data['service_ids'] ??
                    data['serviceIds'] ??
                    const [],
              },
              'message': data['message'],
            });
          }
          break;
        case 'web_result_card':
          final result = WebSearchResult.fromJson(data);
          if (result.title.trim().isNotEmpty ||
              result.snippet.trim().isNotEmpty ||
              result.url.trim().isNotEmpty) {
            webSearchResults.add(result);
          }
          break;
        case 'image_gallery':
          final rawImages = data['images'] as List<dynamic>? ?? const [];
          for (final item in rawImages) {
            if (item is Map) {
              final image =
                  WebSearchImage.fromJson(Map<String, dynamic>.from(item));
              if (image.url.trim().isNotEmpty) {
                webSearchImages.add(image);
              }
            }
          }
          final answer = data['answer']?.toString();
          if ((answer ?? '').trim().isNotEmpty &&
              (webSearchAnswer ?? '').trim().isEmpty) {
            webSearchAnswer = answer!.trim();
          }
          final questions = _extractFollowUpQuestionsFromSchemaData(data);
          for (final question in questions) {
            if (!webSearchFollowUpQuestions.contains(question)) {
              webSearchFollowUpQuestions.add(question);
            }
          }
          break;
        default:
          break;
      }
    }

    final slotGrid = slotOptions.isEmpty
        ? null
        : AiSlotGridPayload(
            clinicId: slotClinicId,
            bookingDate: slotBookingDate,
            serviceIds: slotServiceIds,
            serviceNames: slotServiceNames,
            recommendedSlots: slotOptions,
            alternativeSlots: const [],
            totalSlots: slotOptions.length,
            message: message,
          );

    return _UiSchemaStructuredPayload(
      message: message,
      clinics: clinics,
      serviceOptions: serviceOptions,
      serviceClinicId: serviceClinicId ?? slotClinicId,
      slotGrid: slotGrid,
      bookingSummary: bookingSummary,
      bookingCreated: bookingCreated,
      webSearchResults: webSearchResults,
      webSearchImages: webSearchImages,
      webSearchAnswer: webSearchAnswer,
      webSearchFollowUpQuestions: webSearchFollowUpQuestions,
    );
  }

  List<String> _extractFollowUpQuestionsFromSchemaData(
    Map<String, dynamic> data,
  ) {
    final rawQuestions = (data['follow_up_questions'] as List<dynamic>?) ??
        (data['followUpQuestions'] as List<dynamic>?) ??
        const <dynamic>[];

    return rawQuestions
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  Map<String, dynamic> _normalizeServiceDataFromSchema(
    Map<String, dynamic> data,
  ) {
    final normalized = Map<String, dynamic>.from(data);
    normalized['id'] = normalized['id'] ??
        normalized['service_id'] ??
        normalized['serviceId'] ??
        normalized['item_id'];
    normalized['name'] = normalized['name'] ??
        normalized['service_name'] ??
        normalized['serviceName'] ??
        normalized['label'];
    normalized['clinic_id'] = normalized['clinic_id'] ?? normalized['clinicId'];
    return normalized;
  }

  Map<String, dynamic> _normalizeSlotDataFromSchema(Map<String, dynamic> data) {
    final normalized = Map<String, dynamic>.from(data);
    normalized['start_time'] = normalized['start_time'] ??
        normalized['startTime'] ??
        normalized['slot_time'];
    normalized['end_time'] = normalized['end_time'] ?? normalized['endTime'];
    normalized['duration_minutes'] =
        normalized['duration_minutes'] ?? normalized['durationMinutes'];
    normalized['staff_available'] =
        normalized['staff_available'] ?? normalized['staffAvailable'];
    return normalized;
  }

  void _handleComposerChanged() {
    if (!mounted) {
      return;
    }
    _refreshComposerSuggestions();
  }

  void _refreshComposerSuggestions() {
    final nextSuggestions = buildAiChatAutocompleteSuggestions(
      query: _messageController.text,
      quickPrompts: _quickPrompts,
      tracker: _activeTracker,
    );

    setState(() {
      _composerSuggestions = nextSuggestions;
    });
  }

  void _applyComposerSuggestion(String suggestion) {
    _messageController.value = TextEditingValue(
      text: suggestion,
      selection: TextSelection.collapsed(offset: suggestion.length),
    );
  }

  List<dynamic> _mergeReactTrace(
      List<dynamic>? current, List<dynamic>? incoming) {
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
    if (event.stepIndex == null) return null;
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

  void _captureReactStep(AiChatSocketEvent event) {
    final reactStep = _socketEventToReactStep(event);
    if (reactStep == null) return;

    setState(() {
      _error = null;
      _liveReactTrace.add(reactStep);
      if (_liveReactTrace.length > 60) {
        _liveReactTrace.removeRange(0, _liveReactTrace.length - 60);
      }
    });
  }

  bool _hasStructuredAssistantContent(_UiChatMessage message) {
    return (message.clinicSuggestions?.isNotEmpty ?? false) ||
        (message.serviceOptions?.isNotEmpty ?? false) ||
        message.slotGrid != null ||
        message.bookingSummary != null ||
        message.bookingCreated != null ||
        message.multiPetBookingCreated != null ||
        (message.webSearchResults?.isNotEmpty ?? false) ||
        (message.webSearchImages?.isNotEmpty ?? false) ||
        (message.webSearchAnswer ?? '').trim().isNotEmpty;
  }

  void _upsertAssistantMessage({
    String? content,
    bool? isStreaming,
    List<dynamic>? reactTrace,
    List<AiClinic>? clinicSuggestions,
    List<AiBookingServiceOption>? serviceOptions,
    String? serviceClinicId,
    AiSlotGridPayload? slotGrid,
    AiBookingSummaryPayload? bookingSummary,
    AiBookingCreatedPayload? bookingCreated,
    AiBookingCreatedPayload? multiPetBookingCreated,
    List<WebSearchResult>? webSearchResults,
    List<WebSearchImage>? webSearchImages,
    String? webSearchAnswer,
    List<String>? webSearchFollowUpQuestions,
    bool preferExistingContent = false,
  }) {
    final normalizedContent = (content ?? '').trim();
    final hasAssistantTail =
        _messages.isNotEmpty && _messages.last.role == 'assistant';

    if (!hasAssistantTail) {
      _messages.add(
        _UiChatMessage(
          id: UniqueKey().toString(),
          messageId: null,
          role: 'assistant',
          content: normalizedContent,
          timestamp: DateTime.now(),
          isStreaming: isStreaming ?? false,
          reactTrace: reactTrace,
          clinicSuggestions: clinicSuggestions,
          serviceOptions: serviceOptions,
          serviceClinicId: serviceClinicId,
          slotGrid: slotGrid,
          bookingSummary: bookingSummary,
          bookingCreated: bookingCreated,
          multiPetBookingCreated: multiPetBookingCreated,
          webSearchResults: webSearchResults,
          webSearchImages: webSearchImages,
          webSearchAnswer: webSearchAnswer,
          webSearchFollowUpQuestions: webSearchFollowUpQuestions,
        ),
      );
      return;
    }

    final last = _messages.removeLast();
    final nextContent = normalizedContent.isEmpty
        ? last.content
        : (preferExistingContent && last.content.trim().isNotEmpty)
            ? last.content
            : normalizedContent;

    _messages.add(
      last.copyWith(
        content: nextContent,
        timestamp: DateTime.now(),
        isStreaming: isStreaming ?? last.isStreaming,
        reactTrace: reactTrace != null
            ? _mergeReactTrace(last.reactTrace, reactTrace)
            : null,
        clinicSuggestions: clinicSuggestions,
        serviceOptions: serviceOptions,
        serviceClinicId: serviceClinicId,
        slotGrid: slotGrid,
        bookingSummary: bookingSummary,
        bookingCreated: bookingCreated,
        multiPetBookingCreated: multiPetBookingCreated,
        webSearchResults: webSearchResults,
        webSearchImages: webSearchImages,
        webSearchAnswer: webSearchAnswer,
        webSearchFollowUpQuestions: webSearchFollowUpQuestions,
      ),
    );
  }

  void _appendAssistantChunk(String chunk) {
    if (chunk.isEmpty) return;
    if (_messages.isNotEmpty &&
        _messages.last.role == 'assistant' &&
        _hasStructuredAssistantContent(_messages.last)) {
      setState(() {
        _error = null;
        _isSending = true;
        _agentStatus = 'Đang trả lời...';
      });
      return;
    }
    _streamBuffer += chunk;
    _scheduleStreamFlush();
  }

  void _scheduleStreamFlush() {
    if (_streamFlushTimer != null) return;
    _streamFlushTimer = Timer(const Duration(milliseconds: 60), () {
      _streamFlushTimer?.cancel();
      _streamFlushTimer = null;
      _flushStreamBuffer();
    });
  }

  void _flushStreamBuffer() {
    if (_streamBuffer.isEmpty) return;
    final buffer = _streamBuffer;
    _streamBuffer = '';

    setState(() {
      _error = null;
      _isSending = true;
      _agentStatus = 'Đang trả lời...';

      if (_messages.isNotEmpty &&
          _messages.last.role == 'assistant' &&
          _messages.last.isStreaming) {
        final last = _messages.removeLast();
        _messages.add(last.copyWith(content: '${last.content}$buffer'));
      } else if (_messages.isNotEmpty &&
          _messages.last.role == 'assistant' &&
          _hasStructuredAssistantContent(_messages.last)) {
        final last = _messages.removeLast();
        _messages.add(last.copyWith(isStreaming: true));
      } else {
        _messages.add(
          _UiChatMessage(
            id: UniqueKey().toString(),
            role: 'assistant',
            content: buffer,
            timestamp: DateTime.now(),
            isStreaming: true,
          ),
        );
      }
    });

    _scrollToBottom();
  }

  void _completeAssistantMessage(String fullResponse,
      {List<dynamic>? reactTrace}) {
    setState(() {
      _agentStatus = null;
      _isSending = false;
      _upsertAssistantMessage(
        content: fullResponse,
        isStreaming: false,
        reactTrace: reactTrace,
      );
    });
    _scrollToBottom();
  }

  void _addClinicSuggestions(List<AiClinic> clinics) {
    setState(() {
      _agentStatus = null;
      _latestClinicOptions = _mergeClinicOptions(_latestClinicOptions, clinics);
      _upsertAssistantMessage(
        content: 'Dưới đây là các phòng khám phù hợp để tiếp tục booking.',
        isStreaming: false,
        clinicSuggestions: _bookingAssistantEnabled ? clinics : null,
        preferExistingContent: true,
      );
    });
    _scrollToBottom();
  }

  void _addServiceOptions(
    List<AiBookingServiceOption> services, {
    String? clinicId,
    String? leadText,
  }) {
    if (services.isEmpty) return;
    final normalizedClinicId = (clinicId ?? '').trim();
    final normalizedServices = services
        .map(
          (service) => AiBookingServiceOption(
            id: service.id,
            name: service.name,
            clinicId: (service.clinicId ?? '').trim().isNotEmpty
                ? service.clinicId
                : (normalizedClinicId.isNotEmpty ? normalizedClinicId : null),
            category: service.category,
            basePrice: service.basePrice,
          ),
        )
        .toList();
    setState(() {
      _agentStatus = null;
      _latestServiceOptions =
          _mergeServiceOptions(_latestServiceOptions, normalizedServices);
      _upsertAssistantMessage(
        content: (leadText ??
                'Mình đã tìm được một số dịch vụ phù hợp. Bạn chọn dịch vụ nhé.')
            .trim(),
        isStreaming: false,
        serviceOptions: _bookingAssistantEnabled ? normalizedServices : null,
        serviceClinicId:
            _bookingAssistantEnabled && normalizedClinicId.isNotEmpty
                ? normalizedClinicId
                : null,
        preferExistingContent: true,
      );
    });
    _scrollToBottom();
  }

  void _addSlotGrid(AiSlotGridPayload slotGrid) {
    if (slotGrid.recommendedSlots.isEmpty &&
        slotGrid.alternativeSlots.isEmpty) {
      return;
    }
    setState(() {
      _agentStatus = null;
      _cacheSlotOptions(slotGrid);
      if (_bookingAssistantEnabled) {
        _bookingTracker = _bookingTracker.mergeSlot(slotGrid, null);
      }
      _upsertAssistantMessage(
        content: (slotGrid.message ??
                'Mình đã tìm được một số khung giờ phù hợp. Bạn chọn khung giờ để tiếp tục nhé.')
            .trim(),
        isStreaming: false,
        slotGrid: _bookingAssistantEnabled ? slotGrid : null,
        preferExistingContent: true,
      );
    });
    _scrollToBottom();
  }

  void _addBookingSummary(AiBookingSummaryPayload summary) {
    final normalizedSummary = _normalizeBookingSummaryPayload(summary);

    setState(() {
      _agentStatus = null;
      _cacheHomeVisitInfo(normalizedSummary);
      if (_bookingAssistantEnabled) {
        _bookingTracker = _bookingTracker.mergeSummary(normalizedSummary);
      }
      _upsertAssistantMessage(
        content: (normalizedSummary.message ??
                'Mình đã tổng hợp đủ thông tin cơ bản. Bạn xác nhận để mình tạo yêu cầu đặt lịch nhé.')
            .trim(),
        isStreaming: false,
        bookingSummary: _bookingAssistantEnabled ? normalizedSummary : null,
        preferExistingContent: true,
      );
    });
    _scrollToBottom();
  }

  List<AiClinic> _resolveClinicOptionsForMessage(
    _UiChatMessage message, {
    AiBookingSummaryPayload? summary,
  }) {
    var merged = _mergeClinicOptions(
      _latestClinicOptions,
      message.clinicSuggestions ?? const <AiClinic>[],
    );

    final trackerClinicId = (_bookingTracker.clinicId ?? '').trim();
    final trackerClinicName = (_bookingTracker.clinicName ?? '').trim();
    final summaryClinicId = (summary?.clinicId ?? '').trim();
    final summaryClinicName = (summary?.clinicName ?? '').trim();

    // Fallback: infer clinic options from available services when clinic cards
    // are not present in this turn.
    final inferredFromServices = <AiClinic>[];
    final servicePool = _mergeServiceOptions(
      _latestServiceOptions,
      message.serviceOptions ?? const <AiBookingServiceOption>[],
    );
    final clinicIds = <String>{};
    for (final service in servicePool) {
      final clinicId = (service.clinicId ?? '').trim();
      if (clinicId.isNotEmpty) {
        clinicIds.add(clinicId);
      }
    }

    final fallbackName = summaryClinicName.isNotEmpty
        ? summaryClinicName
        : (trackerClinicName.isNotEmpty ? trackerClinicName : '');
    for (final clinicId in clinicIds) {
      final inferredName = fallbackName.isNotEmpty && clinicIds.length == 1
          ? fallbackName
          : 'Phòng khám $clinicId';
      inferredFromServices.add(
        AiClinic(
          id: clinicId,
          name: inferredName,
          address: '',
        ),
      );
    }
    if (inferredFromServices.isNotEmpty) {
      merged = _mergeClinicOptions(merged, inferredFromServices);
    }

    if (trackerClinicId.isEmpty && trackerClinicName.isEmpty) {
      if (summaryClinicId.isEmpty && summaryClinicName.isEmpty) {
        return merged;
      }
      final summaryClinic = AiClinic(
        id: summaryClinicId,
        name: summaryClinicName.isNotEmpty
            ? summaryClinicName
            : (summaryClinicId.isNotEmpty ? 'Phòng khám $summaryClinicId' : ''),
        address: '',
      );
      return _mergeClinicOptions(merged, <AiClinic>[summaryClinic]);
    }

    final trackerClinic = AiClinic(
      id: trackerClinicId,
      name: trackerClinicName.isNotEmpty
          ? trackerClinicName
          : (trackerClinicId.isNotEmpty ? 'Phòng khám $trackerClinicId' : ''),
      address: '',
    );

    return _mergeClinicOptions(merged, <AiClinic>[trackerClinic]);
  }

  List<AiBookingServiceOption> _resolveServiceOptionsForMessage(
    _UiChatMessage message, {
    AiBookingSummaryPayload? summary,
  }) {
    var merged = _mergeServiceOptions(
      _latestServiceOptions,
      message.serviceOptions ?? const <AiBookingServiceOption>[],
    );

    final clinicServiceFallbacks = <AiBookingServiceOption>[];
    for (final clinic in _resolveClinicOptionsForMessage(
      message,
      summary: summary,
    )) {
      for (final service in clinic.services) {
        final serviceId = service.id.trim();
        final serviceName = service.name.trim();
        if (serviceId.isEmpty && serviceName.isEmpty) continue;
        clinicServiceFallbacks.add(
          AiBookingServiceOption(
            id: serviceId.isNotEmpty ? serviceId : serviceName,
            name: serviceName,
            clinicId: clinic.id.trim().isNotEmpty ? clinic.id.trim() : null,
            category: service.category,
            basePrice: service.basePrice,
          ),
        );
      }
    }
    if (clinicServiceFallbacks.isNotEmpty) {
      merged = _mergeServiceOptions(merged, clinicServiceFallbacks);
    }

    final activeClinicId = _resolveClinicIdForAction(
      summaryClinicId: summary?.clinicId,
      summaryClinicName: summary?.clinicName,
    );
    final scopedByMessageClinic = (message.serviceClinicId ?? '').trim();
    final effectiveClinicId = ((activeClinicId ?? '').trim().isNotEmpty
            ? activeClinicId
            : scopedByMessageClinic)
        ?.trim();

    if (effectiveClinicId != null && effectiveClinicId.isNotEmpty) {
      final matched = merged
          .where((service) =>
              (service.clinicId ?? '').trim().toLowerCase() ==
              effectiveClinicId.toLowerCase())
          .toList();
      if (matched.isNotEmpty) {
        merged = matched;
      }
    }

    final trackerServiceIds = _bookingTracker.serviceIds
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    final trackerServiceNames = _bookingTracker.serviceNames
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();

    if (trackerServiceIds.isEmpty && trackerServiceNames.isEmpty) {
      final summaryServiceIds = (summary?.serviceIds ?? const <String>[])
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList();
      final summaryServiceNames = (summary?.serviceNames ?? const <String>[])
          .map((item) => item.trim())
          .where((item) => item.isNotEmpty)
          .toList();

      if (summaryServiceIds.isEmpty && summaryServiceNames.isEmpty) {
        return merged;
      }

      final summaryFallbacks = <AiBookingServiceOption>[];
      final length = summaryServiceIds.length > summaryServiceNames.length
          ? summaryServiceIds.length
          : summaryServiceNames.length;
      for (var index = 0; index < length; index++) {
        final serviceId =
            index < summaryServiceIds.length ? summaryServiceIds[index] : '';
        final serviceName = index < summaryServiceNames.length
            ? summaryServiceNames[index]
            : '';
        if (serviceId.isEmpty && serviceName.isEmpty) {
          continue;
        }
        summaryFallbacks.add(
          AiBookingServiceOption(
            id: serviceId.isNotEmpty ? serviceId : serviceName,
            name: serviceName.isNotEmpty ? serviceName : serviceId,
            clinicId: effectiveClinicId,
          ),
        );
      }

      return _mergeServiceOptions(merged, summaryFallbacks);
    }

    final trackerFallbacks = <AiBookingServiceOption>[];
    final length = trackerServiceIds.length > trackerServiceNames.length
        ? trackerServiceIds.length
        : trackerServiceNames.length;
    for (var index = 0; index < length; index++) {
      final serviceId =
          index < trackerServiceIds.length ? trackerServiceIds[index] : '';
      final serviceName =
          index < trackerServiceNames.length ? trackerServiceNames[index] : '';
      if (serviceId.isEmpty && serviceName.isEmpty) {
        continue;
      }
      trackerFallbacks.add(
        AiBookingServiceOption(
          id: serviceId.isNotEmpty ? serviceId : serviceName,
          name: serviceName.isNotEmpty ? serviceName : serviceId,
          clinicId: effectiveClinicId,
        ),
      );
    }

    return _mergeServiceOptions(merged, trackerFallbacks);
  }

  List<String> _resolveBookingDateOptionsForMessage(
    _UiChatMessage message, {
    AiBookingSummaryPayload? summary,
  }) {
    final values = <String>{..._latestBookingDateOptions};
    final slotDate = message.slotGrid?.bookingDate?.trim();
    if (slotDate != null && slotDate.isNotEmpty) {
      values.add(slotDate);
    }
    final trackerDate = (_bookingTracker.bookingDate ?? '').trim();
    if (trackerDate.isNotEmpty) {
      values.add(trackerDate);
    }
    final summaryDate =
        ((summary?.bookingDate ?? message.bookingSummary?.bookingDate) ?? '')
            .trim();
    if (summaryDate.isNotEmpty) {
      values.add(summaryDate);
    }
    final sorted = values.toList()..sort();
    return sorted;
  }

  List<String> _resolveStartTimeOptionsForMessage(
    _UiChatMessage message, {
    AiBookingSummaryPayload? summary,
  }) {
    final values = <String>{..._latestStartTimeOptions};
    final selectedDate =
        ((summary?.bookingDate ?? message.bookingSummary?.bookingDate) ?? '')
            .trim();
    if (selectedDate.isNotEmpty) {
      final byDate = _slotTimesByDate[selectedDate];
      if (byDate != null && byDate.isNotEmpty) {
        values
          ..clear()
          ..addAll(byDate);
      }
    }
    final slotGrid = message.slotGrid;
    if (slotGrid != null) {
      for (final slot in slotGrid.recommendedSlots) {
        final time = slot.startTime.trim();
        if (time.isNotEmpty) {
          values.add(time);
        }
      }
      for (final slot in slotGrid.alternativeSlots) {
        final time = slot.startTime.trim();
        if (time.isNotEmpty) {
          values.add(time);
        }
      }
    }

    final trackerTime = (_bookingTracker.startTime ?? '').trim();
    if (trackerTime.isNotEmpty) {
      values.add(trackerTime);
    }
    final summaryTime =
        ((summary?.startTime ?? message.bookingSummary?.startTime) ?? '')
            .trim();
    if (summaryTime.isNotEmpty) {
      values.add(summaryTime);
    }

    final sorted = values.toList()..sort();
    return sorted;
  }

  Future<void> _handleBookingFormChanged(
    AiBookingSummaryPayload summary,
    String field,
  ) async {
    final normalizedSummary = _normalizeBookingSummaryPayload(summary);
    _cacheHomeVisitInfo(normalizedSummary);

    final payload = _buildBookingContextPayload(
      _buildConfirmBookingPayload(
        summaryPetId: normalizedSummary.petId,
        summaryClinicId: normalizedSummary.clinicId,
        summaryClinicName: normalizedSummary.clinicName,
        summaryBookingDate: normalizedSummary.bookingDate,
        summaryStartTime: normalizedSummary.startTime,
        summaryServiceIds: normalizedSummary.serviceIds,
        summaryBookingType: normalizedSummary.bookingType,
        summaryHomeAddress: normalizedSummary.homeAddress,
        summaryHomeLat: normalizedSummary.homeLat,
        summaryHomeLong: normalizedSummary.homeLong,
        summaryDistanceKm: normalizedSummary.distanceKm,
      ),
      serviceNamesFallback: normalizedSummary.serviceNames,
    );

    final selectedBookingType =
        (payload['booking_type']?.toString().trim().toUpperCase() ??
                bookingTypeInClinic)
            .trim();

    if (field == 'booking_type' || field == 'clinic') {
      await _sendStructuredBookingAction(
        userMessage: 'Cập nhật thông tin booking',
        uiAction: <String, dynamic>{
          'type': 'select_booking_type',
          'booking_type': selectedBookingType,
        },
      );

      if ((payload['clinic_id']?.toString().trim().isNotEmpty ?? false)) {
        await _sendStructuredBookingAction(
          userMessage: 'Cập nhật phòng khám đã chọn',
          uiAction: <String, dynamic>{
            'type': 'select_clinic',
            'clinic_id': payload['clinic_id'],
            if ((normalizedSummary.clinicName ?? '').trim().isNotEmpty)
              'clinic_name': normalizedSummary.clinicName!.trim(),
          },
          includeLocation: true,
        );
      }
      return;
    }

    if (field == 'service') {
      final serviceIds = (payload['service_ids'] as List<dynamic>? ?? const [])
          .map((item) => item.toString().trim())
          .where((item) => item.isNotEmpty)
          .toList();
      if (serviceIds.isNotEmpty) {
        await _sendStructuredBookingAction(
          userMessage: 'Cập nhật dịch vụ đã chọn',
          uiAction: <String, dynamic>{
            'type': 'select_services',
            'service_ids': serviceIds,
            if ((payload['clinic_id']?.toString().trim().isNotEmpty ?? false))
              'clinic_id': payload['clinic_id'],
            if (normalizedSummary.serviceNames.isNotEmpty)
              'service_names': normalizedSummary.serviceNames,
          },
        );
      }
      return;
    }

    if (field == 'date') {
      final bookingDate = payload['booking_date']?.toString().trim() ?? '';
      if (bookingDate.isNotEmpty) {
        await _sendStructuredBookingAction(
          userMessage: 'Cập nhật ngày khám đã chọn',
          uiAction: <String, dynamic>{
            'type': 'select_date',
            'booking_date': bookingDate,
          },
        );
      }
      return;
    }

    if (field == 'time') {
      final bookingDate = payload['booking_date']?.toString().trim() ?? '';
      final startTime = payload['start_time']?.toString().trim() ?? '';
      if (bookingDate.isNotEmpty && startTime.isNotEmpty) {
        await _sendStructuredBookingAction(
          userMessage: 'Cập nhật thời gian đã chọn',
          uiAction: <String, dynamic>{
            'type': 'select_slot',
            if ((payload['clinic_id']?.toString().trim().isNotEmpty ?? false))
              'clinic_id': payload['clinic_id'],
            'booking_date': bookingDate,
            'start_time': startTime,
            if ((payload['service_ids'] as List<dynamic>? ?? const [])
                .isNotEmpty)
              'service_ids': payload['service_ids'],
            if ((payload['pet_id']?.toString().trim().isNotEmpty ?? false))
              'pet_id': payload['pet_id'],
          },
        );
      }
      return;
    }

    if (field == 'home_address') {
      final nextAddress = (normalizedSummary.homeAddress ?? '').trim();
      if (nextAddress.isNotEmpty) {
        setState(() {
          _latestKnownHomeAddress = nextAddress;
        });
      }
    }
  }

  List<AiClinic> _mergeClinicOptions(
    List<AiClinic> current,
    List<AiClinic> incoming,
  ) {
    if (incoming.isEmpty) {
      return current;
    }

    final merged = <AiClinic>[];
    final seen = <String>{};

    void addClinic(AiClinic clinic) {
      final clinicId = clinic.id.trim();
      final clinicName = clinic.name.trim();
      if (clinicId.isEmpty && clinicName.isEmpty) {
        return;
      }

      final key = clinicId.isNotEmpty
          ? 'id:$clinicId'
          : 'name:${clinicName.toLowerCase()}';
      if (seen.add(key)) {
        merged.add(clinic);
      }
    }

    for (final clinic in current) {
      addClinic(clinic);
    }
    for (final clinic in incoming) {
      addClinic(clinic);
    }

    return merged;
  }

  List<AiBookingServiceOption> _mergeServiceOptions(
    List<AiBookingServiceOption> current,
    List<AiBookingServiceOption> incoming,
  ) {
    if (incoming.isEmpty) {
      return current;
    }

    final merged = <AiBookingServiceOption>[];
    final seen = <String>{};

    void addService(AiBookingServiceOption service) {
      final serviceId = service.id.trim();
      final serviceName = service.name.trim();
      final clinicId = (service.clinicId ?? '').trim();
      if (serviceId.isEmpty && serviceName.isEmpty) {
        return;
      }

      final key = serviceId.isNotEmpty
          ? 'id:$serviceId|clinic:${clinicId.toLowerCase()}'
          : 'name:${serviceName.toLowerCase()}|clinic:${clinicId.toLowerCase()}';
      if (seen.add(key)) {
        merged.add(service);
      }
    }

    for (final service in current) {
      addService(service);
    }
    for (final service in incoming) {
      addService(service);
    }

    return merged;
  }

  void _cacheSlotOptions(AiSlotGridPayload slotGrid) {
    final date = slotGrid.bookingDate?.trim();
    final collectedTimes = <String>{};
    for (final slot in slotGrid.recommendedSlots) {
      final startTime = slot.startTime.trim();
      if (startTime.isNotEmpty) {
        collectedTimes.add(startTime);
      }
    }
    for (final slot in slotGrid.alternativeSlots) {
      final startTime = slot.startTime.trim();
      if (startTime.isNotEmpty) {
        collectedTimes.add(startTime);
      }
    }

    if (date != null && date.isNotEmpty) {
      final dateSet = <String>{..._latestBookingDateOptions, date};
      final nextDates = dateSet.toList()..sort();
      _latestBookingDateOptions = nextDates;
      final storedTimes = _slotTimesByDate.putIfAbsent(date, () => <String>{});
      storedTimes.addAll(collectedTimes);
    }

    final timeSet = <String>{..._latestStartTimeOptions, ...collectedTimes};
    _latestStartTimeOptions = timeSet.toList()..sort();
  }

  void _cacheHomeVisitInfo(AiBookingSummaryPayload summary) {
    final address = summary.homeAddress?.trim();
    if (address != null && address.isNotEmpty) {
      _latestKnownHomeAddress = address;
    }
    if (summary.homeLat != null) {
      _latestKnownHomeLat = summary.homeLat;
    }
    if (summary.homeLong != null) {
      _latestKnownHomeLong = summary.homeLong;
    }
  }

  void _cacheHomeVisitInfoFromLocation(Map<String, dynamic>? locationPayload) {
    if (locationPayload == null) {
      return;
    }
    final latRaw = locationPayload['lat'];
    final lngRaw = locationPayload['lng'];
    final addressRaw = locationPayload['address'];
    if (latRaw is num) {
      _latestKnownHomeLat = latRaw.toDouble();
    }
    if (lngRaw is num) {
      _latestKnownHomeLong = lngRaw.toDouble();
    }
    if (addressRaw is String) {
      final trimmed = addressRaw.trim();
      if (trimmed.isNotEmpty) {
        _latestKnownHomeAddress = trimmed;
      }
    }
  }

  void _addBookingCreated(AiBookingCreatedPayload bookingCreated) {
    setState(() {
      _agentStatus = null;
      _upsertAssistantMessage(
        content: (bookingCreated.message ??
                'Mình đã tạo yêu cầu đặt lịch thành công. Clinic manager sẽ xác nhận sau.')
            .trim(),
        isStreaming: false,
        bookingCreated: _bookingAssistantEnabled ? bookingCreated : null,
      );
    });
    _scrollToBottom();
  }

  void _addMultiPetBookingCreated(AiBookingCreatedPayload multiPetBooking) {
    final totalBookings = multiPetBooking.multiPetSummary?['total_bookings'] ??
        (multiPetBooking.bookings?.length ?? 0);
    final message = multiPetBooking.message ??
        'Đã tạo $totalBookings yêu cầu đặt lịch cho các bé thú cưng. Clinic manager sẽ xác nhận từng booking sau.';

    setState(() {
      _agentStatus = null;
      _upsertAssistantMessage(
        content: message.trim(),
        isStreaming: false,
        multiPetBookingCreated: multiPetBooking,
      );
    });
    _scrollToBottom();
  }

  Future<void> _handleServiceSelection(
    _UiChatMessage message,
    AiBookingServiceOption service,
  ) async {
    setState(() {
      final selected = _selectedServiceIdsByMessage.putIfAbsent(
        message.id,
        () => <String>{},
      );
      final serviceId = service.id.trim();
      if (serviceId.isEmpty) {
        return;
      }
      if (selected.contains(serviceId)) {
        selected.remove(serviceId);
      } else {
        selected.add(serviceId);
      }
      if (selected.isEmpty) {
        _selectedServiceIdsByMessage.remove(message.id);
      }
    });
  }

  Future<void> _submitSelectedServices(_UiChatMessage message) async {
    final selectedIds =
        _selectedServiceIdsByMessage[message.id]?.toList() ?? const <String>[];
    if (selectedIds.isEmpty) {
      return;
    }

    final selectedServices =
        (message.serviceOptions ?? const <AiBookingServiceOption>[])
            .where((service) => selectedIds.contains(service.id.trim()))
            .toList();
    final selectedNames = selectedServices
        .map((service) => service.name.trim())
        .where((name) => name.isNotEmpty)
        .toList();

    _updateBookingTracker((current) => current.mergeServices(selectedServices));
    await _sendStructuredBookingAction(
      userMessage:
          selectedNames.length == 1 ? 'Chọn dịch vụ' : 'Chọn các dịch vụ',
      uiAction: <String, dynamic>{
        'type': 'select_services',
        'service_ids': selectedIds,
        if (selectedNames.isNotEmpty) 'service_names': selectedNames,
        if ((message.serviceClinicId ?? '').trim().isNotEmpty)
          'clinic_id': message.serviceClinicId!.trim(),
      },
    );
  }

  Future<void> _handleSlotSelection(
    AiSlotGridPayload slotGrid,
    AiBookingSlotOption slot,
  ) async {
    _updateBookingTracker((current) => current.mergeSlot(slotGrid, slot));
    await _sendStructuredBookingAction(
      userMessage: 'Chọn khung giờ ${slot.startTime}',
      uiAction: <String, dynamic>{
        'type': 'select_slot',
        if ((slotGrid.clinicId ?? '').trim().isNotEmpty)
          'clinic_id': slotGrid.clinicId!.trim(),
        if ((slotGrid.bookingDate ?? '').trim().isNotEmpty)
          'booking_date': slotGrid.bookingDate!.trim(),
        if (slot.startTime.trim().isNotEmpty)
          'start_time': slot.startTime.trim(),
        if (slotGrid.serviceIds.isNotEmpty) 'service_ids': slotGrid.serviceIds,
      },
    );
  }

  Future<void> _confirmBookingSummary(
    AiBookingSummaryPayload summary,
    String messageId,
  ) async {
    final payload = _buildConfirmBookingPayload(
      summaryPetId: summary.petId,
      summaryClinicId: summary.clinicId,
      summaryClinicName: summary.clinicName,
      summaryBookingDate: summary.bookingDate,
      summaryStartTime: summary.startTime,
      summaryServiceIds: summary.serviceIds,
      summaryBookingType: summary.bookingType,
      summaryHomeAddress: summary.homeAddress,
      summaryHomeLat: summary.homeLat,
      summaryHomeLong: summary.homeLong,
      summaryDistanceKm: summary.distanceKm,
    );

    final serviceIds = (payload['service_ids'] as List<dynamic>? ?? const [])
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
    final clinicId = payload['clinic_id']?.toString().trim() ?? '';
    final bookingDate = payload['booking_date']?.toString().trim() ?? '';
    final startTime = payload['start_time']?.toString().trim() ?? '';
    final bookingType = payload['booking_type']?.toString().trim() ?? '';

    if (serviceIds.isEmpty) {
      return;
    }

    if (clinicId.isEmpty) {
      return;
    }

    if (bookingDate.isEmpty) {
      return;
    }

    if (startTime.isEmpty) {
      return;
    }

    if (bookingType.isEmpty) {
      return;
    }

    if (bookingType == 'HOME_VISIT') {
      final homeAddress = (summary.homeAddress ?? '').trim();
      final hasLatLng = summary.homeLat != null && summary.homeLong != null;
      if (homeAddress.isEmpty || !hasLatLng) {
        return;
      }
    }

    setState(() {
      _confirmedMessageIds.add(messageId);
    });

    await _sendStructuredBookingAction(
      userMessage: 'Xác nhận đặt lịch',
      uiAction: payload,
    );
  }

  Future<void> _sendStructuredBookingAction({
    required String userMessage,
    required Map<String, dynamic> uiAction,
    bool includeLocation = false,
  }) async {
    await _sendMessage(
      preset: '',
      userVisibleMessage: userMessage,
      uiAction: uiAction,
      includeLocation: includeLocation,
    );
  }

  void _updateBookingTracker(
    AiBookingTrackerSnapshot Function(AiBookingTrackerSnapshot current) updater,
  ) {
    setState(() {
      _bookingTracker = updater(_bookingTracker);
    });
    _refreshComposerSuggestions();
  }

  Future<void> _handleClinicBookingTap(AiClinic clinic) async {
    final clinicName = clinic.name.trim();
    final clinicId = clinic.id.trim();
    final clinicAddress = clinic.address.trim();

    _updateBookingTracker((current) => current.mergeClinic(clinic));
    await _sendStructuredBookingAction(
      userMessage:
          clinicName.isNotEmpty ? 'Chọn $clinicName' : 'Chọn phòng khám',
      uiAction: <String, dynamic>{
        'type': 'select_clinic',
        if (clinicId.isNotEmpty) 'clinic_id': clinicId,
        if (clinicName.isNotEmpty) 'clinic_name': clinicName,
        if (clinicAddress.isNotEmpty) 'clinic_address': clinicAddress,
      },
      includeLocation: true,
    );
  }

  String _sanitizeUserVisibleMessage(String value) {
    var sanitized = value.trim();
    if (sanitized.isEmpty) return sanitized;

    sanitized = sanitized.replaceAll(
      RegExp(r'\s*\(\s*clinic_id\s*:\s*[^)]+\)', caseSensitive: false),
      '',
    );
    sanitized = sanitized.replaceAll(
      RegExp(r'clinic_id\s*:\s*[\w-]+,?', caseSensitive: false),
      '',
    );
    sanitized = sanitized.replaceAll(
      RegExp(r'\s{2,}'),
      ' ',
    );
    sanitized = sanitized.replaceAll(
      RegExp(r'\s+,'),
      ',',
    );
    sanitized = sanitized.replaceAll(
      RegExp(r',\s*,'),
      ', ',
    );
    sanitized = sanitized.replaceAll(
      RegExp(r'\(\s*\)'),
      '',
    );

    return sanitized.trim();
  }

  Future<Map<String, dynamic>?> _tryGetLocationPayload() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return null;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }

      const locationSettings = LocationSettings(
        accuracy: LocationAccuracy.high,
      );
      final position = await Geolocator.getCurrentPosition(
        locationSettings: locationSettings,
      ).timeout(const Duration(seconds: 10));

      final payload = <String, dynamic>{
        'lat': position.latitude,
        'lng': position.longitude,
      };
      _lastLocationPayload = payload;
      _cacheHomeVisitInfoFromLocation(payload);
      return payload;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> _resolveLocationForMessage({
    bool allowActiveFetch = false,
  }) async {
    if (_lastLocationPayload != null) return _lastLocationPayload;
    if (!allowActiveFetch) {
      _ensureLocationCached();
      return null;
    }

    // Không chặn flow chat nếu chưa có vị trí. Chỉ fetch chủ động khi caller yêu cầu rõ.
    try {
      if (mounted) {
        setState(() {
          _agentStatus = 'Đang lấy vị trí hiện tại...';
        });
      }
      final payload =
          await _tryGetLocationPayload().timeout(const Duration(seconds: 3));
      return payload ?? _lastLocationPayload;
    } catch (_) {
      // Fall back to cached (might still be null). Server will ask user if needed.
      _ensureLocationCached();
      return _lastLocationPayload;
    } finally {
      if (mounted && _agentStatus == 'Đang lấy vị trí hiện tại...') {
        setState(() {
          _agentStatus = 'Đang gửi câu hỏi cho trợ lý AI...';
        });
      }
    }
  }

  void _ensureLocationCached() {
    if (_isFetchingLocation || _lastLocationPayload != null) return;
    _isFetchingLocation = true;
    _tryGetLocationPayload().whenComplete(() {
      if (mounted) {
        setState(() {
          _isFetchingLocation = false;
        });
      } else {
        _isFetchingLocation = false;
      }
    });
  }

  void _appendAssistantText(String text) {
    if (text.trim().isEmpty) return;
    if (_isSending) {
      setState(() {
        _error = null;
        _agentStatus = text.trim();
      });
      return;
    }
    setState(() {
      _upsertAssistantMessage(
        content: text.trim(),
        isStreaming: false,
      );
      _error = null;
      _agentStatus = null;
      _isSending = false;
    });
    _scrollToBottom();
  }

  Future<void> _handleWebSearchFollowUpTap(String question) async {
    final normalized = question.trim();
    if (normalized.isEmpty || _isSending || _isReconnecting) {
      return;
    }

    await _sendMessage(
      preset: normalized,
      userVisibleMessage: normalized,
      includeLocation: false,
    );
  }

  Future<void> _sendMessage({
    String? preset,
    String? userVisibleMessage,
    Map<String, dynamic>? uiAction,
    bool includeLocation = true,
    bool allowActiveLocationFetch = false,
  }) async {
    final message = (preset ?? _messageController.text).trim();
    final safeMessage = _sanitizeUserVisibleMessage(message);
    final bubbleMessage =
        _sanitizeUserVisibleMessage(userVisibleMessage ?? safeMessage);
    if ((safeMessage.isEmpty && uiAction == null) ||
        bubbleMessage.isEmpty ||
        _sessionId == null ||
        _channel == null ||
        _isReconnecting) {
      return;
    }

    setState(() {
      _messages.add(
        _UiChatMessage(
          id: UniqueKey().toString(),
          role: 'user',
          content: bubbleMessage,
          timestamp: DateTime.now(),
        ),
      );
      _error = null;
      _agentStatus = _sendingStatusMessage;
      _isSending = true;
    });

    _messageController.clear();
    _scrollToBottom();

    try {
      final location = includeLocation
          ? await _resolveLocationForMessage(
              allowActiveFetch: allowActiveLocationFetch,
            )
          : null;
      _channel!.sink.add(
        _aiChatService.encodeOutgoingPayload(
          message: safeMessage,
          uiAction: uiAction,
          location: location,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = _sendFailedMessage;
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

    await showAiChatSessionListSheet(
      context: context,
      sessions: _recentSessions,
      currentSessionId: _sessionId,
      formatSessionTime: _formatSessionTime,
      onStartNewSession: () {
        _startNewSession();
      },
      onSelectSession: (session) {
        _switchToSession(session);
      },
      onDeleteSession: (session) {
        _confirmDeleteSession(session);
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
      _ensureLocationCached();
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

    final shouldDelete = await showAiDeleteSessionDialog(context);
    if (!shouldDelete) return;

    try {
      await _aiChatService.deleteSession(session.sessionId);
      await _loadRecentSessions();

      if (!mounted) return;

      // Nếu đang ở chính session vừa xóa, tạo phiên mới để tránh treo UI
      if (_sessionId == session.sessionId) {
        await _startNewSession();
        if (!mounted) return;
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
        AiChatFeedbackIconButton(
          icon: Icons.thumb_up_alt_outlined,
          label: 'Hài lòng',
          isSelected: hasSent,
          color: AppColors.successDark,
          onTap: hasSent
              ? null
              : () => _handleFeedback(message, AiFeedbackType.thumbsUp),
        ),
        const SizedBox(width: 6),
        AiChatFeedbackIconButton(
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
          backgroundColor: type == AiFeedbackType.thumbsUp
              ? AppColors.success
              : AppColors.error,
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
        backgroundColor: _assistantAccentColor,
        foregroundColor: AppColors.stone900,
        elevation: 0,
        leading: IconButton(
          onPressed: () {
            FocusManager.instance.primaryFocus?.unfocus();
            context.pop();
          },
          icon: const Icon(Icons.close),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _assistantTitle,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
              ),
            ),
          ],
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
            Expanded(child: _buildContent()),
            AiChatComposer(
              horizontalPadding: horizontalPadding,
              tracker: _activeTracker,
              showTracker: false,
              suggestions: _composerSuggestions,
              errorText: _messages.isNotEmpty ? _error : null,
              controller: _messageController,
              onSuggestionTap: _applyComposerSuggestion,
              onSend: () {
                _sendMessage();
              },
              isSending: _isSending,
              isReconnecting: _isReconnecting,
              hintText: _composerHintText,
              accentColor: _assistantAccentColor,
              suggestionBackgroundColor: _assistantSurfaceColor,
              suggestionTextColor: AppColors.stone900,
            ),
          ],
        ),
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
                : () => _sendMessage(preset: prompt),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: _bookingAssistantEnabled
                    ? AppColors.white
                    : AppColors.teal100,
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
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AiChatLoadingHero(
              backgroundColor: _assistantSurfaceColor,
              iconColor: _assistantAccentColor,
            ),
            const SizedBox(height: 12),
            Text(
              _assistantReadyMessage,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.stone900,
              ),
            ),
          ],
        ),
      );
    }

    final error = _error;
    if (error != null && _messages.isEmpty) {
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
                _friendlyErrorMessage(error),
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
                      side:
                          const BorderSide(color: AppColors.stone900, width: 2),
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
            child: const Icon(Icons.auto_awesome,
                color: AppColors.primary, size: 28),
          ),
          const SizedBox(height: 12),
          Text(
            _emptyStateTitle,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: AppColors.stone900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _emptyStateSubtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(
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
      itemCount: _messages.length + (_shouldShowThinkingBubble() ? 1 : 0),
      itemBuilder: (context, index) {
        if (index >= _messages.length) {
          return _buildThinkingBubble();
        }
        return _buildMessageBubble(_messages[index]);
      },
    );
  }

  bool _shouldShowThinkingBubble() {
    if (_isReconnecting) return false;
    if (!_isSending) return false;
    if (_messages.isEmpty) return false;

    // When actual streaming text has started, the assistant bubble already shows typing UI.
    final last = _messages.last;
    if (last.role == 'assistant' && last.isStreaming) {
      return false;
    }

    // Avoid showing a thinking bubble when the last message is a completed assistant response.
    return last.role == 'user';
  }

  Widget _buildThinkingBubble() {
    final label = (_agentStatus ?? _thinkingLabel).trim();
    final trace = List<Map<String, dynamic>>.from(_liveReactTrace);
    return AiChatThinkingBubble(
      label: label,
      trace: trace,
      isExpanded: _thinkingDetailsExpanded,
      summarizeToolResult: _summarizeToolResult,
      avatarIcon: _assistantAvatarIcon,
      avatarBackgroundColor: _assistantSurfaceColor,
      avatarIconColor: _assistantAccentColor,
      onToggleExpanded: () {
        setState(() {
          _thinkingDetailsExpanded = !_thinkingDetailsExpanded;
        });
      },
    );
  }

  String? _summarizeToolResult(String? toolName, dynamic result) {
    final name = (toolName ?? '').toLowerCase().trim();

    Map<String, dynamic>? data;
    if (result is Map) {
      final map = Map<String, dynamic>.from(result);
      final nestedData = map['data'];
      if (nestedData is Map) {
        data = Map<String, dynamic>.from(nestedData);
      } else {
        data = map;
      }
    }

    if (data == null) return null;

    if (name == 'search_clinics_nearby') {
      final clinics = data['clinics'];
      if (clinics is List) {
        return 'Tìm thấy ${clinics.length} phòng khám gần bạn';
      }
      return 'Đã tìm phòng khám gần bạn';
    }

    if (name == 'get_user_pets') {
      final pets = data['pets'];
      if (pets is List) {
        return 'Tải được ${pets.length} thú cưng';
      }
      return 'Đã tải danh sách thú cưng';
    }

    if (name == 'get_clinic_services') {
      final services = data['services'];
      if (services is List) {
        return 'Tải được ${services.length} dịch vụ';
      }
      return 'Đã tải danh sách dịch vụ';
    }

    if (name == 'check_available_slots') {
      final slots = data['available_slots'];
      if (slots is List) {
        return 'Có ${slots.length} khung giờ trống';
      }
      return 'Đã kiểm tra khung giờ trống';
    }

    if (name == 'create_booking_for_user') {
      return 'Đã tạo yêu cầu đặt lịch';
    }

    return null;
  }

  Widget _buildMessageBubble(_UiChatMessage message) {
    final isUser = message.role == 'user';
    final displayContent =
        !isUser && message.content.isEmpty && message.isStreaming
            ? 'Trợ lý đang suy luận...'
            : message.content;
    final effectiveBookingSummary = !isUser ? message.bookingSummary : null;
    final isBookingReady = !isUser && message.bookingCreated != null;
    final showBookingCreatedVisual = !isUser && message.bookingCreated != null;
    final renderFormOnly = !isUser && effectiveBookingSummary != null;
    final trace =
        !isUser ? (message.reactTrace ?? const <dynamic>[]) : const <dynamic>[];

    return TweenAnimationBuilder<double>(
      key: ValueKey(
          '${message.id}_${message.isStreaming}_${message.content.length}'),
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
          mainAxisAlignment:
              isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!isUser) ...[
              AiChatMessageAvatar(
                icon: isBookingReady
                    ? Icons.event_available
                    : _assistantAvatarIcon,
                backgroundColor: isBookingReady
                    ? AppColors.successLight
                    : _assistantSurfaceColor,
                iconColor: isBookingReady
                    ? AppColors.successDark
                    : _assistantAccentColor,
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
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: isUser ? AppColors.primary : AppColors.white,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(14),
                      topRight: const Radius.circular(14),
                      bottomLeft: Radius.circular(isUser ? 14 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 14),
                    ),
                    border: Border.all(
                      color: isBookingReady
                          ? AppColors.successDark
                          : AppColors.stone900,
                      width: 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: isBookingReady
                            ? AppColors.successDark
                            : AppColors.stone900,
                        offset: const Offset(2, 2),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: isUser
                        ? CrossAxisAlignment.end
                        : CrossAxisAlignment.start,
                    children: [
                      if (showBookingCreatedVisual) ...[
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            AiBookingReadyBadge(),
                          ],
                        ),
                        const SizedBox(height: 8),
                        const AiBookingReadyBanner(),
                        const SizedBox(height: 8),
                      ],
                      if (!renderFormOnly && displayContent.trim().isNotEmpty)
                        Text(
                          displayContent,
                          style: TextStyle(
                            fontSize: 13,
                            height: 1.55,
                            color:
                                isUser ? AppColors.white : AppColors.stone900,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      if (!renderFormOnly &&
                          !isUser &&
                          ((message.webSearchResults?.isNotEmpty ?? false) ||
                              (message.webSearchImages?.isNotEmpty ?? false) ||
                              (message.webSearchAnswer ?? '')
                                  .trim()
                                  .isNotEmpty)) ...[
                        const SizedBox(height: 12),
                        WebSearchResultsCard(
                          results: message.webSearchResults ??
                              const <WebSearchResult>[],
                          images: message.webSearchImages ??
                              const <WebSearchImage>[],
                          answer: message.webSearchAnswer,
                          followUpQuestions:
                              message.webSearchFollowUpQuestions ??
                                  const <String>[],
                          onFollowUpTap: (_isSending || _isReconnecting)
                              ? null
                              : _handleWebSearchFollowUpTap,
                        ),
                      ],
                      if (!renderFormOnly &&
                          message.clinicSuggestions != null &&
                          message.clinicSuggestions!.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        ...message.clinicSuggestions!.map(
                          (clinic) => AiClinicSuggestionCard(
                            clinic: clinic,
                            isBusy: _isSending || _isReconnecting,
                            onBookingTap: () => _handleClinicBookingTap(clinic),
                          ),
                        ),
                      ],
                      if (!renderFormOnly &&
                          message.serviceOptions != null &&
                          message.serviceOptions!.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        AiServiceOptionCard(
                          services: message.serviceOptions ??
                              const <AiBookingServiceOption>[],
                          selectedIds:
                              _selectedServiceIdsByMessage[message.id] ??
                                  const <String>{},
                          isBusy: _isSending || _isReconnecting,
                          onToggleService: (service) =>
                              _handleServiceSelection(message, service),
                          onContinue: () => _submitSelectedServices(message),
                        ),
                      ],
                      if (!renderFormOnly && message.slotGrid != null) ...[
                        const SizedBox(height: 12),
                        AiSlotGridCard(
                          slotGrid: message.slotGrid!,
                          isBusy: _isSending || _isReconnecting,
                          formatBookingDate: _formatBookingDate,
                          onSelectSlot: (slot) =>
                              _handleSlotSelection(message.slotGrid!, slot),
                        ),
                      ],
                      if (message.isStreaming) ...[
                        const SizedBox(height: 8),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const AiChatTypingDots(),
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
                      if (!isUser && effectiveBookingSummary != null) ...[
                        const SizedBox(height: 10),
                        AiStructuredBookingSummaryCard(
                          summary: effectiveBookingSummary,
                          isConfirmed:
                              _confirmedMessageIds.contains(message.id),
                          isBusy: _isSending || _isReconnecting,
                          clinicOptions: _resolveClinicOptionsForMessage(
                            message,
                            summary: effectiveBookingSummary,
                          ),
                          serviceOptions: _resolveServiceOptionsForMessage(
                            message,
                            summary: effectiveBookingSummary,
                          ),
                          bookingDateOptions:
                              _resolveBookingDateOptionsForMessage(
                            message,
                            summary: effectiveBookingSummary,
                          ),
                          startTimeOptions: _resolveStartTimeOptionsForMessage(
                            message,
                            summary: effectiveBookingSummary,
                          ),
                          formatBookingDate: _formatBookingDate,
                          onFormChanged: (updatedSummary, field) =>
                              _handleBookingFormChanged(updatedSummary, field),
                          onConfirm: (editedSummary) =>
                              _confirmBookingSummary(editedSummary, message.id),
                        ),
                      ],
                      if (!isUser && message.bookingCreated != null) ...[
                        const SizedBox(height: 10),
                        AiBookingCreatedCard(
                          bookingCreated: message.bookingCreated!,
                          formatBookingDate: _formatBookingDate,
                          onViewBooking: () =>
                              _openBookingCreated(message.bookingCreated!),
                        ),
                      ],
                      if (!isUser &&
                          message.multiPetBookingCreated != null) ...[
                        const SizedBox(height: 10),
                        AiMultiPetBookingCreatedCard(
                          multiPetBooking: message.multiPetBookingCreated!,
                          formatBookingDate: _formatBookingDate,
                          onViewBooking: () => _openMultiPetBookingCreated(
                              message.multiPetBookingCreated!),
                        ),
                      ],
                      if (!isUser && trace.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        AiChatTracePanel(trace: trace),
                      ],
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: isUser
                            ? MainAxisAlignment.end
                            : MainAxisAlignment.spaceBetween,
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
              const AiChatMessageAvatar(
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

  Map<String, dynamic> _buildConfirmBookingPayload({
    String? summaryPetId,
    String? summaryClinicId,
    String? summaryClinicName,
    String? summaryBookingDate,
    String? summaryStartTime,
    List<String>? summaryServiceIds,
    String? summaryBookingType,
    String? summaryHomeAddress,
    double? summaryHomeLat,
    double? summaryHomeLong,
    double? summaryDistanceKm,
  }) {
    final normalizedServiceIds = (summaryServiceIds ?? const <String>[])
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    final fallbackServiceIds = _bookingTracker.serviceIds
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    final serviceIds = normalizedServiceIds.isNotEmpty
        ? normalizedServiceIds
        : fallbackServiceIds;

    final petId = _pickFirstNonEmpty(summaryPetId, _bookingTracker.petId);
    final clinicId = _resolveClinicIdForAction(
      summaryClinicId: summaryClinicId,
      summaryClinicName: summaryClinicName,
    );
    final bookingDate = _normalizeBookingDateForAction(
      _pickFirstNonEmpty(summaryBookingDate, _bookingTracker.bookingDate),
    );
    final startTime = _normalizeStartTimeForAction(
      _pickFirstNonEmpty(summaryStartTime, _bookingTracker.startTime),
    );
    final bookingType = _pickFirstNonEmpty(
      summaryBookingType,
      _bookingTracker.bookingType,
    );
    final normalizedBookingTypeRaw = bookingType?.trim().toUpperCase();
    final normalizedBookingType =
        normalizedBookingTypeRaw == bookingTypeInClinic ||
                normalizedBookingTypeRaw == bookingTypeHomeVisit
            ? normalizedBookingTypeRaw
            : null;
    final homeAddress = _pickFirstNonEmpty(
      summaryHomeAddress,
      _latestKnownHomeAddress,
    );
    final homeLat = summaryHomeLat ?? _latestKnownHomeLat;
    final homeLong = summaryHomeLong ?? _latestKnownHomeLong;
    final distanceKm = summaryDistanceKm;

    return <String, dynamic>{
      'type': 'confirm_booking',
      if (petId != null) 'pet_id': petId,
      if (clinicId != null) 'clinic_id': clinicId,
      if (bookingDate != null) 'booking_date': bookingDate,
      if (startTime != null) 'start_time': startTime,
      if (serviceIds.isNotEmpty) 'service_ids': serviceIds,
      if (normalizedBookingType != null) 'booking_type': normalizedBookingType,
      if (normalizedBookingType == 'HOME_VISIT' && homeAddress != null)
        'home_address': homeAddress,
      if (normalizedBookingType == 'HOME_VISIT' && homeLat != null)
        'home_lat': homeLat,
      if (normalizedBookingType == 'HOME_VISIT' && homeLong != null)
        'home_long': homeLong,
      if (normalizedBookingType == 'HOME_VISIT' && distanceKm != null)
        'distance_km': distanceKm,
    };
  }

  AiBookingSummaryPayload _normalizeBookingSummaryPayload(
    AiBookingSummaryPayload summary,
  ) {
    final resolvedClinicId = _resolveClinicIdForAction(
      summaryClinicId: summary.clinicId,
      summaryClinicName: summary.clinicName,
    );
    final resolvedClinicName = _pickFirstNonEmpty(
      summary.clinicName,
      _bookingTracker.clinicName,
    );
    final resolvedPetId =
        _pickFirstNonEmpty(summary.petId, _bookingTracker.petId);
    final resolvedPetName =
        _pickFirstNonEmpty(summary.petName, _bookingTracker.petName);
    final resolvedBookingDate = _normalizeBookingDateForAction(
      _pickFirstNonEmpty(summary.bookingDate, _bookingTracker.bookingDate),
    );
    final resolvedStartTime = _normalizeStartTimeForAction(
      _pickFirstNonEmpty(summary.startTime, _bookingTracker.startTime),
    );
    final resolvedBookingType = _pickFirstNonEmpty(
      summary.bookingType,
      _bookingTracker.bookingType,
    )?.toUpperCase();

    final resolvedHomeAddress = _pickFirstNonEmpty(
      summary.homeAddress,
      _latestKnownHomeAddress,
    );
    final resolvedHomeLat = summary.homeLat ?? _latestKnownHomeLat;
    final resolvedHomeLong = summary.homeLong ?? _latestKnownHomeLong;

    final resolvedServiceIds = summary.serviceIds
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty)
            .toList()
            .isNotEmpty
        ? summary.serviceIds
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty)
            .toList()
        : _bookingTracker.serviceIds
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty)
            .toList();

    final resolvedServiceNames = summary.serviceNames
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty)
            .toList()
            .isNotEmpty
        ? summary.serviceNames
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty)
            .toList()
        : _bookingTracker.serviceNames
            .map((item) => item.trim())
            .where((item) => item.isNotEmpty)
            .toList();

    return AiBookingSummaryPayload(
      petId: resolvedPetId,
      petName: resolvedPetName,
      clinicId: resolvedClinicId,
      clinicName: resolvedClinicName,
      bookingDate: resolvedBookingDate,
      startTime: resolvedStartTime,
      serviceIds: resolvedServiceIds,
      serviceNames: resolvedServiceNames,
      bookingType: resolvedBookingType,
      notes: summary.notes,
      homeAddress: resolvedHomeAddress,
      homeLat: resolvedHomeLat,
      homeLong: resolvedHomeLong,
      distanceKm: summary.distanceKm,
      message: summary.message,
      missingFields: summary.missingFields,
      readyToCreate: summary.readyToCreate,
      nextBestAction: summary.nextBestAction,
    );
  }

  Map<String, dynamic> _buildBookingContextPayload(
    Map<String, dynamic> confirmPayload, {
    List<String> serviceNamesFallback = const <String>[],
  }) {
    final payload = <String, dynamic>{
      if (confirmPayload['pet_id'] != null) 'pet_id': confirmPayload['pet_id'],
      if (confirmPayload['clinic_id'] != null)
        'clinic_id': confirmPayload['clinic_id'],
      if (confirmPayload['booking_date'] != null)
        'booking_date': confirmPayload['booking_date'],
      if (confirmPayload['start_time'] != null)
        'start_time': confirmPayload['start_time'],
      if (confirmPayload['booking_type'] != null)
        'booking_type': confirmPayload['booking_type'],
      if (confirmPayload['home_address'] != null)
        'home_address': confirmPayload['home_address'],
      if (confirmPayload['home_lat'] != null)
        'home_lat': confirmPayload['home_lat'],
      if (confirmPayload['home_long'] != null)
        'home_long': confirmPayload['home_long'],
      if (confirmPayload['distance_km'] != null)
        'distance_km': confirmPayload['distance_km'],
    };

    final serviceIds =
        (confirmPayload['service_ids'] as List<dynamic>? ?? const [])
            .map((item) => item.toString().trim())
            .where((item) => item.isNotEmpty)
            .toList();
    if (serviceIds.isNotEmpty) {
      payload['service_ids'] = serviceIds;
    }

    final serviceNames = serviceNamesFallback
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    if (serviceNames.isNotEmpty) {
      payload['service_names'] = serviceNames;
    }

    return payload;
  }

  String? _pickFirstNonEmpty(String? primary, String? fallback) {
    final first = primary?.trim();
    if (first != null && first.isNotEmpty) {
      return first;
    }
    final second = fallback?.trim();
    if (second != null && second.isNotEmpty) {
      return second;
    }
    return null;
  }

  String? _resolveClinicIdForAction({
    String? summaryClinicId,
    String? summaryClinicName,
  }) {
    final trackerClinicId = _bookingTracker.clinicId?.trim();
    final trackerClinicName = (_bookingTracker.clinicName ?? '').trim();
    final rawSummaryClinicId = (summaryClinicId ?? '').trim();
    final rawSummaryClinicName = (summaryClinicName ?? '').trim();

    String? findClinicIdByName(String rawName) {
      final name = rawName.trim().toLowerCase();
      if (name.isEmpty) {
        return null;
      }
      for (final clinic in _latestClinicOptions) {
        final clinicName = clinic.name.trim().toLowerCase();
        final clinicId = clinic.id.trim();
        if (clinicName == name && clinicId.isNotEmpty) {
          return clinicId;
        }
      }
      return null;
    }

    bool isKnownClinicId(String candidate) {
      final normalized = candidate.trim().toLowerCase();
      if (normalized.isEmpty) {
        return false;
      }
      for (final clinic in _latestClinicOptions) {
        if (clinic.id.trim().toLowerCase() == normalized) {
          return true;
        }
      }
      return false;
    }

    if (rawSummaryClinicId.isNotEmpty) {
      if (isKnownClinicId(rawSummaryClinicId)) {
        return rawSummaryClinicId;
      }

      final byIdAsName = findClinicIdByName(rawSummaryClinicId);
      if (byIdAsName != null) {
        return byIdAsName;
      }
    }

    if (rawSummaryClinicName.isNotEmpty) {
      final bySummaryName = findClinicIdByName(rawSummaryClinicName);
      if (bySummaryName != null) {
        return bySummaryName;
      }
    }

    if (trackerClinicId != null && trackerClinicId.isNotEmpty) {
      if (rawSummaryClinicId.toLowerCase() == trackerClinicName.toLowerCase() ||
          rawSummaryClinicName.toLowerCase() ==
              trackerClinicName.toLowerCase()) {
        return trackerClinicId;
      }
      if (rawSummaryClinicId.isEmpty && rawSummaryClinicName.isEmpty) {
        return trackerClinicId;
      }
    }

    return rawSummaryClinicId.isNotEmpty ? rawSummaryClinicId : null;
  }

  String? _normalizeBookingDateForAction(String? raw) {
    final value = raw?.trim();
    if (value == null || value.isEmpty) {
      return null;
    }

    if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(value)) {
      return value;
    }

    final isoWithSlash = RegExp(r'^(\d{4})/(\d{2})/(\d{2})$').firstMatch(value);
    if (isoWithSlash != null) {
      return '${isoWithSlash.group(1)}-${isoWithSlash.group(2)}-${isoWithSlash.group(3)}';
    }

    final local = RegExp(r'^(\d{2})/(\d{2})/(\d{4})$').firstMatch(value);
    if (local != null) {
      return '${local.group(3)}-${local.group(2)}-${local.group(1)}';
    }

    final normalized = value.toLowerCase();
    final now = DateTime.now();
    if (normalized == 'hôm nay' ||
        normalized == 'hom nay' ||
        normalized == 'today') {
      return _toIsoDate(now);
    }
    if (normalized == 'ngày mai' ||
        normalized == 'ngay mai' ||
        normalized == 'mai' ||
        normalized == 'tomorrow') {
      return _toIsoDate(now.add(const Duration(days: 1)));
    }

    return value;
  }

  String? _normalizeStartTimeForAction(String? raw) {
    final value = raw?.trim();
    if (value == null || value.isEmpty) {
      return null;
    }

    final hhmm = RegExp(r'^(\d{1,2}):(\d{2})$').firstMatch(value);
    if (hhmm != null) {
      final hour = int.tryParse(hhmm.group(1) ?? '');
      final minute = int.tryParse(hhmm.group(2) ?? '');
      if (hour != null &&
          minute != null &&
          hour >= 0 &&
          hour <= 23 &&
          minute >= 0 &&
          minute <= 59) {
        return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
      }
    }

    final compact = value.toLowerCase().replaceAll(' ', '');
    final byHour = RegExp(r'^(\d{1,2})h(?:(\d{2}))?$', caseSensitive: false)
        .firstMatch(compact);
    if (byHour != null) {
      final hour = int.tryParse(byHour.group(1) ?? '');
      final minute = int.tryParse(byHour.group(2) ?? '0') ?? 0;
      if (hour != null &&
          hour >= 0 &&
          hour <= 23 &&
          minute >= 0 &&
          minute <= 59) {
        return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
      }
    }

    return value;
  }

  String _toIsoDate(DateTime value) {
    final year = value.year.toString().padLeft(4, '0');
    final month = value.month.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }

  Future<void> _openBookingCreated(
      AiBookingCreatedPayload bookingCreated) async {
    try {
      if ((bookingCreated.bookingId ?? '').trim().isNotEmpty) {
        final booking = await _bookingService.getBookingById(
          bookingCreated.bookingId!.trim(),
        );
        if (!mounted) return;
        context.push(AppRoutes.bookingDetailView, extra: booking);
        return;
      }

      if ((bookingCreated.bookingCode ?? '').trim().isNotEmpty) {
        final booking = await _bookingService.getBookingByCode(
          bookingCreated.bookingCode!.trim(),
        );
        if (!mounted) return;
        context.push(AppRoutes.bookingDetailView, extra: booking);
        return;
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Không tải được chi tiết lịch hẹn. Mở danh sách lịch hẹn của bạn thay thế.',
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }

    if (!mounted) return;
    context.go('${AppRoutes.petOwnerHome}?tab=2');
  }

  Future<void> _openMultiPetBookingCreated(
      AiBookingCreatedPayload multiPetBooking) async {
    final bookings = multiPetBooking.bookings ?? [];

    try {
      if (bookings.isNotEmpty) {
        final firstBooking = bookings.first;
        if ((firstBooking['id']?.toString() ?? '').trim().isNotEmpty) {
          final booking = await _bookingService.getBookingById(
            firstBooking['id'].toString().trim(),
          );
          if (!mounted) return;
          context.push(AppRoutes.bookingDetailView, extra: booking);
          return;
        }

        if ((firstBooking['booking_code']?.toString() ?? '')
            .trim()
            .isNotEmpty) {
          final booking = await _bookingService.getBookingByCode(
            firstBooking['booking_code'].toString().trim(),
          );
          if (!mounted) return;
          context.push(AppRoutes.bookingDetailView, extra: booking);
          return;
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Đã tạo ${bookings.length} lịch hẹn. Vui lòng kiểm tra trong danh sách lịch hẹn của bạn.',
            ),
            backgroundColor: AppColors.success,
          ),
        );
      }
    }

    if (!mounted) return;
    context.go('${AppRoutes.petOwnerHome}?tab=2');
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
    if (message.contains('Không thể kết nối tới AI service')) {
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

class _UiChatMessage {
  final String id;
  final String? messageId;
  final String role;
  final String content;
  final DateTime? timestamp;
  final bool isStreaming;
  final List<dynamic>? reactTrace;
  final List<AiClinic>? clinicSuggestions;
  final List<AiBookingServiceOption>? serviceOptions;
  final String? serviceClinicId;
  final AiSlotGridPayload? slotGrid;
  final AiBookingSummaryPayload? bookingSummary;
  final AiBookingCreatedPayload? bookingCreated;
  final AiBookingCreatedPayload? multiPetBookingCreated;
  final List<WebSearchResult>? webSearchResults;
  final List<WebSearchImage>? webSearchImages;
  final String? webSearchAnswer;
  final List<String>? webSearchFollowUpQuestions;

  const _UiChatMessage({
    required this.id,
    this.messageId,
    required this.role,
    required this.content,
    this.timestamp,
    this.isStreaming = false,
    this.reactTrace,
    this.clinicSuggestions,
    this.serviceOptions,
    this.serviceClinicId,
    this.slotGrid,
    this.bookingSummary,
    this.bookingCreated,
    this.multiPetBookingCreated,
    this.webSearchResults,
    this.webSearchImages,
    this.webSearchAnswer,
    this.webSearchFollowUpQuestions,
  });

  _UiChatMessage copyWith({
    String? content,
    DateTime? timestamp,
    bool? isStreaming,
    List<dynamic>? reactTrace,
    List<AiClinic>? clinicSuggestions,
    List<AiBookingServiceOption>? serviceOptions,
    String? serviceClinicId,
    AiSlotGridPayload? slotGrid,
    AiBookingSummaryPayload? bookingSummary,
    AiBookingCreatedPayload? bookingCreated,
    AiBookingCreatedPayload? multiPetBookingCreated,
    List<WebSearchResult>? webSearchResults,
    List<WebSearchImage>? webSearchImages,
    String? webSearchAnswer,
    List<String>? webSearchFollowUpQuestions,
  }) {
    return _UiChatMessage(
      id: id,
      messageId: messageId,
      role: role,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      isStreaming: isStreaming ?? this.isStreaming,
      reactTrace: reactTrace ?? this.reactTrace,
      clinicSuggestions: clinicSuggestions ?? this.clinicSuggestions,
      serviceOptions: serviceOptions ?? this.serviceOptions,
      serviceClinicId: serviceClinicId ?? this.serviceClinicId,
      slotGrid: slotGrid ?? this.slotGrid,
      bookingSummary: bookingSummary ?? this.bookingSummary,
      bookingCreated: bookingCreated ?? this.bookingCreated,
      multiPetBookingCreated:
          multiPetBookingCreated ?? this.multiPetBookingCreated,
      webSearchResults: webSearchResults ?? this.webSearchResults,
      webSearchImages: webSearchImages ?? this.webSearchImages,
      webSearchAnswer: webSearchAnswer ?? this.webSearchAnswer,
      webSearchFollowUpQuestions:
          webSearchFollowUpQuestions ?? this.webSearchFollowUpQuestions,
    );
  }
}

class _UiSchemaStructuredPayload {
  final String? message;
  final List<AiClinic> clinics;
  final List<AiBookingServiceOption> serviceOptions;
  final String? serviceClinicId;
  final AiSlotGridPayload? slotGrid;
  final AiBookingSummaryPayload? bookingSummary;
  final AiBookingCreatedPayload? bookingCreated;
  final List<WebSearchResult> webSearchResults;
  final List<WebSearchImage> webSearchImages;
  final String? webSearchAnswer;
  final List<String> webSearchFollowUpQuestions;

  const _UiSchemaStructuredPayload({
    this.message,
    this.clinics = const [],
    this.serviceOptions = const [],
    this.serviceClinicId,
    this.slotGrid,
    this.bookingSummary,
    this.bookingCreated,
    this.webSearchResults = const [],
    this.webSearchImages = const [],
    this.webSearchAnswer,
    this.webSearchFollowUpQuestions = const [],
  });

  bool get hasStructuredData {
    return (message ?? '').trim().isNotEmpty ||
        clinics.isNotEmpty ||
        serviceOptions.isNotEmpty ||
        slotGrid != null ||
        bookingSummary != null ||
        bookingCreated != null ||
        webSearchResults.isNotEmpty ||
        webSearchImages.isNotEmpty ||
        (webSearchAnswer ?? '').trim().isNotEmpty;
  }
}
