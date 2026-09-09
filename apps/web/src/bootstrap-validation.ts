export const BOOTSTRAP_PASSWORD_MIN_LENGTH = 12;

type BootstrapInput = { displayName: string; password: string };
type BootstrapValidationCode = "BOOTSTRAP_DISPLAY_NAME_REQUIRED" | "AUTH_INVALID_PASSWORD";

export function validateBootstrapInput(input: BootstrapInput): BootstrapValidationCode | null {
  if (input.displayName.trim().length === 0) return "BOOTSTRAP_DISPLAY_NAME_REQUIRED";
  if (input.password.length < BOOTSTRAP_PASSWORD_MIN_LENGTH) return "AUTH_INVALID_PASSWORD";
  return null;
}

export function bootstrapError(code: string): string | null {
  if (code === "BOOTSTRAP_DISPLAY_NAME_REQUIRED") return "请输入称呼。";
  if (code === "AUTH_INVALID_PASSWORD") return `密码至少需要 ${BOOTSTRAP_PASSWORD_MIN_LENGTH} 个字符。`;
  return null;
}
