import 'dart:convert';
import 'dart:io';

import 'package:aad_oauth/model/failure.dart';
import 'package:flutter_test/flutter_test.dart';

/// Canaries for the equatable 2 → 3 dependency upgrade.
///
/// These are intentionally few and pointed at upgrade failure modes:
/// resolve/constraints, ==/hashCode semantics, and stringify/toString.
void main() {
  group('resolve & constraints', () {
    test('pubspec allows equatable ^3 while keeping flutter_secure_storage ^11',
        () {
      final pubspec = File('pubspec.yaml').readAsStringSync();

      expect(
        pubspec,
        contains(RegExp(r'^  equatable:\s*\^3\.0\.0\s*$', multiLine: true)),
        reason: 'integration line must advertise equatable ^3.0.0',
      );
      expect(
        pubspec,
        contains(RegExp(
          r'^  flutter_secure_storage:\s*\^11\.0\.0\s*$',
          multiLine: true,
        )),
        reason: 'must not regress the flutter_secure_storage ^11 pin',
      );
    });

    test('pub get resolves equatable 3.x with flutter_secure_storage 11.x', () {
      final configFile = File('.dart_tool/package_config.json');
      expect(
        configFile.existsSync(),
        isTrue,
        reason: 'run flutter pub get before flutter test',
      );

      final packages = (jsonDecode(configFile.readAsStringSync())['packages']
              as List)
          .cast<Map<String, dynamic>>();

      String rootUri(String name) {
        final package = packages.firstWhere(
          (p) => p['name'] == name,
          orElse: () => throw TestFailure('package "$name" missing from '
              '.dart_tool/package_config.json — pub resolve failed'),
        );
        return package['rootUri'] as String;
      }

      final equatableRoot = rootUri('equatable');
      final secureStorageRoot = rootUri('flutter_secure_storage');

      expect(
        equatableRoot,
        matches(RegExp(r'equatable-3\.\d+\.\d+')),
        reason: 'expected resolved equatable 3.x, got $equatableRoot',
      );
      expect(
        secureStorageRoot,
        matches(RegExp(r'flutter_secure_storage-11\.\d+\.\d+')),
        reason:
            'expected resolved flutter_secure_storage 11.x, got $secureStorageRoot',
      );
    });
  });

  group('Equatable semantics under resolved equatable 3', () {
    // Sole Equatable usage in this package is the Failure hierarchy.
    // These assertions lock the upgrade-sensitive behaviors call sites rely on.

    test('same-type instances with equal props are == and share hashCode', () {
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

    test('same-type instances with different props are not ==', () {
      final a = RequestFailure(
        errorType: ErrorType.invalidJson,
        message: 'Token json is invalid',
      );
      final b = RequestFailure(
        errorType: ErrorType.unexpectedError,
        message: 'Token json is invalid',
      );
      final c = RequestFailure(
        errorType: ErrorType.invalidJson,
        message: 'different message',
      );

      expect(a, isNot(equals(b)));
      expect(a, isNot(equals(c)));
    });

    test('distinct concrete subtypes with identical props are not ==', () {
      // Published equatable 3.0.0 still compares runtimeType. If a future 3.x
      // drops that check (as the 3.0.0 changelog claims), this canary fails
      // and forces an intentional review before consumers pin the new SHA.
      final request = RequestFailure(
        errorType: ErrorType.unexpectedError,
        message: 'boom',
      );
      final oauth = AadOauthFailure(
        errorType: ErrorType.unexpectedError,
        message: 'boom',
      );
      final unsupported = UnsupportedFailure(
        errorType: ErrorType.unexpectedError,
        message: 'boom',
      );

      expect(request, isNot(equals(oauth)));
      expect(request, isNot(equals(unsupported)));
      expect(oauth, isNot(equals(unsupported)));
    });

    test('stringify:true keeps a useful toString for logging/UI', () {
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
