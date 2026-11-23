import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../config/app_config.dart';
import '../core/time_format.dart';
import '../logic/schedule_filter.dart';
import '../models/academic_year.dart';
import '../models/lecture.dart';
import '../models/week_day.dart';

/// ملف PDF حقيقي (نص عربي قابل للتحديد والنسخ، وليس صورة) بحجم A4.
class PdfExport {
  const PdfExport._();

  static const _navy = PdfColor.fromInt(0xFF14213D);
  static const _gold = PdfColor.fromInt(0xFFE3A72F);
  static const _paper = PdfColor.fromInt(0xFFF7F4EE);
  static const _line = PdfColor.fromInt(0xFFE3DED3);
  static const _muted = PdfColor.fromInt(0xFF5F6B7E);

  static const _crownSvg = '''
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
<path fill="#E3A72F" d="M2 7l5 4 5-7 5 7 5-4-2 12H4z"/>
<rect fill="#E3A72F" x="4" y="20" width="16" height="2" rx="1"/>
</svg>''';

  static pw.Font? _regular;
  static pw.Font? _bold;

  static Future<void> _loadFonts() async {
    _regular ??=
        pw.Font.ttf(await rootBundle.load('assets/fonts/DejaVuSans.ttf'));
    _bold ??=
        pw.Font.ttf(await rootBundle.load('assets/fonts/DejaVuSans-Bold.ttf'));
  }

