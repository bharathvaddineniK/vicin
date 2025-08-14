// Simple, fast client‑side strength check (no PII sent anywhere)
export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4; // 0=very weak … 4=strong
  label: "Very weak" | "Weak" | "Okay" | "Strong" | "Excellent";
  color: string; // UI color hint
  meetsPolicy: boolean; // our enforceable policy flag
  reasons: string[]; // helpful hints you can surface if needed
};

const COMMON_LIST = [
  "password",
  "123456",
  "qwerty",
  "letmein",
  "111111",
  "iloveyou",
  "admin",
  "welcome",
];

export function assessPassword(pw: string): PasswordStrength {
  const reasons: string[] = [];
  const len = pw.length;

  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const uniqueChars = new Set(pw.split("")).size;

  if (len < 8) reasons.push("Use at least 8 characters."); // was 12 before
  if (!hasLower || !hasUpper) reasons.push("Mix upper & lower case.");
  if (!hasDigit) reasons.push("Add a number.");
  if (!hasSymbol) reasons.push("Add a symbol.");
  if (/(.)\1\1/.test(pw)) reasons.push("Avoid repeating characters.");
  if (COMMON_LIST.includes(pw.toLowerCase()))
    reasons.push("Avoid common passwords.");
  if (uniqueChars < Math.min(6, len))
    reasons.push("Increase character variety.");

  // Score buckets (quick heuristic)
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(
    Boolean,
  ).length;

  if (len >= 6) score = 1;
  if (len >= 8 && variety >= 2) score = 2;
  if (len >= 8 && variety >= 3) score = 3;
  if (len >= 10 && variety === 4 && uniqueChars >= 8) score = 4;

  const labels = ["Very weak", "Weak", "Okay", "Strong", "Excellent"] as const;
  const colors = ["#ef4444", "#f97316", "#f59e0b", "#16a34a", "#15803d"];

  // Policy: enforce >= 3 (Strong) and length >= 8 with 3 classes
  const meetsPolicy =
    score >= 3 &&
    len >= 8 &&
    variety >= 3 &&
    !COMMON_LIST.includes(pw.toLowerCase());

  return {
    score,
    label: labels[score],
    color: colors[score],
    meetsPolicy,
    reasons,
  };
}
