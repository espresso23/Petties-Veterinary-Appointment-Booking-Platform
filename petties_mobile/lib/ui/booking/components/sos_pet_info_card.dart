import 'package:flutter/material.dart';

class SosPetInfoCard extends StatelessWidget {
  final String petName;
  final String? petAvatar;
  final String? symptoms;
  final int countdownSeconds;
  final bool isSearching;

  const SosPetInfoCard({
    super.key,
    required this.petName,
    this.petAvatar,
    this.symptoms,
    required this.countdownSeconds,
    required this.isSearching,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Row(
        children: [
          // Pet avatar
          CircleAvatar(
            radius: 24,
            backgroundImage:
                petAvatar != null ? NetworkImage(petAvatar!) : null,
            child: petAvatar == null ? const Icon(Icons.pets, size: 24) : null,
          ),
          const SizedBox(width: 12),
          // Pet info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  petName,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                if (symptoms != null)
                  Text(
                    symptoms!,
                    style: TextStyle(
                      color: Colors.grey.shade600,
                      fontSize: 13,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          // Countdown timer
          if (isSearching)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.timer, size: 16, color: Colors.red.shade700),
                  const SizedBox(width: 4),
                  Text(
                    '${countdownSeconds}s',
                    style: TextStyle(
                      color: Colors.red.shade700,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
