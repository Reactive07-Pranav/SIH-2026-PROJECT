"""ECDSA P-256 / SHA-256 verification for device-signed evidence records."""

from __future__ import annotations

import base64
import binascii
import json
from typing import Any

from cryptography.exceptions import InvalidSignature, UnsupportedAlgorithm
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature


def b64decode_any(value: str) -> bytes:
    """Decode standard or URL-safe base64, padded or not (web sends url-safe, Flutter standard)."""
    s = value.strip().replace("-", "+").replace("_", "/")
    return base64.b64decode(s + "=" * (-len(s) % 4), validate=True)


def canonical_json(value: Any) -> str:
    """Recursive key sort, no whitespace — mirrors FRONTEND src/crypto/sign.ts canonicalize()."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def load_public_key(spki_b64: str) -> ec.EllipticCurvePublicKey:
    """Parse a base64 DER SubjectPublicKeyInfo; raise ValueError unless it is a P-256 key."""
    try:
        key = serialization.load_der_public_key(b64decode_any(spki_b64))
    except (binascii.Error, UnsupportedAlgorithm, ValueError) as exc:
        raise ValueError("publicKey is not a valid base64 DER SPKI key") from exc
    if not isinstance(key, ec.EllipticCurvePublicKey) or key.curve.name != "secp256r1":
        raise ValueError("publicKey must be an ECDSA P-256 key")
    return key


def verify_signature(message: str, signature_b64: str, spki_b64: str) -> bool:
    try:
        key = load_public_key(spki_b64)
        sig = b64decode_any(signature_b64)
    except (binascii.Error, ValueError):
        return False
    if len(sig) == 64:
        # WebCrypto emits raw r||s (IEEE P1363); `cryptography` expects DER.
        sig = encode_dss_signature(int.from_bytes(sig[:32], "big"), int.from_bytes(sig[32:], "big"))
    try:
        key.verify(sig, message.encode("utf-8"), ec.ECDSA(hashes.SHA256()))
        return True
    except InvalidSignature:
        return False
