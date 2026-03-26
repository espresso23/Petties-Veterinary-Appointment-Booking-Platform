import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:petties_mobile/data/models/ai_chat.dart';
import 'package:petties_mobile/ui/chat/ai_chat/widgets/service_selection_group.dart';

void main() {
  group('AiServiceSelectionGroup', () {
    testWidgets('enables continue button only after selecting at least one service',
        (tester) async {
      final serviceChips = <UiComponentV1>[
        UiComponentV1(
          type: 'service_chip',
          id: 'svc_1',
          data: const {
            'id': 'svc-1',
            'name': 'Khám tổng quát cho chó',
            'group_id': 'service_group_1',
          },
          actions: [
            UiAction(
              type: 'select_item',
              label: 'Chọn',
              payload: const {
                'item_id': 'svc-1',
                'item_type': 'service',
                'group_id': 'service_group_1',
              },
            ),
          ],
        ),
        UiComponentV1(
          type: 'service_chip',
          id: 'svc_2',
          data: const {
            'id': 'svc-2',
            'name': 'Tiêm phòng',
            'group_id': 'service_group_1',
          },
          actions: [
            UiAction(
              type: 'select_item',
              label: 'Chọn',
              payload: const {
                'item_id': 'svc-2',
                'item_type': 'service',
                'group_id': 'service_group_1',
              },
            ),
          ],
        ),
      ];

      final actionButton = UiComponentV1(
        type: 'button',
        id: 'service_group_1_continue',
        data: const {
          'label': 'Tiếp tục',
          'group_id': 'service_group_1',
        },
        actions: [
          UiAction(
            type: 'select_services',
            label: 'Tiếp tục',
            payload: const {
              'group_id': 'service_group_1',
            },
          ),
        ],
      );

      var continueTapped = 0;
      final selectedIds = <String>{};

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) {
                return AiServiceSelectionGroup(
                  serviceChips: serviceChips,
                  actionButton: actionButton,
                  selectedServiceIds: selectedIds,
                  isBusy: false,
                  onToggleService: (component) {
                    setState(() {
                      final serviceId = component.data['id']!.toString();
                      if (selectedIds.contains(serviceId)) {
                        selectedIds.remove(serviceId);
                      } else {
                        selectedIds.add(serviceId);
                      }
                    });
                  },
                  onContinue: () {
                    continueTapped += 1;
                  },
                );
              },
            ),
          ),
        ),
      );

      final continueButton = find.widgetWithText(ElevatedButton, 'TIẾP TỤC');
      expect(continueButton, findsOneWidget);
      expect(tester.widget<ElevatedButton>(continueButton).onPressed, isNull);

      await tester.tap(find.text('Khám tổng quát cho chó'));
      await tester.pumpAndSettle();

      expect(
        tester.widget<ElevatedButton>(continueButton).onPressed,
        isNotNull,
      );

      await tester.tap(continueButton);
      await tester.pumpAndSettle();

      expect(continueTapped, 1);
    });
  });
}
