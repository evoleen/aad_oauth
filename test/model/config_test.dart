import 'package:flutter_test/flutter_test.dart';

import '../support/test_config.dart';

void main() {
  group('Config endpoint URLs', () {
    test('builds standard Azure AD authorize and token URLs', () {
      final config = testConfig(tenant: 'common');

      expect(
        config.authorizationUrl,
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      );
      expect(
        config.tokenUrl,
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      );
    });

    test('builds B2C URLs from tenant and policy', () {
      final config = testConfig(
        tenant: 'mytenant',
        isB2C: true,
        policy: 'b2c_1_sign_in',
      );

      expect(
        config.authorizationUrl,
        'https://mytenant.b2clogin.com/mytenant.onmicrosoft.com/'
        'b2c_1_sign_in/oauth2/v2.0/authorize',
      );
      expect(
        config.tokenUrl,
        'https://mytenant.b2clogin.com/mytenant.onmicrosoft.com/'
        'b2c_1_sign_in/oauth2/v2.0/token',
      );
    });

    test('prefers custom domain for B2C when provided', () {
      final config = testConfig(
        tenant: 'mytenant',
        isB2C: true,
        policy: 'b2c_1_sign_in',
        customDomainUrlWithTenantId:
            'https://account.example.com/01234567-89ab-cdef-0123-456789abcdef',
      );

      expect(
        config.authorizationUrl,
        'https://account.example.com/01234567-89ab-cdef-0123-456789abcdef/'
        'b2c_1_sign_in/oauth2/v2.0/authorize',
      );
      expect(
        config.tokenUrl,
        'https://account.example.com/01234567-89ab-cdef-0123-456789abcdef/'
        'b2c_1_sign_in/oauth2/v2.0/token',
      );
    });

    test('prefers explicit custom authorize and token URL overrides', () {
      final config = testConfig(
        customAuthorizationUrl: 'https://adfs.example.com/authorize',
        customTokenUrl: 'https://adfs.example.com/token',
      );

      expect(config.authorizationUrl, 'https://adfs.example.com/authorize');
      expect(config.tokenUrl, 'https://adfs.example.com/token');
    });
  });

  group('Config.copyWith', () {
    test('preserves identity fields and overrides selected values', () {
      final original = testConfig(
        tenant: 'common',
        clientId: 'client-a',
        scope: 'openid',
      );
      final copy = original.copyWith(
        clientId: 'client-b',
        webUseRedirect: true,
      );

      expect(copy.tenant, original.tenant);
      expect(copy.scope, original.scope);
      expect(copy.redirectUri, original.redirectUri);
      expect(copy.clientId, 'client-b');
      expect(copy.webUseRedirect, isTrue);
      expect(copy.authorizationUrl, original.authorizationUrl);
    });
  });
}
