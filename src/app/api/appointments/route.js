import { NextResponse } from "next/server";
import { getAdminData, getReservations, saveReservation } from "@/lib/sheets";
import { createCalendarEvent } from "@/lib/calendar";

// Helper to convert "HH:MM" to minutes from midnight
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

// Helper to check if a date string YYYY-MM-DD is today in Monterrey time
function isTodayInMonterrey(dateStr) {
  const monterreyDateStr = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Monterrey",
  });
  return dateStr === monterreyDateStr;
}

// Helper to get current minutes from midnight in Monterrey
function getCurrentMinutesInMonterrey() {
  const localTime = new Date().toLocaleTimeString("en-US", {
    timeZone: "America/Monterrey",
    hour12: false,
  });
  const [hours, minutes] = localTime.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { branch: branchId, service: serviceId, stylist: stylistName, date, time, name: clientName, phone: clientPhone } = body;

    // 1. Basic validation
    if (!branchId || !serviceId || !stylistName || !date || !time || !clientName || !clientPhone) {
      return NextResponse.json({ error: "Faltan campos obligatorios en el formulario" }, { status: 400 });
    }

    // 2. Fetch admin data and existing reservations
    const adminData = await getAdminData();
    const reservations = await getReservations();

    const { branches, services, staff, staffBranches, staffServices, schedules, blocks } = adminData;

    // 3. Find active branch and service
    const branch = branches.find((b) => b.id === branchId && b.active);
    if (!branch) {
      return NextResponse.json({ error: "La sucursal seleccionada está inactiva" }, { status: 400 });
    }

    const service = services.find((s) => s.id === serviceId && s.active);
    if (!service) {
      return NextResponse.json({ error: "El servicio seleccionado está inactivo" }, { status: 400 });
    }
    const durationMins = service.durationMins;

    // 4. Identify candidate stylists
    let targetStaffList = [];
    const isAnyStylist = stylistName.toLowerCase() === "sin preferencia" || stylistName === "Cualquiera disponible";

    if (isAnyStylist) {
      // Find all active stylists working in this branch that can perform this service
      targetStaffList = staff.filter((s) => {
        if (!s.active) return false;
        const works = staffBranches.some((sb) => sb.staffId === s.id && sb.branchId === branchId && sb.active);
        const canDo = staffServices.some((ss) => ss.staffId === s.id && ss.serviceId === serviceId && ss.active);
        return works && canDo;
      });
    } else {
      const target = staff.find((s) => s.name.toLowerCase() === stylistName.toLowerCase() && s.active);
      if (target) {
        targetStaffList = [target];
      }
    }

    if (targetStaffList.length === 0) {
      return NextResponse.json({ error: "No hay estilistas disponibles para esta combinación" }, { status: 400 });
    }

    // 5. Weekday calculations in Spanish
    const daysOfWeek = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const [yr, mo, dy] = date.split("-").map(Number);
    const dateObj = new Date(yr, mo - 1, dy);
    const dayOfWeekName = daysOfWeek[dateObj.getDay()];

    // 6. Double Availability Check and stylist assignment
    // Find the first stylist in the list who is actually free for this exact slot
    let assignedStaff = null;

    const slotStart = timeToMinutes(time);
    const slotEnd = slotStart + durationMins;

    for (const stylistObj of targetStaffList) {
      let stylistAvailable = true;

      // A. Verify if stylist has shift today
      const shift = schedules.find(
        (sch) =>
          sch.staffId === stylistObj.id &&
          sch.branchId === branchId &&
          sch.dayOfWeek === dayOfWeekName &&
          sch.active
      );
      if (!shift) continue;

      const shiftStartMins = timeToMinutes(shift.startTime);
      const shiftEndMins = timeToMinutes(shift.endTime);

      if (slotStart < shiftStartMins || slotEnd > shiftEndMins) {
        continue; // Out of shifts
      }

      // B. Filter past time
      if (isTodayInMonterrey(date)) {
        const currentMinutes = getCurrentMinutesInMonterrey();
        if (slotStart <= currentMinutes) {
          continue;
        }
      }

      // C. Verify blocks
      const activeBlocks = blocks.filter(
        (b) =>
          b.branchId === branchId &&
          b.date === date &&
          (!b.staffId || b.staffId === stylistObj.id)
      );

      for (const block of activeBlocks) {
        if (!block.startTime && !block.endTime) {
          stylistAvailable = false; // blocked full day
          break;
        } else {
          const blockStart = timeToMinutes(block.startTime);
          const blockEnd = timeToMinutes(block.endTime);
          if (blockStart < slotEnd && blockEnd > slotStart) {
            stylistAvailable = false; // time blocked
            break;
          }
        }
      }

      if (!stylistAvailable) continue;

      // D. Verify active reservations
      const activeReservations = reservations.filter(
        (r) =>
          r.date === date &&
          r.branch === branch.name &&
          r.staff.toLowerCase() === stylistObj.name.toLowerCase() &&
          r.status.toLowerCase() !== "cancelada"
      );

      for (const res of activeReservations) {
        const resStart = timeToMinutes(res.time);
        const resEnd = resStart + res.durationMins;
        if (resStart < slotEnd && resEnd > slotStart) {
          stylistAvailable = false; // slot already booked
          break;
        }
      }

      if (stylistAvailable) {
        assignedStaff = stylistObj;
        break; // Found our worker!
      }
    }

    // 7. If no stylist is free for this slot, return collision conflict
    if (!assignedStaff) {
      return NextResponse.json(
        { error: "Este horario acaba de ser reservado. Por favor selecciona otro horario." },
        { status: 409 }
      );
    }

    // 8. Construct Reservation details
    const resId = `MB-${Date.now().toString().slice(-6)}`;
    const newReservation = {
      id: resId,
      date,
      time,
      branch: branch.name,
      address: branch.address,
      staff: assignedStaff.name,
      service: service.name,
      durationMins,
      price: service.price,
      clientName,
      clientPhone,
      status: "Confirmada",
      createdAt: new Date().toISOString(),
    };

    // 9. Save to Google Sheets
    await saveReservation(newReservation);

    // 10. Create Event in Google Calendar
    // The calendar event is non-blocking, meaning if it fails, the reservation in Sheets is still valid!
    let calendarError = false;
    let calendarEventId = null;

    try {
      const calRes = await createCalendarEvent(branch.calendarId, newReservation);
      if (calRes.success) {
        calendarEventId = calRes.eventId;
      } else {
        calendarError = true;
      }
    } catch (calErr) {
      console.error("Calendar creation failed internally:", calErr);
      calendarError = true;
    }

    // 11. Return response with whatsapp details for automatic prefill link
    return NextResponse.json({
      success: true,
      reservation: {
        id: resId,
        date,
        time,
        branch: branch.name,
        address: branch.address,
        whatsapp: branch.whatsapp, // WhatsApp of selected branch
        staff: assignedStaff.name,
        service: service.name,
        durationMins,
        price: service.price,
        clientName,
        clientPhone,
      },
      calendarError,
      calendarEventId,
    });
  } catch (error) {
    console.error("Error creating appointment:", error);
    return NextResponse.json({ error: "Error interno al guardar la reserva: " + error.message }, { status: 500 });
  }
}
