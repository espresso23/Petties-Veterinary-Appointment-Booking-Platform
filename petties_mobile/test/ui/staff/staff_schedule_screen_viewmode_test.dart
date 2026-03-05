import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/ui/staff/staff_schedule_screen.dart';
import 'package:petties_mobile/data/models/staff_shift.dart';

/// Unit tests cho UI logic của StaffScheduleScreen:
/// - Tính range ngày gọi API theo view mode (Day/Week/Month).
/// - Xác định ngày nào trong calendar Month view có shift (marker trên lịch).
void main() {
  group('StaffScheduleViewMode - range ngày gọi API', () {
    DateTime _mondayOf(DateTime anyDay) {
      return anyDay.subtract(Duration(days: anyDay.weekday - 1));
    }

    ({DateTime start, DateTime end}) _getRange(
      StaffScheduleViewMode mode,
      DateTime focusedDate,
    ) {
      if (mode == StaffScheduleViewMode.month) {
        final start = DateTime(focusedDate.year, focusedDate.month, 1);
        final end = DateTime(focusedDate.year, focusedDate.month + 1, 0);
        return (start: start, end: end);
      }

      final firstDayOfWeek = _mondayOf(focusedDate);
      final weekDates =
          List.generate(7, (index) => firstDayOfWeek.add(Duration(days: index)));
      return (start: weekDates.first, end: weekDates.last);
    }

    test('Day/Week mode dùng cùng range 1 tuần chứa focusedDate', () {
      final focused = DateTime(2026, 3, 13); // Thứ 6

      final weekRange =
          _getRange(StaffScheduleViewMode.week, focused);
      final dayRange =
          _getRange(StaffScheduleViewMode.day, focused);

      // Cả hai đều là thứ 2 → chủ nhật của tuần đó
      expect(weekRange.start.weekday, DateTime.monday);
      expect(weekRange.end.weekday, DateTime.sunday);

      expect(dayRange.start, weekRange.start);
      expect(dayRange.end, weekRange.end);
      // focusedDate phải nằm trong khoảng
      expect(focused.isAfter(weekRange.start.subtract(const Duration(days: 1))),
          true);
      expect(focused.isBefore(weekRange.end.add(const Duration(days: 1))), true);
    });

    test('Month mode: start là ngày 1, end là ngày cuối tháng', () {
      final focused = DateTime(2026, 3, 15);

      final range =
          _getRange(StaffScheduleViewMode.month, focused);

      expect(range.start, DateTime(2026, 3, 1));
      // Tháng 3 năm 2026 có 31 ngày
      expect(range.end, DateTime(2026, 4, 0));
      expect(range.end.day, 31);
    });

    test('Month mode hoạt động đúng qua ranh giới năm (December)', () {
      final focused = DateTime(2025, 12, 10);

      final range =
          _getRange(StaffScheduleViewMode.month, focused);

      expect(range.start, DateTime(2025, 12, 1));
      // Ngày cuối tháng 12/2025
      expect(range.end.month, 12);
      expect(range.end.year, 2025);
      expect(range.end.day, 31);
    });
  });

  group('StaffScheduleScreen - Month view marker ngày có ca', () {
    bool _hasShiftForDate(List<StaffShiftResponse> shifts, DateTime day) {
      final dateStr = '${day.year.toString().padLeft(4, '0')}-'
          '${day.month.toString().padLeft(2, '0')}-'
          '${day.day.toString().padLeft(2, '0')}';

      return shifts.any((s) =>
          (s.displayDate ?? s.workDate) == dateStr && !s.isContinuation);
    }

    StaffShiftResponse _fakeShift({
      required String date,
      bool isContinuation = false,
    }) {
      return StaffShiftResponse(
        shiftId: 'shift-$date-$isContinuation',
        staffId: 'staff-1',
        clinicId: 'clinic-1',
        workDate: date,
        startTime: '08:00:00',
        endTime: '12:00:00',
        isContinuation: isContinuation,
        totalSlots: 0,
        availableSlots: 0,
        bookedSlots: 0,
        blockedSlots: 0,
        slots: const [],
      );
    }

    test('Ngày có shift chính (không continuation) sẽ được đánh dấu', () {
      final day = DateTime(2026, 3, 10);
      const dateStr = '2026-03-10';

      final shifts = [
        _fakeShift(date: dateStr, isContinuation: false),
      ];

      expect(_hasShiftForDate(shifts, day), true);
    });

    test('Ngày chỉ có shift continuation sẽ KHÔNG được đánh dấu', () {
      final day = DateTime(2026, 3, 11);
      const dateStr = '2026-03-11';

      final shifts = [
        _fakeShift(date: dateStr, isContinuation: true),
      ];

      expect(_hasShiftForDate(shifts, day), false);
    });

    test('Ngày không có shift nào thì luôn không được đánh dấu', () {
      final day = DateTime(2026, 3, 12);
      final shifts = <StaffShiftResponse>[];

      expect(_hasShiftForDate(shifts, day), false);
    });
  });
}

