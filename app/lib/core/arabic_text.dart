final RegExp _diacritics = RegExp('[ً-ْٰـ]');
final RegExp _alef = RegExp('[أإآٱ]');
final RegExp _spaces = RegExp(r'\s+');

/// توحيد النص العربي للبحث: يتجاهل التشكيل والتطويل واختلاف
/// الهمزات والتاء المربوطة والألف المقصورة وحالة الأحرف اللاتينية.
String normalizeArabic(String input) {
  return input
      .toLowerCase()
      .replaceAll(_diacritics, '')
      .replaceAll(_alef, 'ا')
      .replaceAll('ة', 'ه')
      .replaceAll('ى', 'ي')
      .replaceAll(_spaces, ' ')
      .trim();
}

/// صيغة العدد الصحيحة لكلمة «محاضرة».
String lectureCountLabel(int n) {
  if (n == 0) return 'لا محاضرات';
  if (n == 1) return 'محاضرة واحدة';
  if (n == 2) return 'محاضرتان';
  if (n >= 3 && n <= 10) return '$n محاضرات';
  return '$n محاضرة';
}

final RegExp _latinEndingWithSymbol = RegExp(r'([A-Za-z][A-Za-z0-9]*[+#]+)(?!‎)');

/// يمنع ظهور «C++» بالشكل «++C» داخل نص عربي، بإضافة علامة اتجاه
/// غير مرئية (U+200E) بعد الكلمة اللاتينية المنتهية برمز.
String bidiSafe(String s) =>
    s.replaceAllMapped(_latinEndingWithSymbol, (m) => '${m[1]}‎');
