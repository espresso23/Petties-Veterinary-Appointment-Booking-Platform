class Review {
  final String reviewId;
  final int rating;
  final String comment;
  final String userName;
  final String? userAvatar;
  final DateTime createdAt;

  Review({
    required this.reviewId,
    required this.rating,
    required this.comment,
    required this.userName,
    this.userAvatar,
    required this.createdAt,
  });

  factory Review.fromJson(Map<String, dynamic> json) {
    return Review(
      reviewId: json['reviewId'],
      rating: json['rating'],
      comment: json['comment'] ?? '',
      userName: json['userName'] ?? 'Người dùng ấn danh',
      userAvatar: json['userAvatar'],
      createdAt: DateTime.parse(json['createdAt']),
    );
  }
}
