import 'package:flutter/material.dart';

import '../../state/schedule_controller.dart';
import '../admin/admin_entry_screen.dart';

/// الشريط العلوي الموحّد: الاسم، والتحديث، ودخول الإدارة.
PreferredSizeWidget shellAppBar(
  BuildContext context,
  ScheduleController c, {
  required String title,
}) {
  return AppBar(
    titleSpacing: 16,
    title: Row(
      children: [
        const Text('👑', style: TextStyle(fontSize: 22)),
        const SizedBox(width: 8),
        const Text('مركز الوسيط', style: TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(width: 8),
        Flexible(
          child: Text('· $title',
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 15, color: Colors.white70)),
        ),
      ],
    ),
    actions: [
      IconButton(
        tooltip: 'تحديث البيانات',
        onPressed: c.isLoading ? null : c.load,
        icon: c.isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.refresh),
      ),
      IconButton(
        tooltip: 'لوحة الإدارة',
        icon: const Icon(Icons.admin_panel_settings_outlined),
        onPressed: () => Navigator.of(context).push(
          MaterialPageRoute<void>(builder: (_) => const AdminEntryScreen()),
        ),
      ),
    ],
  );
}
