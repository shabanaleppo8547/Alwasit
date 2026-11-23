/// قناة تيليغرام لمادة. groupId == null تعني قناة مشتركة بين الفئات.
class Channel {
  const Channel({
    this.id,
    this.groupId,
    this.groupName,
    required this.url,
    this.enabled = true,
  });

  final String? id;
  final String? groupId;
  final String? groupName;
  final String url;
  final bool enabled;

  /// القناة صالحة للاستخدام: لها رابط ومفعّلة.
  bool get isUsable => enabled && url.trim().isNotEmpty;

  factory Channel.fromJson(Map<String, dynamic> j) => Channel(
        id: j['id'] as String?,
        groupId: j['groupId'] as String?,
        groupName: j['groupName'] as String?,
        url: (j['url'] as String?) ?? '',
        enabled: j['enabled'] != false,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'groupId': groupId,
        'groupName': groupName,
        'url': url,
        'enabled': enabled,
      };
}

/// مادة رسمية: اسمها وسنتها وقسمها وأستاذها وقنواتها.
/// تظهر في «الحضور أونلاين» حتى لو لم يكن لها موعد.
class Subject {
  const Subject({
    required this.id,
    required this.name,
    required this.year,
    this.departmentId,
    this.departmentName,
    required this.teacherId,
    required this.teacherName,
    this.channels = const [],
  });

  final String id;
  final String name;
  final int year;
  final String? departmentId;
  final String? departmentName;
  final String teacherId;
  final String teacherName;
  final List<Channel> channels;

  Channel? channelFor(String? groupId) {
    for (final c in channels) {
      if (c.groupId == groupId) return c;
    }
    return null;
  }

  factory Subject.fromJson(Map<String, dynamic> j) => Subject(
        id: j['id'] as String,
        name: j['name'] as String,
        year: (j['year'] as num).toInt(),
        departmentId: j['departmentId'] as String?,
        departmentName: j['departmentName'] as String?,
        teacherId: j['teacherId'] as String,
        teacherName: (j['teacherName'] as String?) ?? '—',
        channels: ((j['channels'] as List?) ?? const [])
            .map((e) => Channel.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'year': year,
        'departmentId': departmentId,
        'departmentName': departmentName,
        'teacherId': teacherId,
        'teacherName': teacherName,
        'channels': channels.map((c) => c.toJson()).toList(),
      };
}
