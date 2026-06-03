import { NextResponse } from "next/server";
import { getAdminData, getReservations } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "reservations") {
      const reservations = await getReservations();
      return NextResponse.json({ values: reservations });
    }

    const adminData = await getAdminData();

    // Filter active items only
    const branches = adminData.branches.filter((b) => b.active);
    const services = adminData.services.filter((s) => s.active);
    const staff = adminData.staff.filter((s) => s.active);
    const staffBranches = adminData.staffBranches.filter((sb) => sb.active);
    const staffServices = adminData.staffServices.filter((ss) => ss.active);
    const schedules = adminData.schedules;
    const blocks = adminData.blocks;

    return NextResponse.json({
      branches,
      services,
      staff,
      staffBranches,
      staffServices,
      schedules,
      blocks,
    });
  } catch (error) {
    console.error("Config API error:", error);
    return NextResponse.json(
      { error: "Error al cargar la configuración: " + error.message },
      { status: 500 }
    );
  }
}
