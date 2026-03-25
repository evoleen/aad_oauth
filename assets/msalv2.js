// Needs to be a var at the top level to get hoisted to global scope.
// https://stackoverflow.com/questions/28776079/do-let-statements-create-properties-on-the-global-object/28776236#28776236
var aadOauth = (function () {
  let myMSALObj = null;
  let authResult = null;
  let redirectHandlerTask = null;

  /** Set true in DevTools: window.__AAD_OAUTH_MSAL_DIAG_VERBOSE = true */
  function diagVerbose() {
    return typeof window !== 'undefined' && window.__AAD_OAUTH_MSAL_DIAG_VERBOSE === true;
  }

  function diag(phase, detail) {
    const stamp = new Date().toISOString();
    if (detail === undefined) {
      console.log('[aad_oauth/msalv2]', stamp, phase);
    } else if (diagVerbose()) {
      console.log('[aad_oauth/msalv2]', stamp, phase, detail);
    } else {
      try {
        const safe =
          typeof detail === 'object' && detail !== null
            ? JSON.stringify(detail)
            : String(detail);
        console.log('[aad_oauth/msalv2]', stamp, phase, safe);
      } catch (_) {
        console.log('[aad_oauth/msalv2]', stamp, phase, '(unserializable detail)');
      }
    }
  }

  function summarizeAuthResult(result) {
    if (result == null) return { result: 'null' };
    return {
      hasAccessToken: !!(result.accessToken),
      accessTokenLength: result.accessToken ? result.accessToken.length : 0,
      hasAccount: !!(result.account),
      accountUsername: result.account ? result.account.username : null,
    };
  }

  function summarizeMsalError(err) {
    if (err == null) return 'null';
    return {
      message: err.message || String(err),
      name: err.name,
      errorCode: err.errorCode,
      errorMessage: err.errorMessage,
      subError: err.suberror || err.subError,
      stack: diagVerbose() && err.stack ? err.stack : undefined,
    };
  }

  const tokenRequest = {
    scopes: null,
    prompt: null,
    extraQueryParameters: {},
    loginHint: null
  };

  function deriveAuthorityFromAuthorizationUrl(authorizationUrl) {
    const oauthSuffixes = ['/oauth2/v2.0/authorize', '/oauth2/authorize'];

    for (const suffix of oauthSuffixes) {
      if (authorizationUrl.endsWith(suffix)) {
        let authority = authorizationUrl.substring(0, authorizationUrl.length - suffix.length);
        if (!authority.endsWith('/')) {
          authority += '/';
        }
        return authority;
      }
    }

    return authorizationUrl.endsWith('/') ? authorizationUrl : authorizationUrl + '/';
  }

  // Initialise the myMSALObj for the given client, authority and scope
  function init(config) {
    diag('init:start', {
      clientId: config.clientId,
      tenant: config.tenant,
      isB2C: !!config.isB2C,
      redirectUri: config.redirectUri,
      cacheLocation: config.cacheLocation,
      scopeType: typeof config.scope,
      scopeCount: typeof config.scope === 'string'
        ? config.scope.split(' ').length
        : (config.scope && config.scope.length) || 0,
    });
    let authority;
    if (config.customAuthorizationUrl) {
      authority = deriveAuthorityFromAuthorizationUrl(config.customAuthorizationUrl);
    } else {
      authority = config.isB2C ? "https://" + config.tenant + ".b2clogin.com/tfp/" + config.tenant + ".onmicrosoft.com/" + config.policy + "/" : "https://login.microsoftonline.com/" + config.tenant;
    }

    const isCustomDomain = !authority.includes('microsoftonline.com') &&
      !authority.includes('b2clogin.com');

    const knownAuthorities = isCustomDomain
      ? [new URL(authority).host]
      : [config.tenant + ".b2clogin.com", "login.microsoftonline.com"];

    var authData = {
      clientId: config.clientId,
      authority: authority,
      knownAuthorities: knownAuthorities,
      redirectUri: config.redirectUri,
    };
    var postLogoutRedirectUri = {
      postLogoutRedirectUri: config.postLogoutRedirectUri,
    };
    var msalConfig = {
      auth: config?.postLogoutRedirectUri == null ? {
        ...authData,
      } : {
        ...authData,
        ...postLogoutRedirectUri,
      },
      cache: {
        cacheLocation: config.cacheLocation,
        storeAuthStateInCookie: false,
      },
    };

    if (typeof config.scope === "string") {
      tokenRequest.scopes = config.scope.split(" ");
    } else {
      tokenRequest.scopes = config.scope;
    }

    tokenRequest.extraQueryParameters = JSON.parse(config.customParameters);
    tokenRequest.prompt = config.prompt;
    tokenRequest.loginHint = config.loginHint;

    myMSALObj = new msal.PublicClientApplication(msalConfig);
    // Register Callbacks for Redirect flow and record the task so we
    // can await its completion in the login API

    redirectHandlerTask = myMSALObj.handleRedirectPromise();
    diag('init:handleRedirectPromise scheduled', { authority: authority });
    redirectHandlerTask
      .then(function (r) {
        diag('init:handleRedirectPromise settled', {
          hasResult: r != null,
          summary: summarizeAuthResult(r),
        });
      })
      .catch(function (e) {
        diag('init:handleRedirectPromise rejected', summarizeMsalError(e));
      });
    diag('init:done');
  }

  // Tries to silently acquire a token. Will return null if a token
  // could not be acquired or if no cached account credentials exist.
  // Will return the authentication result on success and update the
  // global authResult variable.
  async function silentlyAcquireToken() {
    diag('silentlyAcquireToken:start', {
      hasMyMSALObj: myMSALObj != null,
      hasCachedAuthResult: authResult != null,
    });
    try {
      // The redirect handler task will complete with auth results if we
      // were redirected from AAD. If not, it will complete with null
      // We must wait for it to complete before we allow the login to
      // attempt to acquire a token silently, and then progress to interactive
      // login (if silent acquisition fails).
      diag('silentlyAcquireToken:await redirectHandlerTask…');
      let result = await redirectHandlerTask;
      diag('silentlyAcquireToken:redirectHandlerTask resolved', {
        hasResult: result != null,
        summary: summarizeAuthResult(result),
      });
      if (result !== null) {
        authResult = result;
        diag('silentlyAcquireToken:return after redirect result', summarizeAuthResult(authResult));
        return authResult;
      }
    }
    catch (error) {
      diag('silentlyAcquireToken:redirectHandlerTask catch (swallowed in original code)', summarizeMsalError(error));
      authResultError = null;
    }

    const account = getAccount();
    diag('silentlyAcquireToken:after redirect branch', {
      hasAccount: account != null,
      accountUsername: account ? account.username : null,
      homeAccountId: account ? account.homeAccountId : null,
    });
    if (account == null) {
      diag('silentlyAcquireToken:exit no account');
      return null;
    }

    try {
      // Silent acquisition only works if the access token is either
      // within its lifetime, or the refresh token can successfully be
      // used to refresh it. This will throw if the access token can't
      // be acquired.
      diag('silentlyAcquireToken:acquireTokenSilent start', {
        scopes: tokenRequest.scopes,
        prompt: 'none',
      });
      const silentAuthResult = await myMSALObj.acquireTokenSilent({
        scopes: tokenRequest.scopes,
        prompt: "none",
        account: account,
        extraQueryParameters: tokenRequest.extraQueryParameters
      });

      authResult = silentAuthResult;
      diag('silentlyAcquireToken:acquireTokenSilent success', summarizeAuthResult(authResult));
      return authResult;
    } catch (error) {
      console.log('Unable to silently acquire a new token: ' + error.message);
      diag('silentlyAcquireToken:acquireTokenSilent failed', summarizeMsalError(error));
      return null;
    }

  }

  /// Authorize user via refresh token or web gui if necessary.
  ///
  /// Setting [refreshIfAvailable] to [true] should attempt to re-authenticate
  /// with the existing refresh token, if any, even though the access token may
  /// still be valid; however MSAL doesn't support this. Therefore it will have
  /// the same impact as when it is set to [false].
  /// [useRedirect] uses the MSAL redirection based token acquisition instead of
  /// a popup window. This is the only way that iOS based devices will acquire
  /// a token using MSAL when the application is installed to the home screen.
  /// This is because the popup window operates outside the sandbox of the PWA and
  /// won't share cookies or local storage with the PWA sandbox. Redirect flow works
  /// around this issue by having the MSAL authentication take place directly within
  /// the PWA sandbox browser.
  /// The token is requested using acquireTokenSilent, which will refresh the token
  /// if it has nearly expired. If this fails for any reason, it will then move on
  /// to attempt to refresh the token using an interactive login.

  async function login(refreshIfAvailable, useRedirect, onSuccess, onError) {
    diag('login:start', { refreshIfAvailable: refreshIfAvailable, useRedirect: useRedirect });
    // Try to sign in silently, assuming we have already signed in and have
    // a cached access token
    await silentlyAcquireToken()

    if(authResult != null) {
      diag('login:onSuccess silent path', summarizeAuthResult(authResult));
      // Skip interactive login
      onSuccess(authResult.accessToken ?? null);
      return
    }

    const account = getAccount()
    diag('login:after silent, no authResult', {
      hasAccount: account != null,
      useRedirect: useRedirect,
    });

    if (useRedirect) {
      diag('login:acquireTokenRedirect (navigation expected)');
      myMSALObj.acquireTokenRedirect({
        scopes: tokenRequest.scopes,
        prompt: tokenRequest.prompt,
        account: account,
        extraQueryParameters: tokenRequest.extraQueryParameters,
        loginHint: tokenRequest.loginHint
      });
    } else {
      diag('login:loginPopup start');
      // Sign in with popup
      try {
        const interactiveAuthResult = await myMSALObj.loginPopup({
          scopes: tokenRequest.scopes,
          prompt: tokenRequest.prompt,
          account: account,
          extraQueryParameters: tokenRequest.extraQueryParameters,
          loginHint: tokenRequest.loginHint
        });

        authResult = interactiveAuthResult;

        diag('login:loginPopup success', summarizeAuthResult(authResult));
        onSuccess(authResult.accessToken ?? null);
      } catch (error) {
        // rethrow
        diag('login:loginPopup error', summarizeMsalError(error));
        console.warn(error.message);
        onError(error);
      }
    }
  }

  // Tries to refresh the token. Will call [onError] if a token
  // could not be acquired or if no cached account credentials exist.
  // Will call [onSuccess] on success and update the global authResult variable.
  async function refreshToken(onSuccess, onError) {
    diag('refreshToken:start', { hasAuthResult: authResult != null });
    try {
      // The redirect handler task will complete with auth results if we
      // were redirected from AAD. If not, it will complete with null
      // We must wait for it to complete before we allow the login to
      // attempt to acquire a token silently, and then progress to interactive
      // login (if silent acquisition fails).
      diag('refreshToken:await redirectHandlerTask…');
      let result = await redirectHandlerTask;
      diag('refreshToken:redirectHandlerTask resolved', {
        hasResult: result != null,
        summary: summarizeAuthResult(result),
      });
      if (result !== null) {
        authResult = result;
      }
    }
    catch (error) {
      diag('refreshToken:redirectHandlerTask error → onError', summarizeMsalError(error));
      authResultError = error;
      onError(authResultError);
      return;
    }

    // Try to sign in silently, assuming we have already signed in and have
    // a cached access token
    await silentlyAcquireToken()

    if(authResult != null) {
      diag('refreshToken:onSuccess', summarizeAuthResult(authResult));
      onSuccess(authResult.accessToken ?? null);
      return
    }
    diag('refreshToken:no token after silent → onError (Dart bridge)');
    onError(new Error('Silent token refresh did not produce a token'));
  }

  function getAccount() {
    // If we have recently authenticated, we use the auth'd account;
    // otherwise we fallback to using MSAL APIs to find cached auth
    // accounts in browser storage.
    if (authResult !== null && authResult.account !== null) {
      if (diagVerbose()) {
        diag('getAccount:from authResult', {
          username: authResult.account.username,
          homeAccountId: authResult.account.homeAccountId,
        });
      }
      return authResult.account
    }

    const currentAccounts = myMSALObj.getAllAccounts();

    if (currentAccounts === null || currentAccounts.length === 0) {
      diag('getAccount:no cached accounts in MSAL');
      return null;
    } else if (currentAccounts.length > 1) {
      // Multiple users - pick the first one, but this shouldn't happen
      console.warn("Multiple accounts detected, selecting first.");
      diag('getAccount:multiple accounts, using first', { count: currentAccounts.length });

      return currentAccounts[0];
    } else if (currentAccounts.length === 1) {
      if (diagVerbose()) {
        diag('getAccount:single cached account', {
          username: currentAccounts[0].username,
          homeAccountId: currentAccounts[0].homeAccountId,
        });
      }
      return currentAccounts[0];
    }
  }

  function logout(onSuccess, onError, showPopup) {
    diag('logout:start', { showPopup: showPopup });
    const account = getAccount();

    if (!account) {
      diag('logout:no account, onSuccess immediately');
      onSuccess();
      return;
    }

    authResult = null;
    authResultError = null;
    tokenRequest.scopes = null;

    if (showPopup) {
      diag('logout:popup flow');
      myMSALObj
        .logout({ account: account })
        .then((_) => onSuccess())
        .catch(onError);
    } else {
      diag('logout:logoutRedirect flow');
      myMSALObj
        .logoutRedirect({
          account: account,
          onRedirectNavigate: (url) => {
            return false;
          }
        })
        .then((_) => onSuccess())
        .catch(onError);
    }


  }

  async function getAccessToken() {
    diag('getAccessToken:start');
    var result = await silentlyAcquireToken()
    diag('getAccessToken:done', {
      hasResult: result != null,
      accessTokenLength: result && result.accessToken ? result.accessToken.length : 0,
    });
    return result ? result.accessToken : null;
  }

  async function getIdToken() {
    diag('getIdToken:start');
    var result = await silentlyAcquireToken()
    diag('getIdToken:done', {
      hasResult: result != null,
      hasIdToken: !!(result && result.idToken),
    });
    return result ? result.idToken : null;
  }

  function hasCachedAccountInformation() {
    const has = getAccount() != null;
    if (diagVerbose()) {
      diag('hasCachedAccountInformation', { has: has });
    }
    return has;
  }

  return {
    init: init,
    login: login,
    refreshToken: refreshToken,
    logout: logout,
    getIdToken: getIdToken,
    getAccessToken: getAccessToken,
    hasCachedAccountInformation: hasCachedAccountInformation,
  };
})();
