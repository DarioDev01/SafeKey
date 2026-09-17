// detector.js
// Local detection of credential patterns. Nothing is ever sent to a server.

const SAFEKEY_PATTERNS = [
  // --- AI providers ---
  { id: "openai", label: "OpenAI API key", regex: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { id: "anthropic", label: "Anthropic API key", regex: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/ },

  // --- Payments ---
  { id: "stripe_live", label: "Stripe API key (live)", regex: /\bsk_live_[A-Za-z0-9]{16,}\b/ },
  { id: "stripe_test", label: "Stripe API key (test)", regex: /\bsk_test_[A-Za-z0-9]{16,}\b/ },
  { id: "square", label: "Square token", regex: /\bsq0(atp|csp)-[0-9A-Za-z\-_]{22,}\b/ },
  { id: "shopify", label: "Shopify token", regex: /\bsh(pat|pss|pca)_[a-fA-F0-9]{32}\b/ },

  // --- Cloud / infrastructure ---
  { id: "aws", label: "AWS Access Key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "google_api", label: "Google API key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { id: "firebase", label: "Firebase server key", regex: /\bAAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{100,}\b/ },
  { id: "digitalocean", label: "DigitalOcean token", regex: /\bdop_v1_[a-f0-9]{64}\b/ },

  // --- Communications ---
  { id: "slack", label: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: "slack_webhook", label: "Slack webhook", regex: /\bhooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]+\b/ },
  { id: "twilio_sid", label: "Twilio Account SID", regex: /\bAC[a-f0-9]{32}\b/ },
  { id: "twilio_key", label: "Twilio API Key", regex: /\bSK[a-f0-9]{32}\b/ },
  { id: "sendgrid", label: "SendGrid API key", regex: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/ },
  { id: "mailgun", label: "Mailgun API key", regex: /\bkey-[a-f0-9]{32}\b/ },
  { id: "telegram", label: "Telegram bot token", regex: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { id: "discord_bot", label: "Discord bot token", regex: /\b[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}\b/ },

  // --- Development / repos ---
  { id: "github_pat", label: "GitHub token (PAT)", regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { id: "npm_token", label: "npm token", regex: /\bnpm_[A-Za-z0-9]{36}\b/ },

  // --- Structural / generic ---
  { id: "private_key", label: "Private key block", regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: "jwt", label: "JWT token", regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/ },
  {
    id: "generic_secret_keyword",
    label: "Possible secret (next to a keyword)",
    regex: /\b(api[_-]?key|secret|token|password|passwd|client[_-]?secret)\b\s*[:=]\s*["']?[A-Za-z0-9\/+_\-]{16,}["']?/i
  }
];

/**
 * Computes the Shannon entropy of a string (bits per character).
 * Random strings (real keys) have high entropy;
 * normal words or repetitive text have low entropy.
 */
function shannonEntropy(str) {
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  const len = str.length;
  let entropy = 0;
  for (const ch in freq) {
    const p = freq[ch] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// Typical token/key charset: alphanumeric plus a few symbols common in base64/hex/base62
const TOKEN_CHARSET_RE = /^[A-Za-z0-9+/_-]+$/;

/**
 * Looks for "loose" substrings that look like random tokens based on entropy,
 * even without a known prefix or a nearby keyword.
 * Filters out common false positives: git hashes (40/64 hex), UUIDs.
 */
function findHighEntropyToken(text) {
  const candidates = text.match(/[A-Za-z0-9+/_-]{24,}/g);
  if (!candidates) return null;

  for (const candidate of candidates) {
    if (!TOKEN_CHARSET_RE.test(candidate)) continue;

    // Skip UUIDs — not secrets
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)) continue;

    // Skip pure git hashes (40 or 64 hex chars) — common in commits/PRs
    if (/^[0-9a-f]{40}$/i.test(candidate) || /^[0-9a-f]{64}$/i.test(candidate)) continue;

    const entropy = shannonEntropy(candidate);
    // Empirical threshold: normal text rarely exceeds ~3.5; random tokens exceed 4.0
    if (entropy >= 4.0 && candidate.length >= 24) {
      return { id: "high_entropy", label: "Possible secret (high-entropy random string)", match: candidate };
    }
  }
  return null;
}

/**
 * Scans a text and returns the first match found, or null.
 * @param {string} text
 * @returns {{id: string, label: string, match: string} | null}
 */
function safekeyScan(text) {
  if (!text || text.length < 8) return null;

  for (const pattern of SAFEKEY_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      return { id: pattern.id, label: pattern.label, match: match[0] };
    }
  }

  // Fallback: nothing matched a known format, try entropy-based detection
  return findHighEntropyToken(text);
}

// Expose to content.js (same content-script context, no ES modules)
window.__safekeyScan = safekeyScan;
console.log("[SafeKey] detector.js loaded successfully on", window.location.hostname);
