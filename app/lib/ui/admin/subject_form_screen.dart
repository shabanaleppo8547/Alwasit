import 'package:flutter/material.dart';

import '../../app_scope.dart';
import '../../models/academic_year.dart';
import '../../models/subject.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/form_widgets.dart';

/// إضافة مادة أو تعديلها: الاسم، السنة، القسم، الأستاذ، وروابط قنوات تيليغرام.
class SubjectFormScreen extends StatefulWidget {
  const SubjectFormScreen({super.key, this.existing});

  final Subject? existing;

  @override
  State<SubjectFormScreen> createState() => _SubjectFormScreenState();
}

/// حالة حقل رابط قناة واحدة (مشتركة أو لفئة).
class _ChannelField {
  _ChannelField({this.id, required String url, required this.enabled})
      : controller = TextEditingController(text: url);

  final String? id;
  final TextEditingController controller;
  bool enabled;
}

class _SubjectFormScreenState extends State<SubjectFormScreen> {
  late final TextEditingController _name =
      TextEditingController(text: widget.existing?.name ?? '');
  late int? _year = widget.existing?.year;
  late String? _departmentId = widget.existing?.departmentId;
  late String? _teacherId = widget.existing?.teacherId;

  /// المفتاح '' = القناة المشتركة، وإلا معرّف الفئة.
  final Map<String, _ChannelField> _channels = {};

  bool _saving = false;
  bool _submitted = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    for (final ch in widget.existing?.channels ?? const <Channel>[]) {
      _channels[ch.groupId ?? ''] =
          _ChannelField(id: ch.id, url: ch.url, enabled: ch.enabled);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    for (final f in _channels.values) {
      f.controller.dispose();
    }
    super.dispose();
  }

  _ChannelField _field(String key) =>
      _channels.putIfAbsent(key, () => _ChannelField(url: '', enabled: true));

