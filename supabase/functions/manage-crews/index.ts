// manage-crews — staff-gated crew membership writes for the Operations Console.
//
// Crew members are real users (profiles.role='crew'); membership is profiles.crew_id.
// Clients can't write crew_id, so every change goes through here with the service
// role, mirroring manage-users / transition-report. Assigning or moving a member
// sends a branded email + in-app notification (the branded-email pattern is copied
// from transition-report; edge functions are self-contained Deno files). Field crew
// have no app to log into yet, so accounts are created without a set-password link.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// mirrors crew_department enum -> display label (matches console DEPT_LABEL)
const DEPT_LABEL: Record<string, string> = {
  sanitation: 'Sanitation', drainage: 'Drainage', electrical: 'Electrical',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// HTML escaping: prevents XSS from user text interpolated into email HTML
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// inline-styled branded email (email clients strip <style>/external CSS)
function renderCrewEmail(name: string, verb: string, crewName: string, dept: string): string {
  return `
<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;background:#FAFAFA">
  <div style="background:#0B2545;padding:24px;text-align:center">
    <span style="display:inline-block;background:#C8932F;color:#0B2545;font-size:14px;font-weight:800;letter-spacing:0.03em;padding:6px 10px;border-radius:8px">AWMA</span>
    <div style="color:#ffffff;font-size:18px;font-weight:700;margin-top:10px">FixMyCity Operations</div>
  </div>
  <div style="background:#ffffff;padding:24px;border:1px solid #E5E7EB;border-top:none">
    <p style="color:#1F2937;font-size:15px;line-height:1.5;margin:0 0 16px">Hello ${escapeHtml(name)},</p>
    <p style="color:#1F2937;font-size:15px;line-height:1.5;margin:0 0 16px">You have been ${escapeHtml(verb)} <strong>${escapeHtml(crewName)}</strong> — the Ayawaso West Municipal Assembly ${escapeHtml(dept)} field crew.</p>
    <div style="background:#FAFAFA;border-radius:12px;padding:16px;margin:16px 0">
      <p style="color:#6B7280;font-size:12px;margin:0 0 4px">Your crew</p>
      <p style="color:#1F2937;font-size:15px;font-weight:600;margin:0">${escapeHtml(crewName)}</p>
      <p style="color:#6B7280;font-size:13px;margin:4px 0 0">${escapeHtml(dept)}</p>
    </div>
    <p style="color:#6B7280;font-size:13px;line-height:1.5;margin:16px 0 0">Your dispatcher will be in touch with assignments. No action is needed right now.</p>
  </div>
  <p style="color:#6B7280;font-size:11px;text-align:center;padding:16px">FixMyCity &middot; AWMA pilot &middot; Accra</p>
</div>`.trim();
}

function renderCrewEmailText(name: string, verb: string, crewName: string, dept: string): string {
  return `FixMyCity Operations\n\nHello ${name},\n\nYou have been ${verb} ${crewName} — the AWMA ${dept} field crew.\n\nYour dispatcher will be in touch with assignments. No action is needed right now.\n\nFixMyCity · AWMA pilot · Accra`;
}

async function sendCrewEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) { console.error('RESEND_API_KEY not configured — skipping email'); return; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: 'FixMyCity <noreply@fixmycity.gov.gh>', to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`resend returned ${res.status}: ${await res.text()}`);
}

// deno-lint-ignore no-explicit-any
type Admin = any;

// Keep crews.member_count in step with the real profiles.crew_id roster.
async function resyncCount(admin: Admin, crewId: string | null) {
  if (!crewId) return;
  const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('crew_id', crewId);
  await admin.from('crews').update({ member_count: count ?? 0 }).eq('id', crewId);
}

