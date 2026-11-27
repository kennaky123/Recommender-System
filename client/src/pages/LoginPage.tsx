import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LogIn, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { LoginFormValues, loginSchema } from '@/schemas/authSchemas';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      await login(values);
      navigate({ to: '/' });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Unable to sign in.'
      );
    }
  };

  const fillDemo = () => {
    setValue('email', 'claude@spacex.vod', { shouldValidate: true });
    setValue('password', 'SpaceX@2026', { shouldValidate: true });
  };

  return (
    <div className="relative z-10 pl-20 lg:pl-24 pr-8 py-12 min-h-[calc(100dvh-66px)] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <Card className="w-full border-[#373B47] bg-[#0B1023]/95 shadow-2xl">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="gold">CREW AUTHENTICATION</Badge>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#87899D]">
              DRAGON LINK
            </span>
          </div>
          <CardTitle className="text-[22px] tracking-[0.04em]">
            SIGN IN TO SPACEX VOD
          </CardTitle>
          <CardDescription>
            Access your personalized Hybrid AI recommendations, My List, and watch
            history.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-4"
          >
            {serverError && (
              <div
                role="alert"
                className="px-3 py-2.5 rounded-[3px] border border-red-500/70 bg-red-950/50 text-[12px] text-red-200"
              >
                {serverError}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="login-email"
                className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#C8D0E0]"
              >
                CREW EMAIL
              </label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="claude@spacex.vod"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-[11px] text-red-400">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="login-password"
                className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#C8D0E0]"
              >
                ACCESS PASSCODE
              </label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="pr-11"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#87899D] hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-red-400">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="backlit"
              disabled={isSubmitting}
              className="w-full mt-2"
            >
              <LogIn size={16} strokeWidth={2.2} />
              <span>{isSubmitting ? 'AUTHENTICATING...' : 'SIGN IN'}</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={fillDemo}
              className="w-full"
            >
              <Sparkles size={14} strokeWidth={2} className="text-[#F0EA75]" />
              <span>USE DEMO CREW ACCOUNT (CLAUDE PATTERSON)</span>
            </Button>

            <div className="pt-3 border-t border-[#373B47] flex items-center justify-between text-[12px] text-[#87899D]">
              <span>NEW PASSENGER?</span>
              <Link
                to="/register"
                className="font-bold uppercase tracking-wider text-[#F0EA75] hover:underline"
              >
                CREATE ACCOUNT →
              </Link>
            </div>
          </form>
        </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
