"""Print a new certificate signing key for EDUNEXA_CERTIFICATE_SIGNING_KEY (base64, 32 bytes).

Generate it once per deployment and keep it secret and stable: certificates signed with it are
verified against it later. Store it only as an environment variable (Vercel project settings).
"""

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

raw = Ed25519PrivateKey.generate().private_bytes(
    serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption()
)
print(base64.b64encode(raw).decode())
