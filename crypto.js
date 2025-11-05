// Minimal crypto helpers for AES-GCM encryption and IndexedDB storage
// Exposes a small API on window.SecureCrypto
(function () {
    function bufToBase64(buf) {
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }
    function base64ToBuf(b64) {
        const binary = atob(b64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }

    function bufferToBase64Url(buffer) {
        const b64 = bufToBase64(buffer);
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function base64UrlToBuffer(base64url) {
        // convert to regular base64
        base64url = base64url.replace(/-/g, '+').replace(/_/g, '/');
        // pad
        while (base64url.length % 4) base64url += '=';
        return base64ToBuf(base64url);
    }

    async function generateAESKey() {
        return await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    }

    async function exportKeyRaw(key) {
        return await crypto.subtle.exportKey('raw', key);
    }

    async function importKeyRaw(raw) {
        return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
    }

    async function encryptString(plaintext, key) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const enc = new TextEncoder().encode(plaintext);
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
        // return base64(iv) + ':' + base64(ciphertext)
        return bufferToBase64Url(iv) + ':' + bufferToBase64Url(ct);
    }

    async function decryptString(payload, key) {
        try {
            const [ivb64, ctb64] = payload.split(':');
            const iv = new Uint8Array(base64UrlToBuffer(ivb64));
            const ct = base64UrlToBuffer(ctb64);
            const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
            return new TextDecoder().decode(pt);
        } catch (err) {
            console.error('decryptString error', err);
            throw err;
        }
    }

    // Derive a key from a PIN (PBKDF2) for wrapping/unwrapping the AES key (optional)
    async function deriveKeyFromPin(pin, saltB64) {
        const saltBuf = saltB64 ? base64UrlToBuffer(saltB64) : crypto.getRandomValues(new Uint8Array(16)).buffer;
        const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']);
        const derived = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: saltBuf, iterations: 200000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
        return { derived, saltB64: bufferToBase64Url(saltBuf) };
    }

    // Wrap/unwrap an AES key (exported raw) using a derived key (from PIN)
    async function wrapKeyRaw(aesKey, pin) {
        // export raw aes key
        const raw = await exportKeyRaw(aesKey);
        const { derived, saltB64 } = await deriveKeyFromPin(pin);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, derived, raw);
        return { wrappedB64: bufferToBase64Url(wrapped), ivB64: bufferToBase64Url(iv), saltB64 };
    }

    async function unwrapKeyRaw(wrappedB64, ivB64, saltB64, pin) {
        const wrapped = base64UrlToBuffer(wrappedB64);
        const iv = new Uint8Array(base64UrlToBuffer(ivB64));
        const { derived } = await deriveKeyFromPin(pin, saltB64);
        const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, derived, wrapped);
        return await importKeyRaw(raw);
    }

    // Simple IndexedDB tiny KV store: dbName, store 'kv' with key 'k'
    function openKV(dbName = 'secure-store') {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'k' });
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function kvSet(k, v, dbName = 'secure-store') {
        const db = await openKV(dbName);
        return new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readwrite');
            const store = tx.objectStore('kv');
            store.put({ k, v });
            tx.oncomplete = () => { db.close(); resolve(true); };
            tx.onerror = (e) => { db.close(); reject(e.target.error); };
        });
    }

    async function kvGet(k, dbName = 'secure-store') {
        const db = await openKV(dbName);
        return new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readonly');
            const store = tx.objectStore('kv');
            const rq = store.get(k);
            rq.onsuccess = () => { db.close(); resolve(rq.result ? rq.result.v : null); };
            rq.onerror = (e) => { db.close(); reject(e.target.error); };
        });
    }

    // High-level helpers: setEncryptedItem/getEncryptedItem
    async function setEncryptedItem(name, obj, aesKey, dbName) {
        const plaintext = JSON.stringify(obj);
        const payload = await encryptString(plaintext, aesKey);
        return await kvSet(name, payload, dbName);
    }

    async function getEncryptedItem(name, aesKey, dbName) {
        const payload = await kvGet(name, dbName);
        if (!payload) return null;
        const plaintext = await decryptString(payload, aesKey);
        return JSON.parse(plaintext);
    }

    window.SecureCrypto = {
        bufferToBase64Url,
        base64UrlToBuffer,
        generateAESKey,
        exportKeyRaw,
        importKeyRaw,
        encryptString,
        decryptString,
        deriveKeyFromPin,
        wrapKeyRaw,
        unwrapKeyRaw,
        kvSet,
        kvGet,
        setEncryptedItem,
        getEncryptedItem
    };
})();
