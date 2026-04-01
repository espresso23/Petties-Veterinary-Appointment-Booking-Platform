import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../config/constants/app_colors.dart';
import '../../data/models/booking.dart';
import '../../data/services/report_service.dart';

/// Hiển thị popup "Báo cáo vi phạm" cho một booking
Future<void> showReportBookingDialog(
  BuildContext context,
  BookingResponse booking,
) async {
  if (booking.bookingId == null) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Không tìm thấy mã lịch hẹn để báo cáo'),
          backgroundColor: AppColors.error,
        ),
      );
    }
    return;
  }

  final reasonController = TextEditingController();
  final formKey = GlobalKey<FormState>();
  final reportService = ReportService();
  List<File> selectedImages = [];
  final ImagePicker picker = ImagePicker();

  final result = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (dialogContext) {
      final clinicName = booking.clinicName ?? 'Phòng khám';
      final bookingDate = booking.bookingDate ?? '--/--/----';
      final bookingTime = booking.bookingTime ?? '--:--';
      final displayTitle = '$clinicName - $bookingTime $bookingDate';

      return Center(
        child: Dialog(
          backgroundColor: Colors.transparent,
          insetPadding: const EdgeInsets.symmetric(horizontal: 24),
          child: StatefulBuilder(
            builder: (context, setState) {
              Future<void> pickImage(ImageSource source) async {
                try {
                  if (source == ImageSource.gallery) {
                    final pickedFiles = await picker.pickMultiImage(imageQuality: 70);
                    if (pickedFiles.isNotEmpty) {
                      setState(() {
                        for (var file in pickedFiles) {
                          if (selectedImages.length < 5) {
                            selectedImages.add(File(file.path));
                          }
                        }
                      });
                    }
                  } else {
                    final pickedFile = await picker.pickImage(source: source, imageQuality: 70);
                    if (pickedFile != null) {
                      setState(() {
                        if (selectedImages.length < 5) {
                          selectedImages.add(File(pickedFile.path));
                        }
                      });
                    }
                  }
                } catch (e) {
                  debugPrint('Lỗi chọn ảnh: $e');
                }
              }

              void showImageSourceOptions() {
                showModalBottomSheet(
                  context: context,
                  backgroundColor: Colors.transparent,
                  builder: (ctx) => Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                      border: Border.all(color: AppColors.stone900, width: 3),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('Thêm ảnh đính kèm', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppColors.stone900)),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () {
                                  Navigator.pop(ctx);
                                  pickImage(ImageSource.gallery);
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  decoration: BoxDecoration(
                                    color: AppColors.stone50,
                                    border: Border.all(color: AppColors.stone900, width: 2),
                                  ),
                                  child: const Column(
                                    children: [
                                      Icon(Icons.photo_library, color: AppColors.stone600),
                                      SizedBox(height: 8),
                                      Text('Thư viện', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.stone900)),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: GestureDetector(
                                onTap: () {
                                  Navigator.pop(ctx);
                                  pickImage(ImageSource.camera);
                                },
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  decoration: BoxDecoration(
                                    color: AppColors.stone50,
                                    border: Border.all(color: AppColors.stone900, width: 2),
                                  ),
                                  child: const Column(
                                    children: [
                                      Icon(Icons.camera_alt, color: AppColors.stone600),
                                      SizedBox(height: 8),
                                      Text('Chụp ảnh', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.stone900)),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                );
              }

              return ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.white,
                border: Border.all(color: AppColors.stone900, width: 3),
                boxShadow: const [
                  BoxShadow(
                    color: AppColors.stone900,
                    offset: Offset(8, 8),
                  ),
                ],
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header neo-brutalism
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 16),
                      decoration: const BoxDecoration(
                        color: AppColors.error,
                        border: Border(
                          bottom:
                              BorderSide(color: AppColors.stone900, width: 3),
                        ),
                      ),
                      child: Row(
                        children: [
                          const Expanded(
                            child: Text(
                              'BÁO CÁO VI PHẠM',
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 18,
                                letterSpacing: 1.1,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          GestureDetector(
                            onTap: () =>
                                Navigator.of(dialogContext).pop(false),
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                border: Border.all(
                                    color: AppColors.stone900, width: 2),
                              ),
                              child: const Icon(
                                Icons.close_rounded,
                                size: 18,
                                color: AppColors.stone900,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Content – ngắn gọn như thiết kế
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                      child: Form(
                        key: formKey,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'ĐANG BÁO CÁO LỊCH HẸN:',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.stone600,
                                letterSpacing: 0.8,
                              ),
                            ),
                            const SizedBox(height: 6),
                              Text(
                                displayTitle,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.stone900,
                                ),
                              ),
                            const SizedBox(height: 20),
                            const Text(
                              'LÝ DO BÁO CÁO:',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.stone700,
                                letterSpacing: 0.8,
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextFormField(
                              controller: reasonController,
                              minLines: 3,
                              maxLines: 4,
                              maxLength: 2000,
                              validator: (value) {
                                final text = value?.trim() ?? '';
                                if (text.isEmpty) {
                                  return 'Vui lòng mô tả chi tiết vấn đề bạn gặp phải';
                                }
                                if (text.length < 10) {
                                  return 'Lý do báo cáo cần tối thiểu 10 ký tự';
                                }
                                return null;
                              },
                              decoration: const InputDecoration(
                                hintText:
                                    'Vui lòng mô tả chi tiết vấn đề bạn gặp phải\n(phát sinh lỗi, thái độ phục vụ, vi phạm chính sách...)',
                                alignLabelWithHint: true,
                                filled: true,
                                fillColor: AppColors.stone50,
                                counterText: '',
                                enabledBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                      color: AppColors.stone900, width: 2),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                      color: AppColors.stone900, width: 2),
                                ),
                                errorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                      color: AppColors.error, width: 2),
                                ),
                                focusedErrorBorder: OutlineInputBorder(
                                  borderSide: BorderSide(
                                      color: AppColors.error, width: 2),
                                ),
                              ),
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.stone900,
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'ẢNH ĐÍNH KÈM (TÙY CHỌN):',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: AppColors.stone700,
                                letterSpacing: 0.8,
                              ),
                            ),
                            const SizedBox(height: 8),
                            if (selectedImages.isNotEmpty)
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  SizedBox(
                                    height: 100,
                                    child: ListView.separated(
                                      scrollDirection: Axis.horizontal,
                                      itemCount: selectedImages.length < 5
                                          ? selectedImages.length + 1
                                          : selectedImages.length,
                                      separatorBuilder: (context, index) =>
                                          const SizedBox(width: 12),
                                      itemBuilder: (context, index) {
                                        if (index == selectedImages.length) {
                                          return GestureDetector(
                                            onTap: showImageSourceOptions,
                                            child: Container(
                                              width: 100,
                                              decoration: BoxDecoration(
                                                color: AppColors.stone50,
                                                border: Border.all(
                                                    color: AppColors.stone900,
                                                    width: 2),
                                              ),
                                              child: const Column(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  Icon(Icons.add_photo_alternate,
                                                      color: AppColors.stone600),
                                                  SizedBox(height: 4),
                                                  Text(
                                                    'Thêm ảnh',
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      fontWeight: FontWeight.w700,
                                                      color: AppColors.stone600,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          );
                                        }

                                        return Stack(
                                          children: [
                                            Container(
                                              height: 100,
                                              width: 100,
                                              decoration: BoxDecoration(
                                                border: Border.all(
                                                    color: AppColors.stone900,
                                                    width: 2),
                                                image: DecorationImage(
                                                  image: FileImage(
                                                      selectedImages[index]),
                                                  fit: BoxFit.cover,
                                                ),
                                              ),
                                            ),
                                            Positioned(
                                              top: 4,
                                              right: 4,
                                              child: GestureDetector(
                                                onTap: () {
                                                  setState(() {
                                                    selectedImages.removeAt(index);
                                                  });
                                                },
                                                child: Container(
                                                  padding:
                                                      const EdgeInsets.all(4),
                                                  decoration: BoxDecoration(
                                                    color: AppColors.error,
                                                    border: Border.all(
                                                        color: AppColors.stone900,
                                                        width: 2),
                                                  ),
                                                  child: const Icon(
                                                    Icons.close,
                                                    size: 14,
                                                    color: Colors.white,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ],
                                        );
                                      },
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Đã tải lên ${selectedImages.length}/5 ảnh',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.stone600,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              )
                            else
                              Row(
                                children: [
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () => pickImage(ImageSource.gallery),
                                      child: Container(
                                        height: 80,
                                        decoration: BoxDecoration(
                                          color: AppColors.stone50,
                                          border: Border.all(
                                              color: AppColors.stone900, width: 2),
                                        ),
                                        child: const Column(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.photo_library,
                                                color: AppColors.stone600),
                                            SizedBox(height: 4),
                                            Text(
                                              'Thư viện',
                                              style: TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w700,
                                                color: AppColors.stone600,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: GestureDetector(
                                      onTap: () => pickImage(ImageSource.camera),
                                      child: Container(
                                        height: 80,
                                        decoration: BoxDecoration(
                                          color: AppColors.stone50,
                                          border: Border.all(
                                              color: AppColors.stone900, width: 2),
                                        ),
                                        child: const Column(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.camera_alt,
                                                color: AppColors.stone600),
                                            SizedBox(height: 4),
                                            Text(
                                              'Chụp ảnh',
                                              style: TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w700,
                                                color: AppColors.stone600,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            const SizedBox(height: 8),
                            const Text(
                              '* Báo cáo này sẽ được gửi trực tiếp đến quản trị viên hệ thống để xử lý.',
                              style: TextStyle(
                                fontSize: 11,
                                color: AppColors.stone500,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Actions neo-brutalism
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                      child: Row(
                        children: [
                          Expanded(
                            child: _ReportBrutalButton(
                              label: 'HỦY',
                              backgroundColor: AppColors.white,
                              textColor: AppColors.stone900,
                              onTap: () =>
                                  Navigator.of(dialogContext).pop(false),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: _ReportBrutalButton(
                              label: 'GỬI BÁO CÁO',
                              backgroundColor: AppColors.error,
                              textColor: Colors.white,
                              isPrimary: true,
                              onTap: () {
                                if (formKey.currentState?.validate() ??
                                    false) {
                                  Navigator.of(dialogContext).pop(true);
                                }
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    ),
  );
},
);

  if (result == true && context.mounted) {
    // Gọi API tạo report
    try {
      // Loading overlay đơn giản
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (_) => const Center(child: CircularProgressIndicator()),
      );

      await reportService.createReport(
        bookingId: booking.bookingId!,
        reason: reasonController.text.trim(),
        imageFiles: selectedImages.isNotEmpty ? selectedImages : null,
      );

      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop(); // hide loading
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Đã gửi báo cáo thành công'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        Navigator.of(context, rootNavigator: true).pop(); // hide loading
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              'Lỗi khi gửi báo cáo: ${e.toString().replaceAll("Exception:", "").trim()}',
            ),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  // Chờ dialog animate đóng hẳn rổi mới dispose để tránh lỗi 'used after being disposed'
  Future.delayed(const Duration(milliseconds: 400), () {
    reasonController.dispose();
  });
}

class _ReportBrutalButton extends StatelessWidget {
  final String label;
  final Color backgroundColor;
  final Color textColor;
  final bool isPrimary;
  final VoidCallback onTap;

  const _ReportBrutalButton({
    required this.label,
    required this.backgroundColor,
    required this.textColor,
    required this.onTap,
    this.isPrimary = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: backgroundColor,
          border: Border.all(color: AppColors.stone900, width: 3),
          boxShadow: [
            BoxShadow(
              color: AppColors.stone900,
              offset: isPrimary ? const Offset(4, 4) : const Offset(0, 0),
            ),
          ],
        ),
        child: Text(
          label.toUpperCase(),
          textAlign: TextAlign.center,
          style: TextStyle(
            color: textColor,
            fontWeight: FontWeight.w900,
            fontSize: 13,
            letterSpacing: 1.2,
          ),
        ),
      ),
    );
  }
}


