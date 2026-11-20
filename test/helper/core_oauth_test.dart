import 'package:aad_oauth/helper/core_oauth.dart';
import 'package:aad_oauth/model/failure.dart';
import 'package:aad_oauth/model/token.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/test_config.dart';

void main() {
  group('CoreOAuth.fromConfig', () {
    test('returns the stub implementation when isStub is true', () async {
      final oauth = CoreOAuth.fromConfig(testConfig(isStub: true));

      expect(oauth, isA<MockCoreOAuth>());

      final login = await oauth.login();
      expect(
        login.fold((_) => null, (token) => token.accessToken),
        'ACCESS_TOKEN',
      );
      expect(await oauth.getAccessToken(), 'ACCESS_TOKEN');
      expect(await oauth.getIdToken(), 'ID_TOKEN');
      expect(await oauth.hasCachedAccountInformation, isTrue);
    });

    test('default CoreOAuth rejects unsupported operations', () async {
      final oauth = CoreOAuth();

      expect(oauth.login(), throwsA(isA<UnsupportedFailure>()));
      expect(oauth.refreshToken(), throwsA(isA<UnsupportedFailure>()));
      expect(oauth.getAccessToken(), throwsA(isA<UnsupportedFailure>()));
    });
  });

  group('MockCoreOAuth', () {
    test('login yields a Token with the stub access token', () async {
      final oauth = MockCoreOAuth();
      final result = await oauth.login();
      final token = result.getOrElse(() => Token());

      expect(token.accessToken, 'ACCESS_TOKEN');
    });
  });
}
