/// القوائم التي يديرها المسؤول.
enum LookupKind {
  subject('subjects', 'المواد', 'مادة'),
  teacher('teachers', 'المدرسون', 'مدرس'),
  group('class_groups', 'الفئات', 'فئة'),
  department('departments', 'أقسام السنة الرابعة', 'قسم');

  const LookupKind(this.table, this.pluralLabel, this.singularLabel);

  /// اسم الجدول في قاعدة البيانات.
  final String table;
  final String pluralLabel;
  final String singularLabel;
}

/// عنصر في قائمة (مادة، مدرس، فئة، قسم).
class LookupItem {
  const LookupItem({required this.id, required this.name});

  final String id;
  final String name;

  factory LookupItem.fromJson(Map<String, dynamic> json) => LookupItem(
        id: json['id'].toString(),
        name: (json['name'] ?? '').toString(),
      );

  Map<String, dynamic> toJson() => {'id': id, 'name': name};

  @override
  bool operator ==(Object other) =>
      other is LookupItem && other.id == id && other.name == name;

  @override
  int get hashCode => Object.hash(id, name);
}
