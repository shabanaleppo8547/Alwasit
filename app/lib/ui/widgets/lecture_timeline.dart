import 'package:flutter/material.dart';

import '../../logic/schedule_filter.dart';
import '../../models/lecture.dart';
import '../theme.dart';
import 'lecture_card.dart';

/// يعرض محاضرات يوم واحد، ويُبرز المحاضرات المتزامنة دون حذف أيٍّ منها.
class LectureTimeline extends StatelessWidget {
  const LectureTimeline({
    super.key,
    required this.lectures,
    required this.showYear,
    this.trailingBuilder,
  });

  /// محاضرات يوم واحد مرتبة.
  final List<Lecture> lectures;
  final bool showYear;
  final Widget Function(Lecture lecture)? trailingBuilder;

  @override
  Widget build(BuildContext context) {
    final clusters = ScheduleFilter.overlapClusters(lectures);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final cluster in clusters)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: cluster.length == 1
                ? _card(cluster.single)
                : _ConcurrentGroup(
                    count: cluster.length,
                    children: [for (final l in cluster) _card(l)],
                  ),
          ),
      ],
    );
  }

  Widget _card(Lecture l) => LectureCard(
        lecture: l,
        showYear: showYear,
        trailing: trailingBuilder?.call(l),
      );
}

class _ConcurrentGroup extends StatelessWidget {
  const _ConcurrentGroup({required this.count, required this.children});

  final int count;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
      decoration: BoxDecoration(
        color: AppColors.concurrent.withAlpha(18),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.concurrent.withAlpha(90)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 6, bottom: 8),
            child: Row(
              children: [
                const Icon(Icons.call_split,
                    size: 18, color: AppColors.concurrent),
                const SizedBox(width: 6),
                Text(
                  count == 2
                      ? 'محاضرتان متزامنتان'
                      : '$count محاضرات متزامنة',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AppColors.concurrent,
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),
          for (final c in children)
            Padding(padding: const EdgeInsets.only(bottom: 8), child: c),
        ],
      ),
    );
  }
}
