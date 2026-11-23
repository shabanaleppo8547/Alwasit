import 'package:flutter/material.dart';

import '../../app_scope.dart';
import '../../core/app_exception.dart';
import '../../core/time_format.dart';
import '../../models/academic_year.dart';
import '../../models/lecture.dart';
import '../../models/lookup.dart';
import '../../models/week_day.dart';
import '../../state/schedule_controller.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// إضافة محاضرة جديدة أو تعديل محاضرة موجودة.
class LectureFormScreen extends StatefulWidget {
  const LectureFormScreen({
    super.key,
    this.existing,
    this.initialDay,
    this.initialYear,
  });

  final Lecture? existing;
  final WeekDay? initialDay;
  final int? initialYear;

  @override
  State<LectureFormScreen> createState() => _LectureFormScreenState();
}

/// قيمة مختارة من قائمة (قد تكون null بمعنى «الكل»).
class _Picked<T> {
  const _Picked(this.value);
  final T value;
}

class _LectureFormScreenState extends State<LectureFormScreen> {
  late WeekDay? _day = widget.existing?.day ?? widget.initialDay;
  late int? _start = widget.existing?.startMinutes;
  late int? _end = widget.existing?.endMinutes;
  late int? _year = widget.existing?.year ?? widget.initialYear;
  late String? _subjectId = widget.existing?.subjectId;
  late String? _teacherId = widget.existing?.teacherId;
  late String? _groupId = widget.existing?.groupId;
  late String? _departmentId = widget.existing?.departmentId;
  late final TextEditingController _notes =
      TextEditingController(text: widget.existing?.notes ?? '');

  bool _saving = false;
  bool _submitted = false;

  bool get _isEdit => widget.existing != null;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  // ---------- أدوات الاختيار ----------

  Future<_Picked<T>?> _pick<T>({
    required String title,
    required List<(T, String)> options,
    required T current,
    Future<T?> Function()? onAddNew,
    String? addLabel,
  }) {
    return showModalBottomSheet<_Picked<T>>(
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
                      Navigator.of(sheetContext).pop(_Picked<T>(created));
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
                            Navigator.of(sheetContext).pop(_Picked<T>(value)),
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

  Future<String?> Function() _quickAdd(LookupKind kind) => () async {
        final name = await askForText(context,
            title: 'إضافة ${kind.singularLabel}',
            hint: 'اكتب اسم ال${kind.singularLabel}');
        if (name == null || !mounted) return null;
        final scope = AppScope.read(context);
        try {
          final item = await scope.repository.addLookup(kind, name);
          await scope.schedule.load();
          if (mounted) setState(() {});
          return item.id;
        } catch (e) {
          if (mounted) {
            showMessage(context, AppException.from(e).message, error: true);
          }
          return null;
        }
      };

  Future<int?> _pickTime(int? current, int fallback) async {
    final base = current ?? fallback;
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: base ~/ 60, minute: base % 60),
      helpText: 'اختر الوقت',
      cancelText: 'إلغاء',
      confirmText: 'تم',
      builder: (ctx, child) => MediaQuery(
        data: MediaQuery.of(ctx).copyWith(alwaysUse24HourFormat: false),
        child: child!,
      ),
    );
    return t == null ? null : t.hour * 60 + t.minute;
  }

  String? _nameOf(ScheduleController c, LookupKind kind, String? id) {
    if (id == null) return null;
    for (final item in c.lookups(kind)) {
      if (item.id == id) return item.name;
    }
    return null;
  }

  // ---------- الحفظ ----------

  String? get _timeError {
    if (_start == null || _end == null) return null;
    if (_end! <= _start!) return 'وقت النهاية يجب أن يكون بعد وقت البداية';
    return null;
  }

