/// السنوات الدراسية. القيمة null في الفلاتر تعني «جميع السنوات».
class AcademicYears {
  const AcademicYears._();

  static const List<int> values = [1, 2, 3, 4];

  /// السنة التي تنقسم إلى أقسام (الجبر، التحليل، التطبيقية).
  static const int yearWithDepartments = 4;

  static const String allLabel = 'جميع السنوات';
  static const String allDepartmentsLabel = 'جميع الأقسام';

  static String name(int year) {
    switch (year) {
      case 1:
        return 'السنة الأولى';
      case 2:
        return 'السنة الثانية';
      case 3:
        return 'السنة الثالثة';
      case 4:
        return 'السنة الرابعة';
      default:
        return 'السنة $year';
    }
  }
}
