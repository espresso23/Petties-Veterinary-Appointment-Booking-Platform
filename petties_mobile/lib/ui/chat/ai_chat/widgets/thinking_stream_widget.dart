import 'package:flutter/material.dart';

import '../../../../config/constants/app_colors.dart';

class ThinkingStreamWidget extends StatefulWidget {
  final List<ThinkingSegment> segments;
  final bool isStreaming;
  final String? latestContent;
  final VoidCallback? onToggleExpand;

  const ThinkingStreamWidget({
    super.key,
    this.segments = const [],
    this.isStreaming = false,
    this.latestContent,
    this.onToggleExpand,
  });

  @override
  State<ThinkingStreamWidget> createState() => _ThinkingStreamWidgetState();
}

class _ThinkingStreamWidgetState extends State<ThinkingStreamWidget>
    with SingleTickerProviderStateMixin {
  bool _isExpanded = true;
  String _streamingText = '';
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _isExpanded = true;
  }

  @override
  void didUpdateWidget(ThinkingStreamWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    
    // Stream new content
    if (widget.latestContent != null && 
        widget.latestContent != oldWidget.latestContent &&
        widget.isStreaming) {
      _streamText(widget.latestContent!);
    }
  }

  Future<void> _streamText(String text) async {
    if (!mounted) return;
    
    setState(() {
      _streamingText = '';
    });

    for (int i = 0; i < text.length; i++) {
      if (!mounted) return;
      await Future.delayed(const Duration(milliseconds: 25));
      setState(() {
        _streamingText = text.substring(0, i + 1);
      });
      _scrollToBottom();
    }
    
    // Add to segments when done
    if (_streamingText.isNotEmpty) {
      setState(() {
        _streamingText = '';
      });
    }
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.segments.isEmpty && !widget.isStreaming) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.amber50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stone900, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header - Toggle
          GestureDetector(
            onTap: () {
              setState(() {
                _isExpanded = !_isExpanded;
              });
              widget.onToggleExpand?.call();
            },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: const BoxDecoration(
              color: AppColors.stone100,
              border: Border(
                  bottom: BorderSide(color: AppColors.stone900, width: 1),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Text('💭', style: TextStyle(fontSize: 16)),
                      const SizedBox(width: 8),
                      Text(
                        widget.isStreaming ? 'Đang suy luận...' : 'Quá trình suy luận',
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                          color: AppColors.stone900,
                        ),
                      ),
                      if (widget.isStreaming) ...[
                        const SizedBox(width: 8),
                        const _StreamingIndicator(),
                      ],
                    ],
                  ),
                  Icon(
                    _isExpanded 
                        ? Icons.keyboard_arrow_up 
                        : Icons.keyboard_arrow_down,
                    size: 20,
                    color: AppColors.stone900,
                  ),
                ],
              ),
            ),
          ),
          
          // Content
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            child: _isExpanded
                ? Container(
                    constraints: const BoxConstraints(maxHeight: 120),
                    child: SingleChildScrollView(
                      controller: _scrollController,
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Completed segments
                          ...widget.segments.map((seg) => _buildSegmentItem(seg)),
                          
                          // Streaming text
                          if (_streamingText.isNotEmpty)
                            _buildSegmentItem(
                              ThinkingSegment(
                                type: 'thought',
                                content: _streamingText,
                              ),
                              isStreaming: true,
                            ),
                          
                          // Loading
                          if (widget.isStreaming && _streamingText.isEmpty)
                            const Text(
                              'Đang xử lý...',
                              style: TextStyle(
                                color: AppColors.stone500,
                                fontSize: 12,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                        ],
                      ),
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildSegmentItem(ThinkingSegment segment, {bool isStreaming = false}) {
    final icon = _getIcon(segment.type);
    final cleanContent = _cleanContent(segment.content);
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(icon, style: const TextStyle(fontSize: 14)),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              cleanContent,
              style: TextStyle(
                fontSize: 12,
                color: AppColors.stone700,
                height: 1.4,
              ),
            ),
          ),
          if (isStreaming) const _CursorBlink(),
        ],
      ),
    );
  }

  String _getIcon(String content) {
    if (content.startsWith('🧠')) return '🧠';
    if (content.startsWith('🔍')) return '🔍';
    if (content.startsWith('📋')) return '📋';
    return '💭';
  }

  String _cleanContent(String content) {
    return content
        .replaceFirst('🧠', '')
        .replaceFirst('🔍', '')
        .replaceFirst('📋', '')
        .trim();
  }
}

class ThinkingSegment {
  final String type;
  final String content;
  final String? stepIndex;

  const ThinkingSegment({
    required this.type,
    required this.content,
    this.stepIndex,
  });
}

class _StreamingIndicator extends StatefulWidget {
  const _StreamingIndicator();

  @override
  State<_StreamingIndicator> createState() => _StreamingIndicatorState();
}

class _StreamingIndicatorState extends State<_StreamingIndicator>
    with TickerProviderStateMixin {
  late List<AnimationController> _controllers;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(3, (index) {
      final controller = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 400),
      );
      Future.delayed(Duration(milliseconds: index * 100), () {
        if (mounted) controller.repeat(reverse: true);
      });
      return controller;
    });
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(3, (index) {
        return AnimatedBuilder(
          animation: _controllers[index],
          builder: (context, child) {
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 1),
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.5 + _controllers[index].value * 0.5),
                shape: BoxShape.circle,
              ),
            );
          },
        );
      }),
    );
  }
}

class _CursorBlink extends StatefulWidget {
  const _CursorBlink();

  @override
  State<_CursorBlink> createState() => _CursorBlinkState();
}

class _CursorBlinkState extends State<_CursorBlink>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
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
      builder: (context, child) {
        return Opacity(
          opacity: _controller.value,
          child: Container(
            width: 2,
            height: 14,
            color: AppColors.stone900,
          ),
        );
      },
    );
  }
}