  Future<void> _save() async {
    setState(() => _submitted = true);
    final missing = <String>[
      if (_day == null) 'اليوم',
      if (_start == null) 'وقت البداية',
      if (_end == null) 'وقت النهاية',
      if (_year == null) 'السنة',
      if (_subjectId == null) 'المادة',
      if (_teacherId == null) 'المدرس',
    ];
    if (missing.isNotEmpty) {
      showMessage(context, 'أكمل الحقول: ${missing.join('، ')}', error: true);
      return;
    }
    if (_timeError != null) {
      showMessage(context, _timeError!, error: true);
      return;
    }

    final draft = LectureDraft(
      id: widget.existing?.id,
      day: _day!,
      startMinutes: _start!,
      endMinutes: _end!,
      year: _year!,
      subjectId: _subjectId!,
      teacherId: _teacherId!,
      groupId: _groupId,
      departmentId:
          _year == AcademicYears.yearWithDepartments ? _departmentId : null,
      notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
    );

    final scope = AppScope.read(context);
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    final ok = await runWithFeedback(
      context,
      () async {
        await scope.repository.saveLecture(draft);
        await scope.schedule.load();
      },
      success: _isEdit ? 'تم حفظ التعديلات' : 'تمت إضافة المحاضرة',
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (ok) navigator.pop();
  }

  // ---------- الواجهة ----------

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).schedule;
    return ListenableBuilder(
      listenable: c,
      builder: (context, _) {
        final subjects = c.lookups(LookupKind.subject);
        final teachers = c.lookups(LookupKind.teacher);
        final groups = c.lookups(LookupKind.group);
        final departments = c.lookups(LookupKind.department);
        final hasDepartments = _year == AcademicYears.yearWithDepartments;

        return Scaffold(
          appBar: AppBar(
            title: Text(_isEdit ? 'تعديل محاضرة' : 'محاضرة جديدة'),
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
            children: [
              _Section(title: 'الموعد', children: [
                _Field(
                  icon: Icons.calendar_today,
                  label: 'اليوم',
                  value: _day?.arabicName,
                  showError: _submitted && _day == null,
                  onTap: () async {
                    final r = await _pick<WeekDay?>(
                      title: 'اختر اليوم',
                      current: _day,
                      options: [for (final d in WeekDay.values) (d, d.arabicName)],
                    );
                    if (r != null) setState(() => _day = r.value);
                  },
                ),
                Row(
                  children: [
                    Expanded(
                      child: _Field(
                        icon: Icons.schedule,
                        label: 'من',
                        value: _start == null ? null : formatTime12(_start!),
                        showError: _submitted && _start == null,
                        onTap: () async {
                          final t = await _pickTime(_start, 9 * 60);
                          if (t != null) setState(() => _start = t);
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _Field(
                        icon: Icons.schedule,
                        label: 'إلى',
                        value: _end == null ? null : formatTime12(_end!),
                        showError: (_submitted && _end == null) ||
                            _timeError != null,
                        onTap: () async {
                          final t = await _pickTime(
                              _end, (_start ?? 9 * 60) + 90);
                          if (t != null) setState(() => _end = t);
                        },
                      ),
                    ),
                  ],
                ),
                if (_timeError != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(_timeError!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error)),
                  ),
              ]),
              _Section(title: 'الطلاب', children: [
                _Field(
                  icon: Icons.school_outlined,
                  label: 'السنة الدراسية',
                  value: _year == null ? null : AcademicYears.name(_year!),
                  showError: _submitted && _year == null,
                  onTap: () async {
                    final r = await _pick<int?>(
                      title: 'اختر السنة',
                      current: _year,
                      options: [
                        for (final y in AcademicYears.values)
                          (y, AcademicYears.name(y)),
                      ],
                    );
                    if (r != null) {
                      setState(() {
                        _year = r.value;
                        if (_year != AcademicYears.yearWithDepartments) {
                          _departmentId = null;
                        }
                      });
                    }
                  },
                ),
                if (hasDepartments)
                  _Field(
                    icon: Icons.account_tree_outlined,
                    label: 'القسم',
                    value: _nameOf(c, LookupKind.department, _departmentId) ??
                        AcademicYears.allDepartmentsLabel,
                    onTap: () async {
                      final r = await _pick<String?>(
                        title: 'اختر القسم',
                        current: _departmentId,
                        options: [
                          (null, '${AcademicYears.allDepartmentsLabel} (مشتركة)'),
                          for (final d in departments) (d.id, d.name),
                        ],
                        onAddNew: _quickAdd(LookupKind.department),
                        addLabel: 'إضافة قسم جديد',
                      );
                      if (r != null) setState(() => _departmentId = r.value);
                    },
                  ),
                _Field(
                  icon: Icons.groups_outlined,
                  label: 'الفئة',
                  value: _nameOf(c, LookupKind.group, _groupId) ?? 'كل الفئات',
                  onTap: () async {
                    final r = await _pick<String?>(
                      title: 'اختر الفئة',
                      current: _groupId,
                      options: [
                        (null, 'كل الفئات (بدون فئة)'),
                        for (final g in groups) (g.id, 'فئة ${g.name}'),
                      ],
                      onAddNew: _quickAdd(LookupKind.group),
                      addLabel: 'إضافة فئة جديدة',
                    );
                    if (r != null) setState(() => _groupId = r.value);
                  },
                ),
              ]),
              _Section(title: 'المادة والمدرس', children: [
                _Field(
                  icon: Icons.menu_book_outlined,
                  label: 'المادة',
                  value: _nameOf(c, LookupKind.subject, _subjectId),
                  showError: _submitted && _subjectId == null,
                  onTap: () async {
                    final r = await _pick<String?>(
                      title: 'اختر المادة',
                      current: _subjectId,
                      options: [for (final s in subjects) (s.id, s.name)],
                      onAddNew: _quickAdd(LookupKind.subject),
                      addLabel: 'إضافة مادة جديدة',
                    );
                    if (r != null) setState(() => _subjectId = r.value);
                  },
                ),
                _Field(
                  icon: Icons.person_outline,
                  label: 'المدرس',
                  value: _nameOf(c, LookupKind.teacher, _teacherId),
                  showError: _submitted && _teacherId == null,
                  onTap: () async {
                    final r = await _pick<String?>(
                      title: 'اختر المدرس',
                      current: _teacherId,
                      options: [for (final t in teachers) (t.id, t.name)],
                      onAddNew: _quickAdd(LookupKind.teacher),
                      addLabel: 'إضافة مدرس جديد',
                    );
                    if (r != null) setState(() => _teacherId = r.value);
                  },
                ),
              ]),
              _Section(title: 'ملاحظات (اختياري)', children: [
                TextField(
                  controller: _notes,
                  maxLines: 2,
                  decoration: const InputDecoration(
                    hintText: 'مثال: القاعة 3',
                    border: OutlineInputBorder(),
                    filled: true,
                    fillColor: Colors.white,
                  ),
                ),
              ]),
            ],
          ),
          bottomNavigationBar: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(52)),
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.save),
                label: Text(_isEdit ? 'حفظ التعديلات' : 'إضافة المحاضرة'),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

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
class _Field extends StatelessWidget {
  const _Field({
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
