import { requireUser } from '@/lib/auth/guards';
import { ChangePasswordForm } from './change-password-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Change password — CRM' };

export default async function ChangePasswordPage() {
  const profile = await requireUser();
  const forced = profile.must_change_password;

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{forced ? 'Set your password' : 'Change password'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {forced && (
            <p className="text-sm text-muted-foreground">
              Welcome, {profile.full_name.split(' ')[0]}. For security, please set
              your own password before continuing.
            </p>
          )}
          <ChangePasswordForm forced={forced} />
        </CardContent>
      </Card>
    </div>
  );
}
