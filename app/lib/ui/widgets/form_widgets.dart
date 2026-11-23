import 'package:flutter/material.dart';

import '../theme.dart';

/// قيمة مختارة من قائمة (قد تكون null بمعنى «الكل/بدون»).
class Picked<T> {
  const Picked(this.value);
  final T value;
}

/// قائمة اختيار من الأسفل. يرجع null إذا أُغلقت دون اختيار.
Future<Picked<T>?> showPicker<T>(
  BuildContext context, {
  required String title,
  required List<(T, String)> options,
  required T current,
  Future<T?> Function()? onAddNew,
  String? addLabel,
}) {
  return showModalBottomSheet<Picked<T>>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    builder: (sheetContext) => SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(sheetContext).size.height * 0.75,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              child: Text(title,
                  style: Theme.of(sheetContext)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700)),
            ),
            if (onAddNew != null)
              ListTile(
                leading: const Icon(Icons.add_circle, color: AppColors.gold),
                title: Text(addLabel ?? 'إضافة جديد',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                onTap: () async {
                  final created = await onAddNew();
                  if (created != null && sheetContext.mounted) {
                    Navigator.of(sheetContext).pop(Picked<T>(created));
                  }
                },
              ),
            if (options.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Text('القائمة فارغة.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted)),
              ),
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final (value, label) in options)
                    ListTile(
                      title: Text(label),
                      trailing: value == current
                          ? const Icon(Icons.check, color: AppColors.navy)
                          : null,
                      selected: value == current,
                      onTap: () =>
                          Navigator.of(sheetContext).pop(Picked<T>(value)),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class FormSection extends StatelessWidget {
  const FormSection({super.key, required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 4, bottom: 8),
            child: Text(title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: AppColors.muted, fontWeight: FontWeight.w700)),
          ),
          for (final c in children)
            Padding(padding: const EdgeInsets.only(bottom: 10), child: c),
        ],
      ),
    );
  }
}

/// حقل اختيار يفتح قائمة عند الضغط.
class PickerField extends StatelessWidget {
  const PickerField({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
    this.showError = false,
  });

  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback onTap;
  final bool showError;

  @override
  Widget build(BuildContext context) {
    final errorColor = Theme.of(context).colorScheme.error;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: showError ? errorColor : AppColors.line,
              width: showError ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(icon, color: AppColors.navySoft),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: TextStyle(
                            fontSize: 12,
                            color: showError ? errorColor : AppColors.muted)),
                    const SizedBox(height: 2),
                    Text(
                      value ?? 'اختر',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: value == null ? AppColors.muted : AppColors.ink,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.expand_more, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

/// زر الحفظ الثابت أسفل النموذج.
class SaveBar extends StatelessWidget {
  const SaveBar({
    super.key,
    required this.label,
    required this.saving,
    required this.onSave,
  });

  final String label;
  final bool saving;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: FilledButton.icon(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
          onPressed: saving ? null : onSave,
          icon: saving
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : const Icon(Icons.save),
          label: Text(label),
        ),
      ),
    );
  }
}

/// زخرفة موحّدة لحقول النص في نماذج الإدارة.
InputDecoration adminInput(String label, {String? hint, Widget? prefix}) =>
    InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: prefix,
      border: const OutlineInputBorder(),
      filled: true,
      fillColor: Colors.white,
    );
