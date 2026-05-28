// Needs to be a var at the top level to get hoisted to global scope.
// https://stackoverflow.com/questions/28776079/do-let-statements-create-properties-on-the-global-object/28776236#28776236
var aadOauth = (function () {
  let myMSALObj = null;
  let authResult = null;
  let redirectHandlerTask = null;

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
  }

  // Tries to silently acquire a token. Will return null if a token
  // could not be acquired or if no cached account credentials exist.
  // Will return the authentication result on success and update the
  // global authResult variable.
  async function silentlyAcquireToken() {
    // Drain the redirect-callback promise exactly once. `redirectHandlerTask`
    // is a Promise created in `init()` from `handleRedirectPromise()` and
    // keeps its resolved AuthenticationResult forever. If we re-await it on
    // every call, every subsequent invocation short-circuits with the
    // original (and eventually expired) access token, and `acquireTokenSilent`
    // - which is the only path that uses the cached refresh token to mint a
    // new access token - is never reached. That breaks silent token renewal
    // on long-lived tabs and forces interactive re-auth once the access
    // token expires.
    if (redirectHandlerTask !== null) {
      const pendingTask = redirectHandlerTask;
      redirectHandlerTask = null;
      try {
        const result = await pendingTask;
        if (result !== null) {
          authResult = result;
          return authResult;
        }
      }
      catch (error) {
        // Swallow and fall through to acquireTokenSilent so we still try to
        // recover the session from the MSAL cache. We log so the failure
        // can be diagnosed in the field.
        console.warn('handleRedirectPromise rejected: ' +
          (error && error.message ? error.message : error));
      }
    }

    const account = getAccount();
    if (account == null) {
      return null;
    }

    try {
      // Silent acquisition only works if the access token is either
      // within its lifetime, or the refresh token can successfully be
      // used to refresh it. This will throw if the access token can't
      // be acquired.
      const silentAuthResult = await myMSALObj.acquireTokenSilent({
        scopes: tokenRequest.scopes,
        prompt: "none",
        account: account,
        extraQueryParameters: tokenRequest.extraQueryParameters
      });

      authResult = silentAuthResult;
      return authResult;
    } catch (error) {
      console.log('Unable to silently acquire a new token: ' + error.message);
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
    // Try to sign in silently, assuming we have already signed in and have
    // a cached access token
    await silentlyAcquireToken()

    if (authResult != null) {
      // Skip interactive login
      onSuccess(authResult.accessToken ?? null);
      return
    }

    const account = getAccount()

    if (useRedirect) {
      myMSALObj.acquireTokenRedirect({
        scopes: tokenRequest.scopes,
        prompt: tokenRequest.prompt,
        account: account,
        extraQueryParameters: tokenRequest.extraQueryParameters,
        loginHint: tokenRequest.loginHint
      });
    } else {
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

        onSuccess(authResult.accessToken ?? null);
      } catch (error) {
        // rethrow
        console.warn(error.message);
        onError(error);
      }
    }
  }

  // Tries to refresh the token. Will call [onError] if a token
  // could not be acquired or if no cached account credentials exist.
  // Will call [onSuccess] on success and update the global authResult variable.
  async function refreshToken(onSuccess, onError) {
    // `silentlyAcquireToken` already drains the redirect-callback promise on
    // first use and otherwise delegates to MSAL's `acquireTokenSilent`, which
    // refreshes the access token via the cached refresh token when it has
    // expired. Use its return value rather than the global `authResult` so
    // that a failed refresh doesn't accidentally surface a stale token left
    // over from a previous successful acquisition.
    const result = await silentlyAcquireToken();

    if (result != null && result.accessToken) {
      onSuccess(result.accessToken);
      return;
    }
    onError(new Error('Silent token refresh did not produce a token'));
  }

  function getAccount() {
    // If we have recently authenticated, we use the auth'd account;
    // otherwise we fallback to using MSAL APIs to find cached auth
    // accounts in browser storage.
    if (authResult !== null && authResult.account !== null) {
      return authResult.account
    }

    const currentAccounts = myMSALObj.getAllAccounts();

    if (currentAccounts === null || currentAccounts.length === 0) {
      return null;
    } else if (currentAccounts.length > 1) {
      // Multiple users - pick the first one, but this shouldn't happen
      console.warn("Multiple accounts detected, selecting first.");

      return currentAccounts[0];
    } else if (currentAccounts.length === 1) {
      return currentAccounts[0];
    }
  }

  function logout(onSuccess, onError, showPopup) {
    const account = getAccount();

    if (!account) {
      onSuccess();
      return;
    }

    authResult = null;
    authResultError = null;
    tokenRequest.scopes = null;

    if (showPopup) {
      myMSALObj
        .logout({ account: account })
        .then((_) => onSuccess())
        .catch(onError);
    } else {
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
    var result = await silentlyAcquireToken()
    return result ? result.accessToken : null;
  }

  async function getIdToken() {
    var result = await silentlyAcquireToken()
    return result ? result.idToken : null;
  }

  function hasCachedAccountInformation() {
    return getAccount() != null;
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
