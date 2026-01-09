import 'package:flutter/material.dart';
import '../../../config/constants/app_colors.dart';

/// Widget nhập tin nhắn
class MessageInput extends StatefulWidget {
  final Function(String) onSend;
  final bool isLoading;

  const MessageInput({
    super.key,
    required this.onSend,
    this.isLoading = false,
  });

  @override
  State<MessageInput> createState() => _MessageInputState();
}

class _MessageInputState extends State<MessageInput> {
  final TextEditingController _controller = TextEditingController();
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    _controller.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    final hasText = _controller.text.trim().isNotEmpty;
    if (hasText != _hasText) {
      setState(() => _hasText = hasText);
    }
  }

  void _handleSend() {
    final text = _controller.text.trim();
    if (text.isEmpty || widget.isLoading) return;

    widget.onSend(text);
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.white,
        border: Border(
          top: BorderSide(color: AppColors.stone200, width: 1),
        ),
      ),
      child: SafeArea(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            // Text input
            Expanded(
              child: Container(
                constraints: const BoxConstraints(maxHeight: 120),
                decoration: BoxDecoration(
                  color: AppColors.stone50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.stone900, width: 2),
                  boxShadow: const [
                    BoxShadow(color: AppColors.stone900, offset: Offset(2, 2)),
                  ],
                ),
                child: TextField(
                  controller: _controller,
                  maxLines: null,
                  keyboardType: TextInputType.multiline,
                  textInputAction: TextInputAction.newline,
                  style: const TextStyle(
                    fontSize: 15,
                    color: AppColors.stone900,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Nhập tin nhắn...',
                    hintStyle: TextStyle(color: AppColors.stone400),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            // Send button
            Container(
              decoration: BoxDecoration(
                color: _hasText ? AppColors.primary : AppColors.stone300,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.stone900, width: 2),
                boxShadow: _hasText
                    ? const [
                        BoxShadow(
                            color: AppColors.stone900, offset: Offset(2, 2)),
                      ]
                    : null,
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: _hasText && !widget.isLoading ? _handleSend : null,
                  borderRadius: BorderRadius.circular(6),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: widget.isLoading
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              color: AppColors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : Icon(
                            Icons.send_rounded,
                            color:
                                _hasText ? AppColors.white : AppColors.stone500,
                            size: 22,
                          ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
