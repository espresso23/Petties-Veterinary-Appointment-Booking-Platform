import 'package:flutter/material.dart';

import '../../config/constants/app_colors.dart';
import '../../data/services/booking_service.dart';
import 'booking_detail_screen.dart';

class BookingDetailByIdScreen extends StatefulWidget {
  final String bookingId;

  const BookingDetailByIdScreen({super.key, required this.bookingId});

  @override
  State<BookingDetailByIdScreen> createState() => _BookingDetailByIdScreenState();
}

class _BookingDetailByIdScreenState extends State<BookingDetailByIdScreen> {
  final BookingService _bookingService = BookingService();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _bookingService.getBookingById(widget.bookingId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            backgroundColor: AppColors.stone50,
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (snapshot.hasError || !snapshot.hasData) {
          return Scaffold(
            backgroundColor: AppColors.stone50,
            appBar: AppBar(
              backgroundColor: AppColors.white,
              title: const Text('Chi tiết lịch hẹn'),
            ),
            body: const Center(
              child: Text('Không thể tải chi tiết lịch hẹn. Vui lòng thử lại.'),
            ),
          );
        }

        return AppointmentDetailScreen(booking: snapshot.data!);
      },
    );
  }
}