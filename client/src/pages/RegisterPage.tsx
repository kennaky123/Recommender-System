import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
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
import { RegisterFormValues, registerSchema } from '@/schemas/authSchemas';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register: registerAccount } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    try {
      await registerAccount({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      navigate({ to: '/' });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Registration failed.'
      );
    }
  };

  return (
    <div className="relative z-10 pl-20 lg:pl-24 pr-8 py-10 min-h-[calc(100dvh-66px)] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <Card className="w-full border-[#373B47] bg-[#0B1023]/95 shadow-2xl">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="gold">NEW PASSENGER ENROLLMENT</Badge>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#87899D]">
              CABIN PROFILE
            </span>
          </div>
          <CardTitle className="text-[22px] tracking-[0.04em]">
            CREATE SPACEX VOD ACCOUNT
          </CardTitle>
          <CardDescription>
            Your ratings, watchlist, and VidLink progress will personalize your AI
            recommendations.
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
                htmlFor="reg-name"
                className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#C8D0E0]"
              >
                FULL NAME
              </label>
              <Input
                id="reg-name"
                type="text"
                autoComplete="name"
                placeholder="e.g. Elena Vance"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-[11px] text-red-400">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="reg-email"
                className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#C8D0E0]"
              >
                EMAIL ADDRESS
              </label>
              <Input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="elena@spacex.vod"
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
                htmlFor="reg-password"
                className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#C8D0E0]"
              >
                PASSWORD
              </label>
              <div className="relative">
                <Input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
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

            <div className="space-y-1.5">
              <label
                htmlFor="reg-confirm"
                className="block text-[11px] font-bold uppercase tracking-[0.1em] text-[#C8D0E0]"
              >
                CONFIRM PASSWORD
              </label>
              <Input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Re-enter your password"
                {...register('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="text-[11px] text-red-400">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="backlit"
              disabled={isSubmitting}
              className="w-full mt-2"
            >
              <UserPlus size={16} strokeWidth={2.2} />
              <span>
                {isSubmitting ? 'CREATING PROFILE...' : 'CREATE ACCOUNT'}
              </span>
            </Button>

            <div className="pt-3 border-t border-[#373B47] flex items-center justify-between text-[12px] text-[#87899D]">
              <span>ALREADY ENROLLED?</span>
              <Link
                to="/login"
                className="font-bold uppercase tracking-wider text-[#F0EA75] hover:underline"
              >
                SIGN IN →
              </Link>
            </div>
          </form>
        </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
