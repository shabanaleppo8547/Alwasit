/// السنوات الدراسية. القيمة null في الفلاتر تعني «جميع السنوات».
class AcademicYears {
  const AcademicYears._();

  static const List<int> values = [1, 2, 3, 4];

  /// السنة المقسّمة إلى أقسام (الجبر، التحليل، التطبيقية).
  static const int yearWithDepartments = 4;

  /// السنة المقسّمة إلى فئات (A، B). لا فئات في الثالثة ولا الرابعة.
  static const int yearWithGroups = 2;

  /// السنوات التي يسمح الخادم فيها بالفئات (الأولى جاهزة للمستقبل).
  static const List<int> yearsAllowingGroups = [1, 2];

  static const String allLabel = 'جميع السنوات';
  static const String allDepartmentsLabel = 'جميع الأقسام';
  static const String allGroupsLabel = 'جميع الفئات';

  static bool allowsGroups(int year) => yearsAllowingGroups.contains(year);

  /// «السنة الثانية»
  static String name(int year) => 'السنة ${_ordinalFem(year)}';

  /// «سنة ثانية» (للرسائل المختصرة)
  static String shortName(int year) {
    final o = _ordinalFem(year);
    return 'سنة ${o.startsWith('ال') ? o.substring(2) : o}';
  }

  static String _ordinalFem(int year) {
    switch (year) {
      case 1:
        return 'الأولى';
      case 2:
        return 'الثانية';
      case 3:
        return 'الثالثة';
      case 4:
        return 'الرابعة';
      default:
        return '$year';
    }
  }

  /// «التطبيقية» → «تطبيقية»
  static String shortDepartment(String name) {
    final n = name.trim();
    return n.startsWith('ال') && n.length > 3 ? n.substring(2) : n;
  }
}