  Future<void> _save() async {
    setState(() => _submitted = true);
    final name = _name.text.trim();
    final missing = <String>[
      if (name.isEmpty) 'اسم المادة',
      if (_year == null) 'السنة',
      if (_teacherId == null) 'الأستاذ',
    ];
    if (missing.isNotEmpty) {
      showMessage(context, 'أكمل الحقول: ${missing.join('، ')}', error: true);
      return;
    }
    final groupsAllowed = AcademicYears.allowsGroups(_year!);
    final channels = <Channel>[
      for (final e in _channels.entries)
        if (e.value.controller.text.trim().isNotEmpty &&
            (e.key.isEmpty || groupsAllowed))
          Channel(
            id: e.value.id,
            groupId: e.key.isEmpty ? null : e.key,
            url: e.value.controller.text.trim(),
            enabled: e.value.enabled,
          ),
    ];
    final subject = Subject(
      id: widget.existing?.id ?? '',
      name: name,
      year: _year!,
      departmentId: _year == AcademicYears.yearWithDepartments
          ? _departmentId
          : null,
      teacherId: _teacherId!,
      teacherName: '',
      channels: channels,
    );

    final scope = AppScope.read(context);
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    final ok = await runWithFeedback(
      context,
      () async {
        await scope.repository.saveSubject(subject);
        await scope.schedule.load();
      },
      success: _isEdit ? 'تم حفظ المادة' : 'تمت إضافة المادة',
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (ok) navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final c = AppScope.of(context).schedule;
    final groupsAllowed = _year != null && AcademicYears.allowsGroups(_year!);
    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'تعديل مادة' : 'مادة جديدة')),
      bottomNavigationBar: SaveBar(
        label: _isEdit ? 'حفظ المادة' : 'إضافة المادة',
        saving: _saving,
        onSave: _save,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          FormSection(title: 'بيانات المادة', children: [
            TextField(
              controller: _name,
              textInputAction: TextInputAction.next,
              decoration: adminInput('اسم المادة الرسمي',
                      prefix: const Icon(Icons.menu_book_outlined))
                  .copyWith(
                errorText: _submitted && _name.text.trim().isEmpty
                    ? 'الاسم مطلوب'
                    : null,
              ),
            ),
            PickerField(
              icon: Icons.school_outlined,
              label: 'السنة الدراسية',
              value: _year == null ? null : AcademicYears.name(_year!),
              showError: _submitted && _year == null,
              onTap: () async {
                final r = await showPicker<int?>(
                  context,
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
            if (_year == AcademicYears.yearWithDepartments)
              PickerField(
                icon: Icons.account_tree_outlined,
                label: 'القسم',
                value: c.nameOf(c.departments, _departmentId) == null
                    ? 'مشتركة بين جميع الأقسام'
                    : 'قسم ${c.nameOf(c.departments, _departmentId)}',
                onTap: () async {
                  final r = await showPicker<String?>(
                    context,
                    title: 'اختر القسم',
                    current: _departmentId,
                    options: [
                      (null, 'مشتركة بين جميع الأقسام'),
                      for (final d in c.departments) (d.id, 'قسم ${d.name}'),
                    ],
                  );
                  if (r != null) setState(() => _departmentId = r.value);
                },
              ),
            PickerField(
              icon: Icons.person_outline,
              label: 'الأستاذ المسؤول',
              value: c.snapshot?.teacherById(_teacherId)?.name,
              showError: _submitted && _teacherId == null,
              onTap: () async {
                final r = await showPicker<String?>(
                  context,
                  title: 'اختر الأستاذ',
                  current: _teacherId,
                  options: [for (final t in c.teachers) (t.id, t.name)],
                );
                if (r != null) setState(() => _teacherId = r.value);
              },
            ),
          ]),
          FormSection(title: 'قنوات تيليغرام للمادة', children: [
            const Text(
              'ضع رابط قناة المادة (وليس حساب الأستاذ الشخصي). '
              'إذا تُرك فارغًا تظهر للطلاب عبارة «رابط القناة سيُضاف قريبًا».',
              style: TextStyle(color: AppColors.muted, height: 1.4),
            ),
            _ChannelEditor(
              title: groupsAllowed
                  ? 'قناة مشتركة بين جميع الفئات'
                  : 'قناة المادة',
              field: _field(''),
              onChanged: () => setState(() {}),
            ),
            if (groupsAllowed)
              for (final g in c.groups)
                _ChannelEditor(
                  title: 'قناة خاصة بالفئة ${g.name} (اختياري)',
                  field: _field(g.id),
                  onChanged: () => setState(() {}),
                ),
            if (groupsAllowed)
              const Text(
                'طالب الفئة يرى قناة فئته إن وُجدت، وإلا القناة المشتركة.',
                style: TextStyle(color: AppColors.muted, fontSize: 12),
              ),
          ]),
        ],
      ),
    );
  }
}

class _ChannelEditor extends StatelessWidget {
  const _ChannelEditor({
    required this.title,
    required this.field,
    required this.onChanged,
  });

  final String title;
  final _ChannelField field;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final hasUrl = field.controller.text.trim().isNotEmpty;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: field.controller,
            keyboardType: TextInputType.url,
            textDirection: TextDirection.ltr,
            onChanged: (_) => onChanged(),
            decoration: InputDecoration(
              hintText: 'https://t.me/...',
              prefixIcon: const Icon(Icons.telegram),
              border: const OutlineInputBorder(),
              isDense: true,
              suffixIcon: hasUrl
                  ? IconButton(
                      tooltip: 'حذف الرابط',
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        field.controller.clear();
                        onChanged();
                      },
                    )
                  : null,
            ),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('الرابط مفعّل للطلاب'),
            subtitle: Text(
              !hasUrl
                  ? 'لا يوجد رابط بعد'
                  : field.enabled
                      ? 'يظهر زر الانتقال للطلاب'
                      : 'معطّل مؤقتًا: يظهر «رابط القناة سيُضاف قريبًا»',
              style: const TextStyle(fontSize: 12),
            ),
            value: field.enabled,
            onChanged: hasUrl
                ? (v) {
                    field.enabled = v;
                    onChanged();
                  }
                : null,
          ),
        ],
      ),
    );
  }
}
