/// القوائم البسيطة التي يديرها المسؤول (بالاسم فقط).
enum LookupKind {
  group('الفئات', 'فئة'),
  department('أقسام السنة الرابعة', 'قسم');

  const LookupKind(this.pluralLabel, this.singularLabel);

  final String pluralLabel;
  final String singularLabel;
}

/// عنصر بسيط: فئة أو قسم.
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
