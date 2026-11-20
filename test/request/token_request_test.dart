import 'package:aad_oauth/model/config.dart';
import 'package:aad_oauth/request/token_refresh_request.dart';
import 'package:aad_oauth/request/token_request.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/test_config.dart';

void main() {
  group('TokenRequestDetails', () {
    test('builds authorization_code grant params from config', () {
      final config = testConfig(
        clientId: 'client-id',
        scope: 'openid offline_access',
        redirectUri: 'https://example.com/auth',
        clientSecret: 'secret',
        resource: 'https://graph.microsoft.com',
        codeVerifier: 'verifier',
        origin: 'https://example.com',
      );

      final details = TokenRequestDetails(config, 'auth-code');

      expect(details.url, config.tokenUrl);
      expect(details.params, {
        'client_id': 'client-id',
        'grant_type': 'authorization_code',
        'scope': 'openid offline_access',
        'code': 'auth-code',
        'redirect_uri': 'https://example.com/auth',
        'resource': 'https://graph.microsoft.com',
        'client_secret': 'secret',
        'code_verifier': 'verifier',
      });
      expect(details.headers, {
        'Accept': 'application/json',
        'Content-Type': Config.contentType,
        'Origin': 'https://example.com',
      });
    });
  });

  group('TokenRefreshRequestDetails', () {
    test('builds refresh_token grant params from config', () {
      final config = testConfig(
        clientId: 'client-id',
        scope: 'openid offline_access',
        redirectUri: 'https://example.com/auth',
        clientSecret: 'secret',
      );

      final details =
          TokenRefreshRequestDetails(config, 'refresh-token-value');

      expect(details.url, config.tokenUrl);
      expect(details.params, {
        'client_id': 'client-id',
        'scope': 'openid offline_access',
        'redirect_uri': 'https://example.com/auth',
        'grant_type': 'refresh_token',
        'refresh_token': 'refresh-token-value',
        'client_secret': 'secret',
      });
      expect(details.headers['Content-Type'], Config.contentType);
      expect(details.headers.containsKey('Origin'), isFalse);
    });
  });
}
