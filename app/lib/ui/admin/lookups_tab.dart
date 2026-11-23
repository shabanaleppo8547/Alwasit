import 'package:flutter/material.dart';

import '../../app_scope.dart';
import '../../models/lookup.dart';
import '../../state/schedule_controller.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// إدارة أسماء المواد والمدرسين والفئات والأقسام.
class LookupsTab extends StatelessWidget {
  const LookupsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).schedule;
    return ListenableBuilder(
      listenable: c,
      builder: (context, _) => RefreshIndicator(
        onRefresh: c.load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
          children: [
            const InfoBanner(
              icon: Icons.info_outline,
              message: 'تعديل اسم هنا يغيّره في كل المحاضرات المرتبطة به. '
                  'لا يمكن حذف عنصر مستخدم في محاضرات.',
            ),
            const SizedBox(height: 12),
            for (final kind in LookupKind.values)
              _LookupSection(controller: c, kind: kind),
          ],
        ),
      ),
    );
  }
}

class _LookupSection extends StatelessWidget {
  const _LookupSection({required this.controller, required this.kind});

  final ScheduleController controller;
  final LookupKind kind;

  int _usage(String id) => controller.allLectures.where((l) {
        return switch (kind) {
          LookupKind.subject => l.subjectId == id,
          LookupKind.teacher => l.teacherId == id,
          LookupKind.group => l.groupId == id,
          LookupKind.department => l.departmentId == id,
        };
      }).length;

  Future<void> _add(BuildContext context) async {
    final name = await askForText(context,
        title: 'إضافة ${kind.singularLabel}',
        hint: 'اكتب اسم ال${kind.singularLabel}');
    if (name == null || !context.mounted) return;
    final ok = await runWithFeedback(
      context,
      () => controller.repository.addLookup(kind, name),
      success: 'تمت الإضافة',
    );
    if (ok) await controller.load();
  }

  Future<void> _rename(BuildContext context, LookupItem item) async {
    final name = await askForText(context,
        title: 'تعديل ${kind.singularLabel}', initial: item.name);
    if (name == null || name == item.name || !context.mounted) return;
    final ok = await runWithFeedback(
      context,
      () => controller.repository.renameLookup(kind, item.id, name),
      success: 'تم تعديل الاسم',
    );
    if (ok) await controller.load();
  }

  Future<void> _delete(BuildContext context, LookupItem item) async {
    final used = _usage(item.id);
    if (used > 0) {
      showMessage(
        context,
        '«${item.name}» مستخدم في $used من المحاضرات. '
        'عدّلها أو احذفها أولًا.',
        error: true,
      );
      return;
    }
    final yes = await confirm(context,
        title: 'حذف ${kind.singularLabel}؟', message: '«${item.name}»');
    if (!yes || !context.mounted) return;
    final ok = await runWithFeedback(
      context,
      () => controller.repository.deleteLookup(kind, item.id),
      success: 'تم الحذف',
    );
    if (ok) await controller.load();
  }

  @override
  Widget build(BuildContext context) {
    final items = controller.lookups(kind);
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 4, 4),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${kind.pluralLabel} (${items.length})',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                TextButton.icon(
                  onPressed: () => _add(context),
                  icon: const Icon(Icons.add),
                  label: const Text('إضافة'),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('لا توجد عناصر بعد.',
                  style: TextStyle(color: AppColors.muted)),
            ),
          for (final item in items)
            ListTile(
              title: Text(item.name),
              subtitle: Text('مستخدم في ${_usage(item.id)} محاضرة'),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    tooltip: 'تعديل',
                    icon: const Icon(Icons.edit_outlined),
                    onPressed: () => _rename(context, item),
                  ),
                  IconButton(
                    tooltip: 'حذف',
                    icon: const Icon(Icons.delete_outline),
                    color: Theme.of(context).colorScheme.error,
                    onPressed: () => _delete(context, item),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
