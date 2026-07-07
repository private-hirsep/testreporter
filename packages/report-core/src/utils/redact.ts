const SECRET_PATTERNS = [
  /(gh[pousr]_[A-Za-z0-9_]{20,})/g,
  /(github_pat_[A-Za-z0-9_]{20,})/g,
  /(AKIA[0-9A-Z]{16})/g,
  /((?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*)[^\s'"&]+/gi
];

export function redactSecrets(input: string | undefined): string | undefined {
  if (!input) return input;
  let output = input;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, (match, prefix: string | undefined) => {
      if (prefix && /[:=]\s*$/.test(prefix)) return `${prefix}[REDACTED]`;
      return "[REDACTED]";
    });
  }
  return output;
}
