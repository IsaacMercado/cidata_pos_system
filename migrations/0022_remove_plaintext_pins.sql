-- PIN authentication uses pin_hash; plaintext PINs must not remain in D1.
UPDATE users SET pin = '' WHERE pin IS NOT NULL AND pin != '';
