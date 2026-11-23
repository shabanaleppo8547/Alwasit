/// خطأ برسالة عربية جاهزة للعرض للمستخدم.
class AppException implements Exception {
  const AppException(this.message, {this.cause});

  final String message;
  final Object? cause;

  /// يحوّل أي خطأ إلى رسالة مفهومة. أخطاء قاعدة البيانات تُحوَّل
  /// داخل المستودع نفسه، وهنا نعالج الحالات العامة.
  factory AppException.from(Object error) {
    if (error is AppException) return error;
    final text = error.toString();
    if (_looksLikeNetwork(text)) {
      return AppException(
        'تعذّر الاتصال بالإنترنت. تأكد من الشبكة ثم حاول مجددًا.',
        cause: error,
      );
    }
    if (text.contains('TimeoutException')) {
      return AppException('انتهت مهلة الاتصال. حاول مجددًا.', cause: error);
    }
    return AppException('حدث خطأ غير متوقع. حاول مجددًا.', cause: error);
  }

  static bool _looksLikeNetwork(String text) {
    const markers = [
      'SocketException',
      'ClientException',
      'Failed host lookup',
      'Connection refused',
      'Connection reset',
      'Network is unreachable',
      'HandshakeException',
      'AuthRetryableFetchException',
    ];
    return markers.any(text.contains);
  }

  @override
  String toString() => message;
}
