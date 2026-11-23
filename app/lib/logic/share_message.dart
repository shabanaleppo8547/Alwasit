import '../config/app_config.dart';
import '../core/time_format.dart';
import '../models/academic_year.dart';
import '../models/lecture.dart';
import '../models/week_day.dart';
import 'schedule_filter.dart';

/// رسالة واتساب للجدول المعروض، تتغير تلقائيًا حسب الفلاتر.
///
/// كل سطر بين نجمتين *...* ليظهر عريضًا في واتساب.
class ShareMessageBuilder {
  const ShareMessageBuilder._();

  static const String emptyText = 'لا توجد محاضرات ضمن الاختيارات المحددة';

  /// [lectures] المحاضرات المعروضة بعد الفلترة.
  /// [audience] نص النطاق، مثل «لجميع السنوات» (من ScopeText.audience).
  /// [day] null عند عرض جميع الأيام.
  /// [showYear] يُذكر سنة كل مادة عند عرض جميع السنوات.
  /// [showDepartment] يُذكر القسم عند عرض جميع الأقسام.
  /// [allGroupsLabel] مثل «A وB» للمحاضرات المشتركة بين الفئات.
  static String build({
    required List<Lecture> lectures,
    required WeekDay? day,
    required String audience,
    required bool showYear,
    required bool showDepartment,
    required String allGroupsLabel,
    DateTime? now,
  }) {
    final hour = (now ?? DateTime.now()).hour;
    final lines = <String>[
      hour < 12 ? 'صباح الخير جميعاً😍' : 'مساء الخير جميعاً😍',
      '🟡 مواعيد ${ScopeText.days(day)}',
      audience,
      'في:',
      '👑 ${AppConfig.centerName} 👑',
    ];

    final sorted = [...lectures]..sort(ScheduleFilter.compare);
    if (sorted.isEmpty) {
      lines.add(emptyText);
    } else {
      final byDay = ScheduleFilter.byDay(sorted);
      for (final entry in byDay.entries) {
        if (day == null) lines.add('📅 يوم ${entry.key.arabicName}');
        for (final slot in ScheduleFilter.exactSlots(entry.value)) {
          lines.add('🕒 ${formatRangeBare(slot.startMinutes, slot.endMinutes)}:');
          for (final l in slot.lectures) {
            lines.add('∆ ${l.subjectName}${details(
              l,
              showYear: showYear,
              showDepartment: showDepartment,
              allGroupsLabel: allGroupsLabel,
            )}');
          }
        }
      }
    }
    lines.add('بالتوفيق للجميع❤️');
    return lines.map((l) => '*$l*').join('\n\n');
  }

  /// التفاصيل بين القوسين: (سنة رابعة، تطبيقية) أو (فئة A).
  static String details(
    Lecture l, {
    required bool showYear,
    required bool showDepartment,
    required String allGroupsLabel,
  }) {
    final parts = <String>[
      if (showYear) AcademicYears.shortName(l.year),
      if (l.groupName != null && l.groupName!.trim().isNotEmpty)
        'فئة ${l.groupName!.trim()}'
      else if (l.year == AcademicYears.yearWithGroups &&
          allGroupsLabel.isNotEmpty)
        allGroupsLabel,
      if (showDepartment &&
          l.departmentName != null &&
          l.departmentName!.trim().isNotEmpty)
        AcademicYears.shortDepartment(l.departmentName!),
    ];
    return parts.isEmpty ? '' : ' (${parts.join('، ')})';
  }
}
