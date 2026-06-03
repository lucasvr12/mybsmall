import { NextResponse } from "next/server";
import { pool, initDb } from "@/lib/db";

const ADMIN_PASSWORD = "myb2026$$";

function verifyAuth(req) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
    return false;
  }
  return true;
}

export async function POST(request) {
  await initDb();
  
  try {
    const body = await request.json();
    const { action, ...params } = body;

    // 1. Password verification check (doesn't require header auth yet)
    if (action === "verifyPassword") {
      const { password } = params;
      if (password === ADMIN_PASSWORD) {
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ success: false, error: "Contraseña incorrecta" }, { status: 401 });
    }

    // 2. Validate Authorization header for other admin actions
    if (!verifyAuth(request)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 3. Process Actions
    switch (action) {
      case "cancelAppointment": {
        const { id } = params;
        await pool.sql`UPDATE appointments SET status = 'Cancelada' WHERE id = ${id};`;
        return NextResponse.json({ success: true });
      }

      case "addStaff": {
        const { name, phone, img, branchIds, serviceIds } = params;
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString().slice(-4);
        const imagePath = img || "/Staff/laura.jpg";

        // Insert staff member
        await pool.sql`INSERT INTO staff (id, name, phone, img, active) VALUES (${id}, ${name}, ${phone}, ${imagePath}, TRUE);`;

        // Link to selected branches
        if (branchIds && branchIds.length > 0) {
          for (const bId of branchIds) {
            await pool.sql`INSERT INTO staff_branches (staff_id, branch_id, active) VALUES (${id}, ${bId}, TRUE);`;
          }
        }

        // Link to selected services
        if (serviceIds && serviceIds.length > 0) {
          for (const sId of serviceIds) {
            await pool.sql`INSERT INTO staff_services (staff_id, service_id, active) VALUES (${id}, ${sId}, TRUE);`;
          }
        }

        // Initialize default schedules (09:00 - 19:00, Monday to Sunday) for each branch
        const days = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
        if (branchIds && branchIds.length > 0) {
          for (const bId of branchIds) {
            for (const day of days) {
              await pool.sql`
                INSERT INTO schedules (staff_id, branch_id, day_of_week, start_time, end_time, active)
                VALUES (${id}, ${bId}, ${day}, '09:00', '19:00', TRUE);
              `;
            }
          }
        }

        return NextResponse.json({ success: true, id });
      }

      case "deleteStaff": {
        const { id } = params;
        // Cascades will delete relations and schedules automatically
        await pool.sql`DELETE FROM staff WHERE id = ${id};`;
        return NextResponse.json({ success: true });
      }

      case "addService": {
        const { name, category, price, durationMins } = params;
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString().slice(-4);

        // Insert service
        await pool.sql`INSERT INTO services (id, name, category, price, duration_mins, active) VALUES (${id}, ${name}, ${category}, ${price}, ${durationMins}, TRUE);`;

        // Automatically link this service to all existing staff members to keep configuration simple
        const staffResult = await pool.sql`SELECT id FROM staff;`;
        for (const row of staffResult.rows) {
          await pool.sql`INSERT INTO staff_services (staff_id, service_id, active) VALUES (${row.id}, ${id}, TRUE) ON CONFLICT DO NOTHING;`;
        }

        return NextResponse.json({ success: true, id });
      }

      case "deleteService": {
        const { id } = params;
        await pool.sql`DELETE FROM services WHERE id = ${id};`;
        return NextResponse.json({ success: true });
      }

      case "addBlock": {
        const { type, staffId, branchId, date, startTime, endTime, reason } = params;
        
        await pool.sql`
          INSERT INTO blocks (type, staff_id, branch_id, date, start_time, end_time, reason, active)
          VALUES (${type}, ${staffId || null}, ${branchId}, ${date}, ${startTime || null}, ${endTime || null}, ${reason}, TRUE);
        `;
        return NextResponse.json({ success: true });
      }

      case "deleteBlock": {
        const { id } = params;
        await pool.sql`DELETE FROM blocks WHERE id = ${id};`;
        return NextResponse.json({ success: true });
      }

      case "updateSchedule": {
        const { staffId, branchId, dayOfWeek, startTime, endTime, active } = params;

        // Check if schedule row exists
        const result = await pool.sql`
          SELECT id FROM schedules 
          WHERE staff_id = ${staffId} AND branch_id = ${branchId} AND day_of_week = ${dayOfWeek};
        `;

        if (result.rows.length > 0) {
          await pool.sql`
            UPDATE schedules 
            SET start_time = ${startTime}, end_time = ${endTime}, active = ${active} 
            WHERE id = ${result.rows[0].id};
          `;
        } else {
          await pool.sql`
            INSERT INTO schedules (staff_id, branch_id, day_of_week, start_time, end_time, active)
            VALUES (${staffId}, ${branchId}, ${dayOfWeek}, ${startTime}, ${endTime}, ${active});
          `;
        }

        return NextResponse.json({ success: true });
      }

      case "updateSchedulesBatch": {
        const { schedules } = params;
        if (!schedules || !Array.isArray(schedules)) {
          return NextResponse.json({ error: "Lista de horarios inválida" }, { status: 400 });
        }

        for (const item of schedules) {
          const { staffId, branchId, dayOfWeek, startTime, endTime, active } = item;
          const result = await pool.sql`
            SELECT id FROM schedules 
            WHERE staff_id = ${staffId} AND branch_id = ${branchId} AND day_of_week = ${dayOfWeek};
          `;

          if (result.rows.length > 0) {
            await pool.sql`
              UPDATE schedules 
              SET start_time = ${startTime}, end_time = ${endTime}, active = ${active} 
              WHERE id = ${result.rows[0].id};
            `;
          } else {
            await pool.sql`
              INSERT INTO schedules (staff_id, branch_id, day_of_week, start_time, end_time, active)
              VALUES (${staffId}, ${branchId}, ${dayOfWeek}, ${startTime}, ${endTime}, ${active});
            `;
          }
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
