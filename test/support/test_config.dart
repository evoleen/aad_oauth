import 'package:aad_oauth/model/config.dart';
import 'package:flutter/widgets.dart';

/// Minimal [Config] for unit tests that do not exercise the webview/UI path.
Config testConfig({
  String tenant = 'contoso',
  String clientId = 'client-id',
  String scope = 'openid offline_access',
  String redirectUri = 'https://example.com/auth',
  bool isB2C = false,
  String? policy,
  String? clientSecret,
  String? resource,
  String? codeVerifier,
  String? customAuthorizationUrl,
  String? customTokenUrl,
  String? customDomainUrlWithTenantId,
  String? origin,
  bool isStub = false,
}) {
  return Config(
    tenant: tenant,
    clientId: clientId,
    scope: scope,
    redirectUri: redirectUri,
    navigatorKey: GlobalKey<NavigatorState>(),
    isB2C: isB2C,
    policy: policy,
    clientSecret: clientSecret,
    resource: resource,
    codeVerifier: codeVerifier,
    customAuthorizationUrl: customAuthorizationUrl,
    customTokenUrl: customTokenUrl,
    customDomainUrlWithTenantId: customDomainUrlWithTenantId,
    origin: origin,
    isStub: isStub,
  );
}
