'use client';

import { useSession, signOut } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface StripeAccount {
  stripeAccountId: string;
  name: string | null;
  role: string;
  liveInstallationId: string | null;
  testInstallationId: string | null;
}

export default function AccountPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [accounts, setAccounts] = useState<StripeAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session) {
      fetchAccounts();
    }
  }, [session]);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/protected/stripe-app');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (isPending || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Account</h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Email:</span> {session.user.email}
            </p>
            {session.user.name && (
              <p>
                <span className="font-medium">Name:</span> {session.user.name}
              </p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Stripe Accounts</h2>
          {accounts.length === 0 ? (
            <p className="text-gray-600">No connected Stripe accounts found.</p>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => {
                const installations = [
                  { mode: 'Live', installationId: account.liveInstallationId },
                  { mode: 'Test', installationId: account.testInstallationId },
                ].filter((i) => i.installationId !== null);

                return (
                  <div
                    key={account.stripeAccountId}
                    className="border rounded-lg p-4 hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-medium">
                        {account.name || 'Stripe Account'}: {account.stripeAccountId}
                      </p>
                      <span className="px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800 capitalize">
                        {account.role}
                      </span>
                    </div>
                    {installations.length === 0 ? (
                      <p className="text-sm text-gray-600 mt-2">Not installed in any mode.</p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {installations.map((installation) => (
                          <div
                            key={installation.mode}
                            className="flex justify-between items-start"
                          >
                            <p className="text-sm text-gray-600">
                              Installation ID: {installation.installationId}
                            </p>
                            <span
                              className={`px-3 py-1 rounded-full text-sm ${installation.mode === 'Live'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                                }`}
                            >
                              {installation.mode}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
