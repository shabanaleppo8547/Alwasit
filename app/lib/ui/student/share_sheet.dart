import 'package:flutter/material.dart';

import '../../models/week_day.dart';
import '../../services/whatsapp_share.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// معاينة رسالة اليوم قبل إرسالها عبر واتساب.
Future<void> showShareSheet(
  BuildContext context, {
  required WeekDay day,
  required String message,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: Colors.white,
    builder: (sheetContext) {
      final text = Theme.of(sheetContext).textTheme;
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('مشاركة مواعيد يوم ${day.arabicName}',
                  style:
                      text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(sheetContext).size.height * 0.45,
                ),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE7F7EC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFBFE5CB)),
                  ),
                  child: SingleChildScrollView(
                    child: SelectableText(
                      message,
                      style: text.bodyMedium?.copyWith(height: 1.6),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF1FA855),
                  minimumSize: const Size.fromHeight(50),
                ),
                icon: const Icon(Icons.send),
                label: const Text('إرسال عبر واتساب'),
                onPressed: () async {
                  final outcome = await WhatsAppShare.send(message);
                  if (!sheetContext.mounted) return;
                  Navigator.of(sheetContext).pop();
                  if (outcome == ShareOutcome.copiedToClipboard &&
                      context.mounted) {
                    showMessage(context,
                        'تعذّر فتح واتساب، فنسخنا الرسالة. الصقها في المحادثة.');
                  }
                },
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.navy,
                  minimumSize: const Size.fromHeight(48),
                ),
                icon: const Icon(Icons.copy),
                label: const Text('نسخ النص'),
                onPressed: () async {
                  await WhatsAppShare.copy(message);
                  if (!sheetContext.mounted) return;
                  Navigator.of(sheetContext).pop();
                  if (context.mounted) showMessage(context, 'تم نسخ الرسالة');
                },
              ),
            ],
          ),
        ),
      );
    },
  );
}
