/// تنسيق الوقت بنظام 12 ساعة (ص / م).
///
/// الوقت يُمثَّل داخليًا بعدد الدقائق منذ منتصف الليل (0 – 1439).

String _period(int minutes) => (minutes ~/ 60) < 12 ? 'ص' : 'م';

String _clock(int minutes) {
  final h24 = (minutes ~/ 60) % 24;
  final m = minutes % 60;
  var h = h24 % 12;
  if (h == 0) h = 12;
  return '$h:${m.toString().padLeft(2, '0')}';
}

/// مثال: 990 → «4:30 م»
String formatTime12(int minutes) => '${_clock(minutes)} ${_period(minutes)}';

/// مثال: 4:30 م إلى 7:00 م → «4:30 - 7:00 م»
/// ومن 11:00 ص إلى 1:00 م → «11:00 ص - 1:00 م»
String formatRange12(int start, int end) {
  if (_period(start) == _period(end)) {
    return '${_clock(start)} - ${_clock(end)} ${_period(end)}';
  }
  return '${formatTime12(start)} - ${formatTime12(end)}';
}

/// يقرأ «16:30» أو «16:30:00» القادمة من قاعدة البيانات.
int parseDbTime(String value) {
  final parts = value.trim().split(':');
  if (parts.length < 2) {
    throw FormatException('صيغة وقت غير صالحة: $value');
  }
  final h = int.parse(parts[0]);
  final m = int.parse(parts[1]);
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    throw FormatException('وقت خارج النطاق: $value');
  }
  return h * 60 + m;
}

/// يكتب الوقت بصيغة «HH:MM» لحفظه في قاعدة البيانات.
String toDbTime(int minutes) {
  final h = (minutes ~/ 60).toString().padLeft(2, '0');
  final m = (minutes % 60).toString().padLeft(2, '0');
  return '$h:$m';
}
