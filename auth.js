// WebAuthn-based auth (uses platform authenticator where available)
// Provides a simple register/login UI that unlocks the app and initializes a session AES key.
(function () {
    const registerBtn = document.getElementById('webauthnRegisterBtn');
    const loginBtn = document.getElementById('webauthnLoginBtn');
    const authOverlay = document.getElementById('authOverlay');
    const authMsg = document.getElementById('authMsg');
    const persistPinInput = document.getElementById('persistPin');

    function bufToBase64Url(buffer) {
        const bytes = new Uint8Array(buffer);
        let str = '';
        for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
        return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function base64UrlToBuf(base64url) {
        base64url = base64url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64url.length % 4) base64url += '=';
        const bin = atob(base64url);
        const len = bin.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
        return arr.buffer;
    }

    async function isPlatformAvailable() {
        if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
        try {
            return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch (err) {
            return false;
        }
    }

    async function registerCredential() {
        if (!await isPlatformAvailable()) {
            authMsg.textContent = 'Platform authenticator not available on this device.';
            return;
        }
        authMsg.textContent = 'Registering... Please follow the device prompt.';
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const userId = crypto.getRandomValues(new Uint8Array(16));

        const publicKey = {
            challenge: challenge,
            rp: { name: location.hostname },
            user: { id: userId, name: 'local-user', displayName: 'Local User' },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256
            authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
            timeout: 60000,
            attestation: 'none'
        };

        try {
            const cred = await navigator.credentials.create({ publicKey });
            const rawId = new Uint8Array(cred.rawId);
            const idB64 = bufToBase64Url(rawId.buffer);
            localStorage.setItem('webauthn_cred', idB64);
            authMsg.textContent = 'Registration successful. You can now Login using Face ID.';
        } catch (err) {
            console.error('register error', err);
            authMsg.textContent = 'Registration failed: ' + (err.message || err.toString());
        }
    }

    async function loginCredential() {
        const idB64 = localStorage.getItem('webauthn_cred');
        if (!idB64) {
            authMsg.textContent = 'No credential found. Please Register first.';
            return;
        }
        if (!await isPlatformAvailable()) {
            authMsg.textContent = 'Platform authenticator not available on this device.';
            return;
        }
        authMsg.textContent = 'Authenticating... Follow the Face ID prompt.';
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const allow = [{ id: base64UrlToBuf(idB64), type: 'public-key', transports: ['internal'] }];
        const publicKey = { challenge, allowCredentials: allow, timeout: 60000, userVerification: 'required' };
        try {
            const assertion = await navigator.credentials.get({ publicKey });
            // We don't have a server to verify signature; success means platform auth was used
            authMsg.textContent = 'Authentication successful.';
            await onAuthenticated();
        } catch (err) {
            console.error('login error', err);
            authMsg.textContent = 'Authentication failed: ' + (err.message || err.toString());
        }
    }

    async function onAuthenticated() {
        // Try to initialize session AES key. If a wrapped key exists in IndexedDB and the user supplied a PIN, try to unwrap.
        try {
            const pin = persistPinInput.value && persistPinInput.value.trim();
            // Check for wrapped key
            const wrapped = await window.SecureCrypto.kvGet('wrapped_aes');
            if (wrapped && pin) {
                try {
                    const aesKey = await window.SecureCrypto.unwrapKeyRaw(wrapped.wrappedB64, wrapped.ivB64, wrapped.saltB64, pin);
                    window.AppEncryptionKey = aesKey;
                    authMsg.textContent = 'Unlocked and AES key restored from persisted storage.';
                    hideOverlay();
                    return;
                } catch (err) {
                    console.warn('Failed to unwrap persisted key with supplied PIN', err);
                    // fall through to generate new key
                }
            }

            // No persisted key or unwrapping failed -> create a fresh AES key for session
            const newKey = await window.SecureCrypto.generateAESKey();
            window.AppEncryptionKey = newKey;

            if (pin) {
                // persist wrapped key
                const wrappedObj = await window.SecureCrypto.wrapKeyRaw(newKey, pin);
                await window.SecureCrypto.kvSet('wrapped_aes', wrappedObj);
                authMsg.textContent = 'New AES key generated and persisted (encrypted with your PIN).';
            } else {
                authMsg.textContent = 'New AES key generated for this session.';
            }

            // Small delay so user sees message then hide overlay
            setTimeout(hideOverlay, 700);
        } catch (err) {
            console.error('onAuthenticated error', err);
            authMsg.textContent = 'Post-auth setup failed: ' + (err.message || err.toString());
        }
    }

    function hideOverlay() {
        if (authOverlay) authOverlay.style.display = 'none';
        window.AppIsAuthenticated = true;
        // Expose a helper to get the AES key (returns a Promise resolving to CryptoKey)
        window.getAppKey = async () => {
            if (window.AppEncryptionKey) return window.AppEncryptionKey;
            // Try to restore from sessionStorage (not persisted by default)
            const rawB64 = sessionStorage.getItem('session_aes_raw');
            if (!rawB64) return null;
            const raw = base64UrlToBuf(rawB64);
            return await window.SecureCrypto.importKeyRaw(raw);
        };
    }

    // Wire up handlers
    document.addEventListener('DOMContentLoaded', async () => {
        // If no platform authenticator available, show message but allow app (optional)
        if (!await isPlatformAvailable()) {
            authMsg.textContent = 'Platform authenticator not available on this device. You may still use the app without Face ID.';
            // Offer a "skip" by showing a login button that simply unlocks (not recommended)
            const skipBtn = document.createElement('button');
            skipBtn.textContent = 'Use without Face ID';
            skipBtn.style.padding = '8px 12px';
            skipBtn.style.borderRadius = '8px';
            skipBtn.style.marginTop = '8px';
            skipBtn.onclick = async () => { await onAuthenticated(); };
            authOverlay.querySelector('div').appendChild(skipBtn);
        }

        registerBtn.addEventListener('click', registerCredential);
        loginBtn.addEventListener('click', loginCredential);

        // Auto-attempt login if credential present
        const idB64 = localStorage.getItem('webauthn_cred');
        if (idB64) {
            // small delay to let page load
            setTimeout(() => loginCredential(), 500);
        }
    });

    // Expose small API
    window.AppAuth = {
        isPlatformAvailable,
        registerCredential,
        loginCredential
    };
})();
