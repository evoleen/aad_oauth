import 'package:aad_oauth/request/authorization_request.dart';
import 'package:flutter_test/flutter_test.dart';

import '../support/test_config.dart';

void main() {
  group('AuthorizationRequest', () {
    test('includes required OAuth authorize parameters', () {
      final config = testConfig(
        clientId: 'client-id',
        scope: 'openid',
        redirectUri: 'https://example.com/auth',
      );

      final request = AuthorizationRequest(config);

      expect(request.url, config.authorizationUrl);
      expect(request.redirectUrl, 'https://example.com/auth');
      expect(request.parameters, {
        'client_id': 'client-id',
        'response_type': 'code',
        'redirect_uri': 'https://example.com/auth',
        'scope': 'openid',
      });
    });

    test('adds optional and B2C parameters when configured', () {
      final config = testConfig(
        isB2C: true,
        policy: 'b2c_1_sign_in',
        clientId: 'client-id',
        scope: 'openid',
      ).copyWith(
        state: 'xyz',
        prompt: 'login',
        loginHint: 'user@example.com',
        domainHint: 'organizations',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        codeVerifier: 'verifier',
        responseMode: 'query',
      );

      final request = AuthorizationRequest(config);

      expect(request.parameters['state'], 'xyz');
      expect(request.parameters['prompt'], 'login');
      expect(request.parameters['login_hint'], 'user@example.com');
      expect(request.parameters['domain_hint'], 'organizations');
      expect(request.parameters['code_challenge'], 'challenge');
      expect(request.parameters['code_challenge_method'], 'S256');
      expect(request.parameters['code_verifier'], 'verifier');
      expect(request.parameters['response_mode'], 'query');
      expect(request.parameters['nonce'], config.nonce);
    });
  });
}
