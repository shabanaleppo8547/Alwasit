import 'package:flutter/material.dart';

import '../../core/time_format.dart';
import '../../models/academic_year.dart';
import '../../models/lecture.dart';
import '../theme.dart';

/// بطاقة محاضرة واحدة.
class LectureCard extends StatelessWidget {
  const LectureCard({
    super.key,
    required this.lecture,
    this.showYear = true,
    this.trailing,
  });

  final Lecture lecture;
  final bool showYear;

  /// عناصر إضافية (مثل قائمة تعديل/حذف في لوحة الإدارة).
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final l = lecture;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _TimeBlock(start: l.startMinutes, end: l.endMinutes),
            Expanded(
              child: Padding(
                padding: const EdgeInsetsDirectional.fromSTEB(14, 12, 8, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      l.subjectName,
                      style: text.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.person_outline,
                            size: 18, color: AppColors.muted),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            l.teacherName,
                            style:
                                text.bodyMedium?.copyWith(color: AppColors.muted),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if (showYear)
                          _Tag(label: AcademicYears.name(l.year)),
                        if (l.groupName != null)
                          _Tag(label: 'الفئة ${l.groupName}', strong: true)
                        else if (l.year == AcademicYears.yearWithGroups)
                          const _Tag(label: 'مشتركة بين الفئات'),
                        if (l.departmentName != null)
                          _Tag(label: 'قسم ${l.departmentName}'),
                        if (l.year == AcademicYears.yearWithDepartments &&
                            l.departmentName == null)
                          const _Tag(label: 'كل الأقسام'),
                      ],
                    ),
                    if (l.notes != null) ...[
                      const SizedBox(height: 6),
                      Text(l.notes!,
                          style: text.bodySmall
                              ?.copyWith(color: AppColors.muted, height: 1.4)),
                    ],
                  ],
                ),
              ),
            ),
            if (trailing != null)
              Align(alignment: Alignment.topCenter, child: trailing!),
          ],
        ),
      ),
    );
  }
}

class _TimeBlock extends StatelessWidget {
  const _TimeBlock({required this.start, required this.end});

  final int start;
  final int end;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme;
    return Container(
      width: 84,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
      decoration: const BoxDecoration(
        color: AppColors.navy,
        borderRadius: BorderRadiusDirectional.horizontal(
          start: Radius.circular(15),
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            formatTime12(start),
            textAlign: TextAlign.center,
            style: style.titleSmall?.copyWith(
              color: AppColors.gold,
              fontWeight: FontWeight.w700,
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(vertical: 4),
            width: 2,
            height: 12,
            color: Colors.white24,
          ),
          Text(
            formatTime12(end),
            textAlign: TextAlign.center,
            style: style.bodySmall?.copyWith(color: Colors.white70),
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({required this.label, this.strong = false});

  final String label;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: strong ? AppColors.goldSoft : AppColors.paper,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: strong ? AppColors.gold : AppColors.line),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: AppColors.ink,
              fontWeight: strong ? FontWeight.w700 : FontWeight.w500,
            ),
      ),
    );
  }
}
