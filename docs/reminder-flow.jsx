import { useState } from "react";

const ACCENT = "#c9a86c";
const ACCENT_DIM = "rgba(201,168,108,0.13)";
const DANGER = "#e07a7a";
const GREEN = "#6daf82";
const GREEN_DIM = "rgba(109,175,130,0.13)";
const BLUE = "#7aa2e0";
const BLUE_DIM = "rgba(122,162,224,0.13)";
const BG = "#0a0a0b";
const SURFACE = "#111113";
const SURFACE2 = "#18181b";
const SURFACE3 = "#222226";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT = "#ececee";
const TEXT2 = "#8b8b96";
const TEXT3 = "#55555f";

const mono = "'IBM Plex Mono', monospace";
const sans = "'DM Sans', system-ui, sans-serif";

/* ── primitives ── */
function Box({ children, style }) {
  return <div style={{ fontFamily: sans, ...style }}>{children}</div>;
}

function Node({ color = ACCENT, dim = ACCENT_DIM, icon, label, sub, style }) {
  return (
    <div style={{
      background: dim,
      border: `1px solid ${color}44`,
      borderRadius: 12,
      padding: "12px 18px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      minWidth: 220,
      ...style,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 8,
        background: `${color}22`, border: `1px solid ${color}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: TEXT2, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Arrow({ label, color = TEXT3, vertical = true }) {
  return (
    <div style={{
      display: "flex", flexDirection: vertical ? "column" : "row",
      alignItems: "center", gap: 2,
      margin: vertical ? "4px 0" : "0 4px",
    }}>
      <div style={{ width: vertical ? 1 : 28, height: vertical ? 28 : 1, background: color }} />
      {label && <div style={{ fontSize: 10, color, fontFamily: mono, whiteSpace: "nowrap" }}>{label}</div>}
      <div style={{ fontSize: 12, color, lineHeight: 1 }}>{vertical ? "▼" : "▶"}</div>
    </div>
  );
}

function Decision({ label, sub }) {
  return (
    <div style={{
      background: SURFACE2,
      border: `1px dashed ${ACCENT}88`,
      borderRadius: 10,
      padding: "10px 20px",
      textAlign: "center",
      minWidth: 200,
      position: "relative",
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: TEXT2, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children, color = ACCENT }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color,
      letterSpacing: "0.08em", fontFamily: mono,
      marginBottom: 14, paddingLeft: 4,
      borderLeft: `2px solid ${color}`,
      paddingLeft: 10,
    }}>{children}</div>
  );
}

function Lane({ title, color, children, style }) {
  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      padding: "20px 18px",
      flex: 1,
      minWidth: 0,
      ...style,
    }}>
      <SectionTitle color={color}>{title}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
        {children}
      </div>
    </div>
  );
}

function EmailCard({ n, time, faded }) {
  return (
    <div style={{
      background: faded ? `${SURFACE3}88` : SURFACE2,
      border: `1px solid ${faded ? BORDER : BLUE + "44"}`,
      borderRadius: 8,
      padding: "8px 12px",
      display: "flex",
      alignItems: "center",
      gap: 10,
      opacity: faded ? 0.4 : 1,
      minWidth: 180,
      position: "relative",
    }}>
      {faded && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 8,
          background: "repeating-linear-gradient(-45deg,transparent,transparent 4px,rgba(224,122,122,0.07) 4px,rgba(224,122,122,0.07) 8px)",
        }} />
      )}
      <div style={{ fontSize: 14 }}>📧</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: faded ? TEXT3 : TEXT, fontFamily: mono }}>
          Mail #{n}
        </div>
        <div style={{ fontSize: 10, color: TEXT3 }}>{time}</div>
      </div>
      {faded && <div style={{ marginLeft: "auto", fontSize: 10, color: DANGER, fontFamily: mono }}>CANCELLED</div>}
    </div>
  );
}

/* ── tabs ── */
const TABS = ["Type 1 — Daily Reminder", "Type 2 — Smart Due Date"];

export default function App() {
  const [tab, setTab] = useState(0);

  return (
    <div style={{
      background: BG, minHeight: "100vh", color: TEXT,
      fontFamily: sans, padding: "32px 24px",
    }}>
      {/* header */}
      <div style={{ maxWidth: 860, margin: "0 auto 32px" }}>
        <div style={{ fontSize: 11, color: ACCENT, fontFamily: mono, letterSpacing: "0.08em", marginBottom: 8 }}>
          QUICKCHECK · REMINDER FEATURE
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 8 }}>
          Reminder Flow
        </div>
        <div style={{ fontSize: 14, color: TEXT2, maxWidth: 480 }}>
          Two reminder types — daily cadence and smart due-date stacking with one-click cancel.
        </div>

        {/* tabs */}
        <div style={{
          display: "flex", gap: 6, marginTop: 24,
          background: SURFACE, border: `1px solid ${BORDER}`,
          borderRadius: 10, padding: 4, width: "fit-content",
        }}>
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setTab(i)} style={{
              background: tab === i ? SURFACE2 : "none",
              border: tab === i ? `1px solid ${BORDER}` : "1px solid transparent",
              borderRadius: 8, padding: "8px 16px",
              fontSize: 13, fontWeight: 500,
              color: tab === i ? TEXT : TEXT2,
              cursor: "pointer", fontFamily: sans,
              transition: "all 0.15s",
            }}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {tab === 0 ? <DailyFlow /> : <SmartFlow />}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   TYPE 1 — DAILY REMINDER
══════════════════════════════════════════ */
function DailyFlow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Step 1 */}
      <Lane title="01 · USER SETUP" color={ACCENT}>
        <Node color={ACCENT} dim={ACCENT_DIM} icon="✅" label="User picks a checklist" sub="e.g. Deploy checklist" />
        <Arrow />
        <Node color={ACCENT} dim={ACCENT_DIM} icon="📅" label="Sets date range" sub="e.g. Jan 9 → Jan 19 (11 days)" />
        <Arrow />
        <Node color={ACCENT} dim={ACCENT_DIM} icon="⏰" label="Sets daily time" sub="9:00 AM every morning" />
        <Arrow />
        <Node color={ACCENT} dim={ACCENT_DIM} icon="💾" label="Reminder saved to DB" sub="table: reminders · type: daily" />
      </Lane>

      <Arrow label="cron job fires each day at 9 AM" color={ACCENT} />

      {/* Step 2 */}
      <Lane title="02 · SUPABASE EDGE FUNCTION (daily-reminder)" color={BLUE}>
        <Node color={BLUE} dim={BLUE_DIM} icon="🔍" label="Query active daily reminders" sub="WHERE date BETWEEN start AND end" />
        <Arrow />
        <Node color={BLUE} dim={BLUE_DIM} icon="📤" label="Send 1 email per reminder" sub="via Resend / SMTP" />
        <Arrow />
        <Node color={BLUE} dim={BLUE_DIM} icon="📝" label="Log send in reminder_logs" sub="sent_at, reminder_id, user_id" />
      </Lane>

      <Arrow label="user receives email" color={BLUE} />

      {/* Step 3 */}
      <Lane title="03 · EMAIL CONTENT" color={GREEN}>
        <div style={{
          background: SURFACE2, border: `1px solid ${BORDER}`,
          borderRadius: 10, padding: 16, width: "100%",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 8 }}>📧 Email Preview</div>
          <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.8 }}>
            <div>📋 <span style={{ color: TEXT }}>Daily reminder:</span> Deploy checklist</div>
            <div>📅 <span style={{ color: TEXT }}>Day 3 of 11</span> · Jan 11, 9:00 AM</div>
            <div>✅ Progress: <span style={{ color: GREEN }}>2 / 8 items done</span></div>
            <br />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{
                background: ACCENT, borderRadius: 6, padding: "6px 14px",
                fontSize: 11, fontWeight: 600, color: BG,
              }}>Open Checklist →</div>
              <div style={{
                background: SURFACE3, border: `1px solid ${BORDER}`,
                borderRadius: 6, padding: "6px 14px",
                fontSize: 11, color: TEXT2,
              }}>Stop reminders</div>
            </div>
          </div>
        </div>
      </Lane>

      <Arrow label="user clicks 'Stop reminders'" color={DANGER} />

      {/* Step 4 */}
      <Lane title="04 · STOP LOGIC" color={DANGER}>
        <Node color={DANGER} dim={`${DANGER}15`} icon="🛑" label="Webhook hits stop-reminder endpoint" sub="reminder_id in URL token" />
        <Arrow />
        <Node color={DANGER} dim={`${DANGER}15`} icon="🗃️" label="Set active = false in DB" sub="no more emails sent" />
      </Lane>

      {/* DB schema hint */}
      <div style={{
        background: SURFACE, border: `1px solid ${BORDER}`,
        borderRadius: 10, padding: 16, fontFamily: mono, fontSize: 11, color: TEXT2,
        lineHeight: 1.8,
      }}>
        <div style={{ color: ACCENT, marginBottom: 6 }}>-- Supabase table: reminders</div>
        <div><span style={{ color: BLUE }}>id</span>, <span style={{ color: GREEN }}>user_id</span>, checklist_id, type: <span style={{ color: ACCENT }}>'daily'</span>,</div>
        <div>start_date, end_date, send_time, active, created_at</div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   TYPE 2 — SMART DUE DATE
══════════════════════════════════════════ */
function SmartFlow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Step 1 */}
      <Lane title="01 · USER SETUP" color={ACCENT}>
        <Node color={ACCENT} dim={ACCENT_DIM} icon="🎯" label="User picks a checklist task" sub="e.g. 'Ship v2.0'" />
        <Arrow />
        <Node color={ACCENT} dim={ACCENT_DIM} icon="📅" label="Sets a due date" sub="e.g. Jan 20" />
        <Arrow />
        <Node color={ACCENT} dim={ACCENT_DIM} icon="💾" label="System schedules 5 emails" sub="spread across Jan 20, every ~4–5 hrs" style={{ width: "100%" }} />
      </Lane>

      {/* Schedule visual */}
      <div style={{
        background: SURFACE, border: `1px solid ${BORDER}`,
        borderRadius: 12, padding: 18,
      }}>
        <SectionTitle color={BLUE}>02 · JAN 20 EMAIL SCHEDULE (auto-generated)</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { n: 1, time: "8:00 AM · Morning nudge" },
            { n: 2, time: "12:00 PM · Midday check-in" },
            { n: 3, time: "3:00 PM · Afternoon push" },
            { n: 4, time: "6:00 PM · Evening warning" },
            { n: 5, time: "9:00 PM · Final reminder" },
          ].map(m => (
            <EmailCard key={m.n} n={m.n} time={m.time} />
          ))}
        </div>
        <div style={{ fontSize: 11, color: TEXT3, marginTop: 10, fontFamily: mono }}>
          5 jobs queued in reminder_jobs table · status: pending
        </div>
      </div>

      <Arrow label="cron fires → sends mail #1 at 8 AM" color={BLUE} />

      {/* Decision loop */}
      <Lane title="03 · AFTER EACH EMAIL SEND" color={BLUE}>
        <Node color={BLUE} dim={BLUE_DIM} icon="📧" label="Email sent to user" sub="with 'Mark as Done' CTA button" />
        <Arrow />
        <Decision label="Did user click 'Mark as Done'?" />

        {/* two branches */}
        <div style={{ display: "flex", gap: 24, marginTop: 8, width: "100%", justifyContent: "center" }}>
          {/* NO branch */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <div style={{ fontSize: 10, color: TEXT3, fontFamily: mono, marginBottom: 4 }}>NO</div>
            <Arrow color={TEXT3} />
            <Node color={TEXT2} dim={SURFACE2} icon="⏳" label="Wait for next slot" sub="next email sends on schedule" style={{ minWidth: 0, flex: 1 }} />
          </div>

          {/* YES branch */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
            <div style={{ fontSize: 10, color: GREEN, fontFamily: mono, marginBottom: 4 }}>YES ✓</div>
            <Arrow color={GREEN} />
            <Node color={GREEN} dim={GREEN_DIM} icon="🎉" label="Task marked done" sub="remaining emails cancelled" style={{ minWidth: 0, flex: 1 }} />
          </div>
        </div>
      </Lane>

      <Arrow label="user clicked done after mail #3" color={GREEN} />

      {/* Cancellation visual */}
      <div style={{
        background: SURFACE, border: `1px solid ${BORDER}`,
        borderRadius: 12, padding: 18,
      }}>
        <SectionTitle color={GREEN}>04 · QUEUE AFTER 'MARK AS DONE' ON MAIL #3</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <EmailCard n={1} time="8:00 AM · sent ✓" />
          <EmailCard n={2} time="12:00 PM · sent ✓" />
          <div style={{ position: "relative" }}>
            <EmailCard n={3} time="3:00 PM · user clicked DONE here" />
            <div style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: GREEN_DIM, border: `1px solid ${GREEN}44`,
              borderRadius: 6, padding: "3px 8px",
              fontSize: 10, color: GREEN, fontFamily: mono,
            }}>DONE ✓</div>
          </div>
          <EmailCard n={4} time="6:00 PM · cancelled" faded />
          <EmailCard n={5} time="9:00 PM · cancelled" faded />
        </div>
        <div style={{ fontSize: 11, color: GREEN, marginTop: 10, fontFamily: mono }}>
          → reminder_jobs WHERE id IN (4,5): status = 'cancelled'
        </div>
      </div>

      {/* DB schema */}
      <div style={{
        background: SURFACE, border: `1px solid ${BORDER}`,
        borderRadius: 10, padding: 16, fontFamily: mono, fontSize: 11, color: TEXT2,
        lineHeight: 1.8,
      }}>
        <div style={{ color: ACCENT, marginBottom: 6 }}>-- Supabase tables</div>
        <div><span style={{ color: BLUE }}>reminders</span>: id, user_id, checklist_id, task_id, type: <span style={{ color: ACCENT }}>'smart'</span>, due_date, done_at</div>
        <div><span style={{ color: GREEN }}>reminder_jobs</span>: id, reminder_id, scheduled_at, status: <span style={{ color: ACCENT }}>'pending'|'sent'|'cancelled'</span>, token</div>
        <div style={{ color: TEXT3, marginTop: 6 }}>-- token: unique UUID in email CTA link → POST /mark-done/:token</div>
      </div>

      {/* Email preview */}
      <Lane title="05 · EMAIL CONTENT" color={GREEN}>
        <div style={{
          background: SURFACE2, border: `1px solid ${BORDER}`,
          borderRadius: 10, padding: 16, width: "100%",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: TEXT, marginBottom: 8 }}>📧 Smart Reminder Email</div>
          <div style={{ fontSize: 12, color: TEXT2, lineHeight: 1.8 }}>
            <div>⚠️ <span style={{ color: ACCENT }}>Due today:</span> Ship v2.0</div>
            <div>📋 Checklist: <span style={{ color: TEXT }}>Deploy checklist</span></div>
            <div>📨 <span style={{ color: TEXT }}>Reminder 3 of 5</span> · 3:00 PM</div>
            <br />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{
                background: GREEN, borderRadius: 6, padding: "6px 14px",
                fontSize: 11, fontWeight: 700, color: BG,
              }}>✓ Mark as Done</div>
              <div style={{
                background: ACCENT, borderRadius: 6, padding: "6px 14px",
                fontSize: 11, fontWeight: 600, color: BG,
              }}>Open Checklist →</div>
            </div>
            <div style={{ fontSize: 10, color: TEXT3, marginTop: 8 }}>
              Clicking "Mark as Done" cancels remaining reminders instantly.
            </div>
          </div>
        </div>
      </Lane>
    </div>
  );
}
