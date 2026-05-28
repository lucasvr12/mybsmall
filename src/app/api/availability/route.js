import { NextResponse } from "next/server";
import { getAdminData, getReservations } from "@/lib/sheets";

// Helper to convert "HH:MM" to minutes from midnight
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

// Helper to convert minutes from midnight to "HH:MM"
function minutesToTime(mins) {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}`;
}

// Helper to check if a date string YYYY-MM-DD is today in Monterrey time
function isTodayInMonterrey(dateStr) {
  const monterreyDateStr = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Monterrey",
  }); // returns "YYYY-MM-DD"
  return dateStr === monterreyDateStr;
}

// Helper to get current minutes from midnight in Monterrey
function getCurrentMinutesInMonterrey() {
  const localTime = new Date().toLocaleTimeString("en-US", {
    timeZone: "America/Monterrey",
    hour12: false,
  }); // returns "HH:MM:SS"
  const [hours, minutes] = localTime.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const branchId = searchParams.get("branch");
  const serviceId = searchParams.get("service");
  const staffName = searchParams.get("stylist"); // Staff name, e.g. "Edith"

  if (!date || !branchId || !serviceId || !staffName) {
    return NextResponse.json(
      { error: "Faltan parámetros obligatorios: date, branch, service, stylist" },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch all config and reservations in parallel
    const [adminData, reservations] = await Promise.all([
      getAdminData(),
      getReservations(),
    ]);

    const { branches, services, staff, staffBranches, staffServices, schedules, blocks } = adminData;

    // 2. Validate Branch
    const branch = branches.find((b) => b.id === branchId && b.active);
    if (!branch) {
      return NextResponse.json({ error: "La sucursal seleccionada no existe o está inactiva" }, { status: 400 });
    }

    // 3. Validate Service
    const service = services.find((s) => s.id === serviceId && s.active);
    if (!service) {
      return NextResponse.json({ error: "El servicio seleccionado no existe o está inactivo" }, { status: 400 });
    }
    const durationMins = service.durationMins;

    // 4. Validate Staff member
    // The client sends the stylist's NAME (e.g. "Edith" or "Sin preferencia")
    let targetStaff = null;
    let isAnyStylist = staffName.toLowerCase() === "sin preferencia" || staffName === "Cualquiera disponible";

    if (!isAnyStylist) {
      targetStaff = staff.find((s) => s.name.toLowerCase() === staffName.toLowerCase() && s.active);
      if (!targetStaff) {
        return NextResponse.json({ error: "El estilista seleccionado no existe o está inactivo" }, { status: 400 });
      }

      // Check if targetStaff works at the selected branch
      const worksAtBranch = staffBranches.some(
        (sb) => sb.staffId === targetStaff.id && sb.branchId === branchId && sb.active
      );
      if (!worksAtBranch) {
        return NextResponse.json({ error: "El estilista no trabaja en la sucursal seleccionada" }, { status: 400 });
      }

      // Check if targetStaff can perform the selected service
      const canDoService = staffServices.some(
        (ss) => ss.staffId === targetStaff.id && ss.serviceId === serviceId && ss.active
      );
      if (!canDoService) {
        return NextResponse.json({ error: "El estilista no realiza el servicio seleccionado" }, { status: 400 });
      }
    }

    // 5. Determine which stylists we can consider
    let stylistsToEvaluate = [];
    if (isAnyStylist) {
      // Find all active stylists working in this branch that can perform this service
      stylistsToEvaluate = staff.filter((s) => {
        if (!s.active) return false;
        const works = staffBranches.some((sb) => sb.staffId === s.id && sb.branchId === branchId && sb.active);
        const canDo = staffServices.some((ss) => ss.staffId === s.id && ss.serviceId === serviceId && ss.active);
        return works && canDo;
      });
    } else {
      stylistsToEvaluate = [targetStaff];
    }

    if (stylistsToEvaluate.length === 0) {
      return NextResponse.json({ message: "No hay estilistas disponibles para esta combinación", availableSlots: [] });
    }

    // 6. Find weekday in Spanish
    // sv-SE locale parsing is timezone-safe for YYYY-MM-DD split
    const daysOfWeek = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const [yr, mo, dy] = date.split("-").map(Number);
    const dateObj = new Date(yr, mo - 1, dy);
    const dayOfWeekName = daysOfWeek[dateObj.getDay()];

    // 7. Calculate slots for all candidate stylists and merge availability
    // A slot is available if AT LEAST ONE stylist has it free!
    // We will generate slots in 30-minute intervals
    const allCandidateSlots = {};

    for (const stylistObj of stylistsToEvaluate) {
      // Find shift schedule for this stylist at this branch for this weekday
      const shift = schedules.find(
        (sch) =>
          sch.staffId === stylistObj.id &&
          sch.branchId === branchId &&
          sch.dayOfWeek === dayOfWeekName &&
          sch.active
      );

      if (!shift) continue; // Stylist doesn't work today at this branch

      const shiftStartMins = timeToMinutes(shift.startTime);
      const shiftEndMins = timeToMinutes(shift.endTime);

      // Get manual blocks that apply to this stylist or to the whole branch on this date
      const activeBlocks = blocks.filter(
        (b) =>
          b.branchId === branchId &&
          b.date === date &&
          (!b.staffId || b.staffId === stylistObj.id)
      );

      // Get active reservations for this stylist on this date
      const activeReservations = reservations.filter(
        (r) =>
          r.date === date &&
          r.branch === branch.name &&
          r.staff.toLowerCase() === stylistObj.name.toLowerCase() &&
          r.status.toLowerCase() !== "cancelada"
      );

      // Generate 30-minute interval slots
      for (let timeMins = shiftStartMins; timeMins + durationMins <= shiftEndMins; timeMins += 30) {
        const slotStart = timeMins;
        const slotEnd = timeMins + durationMins;
        const slotTimeStr = minutesToTime(slotStart);

        let isAvailable = true;

        // A. Filter past times if date is today
        if (isTodayInMonterrey(date)) {
          const currentMinutes = getCurrentMinutesInMonterrey();
          if (slotStart <= currentMinutes) {
            isAvailable = false;
          }
        }

        // B. Check Manual Blocks
        if (isAvailable) {
          for (const block of activeBlocks) {
            if (!block.startTime && !block.endTime) {
              // Full day block
              isAvailable = false;
              break;
            } else {
              // Partial time block
              const blockStart = timeToMinutes(block.startTime);
              const blockEnd = timeToMinutes(block.endTime);
              // Overlap check: blockStart < slotEnd && blockEnd > slotStart
              if (blockStart < slotEnd && blockEnd > slotStart) {
                isAvailable = false;
                break;
              }
            }
          }
        }

        // C. Check Existing Reservations (Avoid Collisions)
        if (isAvailable) {
          for (const res of activeReservations) {
            const resStart = timeToMinutes(res.time);
            const resEnd = resStart + res.durationMins;
            // Overlap check
            if (resStart < slotEnd && resEnd > slotStart) {
              isAvailable = false;
              break;
            }
          }
        }

        // If available, register it
        if (!allCandidateSlots[slotTimeStr]) {
          allCandidateSlots[slotTimeStr] = {
            time: slotTimeStr,
            available: false,
          };
        }

        if (isAvailable) {
          allCandidateSlots[slotTimeStr].available = true;
        }
      }
    }

    // Convert object values to sorted array
    const sortedSlots = Object.values(allCandidateSlots).sort((a, b) => {
      return timeToMinutes(a.time) - timeToMinutes(b.time);
    });

    return NextResponse.json({
      date,
      branch: branch.name,
      service: service.name,
      stylist: staffName,
      availableSlots: sortedSlots,
    });
  } catch (error) {
    console.error("Availability calculation error:", error);
    return NextResponse.json({ error: "Error interno al calcular disponibilidad: " + error.message }, { status: 500 });
  }
}
