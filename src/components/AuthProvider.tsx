
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  hasPaidAccess: boolean;
  signOut: () => Promise<void>;
  checkPaymentStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPaidAccess, setHasPaidAccess] = useState(false);

  const checkPaymentStatus = async () => {
    if (!user) {
      setHasPaidAccess(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_payments')
        .select('payment_status')
        .eq('user_id', user.id)
        .eq('payment_status', 'completed')
        .maybeSingle();

      if (error) {
        console.error('Error checking payment status:', error);
        setHasPaidAccess(false);
        return;
      }

      setHasPaidAccess(!!data);
    } catch (error) {
      console.error('Unexpected error checking payment:', error);
      setHasPaidAccess(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      checkPaymentStatus();
    } else {
      setHasPaidAccess(false);
    }
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setHasPaidAccess(false);
  };

  const value = {
    user,
    session,
    loading,
    hasPaidAccess,
    signOut,
    checkPaymentStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
