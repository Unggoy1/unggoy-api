import validator from "validator";

export function validateInput(value: string, minValue: number) {
  let sanitized = validator.trim(value);
  sanitized = sanitized.replace(
    /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF\u2028\u2029]/g,
    "",
  );
  sanitized = sanitized.replace(/\s+/g, " ");

  let isValid = true;

  if (sanitized.length < minValue || sanitized.length > 255) {
    isValid = false;
  }
  return {
    sanitized,
    isValid,
  };
}
