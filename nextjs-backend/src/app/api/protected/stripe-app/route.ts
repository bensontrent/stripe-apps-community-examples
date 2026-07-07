import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
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

    const supabase = getSupabase();

    // The stripe_accounts(name) part follows the foreign key from
    // stripe_account_users to stripe_accounts, like a join. Without generated
    // database types supabase-js can't tell the embed is single-row, so spell
    // the shape out.
    const { data: memberships, error: membershipsError } = await supabase
      .from('stripe_account_users')
      .select('stripe_account_id, stripe_accounts ( name )')
      .eq('user_id', session.user.id)
      .returns<Array<{
        stripe_account_id: string;
        stripe_accounts: { name: string | null } | null;
      }>>();

    if (membershipsError) throw membershipsError;

    const accountIds = memberships.map((m) => m.stripe_account_id);
    let installations: Array<{ stripe_account_id: string }> = [];
    if (accountIds.length > 0) {
      const { data, error } = await supabase
        .from('stripe_app_installations')
        .select('*')
        .in('stripe_account_id', accountIds);
      if (error) throw error;
      installations = data;
    }

    const accounts = memberships.map((membership) => ({
      stripeAccountId: membership.stripe_account_id,
      name: membership.stripe_accounts?.name ?? null,
      installations: installations.filter(
        (i) => i.stripe_account_id === membership.stripe_account_id
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

    const supabase = getSupabase();

    // ignoreDuplicates makes these "insert if missing, leave alone if present"
    // (the SQL equivalent of ON CONFLICT DO NOTHING).
    const { error: accountError } = await supabase
      .from('stripe_accounts')
      .upsert(
        { stripe_account_id: stripeAccountId },
        { onConflict: 'stripe_account_id', ignoreDuplicates: true }
      );
    if (accountError) throw accountError;

    const { error: memberError } = await supabase
      .from('stripe_account_users')
      .upsert(
        { user_id: session.user.id, stripe_account_id: stripeAccountId },
        { onConflict: 'user_id,stripe_account_id', ignoreDuplicates: true }
      );
    if (memberError) throw memberError;

    const { data: installation, error: installationError } = await supabase
      .from('stripe_app_installations')
      .upsert(
        {
          stripe_account_id: stripeAccountId,
          livemode,
          installation_id: installationId,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_account_id,livemode' }
      )
      .select()
      .single();
    if (installationError) throw installationError;

    if (accountSettings !== undefined) {
      const { error } = await supabase
        .from('stripe_account_settings')
        .upsert(
          {
            stripe_account_id: stripeAccountId,
            livemode,
            settings: accountSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'stripe_account_id,livemode' }
        );
      if (error) throw error;
    }

    if (userSettings !== undefined) {
      const { error } = await supabase
        .from('stripe_account_user_settings')
        .upsert(
          {
            user_id: session.user.id,
            stripe_account_id: stripeAccountId,
            livemode,
            settings: userSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,stripe_account_id,livemode' }
        );
      if (error) throw error;
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
