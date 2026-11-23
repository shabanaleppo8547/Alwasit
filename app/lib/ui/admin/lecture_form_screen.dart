import 'package:flutter/material.dart';

import '../../app_scope.dart';
import '../../core/arabic_text.dart';
import '../../core/time_format.dart';
import '../../models/academic_year.dart';
import '../../models/lecture.dart';
import '../../models/subject.dart';
import '../../models/week_day.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/form_widgets.dart';

/// إضافة موعد أو تعديله. السنة والأستاذ والقسم تُستمد من المادة.
class LectureFormScreen extends StatefulWidget {
  const LectureFormScreen({super.key, this.existing, this.initialDay});

  final Lecture? existing;
  final WeekDay? initialDay;

  @override
  State<LectureFormScreen> createState() => _LectureFormScreenState();
}

class _LectureFormScreenState extends State<LectureFormScreen> {
  late WeekDay? _day = widget.existing?.day ?? widget.initialDay;
  late int? _start = widget.existing?.startMinutes;
  late int? _end = widget.existing?.endMinutes;
  late String? _subjectId = widget.existing?.subjectId;
  late String? _groupId = widget.existing?.groupId;
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

  static String subjectLabel(Subject s) {
    final scope = [
      AcademicYears.shortName(s.year),
      if (s.departmentName != null) s.departmentName!,
    ].join(' – ');
    return '${bidiSafe(s.name)}  ($scope)';
  }

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
      if (_subjectId == null) 'المادة',
    ];
    if (missing.isNotEmpty) {
      showMessage(context, 'أكمل الحقول: ${missing.join('، ')}', error: true);
      return;
    }
    if (_timeError != null) {
      showMessage(context, _timeError!, error: true);
      return;
    }
    final scope = AppScope.read(context);
    final subject = scope.schedule.snapshot?.subjectById(_subjectId);
    final draft = LectureDraft(
      id: widget.existing?.id,
      day: _day!,
      startMinutes: _start!,
      endMinutes: _end!,
      subjectId: _subjectId!,
      groupId: subject != null && AcademicYears.allowsGroups(subject.year)
          ? _groupId
          : null,
      notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
    );

    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    final ok = await runWithFeedback(
      context,
      () async {
        await scope.repository.saveLecture(draft);
        await scope.schedule.load();
      },
      success: _isEdit ? 'تم حفظ التعديلات' : 'تمت إضافة الموعد',
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (ok) navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).schedule;
    return ListenableBuilder(
      listenable: c,
      builder: (context, _) {
        final subject = c.snapshot?.subjectById(_subjectId);
        final groupsAllowed =
            subject != null && AcademicYears.allowsGroups(subject.year);
        final sortedSubjects = [...c.subjects]
          ..sort((a, b) {
            final y = a.year.compareTo(b.year);
            return y != 0 ? y : a.name.compareTo(b.name);
          });

        return Scaffold(
          appBar: AppBar(title: Text(_isEdit ? 'تعديل موعد' : 'موعد جديد')),
          bottomNavigationBar: SaveBar(
            label: _isEdit ? 'حفظ التعديلات' : 'إضافة الموعد',
            saving: _saving,
            onSave: _save,
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
            children: [
              FormSection(title: 'المادة', children: [
                PickerField(
                  icon: Icons.menu_book_outlined,
                  label: 'المادة',
                  value: subject == null ? null : subjectLabel(subject),
                  showError: _submitted && _subjectId == null,
                  onTap: () async {
                    final r = await showPicker<String?>(
                      context,
                      title: 'اختر المادة',
                      current: _subjectId,
                      options: [
                        for (final s in sortedSubjects) (s.id, subjectLabel(s)),
                      ],
                    );
                    if (r != null) setState(() => _subjectId = r.value);
                  },
                ),
                if (subject != null)
                  Text(
                    'الأستاذ ${subject.teacherName} · ${AcademicYears.name(subject.year)}'
                    '${subject.departmentName == null ? '' : ' · قسم ${subject.departmentName}'}',
                    style: const TextStyle(color: AppColors.muted),
                  ),
                if (c.subjects.isEmpty)
                  const Text('أضف المواد أولًا من تبويب «المواد».',
                      style: TextStyle(color: AppColors.muted)),
              ]),
              FormSection(title: 'الموعد', children: [
                PickerField(
                  icon: Icons.calendar_today,
                  label: 'اليوم',
                  value: _day?.arabicName,
                  showError: _submitted && _day == null,
                  onTap: () async {
                    final r = await showPicker<WeekDay?>(
                      context,
                      title: 'اختر اليوم',
                      current: _day,
                      options: [
                        for (final d in WeekDay.values) (d, d.arabicName)
                      ],
                    );
                    if (r != null) setState(() => _day = r.value);
                  },
                ),
                Row(
                  children: [
                    Expanded(
                      child: PickerField(
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
                      child: PickerField(
                        icon: Icons.schedule,
                        label: 'إلى',
                        value: _end == null ? null : formatTime12(_end!),
                        showError:
                            (_submitted && _end == null) || _timeError != null,
                        onTap: () async {
                          final t =
                              await _pickTime(_end, (_start ?? 9 * 60) + 120);
                          if (t != null) setState(() => _end = t);
                        },
                      ),
                    ),
                  ],
                ),
                if (_timeError != null)
                  Text(_timeError!,
                      style:
                          TextStyle(color: Theme.of(context).colorScheme.error)),
              ]),
              if (groupsAllowed && c.groups.isNotEmpty)
                FormSection(title: 'الفئة', children: [
                  PickerField(
                    icon: Icons.groups_outlined,
                    label: 'الفئة',
                    value: c.nameOf(c.groups, _groupId) == null
                        ? 'مشتركة بين جميع الفئات'
                        : 'الفئة ${c.nameOf(c.groups, _groupId)}',
                    onTap: () async {
                      final r = await showPicker<String?>(
                        context,
                        title: 'لمن هذا الموعد؟',
                        current: _groupId,
                        options: [
                          (null, 'مشتركة بين جميع الفئات'),
                          for (final g in c.groups) (g.id, 'الفئة ${g.name}'),
                        ],
                      );
                      if (r != null) setState(() => _groupId = r.value);
                    },
                  ),
                ]),
              FormSection(title: 'ملاحظات (اختياري)', children: [
                TextField(
                  controller: _notes,
                  maxLines: 2,
                  decoration: adminInput('ملاحظات', hint: 'مثال: القاعة 3'),
                ),
              ]),
            ],
          ),
        );
      },
    );
  }
}