// Move a member to a crew: update crew_id, resync both crews' counts, notify.
async function assignToCrew(admin: Admin, memberId: string, fromCrewId: string | null, toCrewId: string) {
  const { data: crew } = await admin.from('crews').select('name, department').eq('id', toCrewId).single();
  if (!crew) return json({ error: 'crew not found' }, 404);

  const { error: updErr } = await admin.from('profiles').update({ crew_id: toCrewId }).eq('id', memberId);
  if (updErr) return json({ error: updErr.message }, 400);

  await resyncCount(admin, toCrewId);
  if (fromCrewId && fromCrewId !== toCrewId) await resyncCount(admin, fromCrewId);

  const { data: member } = await admin.from('profiles').select('full_name, email').eq('id', memberId).single();
  const dept = DEPT_LABEL[crew.department] ?? crew.department;
  const moved = !!fromCrewId && fromCrewId !== toCrewId;
  const verb = moved ? 'moved to' : 'assigned to';
  const body = `You've been ${verb} ${crew.name} (${dept}).`;

  // in-app notification (report_id is nullable — this is a membership event)
  try {
    await admin.from('notifications').insert({ user_id: memberId, report_id: null, type: 'crew_assignment', body });
  } catch (e) { console.error('notification insert failed', e); }

  // branded email (non-fatal)
  const email = member?.email as string | undefined;
  if (email) {
    try {
      const name = (member?.full_name as string) || 'there';
      await sendCrewEmail(
        email,
        moved ? `You've been moved to ${crew.name}` : `You've been added to ${crew.name}`,
        renderCrewEmail(name, verb, crew.name, dept),
        renderCrewEmailText(name, verb, crew.name, dept),
      );
    } catch (e) { console.error('crew email failed', e); }
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('id, full_name, email, console_role, unit, status, role, crew_id')
    .eq('id', memberId).single();
  return json({ profile });
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
    user_id?: string; crew_id?: string; full_name?: string; email?: string; name?: string;
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

  // Gate: any console staff (officer/admin) may manage crew membership.
  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (caller?.role !== 'officer' && caller?.role !== 'admin') return json({ error: 'staff only' }, 403);

  switch (action) {
    case 'add_member': {
      const crewId = body.crew_id;
      if (!crewId) return json({ error: 'crew_id is required' }, 400);

      // Assign an existing crew user...
      if (body.user_id) {
        const { data: member } = await admin.from('profiles').select('crew_id, role').eq('id', body.user_id).single();
        if (!member) return json({ error: 'member not found' }, 404);
        return assignToCrew(admin, body.user_id, member.crew_id ?? null, crewId);
      }

      // ...or create-and-assign a new Field Crew user.
      const email = body.email?.trim();
      const fullName = body.full_name?.trim() ?? '';
      if (!email) return json({ error: 'email is required to invite a new member' }, 400);
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email, email_confirm: true,
        user_metadata: { full_name: fullName, console_role: 'Field Crew' },
      });
      if (createErr || !created?.user) return json({ error: createErr?.message ?? 'could not create user' }, 400);
      const { error: roleErr } = await admin.from('profiles')
        .update({ role: 'crew', console_role: 'Field Crew' }).eq('id', created.user.id);
      if (roleErr) return json({ error: roleErr.message }, 400);
      return assignToCrew(admin, created.user.id, null, crewId);
    }

    case 'move_member': {
      const { user_id: memberId, crew_id: crewId } = body;
      if (!memberId || !crewId) return json({ error: 'user_id and crew_id are required' }, 400);
      const { data: member } = await admin.from('profiles').select('crew_id').eq('id', memberId).single();
      if (!member) return json({ error: 'member not found' }, 404);
      return assignToCrew(admin, memberId, member.crew_id ?? null, crewId);
    }

    case 'remove_member': {
      const memberId = body.user_id;
      if (!memberId) return json({ error: 'user_id is required' }, 400);
      const { data: member } = await admin.from('profiles').select('crew_id').eq('id', memberId).single();
      if (!member) return json({ error: 'member not found' }, 404);
      const { error } = await admin.from('profiles').update({ crew_id: null }).eq('id', memberId);
      if (error) return json({ error: error.message }, 400);
      await resyncCount(admin, member.crew_id ?? null);
      return json({ ok: true });
    }

    case 'set_lead': {
      const { crew_id: crewId, name } = body;
      if (!crewId || !name?.trim()) return json({ error: 'crew_id and name are required' }, 400);
      const { error } = await admin.from('crews').update({ lead_name: name.trim() }).eq('id', crewId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    default:
      return json({ error: 'unknown action' }, 400);
  }
});
