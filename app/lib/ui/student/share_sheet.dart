import 'package:flutter/material.dart';

import '../../core/app_exception.dart';
import '../../logic/schedule_filter.dart';
import '../../services/pdf_export.dart';
import '../../services/whatsapp_share.dart';
import '../../state/schedule_controller.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// مشاركة الجدول المعروض: نص واتساب (مع معاينة) أو ملف PDF.
Future<void> showShareSheet(BuildContext context, ScheduleController c) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: Colors.white,
    builder: (_) => _ShareSheet(c: c, hostContext: context),
  );
}

class _ShareSheet extends StatefulWidget {
  const _ShareSheet({required this.c, required this.hostContext});

  final ScheduleController c;
  final BuildContext hostContext;

  @override
  State<_ShareSheet> createState() => _ShareSheetState();
}

class _ShareSheetState extends State<_ShareSheet> {
  bool _pdfBusy = false;

  ScheduleController get c => widget.c;

  Future<void> _pdf({required bool share}) async {
    setState(() => _pdfBusy = true);
    final title = c.titleFor(c.day);
    try {
      final bytes = await PdfExport.build(
        title: title,
        lectures: c.visibleLectures,
        showYear: c.year == null,
        showDepartment: c.departmentId == null,
        allGroupsLabel: ScopeText.groupsJoined(c.groups),
      );
      if (share) {
        await PdfExport.share(bytes, title);
      } else {
        await PdfExport.printOrSave(bytes, title);
      }
    } catch (e) {
      if (mounted) {
        showMessage(context,
            'تعذّر إنشاء ملف PDF. ${AppException.from(e).message}',
            error: true);
      }
    } finally {
      if (mounted) setState(() => _pdfBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final message = c.shareMessage();
    final host = widget.hostContext;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('مشاركة الجدول',
                style: text.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
            Text(c.titleFor(c.day),
                style: text.bodySmall?.copyWith(color: AppColors.muted)),
            const SizedBox(height: 12),
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.38,
              ),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFE7F7EC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFBFE5CB)),
                ),
                child: SingleChildScrollView(
                  child: SelectableText(message,
                      style: text.bodyMedium?.copyWith(height: 1.5)),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text('نص واتساب',
                style: text.labelLarge?.copyWith(color: AppColors.muted)),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF1FA855),
                      minimumSize: const Size.fromHeight(48),
                    ),
                    icon: const Icon(Icons.send),
                    label: const Text('إرسال عبر واتساب'),
                    onPressed: () async {
                      final navigator = Navigator.of(context);
                      final outcome = await WhatsAppShare.send(message);
                      navigator.pop();
                      if (outcome == ShareOutcome.copiedToClipboard &&
                          host.mounted) {
                        showMessage(host,
                            'تعذّر فتح واتساب، فنسخنا الرسالة. الصقها في المحادثة.');
                      }
                    },
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.outlined(
                  tooltip: 'نسخ النص',
                  icon: const Icon(Icons.copy),
                  onPressed: () async {
                    final navigator = Navigator.of(context);
                    await WhatsAppShare.copy(message);
                    navigator.pop();
                    if (host.mounted) showMessage(host, 'تم نسخ الرسالة');
                  },
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text('ملف PDF',
                style: text.labelLarge?.copyWith(color: AppColors.muted)),
            const SizedBox(height: 6),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.navy,
                      minimumSize: const Size.fromHeight(48),
                    ),
                    icon: _pdfBusy
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.picture_as_pdf),
                    label: const Text('مشاركة PDF'),
                    onPressed: _pdfBusy ? null : () => _pdf(share: true),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.navy,
                      minimumSize: const Size.fromHeight(48),
                    ),
                    icon: const Icon(Icons.download),
                    label: const Text('حفظ / طباعة'),
                    onPressed: _pdfBusy ? null : () => _pdf(share: false),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
