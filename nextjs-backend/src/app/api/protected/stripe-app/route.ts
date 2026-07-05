import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import {
  stripeAccounts,
  stripeAccountSettings,
  stripeAccountUsers,
  stripeAccountUserSettings,
  stripeAppInstallations,
} from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { Json } from '@/types';

interface RegisterInstallationBody {
  stripeAccountId: string;
  installationId: string;
  livemode: boolean;
  // Settings shared by every user of the Stripe account, for this mode
  // (e.g. the company office address).
  accountSettings?: Json;
  // Settings for the current user within the Stripe account, for this mode
  // (e.g. the user's local company address).
  userSettings?: Json;
}

// List the Stripe accounts the current user belongs to, with each account's
// installations (live and test tracked separately).
export async function GET(req: NextRequest) {
  try {
    // Verify the session
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const memberships = await db
      .select({
        stripeAccountId: stripeAccounts.stripeAccountId,
        name: stripeAccounts.name,
      })
      .from(stripeAccountUsers)
      .innerJoin(
        stripeAccounts,
        eq(stripeAccountUsers.stripeAccountId, stripeAccounts.stripeAccountId)
      )
      .where(eq(stripeAccountUsers.userId, session.user.id));

    const accountIds = memberships.map((m) => m.stripeAccountId);
    const installations = accountIds.length
      ? await db
          .select()
          .from(stripeAppInstallations)
          .where(inArray(stripeAppInstallations.stripeAccountId, accountIds))
      : [];

    const accounts = memberships.map((membership) => ({
      ...membership,
      installations: installations.filter(
        (i) => i.stripeAccountId === membership.stripeAccountId
      ),
    }));

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Register an installation: upserts the Stripe account, the current user's
// membership in it, and the (account, livemode) installation record.
export async function POST(req: NextRequest) {
  try {
    // Verify the session
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json() as RegisterInstallationBody;
    const { stripeAccountId, installationId, livemode, accountSettings, userSettings } = body;

    if (!stripeAccountId || !installationId || typeof livemode !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await db
      .insert(stripeAccounts)
      .values({ stripeAccountId })
      .onConflictDoNothing({ target: stripeAccounts.stripeAccountId });

    await db
      .insert(stripeAccountUsers)
      .values({ userId: session.user.id, stripeAccountId })
      .onConflictDoNothing();

    const [installation] = await db
      .insert(stripeAppInstallations)
      .values({
        stripeAccountId,
        livemode,
        installationId,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [stripeAppInstallations.stripeAccountId, stripeAppInstallations.livemode],
        set: {
          installationId,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (accountSettings !== undefined) {
      await db
        .insert(stripeAccountSettings)
        .values({ stripeAccountId, livemode, settings: accountSettings })
        .onConflictDoUpdate({
          target: [stripeAccountSettings.stripeAccountId, stripeAccountSettings.livemode],
          set: {
            settings: accountSettings,
            updatedAt: new Date(),
          },
        });
    }

    if (userSettings !== undefined) {
      await db
        .insert(stripeAccountUserSettings)
        .values({
          userId: session.user.id,
          stripeAccountId,
          livemode,
          settings: userSettings,
        })
        .onConflictDoUpdate({
          target: [
            stripeAccountUserSettings.userId,
            stripeAccountUserSettings.stripeAccountId,
            stripeAccountUserSettings.livemode,
          ],
          set: {
            settings: userSettings,
            updatedAt: new Date(),
          },
        });
    }

    return NextResponse.json({ installation });
  } catch (error) {
    console.error('Error registering installation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
