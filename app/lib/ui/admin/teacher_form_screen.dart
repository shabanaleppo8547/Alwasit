import 'package:flutter/material.dart';

import '../../app_scope.dart';
import '../../models/teacher.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/form_widgets.dart';

/// إضافة أستاذ أو تعديله مع وسائل تواصله (واتساب، تيليغرام، فيسبوك، ...).
class TeacherFormScreen extends StatefulWidget {
  const TeacherFormScreen({super.key, this.existing});

  final Teacher? existing;

  @override
  State<TeacherFormScreen> createState() => _TeacherFormScreenState();
}

class _ContactRow {
  _ContactRow({this.id, required this.type, String value = '', String? label})
      : value = TextEditingController(text: value),
        label = TextEditingController(text: label ?? '');

  final String? id;
  ContactType type;
  final TextEditingController value;
  final TextEditingController label;

  void dispose() {
    value.dispose();
    label.dispose();
  }
}

class _TeacherFormScreenState extends State<TeacherFormScreen> {
  late final TextEditingController _name =
      TextEditingController(text: widget.existing?.name ?? '');
  late final List<_ContactRow> _rows = [
    for (final c in widget.existing?.contacts ?? const <Contact>[])
      _ContactRow(id: c.id, type: c.type, value: c.value, label: c.label),
  ];
  bool _saving = false;

  bool get _isEdit => widget.existing != null;

  @override
  void initState() {
    super.initState();
    if (_rows.isEmpty) {
      _rows.addAll([
        _ContactRow(type: ContactType.whatsapp),
        _ContactRow(type: ContactType.telegram),
        _ContactRow(type: ContactType.facebook),
      ]);
    }
  }

  @override
  void dispose() {
    _name.dispose();
    for (final r in _rows) {
      r.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      showMessage(context, 'اكتب اسم الأستاذ.', error: true);
      return;
    }
    final teacher = Teacher(
      id: widget.existing?.id ?? '',
      name: name,
      contacts: [
        for (final r in _rows)
          if (r.value.text.trim().isNotEmpty)
            Contact(
              id: r.id,
              type: r.type,
              value: r.value.text.trim(),
              label: r.label.text.trim().isEmpty ? null : r.label.text.trim(),
            ),
      ],
    );
    final scope = AppScope.read(context);
    final navigator = Navigator.of(context);
    setState(() => _saving = true);
    final ok = await runWithFeedback(
      context,
      () async {
        await scope.repository.saveTeacher(teacher);
        await scope.schedule.load();
      },
      success: _isEdit ? 'تم حفظ بيانات الأستاذ' : 'تمت إضافة الأستاذ',
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (ok) navigator.pop();
  }

  Future<void> _addContact() async {
    final r = await showPicker<ContactType?>(
      context,
      title: 'نوع وسيلة التواصل',
      current: null,
      options: [for (final t in ContactType.values) (t, t.label)],
    );
    final type = r?.value;
    if (type == null) return;
    setState(() => _rows.add(_ContactRow(type: type)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEdit ? 'تعديل أستاذ' : 'أستاذ جديد')),
      bottomNavigationBar: SaveBar(
        label: _isEdit ? 'حفظ' : 'إضافة الأستاذ',
        saving: _saving,
        onSave: _save,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
        children: [
          FormSection(title: 'الاسم', children: [
            TextField(
              controller: _name,
              decoration: adminInput('اسم الأستاذ',
                  prefix: const Icon(Icons.person_outline)),
            ),
          ]),
          FormSection(title: 'وسائل التواصل', children: [
            const Text(
              'واتساب والاتصال: اكتب الرقم مع رمز الدولة (مثل 963935350049). '
              'تيليغرام وفيسبوك: الصق رابط الحساب الشخصي.',
              style: TextStyle(color: AppColors.muted, height: 1.4),
            ),
            for (var i = 0; i < _rows.length; i++)
              _ContactEditor(
                key: ObjectKey(_rows[i]),
                row: _rows[i],
                onRemove: () {
                  final removed = _rows[i];
                  setState(() => _rows.removeAt(i));
                  // التخلص بعد إزالة الحقل من الشاشة.
                  WidgetsBinding.instance
                      .addPostFrameCallback((_) => removed.dispose());
                },
              ),
            OutlinedButton.icon(
              onPressed: _addContact,
              icon: const Icon(Icons.add),
              label: const Text('إضافة وسيلة تواصل'),
            ),
          ]),
        ],
      ),
    );
  }
}

class _ContactEditor extends StatelessWidget {
  const _ContactEditor({super.key, required this.row, required this.onRemove});

  final _ContactRow row;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final isPhone = row.type.isPhone;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 6, 4, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(row.type.label,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
              IconButton(
                tooltip: 'حذف',
                icon: const Icon(Icons.delete_outline),
                color: Theme.of(context).colorScheme.error,
                onPressed: onRemove,
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 8),
            child: TextField(
              controller: row.value,
              keyboardType: isPhone ? TextInputType.phone : TextInputType.url,
              textDirection: TextDirection.ltr,
              decoration: InputDecoration(
                hintText: isPhone ? '963935350049' : 'https://...',
                border: const OutlineInputBorder(),
                isDense: true,
              ),
            ),
          ),
          if (row.type == ContactType.other) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: TextField(
                controller: row.label,
                decoration: const InputDecoration(
                  hintText: 'اسم الوسيلة (مثل: إنستغرام)',
                  border: OutlineInputBorder(),
                  isDense: true,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
