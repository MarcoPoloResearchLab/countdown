// gLogin.js

// ----- Google OAuth2 with PKCE (no backend needed) -----

// Adjust these constants with your own values
const googleClientId = "74022320040-v4hv4s7vm0qe8m0l3563c69c3pjuu9g2.apps.googleusercontent.com";
const googleRedirectUri = "https://countdown.mprlab.com";
const googleAuthEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenEndpoint = "https://oauth2.googleapis.com/token";
const googleScope = "openid email profile";

// PKCE code-verifier generator
function generateCodeVerifier() {
    const randomValues = new Uint8Array(32);
    window.crypto.getRandomValues(randomValues);
    let codeVerifier = "";
    for (let indexValue of randomValues) {
        codeVerifier += (indexValue % 16).toString(16);
    }
    return codeVerifier;
}

// Generates code challenge from the code verifier
async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    let base64String = btoa(String.fromCharCode(...new Uint8Array(digest)));
    base64String = base64String.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    return base64String;
}

// Initiates login by redirecting to Google's OAuth2 authorization endpoint
async function loginWithGoogle() {
    const codeVerifier = generateCodeVerifier();
    localStorage.setItem("google_code_verifier", codeVerifier);

    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const authUrlParams = new URLSearchParams({
        client_id: googleClientId,
        redirect_uri: googleRedirectUri,
        response_type: "code",
        scope: googleScope,
        code_challenge: codeChallenge,
        code_challenge_method: "S256"
    });

    const authorizationUrl = `${googleAuthEndpoint}?${authUrlParams.toString()}`;
    window.location.href = authorizationUrl;
}

// Handle the redirect from Google, exchange code for tokens
async function handleGoogleRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const authorizationCode = urlParams.get("code");
    if (!authorizationCode) {
        return;  // No code found
    }

    const storedCodeVerifier = localStorage.getItem("google_code_verifier");
    if (!storedCodeVerifier) {
        return;  // Safety check
    }

    const tokenResponse = await fetch(googleTokenEndpoint, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({
            client_id: googleClientId,
            grant_type: "authorization_code",
            code: authorizationCode,
            redirect_uri: googleRedirectUri,
            code_verifier: storedCodeVerifier
        })
    });

    const tokenJson = await tokenResponse.json();

    // Clear out the code verifier from storage
    localStorage.removeItem("google_code_verifier");

    if (tokenJson.access_token) {
        sessionStorage.setItem("google_access_token", tokenJson.access_token);
    }
    if (tokenJson.id_token) {
        sessionStorage.setItem("google_id_token", tokenJson.id_token);
    }

    // Clean up the URL
    window.history.replaceState({}, document.title, window.location.pathname);
}

// Automatically call handleGoogleRedirect on page load
handleGoogleRedirect();
