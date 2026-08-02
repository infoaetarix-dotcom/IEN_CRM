import { requireUser } from '@/lib/auth/guards';
import { ChangePasswordForm } from '../change-password/change-password-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Set a new password — IEN CRM' };

// Reached from a reset email via /auth/callback, which establishes a recovery
// session. requireUser ensures that session exists (else → /login).
export default async function UpdatePasswordPage() {
  await requireUser();

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
          <ChangePasswordForm forced={false} />
        </CardContent>
      </Card>
    </div>
  );
}
