import 'package:aad_oauth/model/token.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Token.fromMap', () {
    test('parses a successful token response', () {
      final token = Token.fromMap({
        'access_token': 'access',
        'token_type': 'Bearer',
        'refresh_token': 'refresh',
        'id_token': 'id',
        'expires_in': 3600,
      });

      expect(token.accessToken, 'access');
      expect(token.tokenType, 'Bearer');
      expect(token.refreshToken, 'refresh');
      expect(token.idToken, 'id');
      expect(token.expiresIn, 3600);
      expect(token.expireTimeStamp, isNotNull);
      expect(token.hasValidAccessToken(), isTrue);
      expect(token.hasRefreshToken(), isTrue);
    });

    test('parses expires_in when provided as a string', () {
      final token = Token.fromMap({
        'access_token': 'access',
        'expires_in': '120',
      });

      expect(token.expiresIn, 120);
    });

    test('defaults expires_in when value is not parseable', () {
      final token = Token.fromMap({
        'access_token': 'access',
        'expires_in': 'not-a-number',
      });

      expect(token.expiresIn, 60);
    });

    test('uses expire_timestamp when present', () {
      final stamp = DateTime.utc(2030, 1, 1).millisecondsSinceEpoch;
      final token = Token.fromMap({
        'access_token': 'access',
        'expires_in': 1,
        'expire_timestamp': stamp,
      });

      expect(
        token.expireTimeStamp!.millisecondsSinceEpoch,
        stamp,
      );
    });

    test('throws when map is null', () {
      expect(() => Token.fromMap(null), throwsException);
    });

    test('throws when the response contains an OAuth error', () {
      expect(
        () => Token.fromMap({
          'error': 'invalid_grant',
          'error_description': 'refresh token expired',
        }),
        throwsA(
          isA<Exception>().having(
            (e) => e.toString(),
            'message',
            contains('invalid_grant'),
          ),
        ),
      );
    });
  });

  group('Token serialization and validity', () {
    test('toJsonMap round-trips the fields consumers persist', () {
      final original = Token.fromMap({
        'access_token': 'access',
        'token_type': 'Bearer',
        'refresh_token': 'refresh',
        'id_token': 'id',
        'expires_in': 3600,
      });

      final restored = Token.fromMap(
        Map<String, dynamic>.from(Token.toJsonMap(original)),
      );

      expect(restored.accessToken, original.accessToken);
      expect(restored.tokenType, original.tokenType);
      expect(restored.refreshToken, original.refreshToken);
      expect(restored.idToken, original.idToken);
      expect(restored.expiresIn, original.expiresIn);
      expect(
        restored.expireTimeStamp!.millisecondsSinceEpoch,
        original.expireTimeStamp!.millisecondsSinceEpoch,
      );
    });

    test('hasValidAccessToken is false when expired or missing', () {
      final expired = Token.fromMap({
        'access_token': 'access',
        'expires_in': 3600,
        'expire_timestamp':
            DateTime.utc(2000, 1, 1).millisecondsSinceEpoch,
      });
      final empty = Token();

      expect(expired.hasValidAccessToken(), isFalse);
      expect(empty.hasValidAccessToken(), isFalse);
      expect(empty.hasRefreshToken(), isFalse);
    });
  });
}
