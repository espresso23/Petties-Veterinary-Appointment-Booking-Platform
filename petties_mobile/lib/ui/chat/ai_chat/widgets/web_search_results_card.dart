import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

// Simplified Web Search data classes (same as in ai_chat_screen.dart)
class WebSearchResult {
  final String title;
  final String snippet;
  final String url;
  final double score;

  WebSearchResult({
    required this.title,
    required this.snippet,
    required this.url,
    required this.score,
  });

  factory WebSearchResult.fromJson(Map<String, dynamic> json) {
    return WebSearchResult(
      title: json['title'] ?? '',
      snippet: json['snippet'] ?? '',
      url: json['url'] ?? json['source'] ?? '',
      score: (json['score'] ?? 0).toDouble(),
    );
  }
}

class WebSearchImage {
  final String url;
  final String title;
  final String description;

  WebSearchImage({
    required this.url,
    required this.title,
    required this.description,
  });

  factory WebSearchImage.fromJson(Map<String, dynamic> json) {
    return WebSearchImage(
      url: json['url'] ?? '',
      title: json['title'] ?? '',
      description: json['description'] ?? '',
    );
  }
}

class WebSearchResultsCard extends StatelessWidget {
  final List<WebSearchResult> results;
  final List<WebSearchImage> images;
  final String? answer;
  final List<String> followUpQuestions;
  final Function(String)? onFollowUpTap;

  const WebSearchResultsCard({
    super.key,
    this.results = const [],
    this.images = const [],
    this.answer,
    this.followUpQuestions = const [],
    this.onFollowUpTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasContent = results.isNotEmpty ||
        images.isNotEmpty ||
        (answer != null && answer!.isNotEmpty);

    if (!hasContent) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(top: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF1C1917), width: 2),
        boxShadow: const [
          BoxShadow(
            color: Color(0xFF1C1917),
            offset: Offset(3, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // AI Answer Summary
          if (answer != null && answer!.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFFFFF7ED),
                borderRadius: BorderRadius.vertical(top: Radius.circular(15)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.auto_awesome,
                    size: 18,
                    color: Color(0xFFD97706),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Tổng hợp',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFFD97706),
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          answer!,
                          style: const TextStyle(
                            fontSize: 13,
                            height: 1.5,
                            color: Color(0xFF44403C),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],

          // Image Gallery
          if (images.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'HÌNH ẢNH MINH HỌA',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF78716C),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 80,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      itemCount: images.length,
                      itemBuilder: (context, index) {
                        final img = images[index];
                        return GestureDetector(
                          onTap: () => _openImage(img.url),
                          child: Container(
                            width: 80,
                            height: 80,
                            margin: const EdgeInsets.only(right: 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(8),
                              border:
                                  Border.all(color: const Color(0xFFE7E5E4)),
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(7),
                              child: Image.network(
                                img.url,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  color: const Color(0xFFF5F5F4),
                                  child: const Icon(
                                    Icons.image_not_supported,
                                    color: Color(0xFFA8A29E),
                                    size: 24,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
            if (results.isNotEmpty || followUpQuestions.isNotEmpty)
              const Divider(height: 1, color: Color(0xFFE7E5E4)),
          ],

          // Sources
          if (results.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'NGUỒN THAM KHẢO',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF78716C),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  ...results.take(5).map((result) => _SourceItem(
                        result: result,
                        onTap: () => _openUrl(result.url),
                      )),
                ],
              ),
            ),
            if (followUpQuestions.isNotEmpty)
              const Divider(height: 1, color: Color(0xFFE7E5E4)),
          ],

          // Follow-up Questions
          if (followUpQuestions.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'CÓ THỂ BẠN QUAN TÂM',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF78716C),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: followUpQuestions.take(3).map((question) {
                      return InkWell(
                        onTap: onFollowUpTap != null
                            ? () => onFollowUpTap!(question)
                            : null,
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF5F5F4),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFFE7E5E4)),
                          ),
                          child: Text(
                            question,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF44403C),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _openImage(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _SourceItem extends StatelessWidget {
  final WebSearchResult result;
  final VoidCallback? onTap;

  const _SourceItem({
    required this.result,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              Icons.link,
              size: 14,
              color: Color(0xFF78716C),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    result.title,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1C1917),
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatUrl(result.url),
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFF78716C),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right,
              size: 16,
              color: Color(0xFFA8A29E),
            ),
          ],
        ),
      ),
    );
  }

  String _formatUrl(String url) {
    try {
      final uri = Uri.parse(url);
      return uri.host;
    } catch (_) {
      return url;
    }
  }
}
