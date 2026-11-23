import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

enum ShareOutcome { openedWhatsApp, copiedToClipboard }

/// يفتح واتساب برسالة جاهزة، وإن تعذّر ذلك ينسخها للحافظة.
class WhatsAppShare {
  const WhatsAppShare._();

  static Future<ShareOutcome> send(String text) async {
    final encoded = Uri.encodeComponent(text);
    final candidates = [
      Uri.parse('whatsapp://send?text=$encoded'),
      Uri.parse('https://wa.me/?text=$encoded'),
    ];
    for (final uri in candidates) {
      try {
        final opened =
            await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (opened) return ShareOutcome.openedWhatsApp;
      } catch (_) {
        // جرّب الرابط التالي.
      }
    }
    await copy(text);
    return ShareOutcome.copiedToClipboard;
  }

  static Future<void> copy(String text) =>
      Clipboard.setData(ClipboardData(text: text));
}
