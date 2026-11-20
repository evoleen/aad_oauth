import 'package:aad_oauth/model/failure.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Failure', () {
    test('value equality compares errorType and message for the same subtype',
        () {
      final a = RequestFailure(
        errorType: ErrorType.invalidJson,
        message: 'Token json is invalid',
      );
      final b = RequestFailure(
        errorType: ErrorType.invalidJson,
        message: 'Token json is invalid',
      );

      expect(a, equals(b));
      expect(a.hashCode, equals(b.hashCode));
    });

    test('instances differ when errorType or message differs', () {
      final base = RequestFailure(
        errorType: ErrorType.invalidJson,
        message: 'Token json is invalid',
      );

      expect(
        base,
        isNot(equals(RequestFailure(
          errorType: ErrorType.unexpectedError,
          message: 'Token json is invalid',
        ))),
      );
      expect(
        base,
        isNot(equals(RequestFailure(
          errorType: ErrorType.invalidJson,
          message: 'different',
        ))),
      );
    });

    test('concrete subtypes with the same props are not interchangeable', () {
      final props = (
        errorType: ErrorType.unexpectedError,
        message: 'boom',
      );

      final request = RequestFailure(
        errorType: props.errorType,
        message: props.message,
      );
      final oauth = AadOauthFailure(
        errorType: props.errorType,
        message: props.message,
      );
      final unsupported = UnsupportedFailure(
        errorType: props.errorType,
        message: props.message,
      );

      expect(request, isNot(equals(oauth)));
      expect(request, isNot(equals(unsupported)));
      expect(oauth, isNot(equals(unsupported)));

      expect(request, isA<RequestFailure>());
      expect(oauth, isA<AadOauthFailure>());
      expect(unsupported, isA<UnsupportedFailure>());
      expect(request, isA<Failure>());
    });

    test('toString includes type, errorType, and message for diagnostics', () {
      final failure = AadOauthFailure(
        errorType: ErrorType.accessDeniedOrAuthenticationCanceled,
        message: 'Access denied or authentication canceled',
      );

      final text = failure.toString();
      expect(text, contains('AadOauthFailure'));
      expect(
        text,
        contains('ErrorType.accessDeniedOrAuthenticationCanceled'),
      );
      expect(text, contains('Access denied or authentication canceled'));
    });
  });
}
