import 'package:alwasit_center/ui/widgets/lecture_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers.dart';

void main() {
  testWidgets('بطاقة المحاضرة تعرض المادة والمدرس والوقت', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          body: LectureCard(
            lecture: lecture(start: t(16, 30), end: t(19), group: 'A'),
          ),
        ),
      ),
    ));

    expect(find.text('برمجة C++\u200E'), findsOneWidget);
    expect(find.text('شعبان'), findsOneWidget);
    expect(find.text('4:30 م'), findsOneWidget);
    expect(find.text('7:00 م'), findsOneWidget);
    expect(find.text('الفئة A'), findsOneWidget);
    expect(find.text('السنة الثالثة'), findsOneWidget);
  });
}
