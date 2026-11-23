import 'package:flutter/material.dart';

import '../../core/app_exception.dart';
import '../theme.dart';

/// شريط تنبيه أعلى المحتوى.
class InfoBanner extends StatelessWidget {
  const InfoBanner({
    super.key,
    required this.icon,
    required this.message,
    this.color = AppColors.gold,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String message;
  final Color color;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 4, 8),
      decoration: BoxDecoration(
        color: color.withAlpha(28),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withAlpha(110)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.ink),
          const SizedBox(width: 8),
          Expanded(
            child: Text(message,
                style: Theme.of(context)
                    .textTheme
                    .bodySmall
                    ?.copyWith(color: AppColors.ink, height: 1.4)),
          ),
          if (actionLabel != null)
            TextButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ),
    );
  }
}

/// حالة فارغة أو خطأ في منتصف الشاشة.
class CenteredMessage extends StatelessWidget {
  const CenteredMessage({
    super.key,
    required this.icon,
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: AppColors.muted),
            const SizedBox(height: 12),
            Text(title,
                textAlign: TextAlign.center,
                style: text.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(subtitle!,
                  textAlign: TextAlign.center,
                  style: text.bodyMedium?.copyWith(color: AppColors.muted)),
            ],
            if (actionLabel != null) ...[
              const SizedBox(height: 16),
              FilledButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

void showMessage(BuildContext context, String message, {bool error = false}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;
  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(message),
      backgroundColor: error ? Theme.of(context).colorScheme.error : null,
    ));
}

/// ينفذ عملية إدارة ويعرض النجاح أو رسالة الخطأ بالعربية.
Future<bool> runWithFeedback(
  BuildContext context,
  Future<void> Function() action, {
  required String success,
}) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  final errorColor = Theme.of(context).colorScheme.error;
  try {
    await action();
    messenger
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(success)));
    return true;
  } catch (e) {
    messenger
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(AppException.from(e).message),
        backgroundColor: errorColor,
        duration: const Duration(seconds: 5),
      ));
    return false;
  }
}

/// نافذة إدخال نص (إضافة أو إعادة تسمية).
Future<String?> askForText(
  BuildContext context, {
  required String title,
  String initial = '',
  String hint = '',
}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _TextDialog(title: title, initial: initial, hint: hint),
  );
}

class _TextDialog extends StatefulWidget {
  const _TextDialog(
      {required this.title, required this.initial, required this.hint});

  final String title;
  final String initial;
  final String hint;

  @override
  State<_TextDialog> createState() => _TextDialogState();
}

class _TextDialogState extends State<_TextDialog> {
  late final TextEditingController _ctrl =
      TextEditingController(text: widget.initial);
  String? _error;

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _submit() {
    final v = _ctrl.text.trim();
    if (v.isEmpty) {
      setState(() => _error = 'الاسم مطلوب');
      return;
    }
    Navigator.of(context).pop(v);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: TextField(
        controller: _ctrl,
        autofocus: true,
        textInputAction: TextInputAction.done,
        onSubmitted: (_) => _submit(),
        decoration: InputDecoration(
          hintText: widget.hint,
          errorText: _error,
          border: const OutlineInputBorder(),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('إلغاء')),
        FilledButton(onPressed: _submit, child: const Text('حفظ')),
      ],
    );
  }
}

Future<bool> confirm(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'حذف',
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('إلغاء')),
        FilledButton(
          style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error),
          onPressed: () => Navigator.of(ctx).pop(true),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return result ?? false;
}
