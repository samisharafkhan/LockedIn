/** Map Firebase Auth error codes to i18n keys (prefix err_auth_ or err_generic). */
export function authErrorToKey(code: string | undefined): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "err_auth_email_in_use";
    case "auth/invalid-email":
      return "err_auth_invalid_email";
    case "auth/weak-password":
      return "err_auth_weak_password";
    case "auth/user-not-found":
      return "err_auth_user_not_found";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "err_auth_wrong_password";
    case "auth/too-many-requests":
      return "err_auth_too_many_requests";
    case "auth/invalid-phone-number":
      return "err_auth_invalid_phone";
    case "auth/invalid-verification-code":
    case "auth/code-expired":
      return "err_auth_invalid_code";
    case "auth/operation-not-allowed":
      return "err_auth_operation_not_allowed";
    case "auth/captcha-check-failed":
    case "auth/invalid-app-credential":
    case "auth/missing-app-credential":
      return "err_auth_recaptcha_failed";
    case "auth/quota-exceeded":
      return "err_auth_quota_sms";
    default:
      return "err_generic";
  }
}
