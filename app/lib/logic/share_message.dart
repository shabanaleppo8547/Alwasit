import '../config/app_config.dart';
import '../core/time_format.dart';
import '../models/academic_year.dart';
import '../models/lecture.dart';
import '../models/week_day.dart';
import 'schedule_filter.dart';

/// يبني رسالة مواعيد اليوم بالتنسيق المعتمد لواتساب.
///
/// النجوم *...* تجعل النص عريضًا في واتساب.
class ShareMessageBuilder {
  const ShareMessageBuilder._();

  /// [lectures] محاضرات اليوم بعد الفلترة.
  /// [includeYear] يُضاف اسم السنة عند مشاركة «جميع السنوات»
  /// حتى لا تختلط محاضرات السنوات ببعضها.
  static String buildDay({
    required WeekDay day,
    required List<Lecture> lectures,
    required bool includeYear,
  }) {
    final sorted = [...lectures]..sort(ScheduleFilter.compare);
    final b = StringBuffer()
      ..writeln('🟡 *مواعيد يوم ${day.arabicName}*')
      ..writeln('في:')
      ..writeln('👑 *${AppConfig.centerName}* 👑');

    if (sorted.isEmpty) {
      b
        ..writeln()
        ..writeln('لا توجد محاضرات في هذا اليوم.');
      return b.toString().trimRight();
    }

    for (final slot in ScheduleFilter.exactSlots(sorted)) {
      b
        ..writeln()
        ..writeln('🕒 *${formatRange12(slot.startMinutes, slot.endMinutes)}*:');
      for (final l in slot.lectures) {
        b.writeln('∆ ${l.subjectName}${details(l, includeYear: includeYear)}');
      }
    }
    return b.toString().trimRight();
  }

  /// النص بين القوسين: (السنة، الفئة، القسم) حسب الحاجة.
  static String details(Lecture l, {required bool includeYear}) {
    final parts = <String>[
      if (includeYear) AcademicYears.name(l.year),
      if (l.groupName != null && l.groupName!.trim().isNotEmpty)
        'فئة ${l.groupName!.trim()}',
      if (l.departmentName != null && l.departmentName!.trim().isNotEmpty)
        l.departmentName!.trim(),
    ];
    return parts.isEmpty ? '' : ' (${parts.join('، ')})';
  }
}
