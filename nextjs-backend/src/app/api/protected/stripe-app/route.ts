import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { appInstallations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Json } from '@/types';

interface CreateInstallationBody {
  stripeAccountId: string;
  installationId: string;
  settings?: Json;
}

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

    // Get user's app installations
    const installations = await db.query.appInstallations.findMany({
      where: eq(appInstallations.userId, session.user.id),
    });

    return NextResponse.json({ installations });
  } catch (error) {
    console.error('Error fetching installations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    const body = await req.json() as CreateInstallationBody;
    const { stripeAccountId, installationId, settings } = body;

    if (!stripeAccountId || !installationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create or update app installation
    const installation = await db
      .insert(appInstallations)
      .values({
        userId: session.user.id,
        stripeAccountId,
        installationId,
        settings: settings || {},
        isActive: true,
      })
      .onConflictDoUpdate({
        target: appInstallations.stripeAccountId,
        set: {
          installationId,
          settings: settings || {},
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ installation: installation[0] });
  } catch (error) {
    console.error('Error creating installation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
