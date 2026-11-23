/// نوع وسيلة التواصل مع الأستاذ.
enum ContactType {
  whatsapp('واتساب'),
  telegram('تيليغرام'),
  facebook('فيسبوك'),
  phone('اتصال هاتفي'),
  other('رابط آخر');

  const ContactType(this.label);

  final String label;

  static ContactType fromKey(String? key) {
    for (final t in ContactType.values) {
      if (t.name == key) return t;
    }
    return ContactType.other;
  }

  /// رقم هاتف (واتساب/اتصال) أم رابط.
  bool get isPhone => this == ContactType.whatsapp || this == ContactType.phone;
}

class Contact {
  const Contact({this.id, required this.type, required this.value, this.label});

  final String? id;
  final ContactType type;

  /// رقم بصيغة دولية بلا + (مثل 963935350049) أو رابط https.
  final String value;

  /// اسم اختياري يظهر بدل اسم النوع.
  final String? label;

  String get displayLabel =>
      (label != null && label!.trim().isNotEmpty) ? label!.trim() : type.label;

  factory Contact.fromJson(Map<String, dynamic> j) => Contact(
        id: j['id'] as String?,
        type: ContactType.fromKey(j['type'] as String?),
        value: (j['value'] as String?) ?? '',
        label: j['label'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'value': value,
        'label': label,
      };
}

class Teacher {
  const Teacher({required this.id, required this.name, this.contacts = const []});

  final String id;
  final String name;
  final List<Contact> contacts;

  factory Teacher.fromJson(Map<String, dynamic> j) => Teacher(
        id: j['id'] as String,
        name: j['name'] as String,
        contacts: ((j['contacts'] as List?) ?? const [])
            .map((e) => Contact.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'contacts': contacts.map((c) => c.toJson()).toList(),
      };
}
