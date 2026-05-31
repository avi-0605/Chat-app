import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables are missing! Make sure to create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

/**
 * Synchronize current user credentials with public profiles table.
 * Helps other users see display names/emails without needing backend triggers.
 */
export async function syncUserProfile() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;

    if (user) {
      const email = user.email || '';
      const defaultName = email ? email.split('@')[0] : 'User';
      
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: email,
          display_name: user.user_metadata?.display_name || defaultName,
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' })
        .select();

      if (error) {
        console.error('Error synchronizing user profile:', error.message);
        return null;
      }
      return data?.[0] || null;
    }
  } catch (err) {
    console.error('Profile sync failed:', err);
  }
  return null;
}