  /// [title] مثل «مواعيد يوم الأربعاء – لجميع السنوات».
  static Future<Uint8List> build({
    required String title,
    required List<Lecture> lectures,
    required bool showYear,
    required bool showDepartment,
    required String allGroupsLabel,
    DateTime? generatedAt,
  }) async {
    await _loadFonts();
    final doc = pw.Document(
      title: '${AppConfig.centerName} - $title',
      author: AppConfig.centerName,
      theme: pw.ThemeData.withFont(base: _regular, bold: _bold),
    );

    final sorted = [...lectures]..sort(ScheduleFilter.compare);
    final byDay = ScheduleFilter.byDay(sorted);
    final when = generatedAt ?? DateTime.now();

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        textDirection: pw.TextDirection.rtl,
        margin: const pw.EdgeInsets.fromLTRB(32, 28, 32, 28),
        header: (ctx) => ctx.pageNumber == 1
            ? _header(title)
            : pw.Container(
                alignment: pw.Alignment.centerRight,
                margin: const pw.EdgeInsets.only(bottom: 10),
                child: pw.Text('${AppConfig.centerName} – $title',
                    style: const pw.TextStyle(fontSize: 9, color: _muted)),
              ),
        footer: (ctx) => pw.Container(
          margin: const pw.EdgeInsets.only(top: 10),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text('صفحة ${ctx.pageNumber} من ${ctx.pagesCount}',
                  style: const pw.TextStyle(fontSize: 9, color: _muted)),
              pw.Text(
                  'تاريخ الإصدار: ${when.year}/${when.month}/${when.day}',
                  style: const pw.TextStyle(fontSize: 9, color: _muted)),
            ],
          ),
        ),
        build: (ctx) {
          if (sorted.isEmpty) {
            return [
              pw.SizedBox(height: 40),
              pw.Center(
                child: pw.Text('لا توجد محاضرات ضمن الاختيارات المحددة',
                    style: const pw.TextStyle(fontSize: 14, color: _muted)),
              ),
            ];
          }
          final widgets = <pw.Widget>[];
          for (final entry in byDay.entries) {
            final rows = entry.value
                .map((l) => _row(l,
                    showYear: showYear,
                    showDepartment: showDepartment,
                    allGroupsLabel: allGroupsLabel))
                .toList();
            // عنوان اليوم مع أول محاضرة في كتلة واحدة حتى لا ينفصلا بين صفحتين.
            widgets.add(pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.stretch,
              children: [_dayHeader(entry.key, entry.value.length), rows.first],
            ));
            widgets.addAll(rows.skip(1));
            widgets.add(pw.SizedBox(height: 10));
          }
          return widgets;
        },
      ),
    );
    return doc.save();
  }

  static pw.Widget _header(String title) {
    final crown = pw.SvgImage(svg: _crownSvg, width: 22, height: 22);
    return pw.Container(
      margin: const pw.EdgeInsets.only(bottom: 16),
      padding: const pw.EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      decoration: const pw.BoxDecoration(
        color: _navy,
        borderRadius: pw.BorderRadius.all(pw.Radius.circular(10)),
      ),
      child: pw.Column(
        children: [
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.center,
            children: [
              crown,
              pw.SizedBox(width: 8),
              pw.Text(AppConfig.centerName,
                  style: pw.TextStyle(
                      fontSize: 20,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.white)),
              pw.SizedBox(width: 8),
              crown,
            ],
          ),
          pw.SizedBox(height: 6),
          pw.Text(title,
              textAlign: pw.TextAlign.center,
              style: const pw.TextStyle(fontSize: 12, color: _gold)),
        ],
      ),
    );
  }

  static pw.Widget _dayHeader(WeekDay day, int count) => pw.Container(
        margin: const pw.EdgeInsets.only(top: 6, bottom: 6),
        padding: const pw.EdgeInsets.symmetric(vertical: 5, horizontal: 10),
        decoration: const pw.BoxDecoration(
          color: _paper,
          border: pw.Border(right: pw.BorderSide(color: _gold, width: 4)),
        ),
        child: pw.Text('يوم ${day.arabicName}  ($count)',
            style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold)),
      );

  static pw.Widget _row(
    Lecture l, {
    required bool showYear,
    required bool showDepartment,
    required String allGroupsLabel,
  }) {
    final tags = <String>[
      if (showYear) AcademicYears.name(l.year),
      if (l.groupName != null)
        'الفئة ${l.groupName}'
      else if (l.year == AcademicYears.yearWithGroups &&
          allGroupsLabel.isNotEmpty)
        'مشتركة $allGroupsLabel',
      if (showDepartment && l.departmentName != null)
        'قسم ${l.departmentName}',
    ];
    return pw.Container(
      margin: const pw.EdgeInsets.only(bottom: 5),
      padding: const pw.EdgeInsets.symmetric(vertical: 7, horizontal: 10),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: _line),
        borderRadius: const pw.BorderRadius.all(pw.Radius.circular(6)),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
          pw.SizedBox(
            width: 110,
            child: pw.Text(
              formatRange12(l.startMinutes, l.endMinutes),
              style: pw.TextStyle(
                  fontSize: 11, fontWeight: pw.FontWeight.bold, color: _navy),
            ),
          ),
          pw.Expanded(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(l.subjectName,
                    style: pw.TextStyle(
                        fontSize: 12, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 2),
                pw.Text(
                  [l.teacherName, ...tags].join('  ·  '),
                  style: const pw.TextStyle(fontSize: 9.5, color: _muted),
                ),
                if (l.notes != null)
                  pw.Text(l.notes!,
                      style: const pw.TextStyle(fontSize: 9, color: _muted)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String fileName(String title) {
    final safe = title
        .replaceAll(RegExp(r'[\\/:*?"<>|،–]'), ' ')
        .replaceAll(RegExp(r'\s+'), '_')
        .trim();
    return 'مركز_الوسيط_$safe.pdf';
  }

  /// قائمة المشاركة في النظام (واتساب، تيليغرام، حفظ في الملفات...).
  static Future<void> share(Uint8List bytes, String title) =>
      Printing.sharePdf(bytes: bytes, filename: fileName(title));

  /// نافذة الطباعة أو الحفظ كـ PDF.
  static Future<void> printOrSave(Uint8List bytes, String title) =>
      Printing.layoutPdf(onLayout: (_) async => bytes, name: fileName(title));
}
