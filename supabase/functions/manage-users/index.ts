// manage-users — admin-only staff directory writes for the Operations Console.
//
// The client is granted almost nothing on `profiles` (select + update(full_name,
// phone) only), so every staff mutation goes through here with the service role,
// mirroring transition-report. Three actions:
//   invite     -> create an auth account via inviteUserByEmail (real set-password
//                 email) and stamp its console_role / unit / access role.
//   set_role   -> change a staffer's console_role (and derived access role).
//   set_status -> suspend / reactivate (profiles.status).
//
// console_role is the org-chart label; user_role stays the true access boundary —
// Administrator gates as admin, Field Crew as crew (no console), the rest as officer.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CONSOLE_ROLES = ['Administrator', 'Supervisor', 'Officer', 'Dispatcher', 'Viewer', 'Field Crew'] as const;
type ConsoleRole = typeof CONSOLE_ROLES[number];

// The org-chart label collapses onto the 4-value access enum: Administrator gets
// admin, Field Crew are field workers (role='crew', gated out of the console),
// everyone else operates as officers.
function accessRole(consoleRole: ConsoleRole): 'admin' | 'officer' | 'crew' {
  if (consoleRole === 'Administrator') return 'admin';
  if (consoleRole === 'Field Crew') return 'crew';
  return 'officer';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'not signed in' }, 401);

  let body: {
    action?: string;
    email?: string; full_name?: string; console_role?: string; unit?: string; phone?: string;
    redirect_to?: string; user_id?: string; active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  const { action } = body;
  if (!action) return json({ error: 'action is required' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Gate: only an Administrator (DB role = admin) may manage the staff directory.
  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (caller?.role !== 'admin') return json({ error: 'administrators only' }, 403);

  switch (action) {
    case 'invite': {
      const email = body.email?.trim();
      const fullName = body.full_name?.trim() ?? '';
      const consoleRole = body.console_role as ConsoleRole | undefined;
      const unit = body.unit?.trim() || null;
      if (!email) return json({ error: 'email is required' }, 400);
      if (!consoleRole || !CONSOLE_ROLES.includes(consoleRole)) {
        return json({ error: 'a valid console_role is required' }, 400);
      }

      // Both paths fire the profile-bootstrap trigger, which reads this metadata.
      const metadata = {
        full_name: fullName,
        console_role: consoleRole,
        unit: unit ?? '',
        phone: body.phone?.trim() ?? '',
      };
      let invited: { user: { id: string } | null };
      let inviteErr: { message: string } | null;
      if (accessRole(consoleRole) === 'crew') {
        // Field Crew have no console/app to log into yet, so create the account
        // silently (no set-password email). They're notified via the branded
        // crew-assignment email when assigned to a crew (manage-crews).
        const res = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: metadata });
        invited = res.data; inviteErr = res.error;
      } else {
        // Console staff get a real set-password email. redirectTo lands the link
        // on the console's /set-password page (must be on the project's redirect
        // allow-list — see supabase/config.toml).
        const redirectTo = typeof body.redirect_to === 'string' ? body.redirect_to : undefined;
        const res = await admin.auth.admin.inviteUserByEmail(email, { data: metadata, redirectTo });
        invited = res.data; inviteErr = res.error;
      }
      if (inviteErr || !invited?.user) {
        return json({ error: inviteErr?.message ?? 'could not create user' }, 400);
      }

      // Set the access role (metadata only feeds full_name/console_role/unit via
      // the trigger; role/status are service-role writes).
      const { data: profile, error: updErr } = await admin
        .from('profiles')
        .update({ console_role: consoleRole, unit, role: accessRole(consoleRole) })
        .eq('id', invited.user.id)
        .select('id, full_name, email, console_role, unit, status, role')
        .single();
      if (updErr) return json({ error: updErr.message }, 400);
      return json({ profile });
    }

    case 'set_role': {
      const targetId = body.user_id;
      const consoleRole = body.console_role as ConsoleRole | undefined;
      if (!targetId) return json({ error: 'user_id is required' }, 400);
      if (!consoleRole || !CONSOLE_ROLES.includes(consoleRole)) {
        return json({ error: 'a valid console_role is required' }, 400);
      }
      const { data: profile, error } = await admin
        .from('profiles')
        .update({ console_role: consoleRole, role: accessRole(consoleRole) })
        .eq('id', targetId)
        .select('id, full_name, email, console_role, unit, status, role')
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ profile });
    }

    case 'set_status': {
      const targetId = body.user_id;
      if (!targetId) return json({ error: 'user_id is required' }, 400);
      if (typeof body.active !== 'boolean') return json({ error: 'active (boolean) is required' }, 400);
      if (targetId === user.id) return json({ error: 'you cannot change your own status' }, 409);
      const { data: profile, error } = await admin
        .from('profiles')
        .update({ status: body.active ? 'active' : 'suspended' })
        .eq('id', targetId)
        .select('id, full_name, email, console_role, unit, status, role')
        .single();
      if (error) return json({ error: error.message }, 400);
      return json({ profile });
    }

    default:
      return json({ error: 'unknown action' }, 400);
  }
});
