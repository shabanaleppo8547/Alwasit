/// أيام الأسبوع بالترتيب المعتمد في الجدول (يبدأ بالسبت).
enum WeekDay {
  saturday('السبت'),
  sunday('الأحد'),
  monday('الإثنين'),
  tuesday('الثلاثاء'),
  wednesday('الأربعاء'),
  thursday('الخميس'),
  friday('الجمعة');

  const WeekDay(this.arabicName);

  final String arabicName;

  /// المفتاح المحفوظ في قاعدة البيانات، مثل «tuesday».
  String get key => name;

  static WeekDay fromKey(String key) {
    final k = key.trim().toLowerCase();
    for (final d in WeekDay.values) {
      if (d.name == k) return d;
    }
    throw FormatException('يوم غير معروف: $key');
  }

  static WeekDay fromDate(DateTime date) {
    switch (date.weekday) {
      case DateTime.saturday:
        return WeekDay.saturday;
      case DateTime.sunday:
        return WeekDay.sunday;
      case DateTime.monday:
        return WeekDay.monday;
      case DateTime.tuesday:
        return WeekDay.tuesday;
      case DateTime.wednesday:
        return WeekDay.wednesday;
      case DateTime.thursday:
        return WeekDay.thursday;
      default:
        return WeekDay.friday;
    }
  }
}
