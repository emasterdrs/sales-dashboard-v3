import { supabase } from '../api/supabase';

interface SafeError {
  message: string;
  details?: string;
  hint?: string;
  stack?: string;
}

export class SecurityService {
  /**
   * Prevents revealing DB or file paths to end-users.
   * Logs only to server (or console for dev), showing safe message to user.
   */
  static handleSafeError(error: unknown, userFriendlyMsg: string = '데이터를 처리하는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.') {
    const err = error as SafeError;
    
    // 1. Log sensitive details
    console.error('[SERVER_LOG][SECURE]:', {
      timestamp: new Date().toISOString(),
      message: err.message || 'Unknown error',
      stack: err.stack,
      details: err.details,
      hint: err.hint
    });

    // 2. Alert user with non-sensitive message
    alert(userFriendlyMsg);
    
    // 3. Return a sanitized error object
    return {
      success: false,
      message: userFriendlyMsg,
    };
  }

  /**
   * Double-check user permissions before performing mutations.
   * While RLS handles this in DB, we also want frontend guards.
   */
  static async checkPermission(allowedRoles: string[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    return profile && allowedRoles.includes(profile.role);
  }

  /**
   * Sanitize inputs to prevent XSS.
   */
  static sanitizeInput(input: string): string {
    return input.replace(/<[^>]*>?/gm, ''); 
  }
}
