import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../../config/constants/app_colors.dart';
import '../../../../data/models/vaccination.dart';

class VaccinationRoadmapTable extends StatelessWidget {
  final List<VaccinationRecord> records;
  final List<VaccinationRecord> upcoming;

  const VaccinationRoadmapTable({
    super.key,
    required this.records,
    this.upcoming = const [],
  });

  @override
  Widget build(BuildContext context) {
    // Merge records with upcoming predictions
    final List<VaccinationRecord> allRecords = [...records];
    
    // Add upcoming predictions that don't already exist in records
    for (var upcomingRec in upcoming) {
      final normalizedUpcoming = upcomingRec.vaccineName
          .toLowerCase()
          .replaceAll(RegExp(r'\(booster\)', caseSensitive: false), '')
          .replaceAll(RegExp(r'\(hàng năm\)', caseSensitive: false), '')
          .replaceAll(RegExp(r'[^a-z0-9]'), '');
      
      final exists = records.any((r) {
        final normalizedRecord = r.vaccineName
            .toLowerCase()
            .replaceAll(RegExp(r'\(booster\)', caseSensitive: false), '')
            .replaceAll(RegExp(r'\(hàng năm\)', caseSensitive: false), '')
            .replaceAll(RegExp(r'[^a-z0-9]'), '');
        return normalizedRecord == normalizedUpcoming && r.doseNumber == upcomingRec.doseNumber;
      });
      
      if (!exists) {
        allRecords.add(upcomingRec);
      }
    }

    // Grouping logic by normalized name
    final Map<String, List<VaccinationRecord>> groups = {};
    for (var rec in allRecords) {
      final normalizedName = rec.vaccineName
          .toLowerCase()
          .replaceAll(RegExp(r'\(booster\)', caseSensitive: false), '')
          .replaceAll(RegExp(r'\(hàng năm\)', caseSensitive: false), '')
          .replaceAll(RegExp(r'[^a-z0-9]'), '');
      
      if (!groups.containsKey(normalizedName)) groups[normalizedName] = [];
      groups[normalizedName]!.add(rec);
    }

    // Sort groups by vaccine name
    final sortedKeys = groups.keys.toList()..sort();

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.stone200),
        ),
        child: DataTable(
          columnSpacing: 20,
          dataRowMinHeight: 80,
          dataRowMaxHeight: 100,
          columns: const [
            DataColumn(label: Text('LOẠI VACCINE', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, color: AppColors.stone400))),
            DataColumn(label: Text('MŨI 1', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, color: AppColors.stone400))),
            DataColumn(label: Text('MŨI 2', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, color: AppColors.stone400))),
            DataColumn(label: Text('MŨI 3', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, color: AppColors.stone400))),
            DataColumn(label: Text('MŨI 4+ / NHẮC LẠI', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 10, color: AppColors.stone400))),
          ],
          rows: sortedKeys.map((key) {
            final doses = groups[key]!;
            // Only show groups that have at least one completed/real record
            final hasHistory = doses.any((d) => d.status == 'COMPLETED' || (d.id.isNotEmpty && !d.id.startsWith('predicted-')));
            if (!hasHistory) return const DataRow(cells: []);

            final vaccineName = doses[0].vaccineName
                .replaceAll(RegExp(r'\(booster\)', caseSensitive: false), '')
                .replaceAll(RegExp(r'\(hàng năm\)', caseSensitive: false), '')
                .replaceAll(RegExp(r'\(Mũi \d+\)', caseSensitive: false), '')
                .trim();

            // Find dose for each column (prefer COMPLETED over pending)
            VaccinationRecord? findDose(int num) {
              final groupDoses = doses.where((d) => d.doseNumber == num).toList();
              if (groupDoses.isEmpty) return null;
              return groupDoses.firstWhere(
                (d) => d.status == 'COMPLETED',
                orElse: () => groupDoses.first,
              );
            }

            // Find boosters (dose 4+)
            final boosters = doses.where((d) => (d.doseNumber ?? 0) > 3).toList();

            return DataRow(
              cells: [
                // Vaccine name column
                DataCell(
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        constraints: const BoxConstraints(maxWidth: 160),
                        child: Text(
                          vaccineName,
                          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: AppColors.stone900),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (doses.isNotEmpty && doses[0].totalDoses != null)
                        Text(
                          '${doses[0].totalDoses} MŨI TỔNG CỘNG',
                          style: const TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: AppColors.stone400),
                        ),
                    ],
                  ),
                ),
                DataCell(_buildDoseCell(findDose(1))),
                DataCell(_buildDoseCell(findDose(2))),
                DataCell(_buildDoseCell(findDose(3))),
                DataCell(_buildBoosterCell(boosters)),
              ],
            );
          }).where((row) => row.cells.isNotEmpty).toList(),
        ),
      ),
    );
  }

  Widget _buildDoseCell(VaccinationRecord? dose) {
    if (dose == null) {
      return const Text('-', style: TextStyle(color: AppColors.stone300, fontSize: 12));
    }
    return _buildRecordCell(dose);
  }

  Widget _buildBoosterCell(List<VaccinationRecord> boosters) {
    if (boosters.isEmpty) {
      return const Text('-', style: TextStyle(color: AppColors.stone300, fontSize: 12));
    }
    // Show most relevant booster (completed or upcoming)
    final completed = boosters.where((b) => b.status == 'COMPLETED').toList();
    final pending = boosters.where((b) => b.status != 'COMPLETED').toList();
    
    // Prefer showing upcoming if there's one, otherwise show latest completed
    if (pending.isNotEmpty) {
      return _buildRecordCell(pending.first);
    } else if (completed.isNotEmpty) {
      return _buildRecordCell(completed.last);
    }
    return const Text('-', style: TextStyle(color: AppColors.stone300, fontSize: 12));
  }

  Widget _buildRecordCell(VaccinationRecord dose) {
    final bool isCompleted = dose.status == 'COMPLETED';
    final bool isPredicted = dose.id.startsWith('predicted-') || dose.status == 'PLANNED';
    
    // Status Logic
    String statusText;
    Color color;
    Color bgColor;
    Color borderColor;
    IconData icon;

    if (isCompleted) {
      statusText = 'ĐÃ TIÊM';
      color = AppColors.successDark;
      bgColor = AppColors.successLight;
      borderColor = AppColors.success.withOpacity(0.3);
      icon = Icons.check_circle;
    } else if (dose.nextDueDate != null) {
      final now = DateTime.now();
      final difference = dose.nextDueDate!.difference(now).inDays;
      if (difference < 0) {
        statusText = 'QUÁ HẠN';
        color = AppColors.errorDark;
        bgColor = AppColors.errorLight;
        borderColor = AppColors.error.withOpacity(0.3);
        icon = Icons.error_outline;
      } else {
        statusText = 'SẮP TIÊM';
        color = AppColors.warning; // amber-500
        bgColor = AppColors.warningLight;
        borderColor = AppColors.warning.withOpacity(0.3);
        icon = Icons.calendar_today;
      }
    } else {
      // Default / Planning / Check-in
      statusText = 'CHỜ TIÊM';
      color = AppColors.info; // blue-500
      bgColor = AppColors.infoLight;
      borderColor = AppColors.info.withOpacity(0.3);
      icon = Icons.schedule;
    }

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 95,
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: borderColor, width: isPredicted && !isCompleted ? 1.5 : 1),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 12, color: color),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      statusText,
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color, letterSpacing: -0.2),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                isCompleted 
                    ? (dose.vaccinationDate != null ? DateFormat('d/M/yyyy').format(dose.vaccinationDate!) : '-')
                    : (dose.nextDueDate != null ? DateFormat('d/M/yyyy').format(dose.nextDueDate!) : '-'),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: isCompleted ? AppColors.stone800 : AppColors.stone600,
                ),
              ),
            ],
          ),
        ),
        // Dự kiến badge like web - top right corner
        if ((isPredicted || !isCompleted) && dose.nextDueDate != null)
          Positioned(
            top: -8,
            right: -8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.stone200),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4, offset: const Offset(0, 1)),
                ],
              ),
              child: Text(
                'Dự kiến',
                style: TextStyle(fontSize: 7, fontWeight: FontWeight.bold, color: AppColors.stone500),
              ),
            ),
          ),
      ],
    );
  }
}
