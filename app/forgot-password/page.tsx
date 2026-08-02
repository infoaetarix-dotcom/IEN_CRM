import { ForgotPasswordForm } from './forgot-password-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Reset password — IEN CRM' };

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter your account email and we&rsquo;ll send you a link to set a new
            password.
          </p>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
