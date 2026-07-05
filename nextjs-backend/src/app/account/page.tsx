'use client';

import { useSession, signOut } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Json } from '@/types';

interface Installation {
  id: string;
  stripeAccountId: string;
  installationId: string;
  isActive: boolean;
  settings: Json;
  createdAt: string;
}

export default function AccountPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  useEffect(() => {
    if (session) {
      fetchInstallations();
    }
  }, [session]);

  const fetchInstallations = async () => {
    try {
      const response = await fetch('/api/protected/stripe-app');
      if (response.ok) {
        const data = await response.json();
        setInstallations(data.installations);
      }
    } catch (error) {
      console.error('Error fetching installations:', error);
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
          <h2 className="text-xl font-semibold mb-4">Stripe App Installations</h2>
          {installations.length === 0 ? (
            <p className="text-gray-600">No installations found.</p>
          ) : (
            <div className="space-y-4">
              {installations.map((installation) => (
                <div
                  key={installation.id}
                  className="border rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        Account ID: {installation.stripeAccountId}
                      </p>
                      <p className="text-sm text-gray-600">
                        Installation ID: {installation.installationId}
                      </p>
                      <p className="text-sm text-gray-600">
                        Created: {new Date(installation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm ${installation.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                        }`}
                    >
                      {installation.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
