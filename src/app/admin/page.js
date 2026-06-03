"use client";

import { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Users,
  Scissors,
  Clock,
  Slash,
  Lock,
  LogOut,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  RefreshCw,
  Phone,
  DollarSign,
  Briefcase
} from "lucide-react";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeTab, setActiveTab] = useState("appointments");

  // Catalog data fetched from API
  const [config, setConfig] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Add forms state
  const [newStaff, setNewStaff] = useState({ name: "", phone: "", img: "", branchIds: [], serviceIds: [] });
  const [newService, setNewService] = useState({ name: "", category: "HAIRSTUDIO", price: "$280", durationMins: 30 });
  const [newBlock, setNewBlock] = useState({ type: "Completo", staffId: "", branchId: "", date: "", startTime: "", endTime: "", reason: "" });
  
  // Selected staff/branch for schedule editing
  const [selectedStaffSchedule, setSelectedStaffSchedule] = useState("");
  const [selectedBranchSchedule, setSelectedBranchSchedule] = useState("");

  // Local schedules and blocks state
  const [editingSchedules, setEditingSchedules] = useState({});
  const [quickBlock, setQuickBlock] = useState({ type: "Completo", date: "", startTime: "", endTime: "", reason: "" });
  
  // Check local session storage for password persistence
  useEffect(() => {
    const savedPassword = sessionStorage.getItem("adminPassword");
    if (savedPassword === "myb2026$$") {
      setIsAuthenticated(true);
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, []);

  // Synchronize local schedules state when Stylist/Branch selection changes
  useEffect(() => {
    if (selectedStaffSchedule && selectedBranchSchedule && config) {
      const days = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
      const initial = {};
      days.forEach(day => {
        const sched = config.schedules.find(
          s => s.staffId === selectedStaffSchedule && s.branchId === selectedBranchSchedule && s.dayOfWeek === day
        ) || { startTime: "09:00", endTime: "19:00", active: true };
        initial[day] = { ...sched };
      });
      setEditingSchedules(initial);
    } else {
      setEditingSchedules({});
    }
  }, [selectedStaffSchedule, selectedBranchSchedule, config]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verifyPassword", password }),
      });
      if (res.ok) {
        sessionStorage.setItem("adminPassword", password);
        setIsAuthenticated(true);
        loadDashboardData();
      } else {
        const data = await res.json();
        setLoginError(data.error || "Contraseña incorrecta");
      }
    } catch (err) {
      setLoginError("Error de conexión");
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminPassword");
    setIsAuthenticated(false);
    setReservations([]);
    setConfig(null);
  };

  const loadDashboardData = async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const configRes = await fetch("/api/config");
      const configData = await configRes.json();
      
      if (!configRes.ok) {
        throw new Error(configData.error || "Fallo al obtener la configuración de la base de datos.");
      }

      setConfig(configData);

      // Fetch reservations
      const r = await fetch("/api/config?action=reservations");
      if (r.ok) {
        const data = await r.json();
        setReservations(data.values || []);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err.message || "No se pudo conectar a la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch helper (refreshes data in place instead of reloading the page)
  const apiCall = async (action, data = {}) => {
    setActionLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("adminPassword")}`
        },
        body: JSON.stringify({ action, ...data })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error al procesar la solicitud");
      
      await loadDashboardData();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Add Staff Handler
  const handleAddStaff = (e) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.phone) return;
    
    // Require selecting at least one branch
    if (newStaff.branchIds.length === 0) {
      alert("Por favor selecciona al menos una sucursal para el estilista.");
      return;
    }
    
    // Select all services by default to simplify setup
    const serviceIds = newStaff.serviceIds.length > 0 
      ? newStaff.serviceIds 
      : (config.services || []).map(s => s.id);

    apiCall("addStaff", { 
      name: newStaff.name, 
      phone: newStaff.phone, 
      img: newStaff.img,
      branchIds: newStaff.branchIds,
      serviceIds
    });

    // Reset form state
    setNewStaff({ name: "", phone: "", img: "", branchIds: [], serviceIds: [] });
  };

  // Add Service Handler
  const handleAddService = (e) => {
    e.preventDefault();
    if (!newService.name || !newService.price) return;
    apiCall("addService", {
      name: newService.name,
      category: newService.category,
      price: newService.price,
      durationMins: parseInt(newService.durationMins, 10) || 30
    });
  };

  // Add Block Handler
  const handleAddBlock = (e) => {
    e.preventDefault();
    if (!newBlock.branchId || !newBlock.date) return;
    apiCall("addBlock", {
      type: newBlock.type,
      staffId: newBlock.staffId || null,
      branchId: newBlock.branchId,
      date: newBlock.date,
      startTime: newBlock.type === "Parcial" ? newBlock.startTime : null,
      endTime: newBlock.type === "Parcial" ? newBlock.endTime : null,
      reason: newBlock.reason
    });
  };

  // Cancel Appointment Handler
  const handleCancelAppointment = (id) => {
    if (confirm("¿Estás seguro que deseas cancelar esta reservación? El horario volverá a quedar libre.")) {
      apiCall("cancelAppointment", { id });
    }
  };

  // Delete Staff Handler
  const handleDeleteStaff = (id, name) => {
    if (confirm(`¿Estás seguro que deseas borrar a ${name}? Se eliminarán todas sus relaciones y horarios.`)) {
      apiCall("deleteStaff", { id });
    }
  };

  // Delete Service Handler
  const handleDeleteService = (id, name) => {
    if (confirm(`¿Estás seguro que deseas eliminar el servicio "${name}"?`)) {
      apiCall("deleteService", { id });
    }
  };

  // Delete Block Handler
  const handleDeleteBlock = (id) => {
    if (confirm("¿Deseas eliminar este bloqueo?")) {
      apiCall("deleteBlock", { id });
    }
  };

  // Update Schedule Hour Handler (Legacy - retained for safety)
  const handleUpdateSchedule = (day, field, val) => {
    if (!selectedStaffSchedule || !selectedBranchSchedule) return;
    
    const current = config.schedules.find(
      s => s.staffId === selectedStaffSchedule && s.branchId === selectedBranchSchedule && s.dayOfWeek === day
    ) || { startTime: "09:00", endTime: "19:00", active: true };

    apiCall("updateSchedule", {
      staffId: selectedStaffSchedule,
      branchId: selectedBranchSchedule,
      dayOfWeek: day,
      startTime: field === "startTime" ? val : (current.startTime || "09:00"),
      endTime: field === "endTime" ? val : (current.endTime || "19:00"),
      active: field === "active" ? val : (current.active !== undefined ? current.active : true)
    });
  };

  // Helper to filter stylists linked to the selected branch
  const getStylistsForSelectedBranch = () => {
    if (!selectedBranchSchedule) return [];
    return config.staff.filter(st => 
      config.staffBranches.some(sb => sb.branchId === selectedBranchSchedule && sb.staffId === st.id && sb.active)
    );
  };

  // Modify schedule value locally (no API call on keystroke)
  const handleLocalScheduleChange = (day, field, val) => {
    setEditingSchedules(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: val
      }
    }));
  };

  // Save the full weekly schedules for the stylist at this branch
  const handleSaveAllSchedules = () => {
    if (!selectedStaffSchedule || !selectedBranchSchedule) return;
    
    const schedulesList = Object.values(editingSchedules).map(sched => ({
      staffId: selectedStaffSchedule,
      branchId: selectedBranchSchedule,
      dayOfWeek: sched.dayOfWeek,
      startTime: sched.startTime || "09:00",
      endTime: sched.endTime || "19:00",
      active: sched.active !== undefined ? sched.active : true
    }));

    apiCall("updateSchedulesBatch", { schedules: schedulesList });
  };

  // Add block quickly from the schedules view
  const handleQuickAddBlock = (e) => {
    e.preventDefault();
    if (!selectedBranchSchedule || !selectedStaffSchedule || !quickBlock.date) return;
    apiCall("addBlock", {
      type: quickBlock.type,
      staffId: selectedStaffSchedule,
      branchId: selectedBranchSchedule,
      date: quickBlock.date,
      startTime: quickBlock.type === "Parcial" ? quickBlock.startTime : null,
      endTime: quickBlock.type === "Parcial" ? quickBlock.endTime : null,
      reason: quickBlock.reason
    });
    // Reset form state
    setQuickBlock({ type: "Completo", date: "", startTime: "", endTime: "", reason: "" });
  };

  // Custom useEffect to load appointments dynamically
  useEffect(() => {
    if (isAuthenticated) {
      fetch("/api/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionStorage.getItem("adminPassword")}`
        },
        // We will get appointments by fetching the raw database table directly in an API route or bypass
      });

      // Let's retrieve appointments directly from our endpoint
      async function fetchReservas() {
        try {
          const res = await fetch("/api/admin", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${sessionStorage.getItem("adminPassword")}`
            },
            body: JSON.stringify({ action: "getReservations" }) // Wait, let's support this action in admin route
          });
          
          // Actually, our API handles actions. Let's make sure it returns them
          const r = await fetch("/api/config?action=reservations");
          if (r.ok) {
            const data = await r.json();
            setReservations(data.values || []);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      }
      fetchReservas();
    }
  }, [isAuthenticated]);

  // LOGIN SCREEN
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-[#111] border border-white/10 rounded-3xl p-8 space-y-8 shadow-2xl shadow-mbRed/10">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-mbRed/10 rounded-2xl flex items-center justify-center mx-auto border border-mbRed/20">
              <Lock className="w-8 h-8 text-mbRed" />
            </div>
            <h1 className="text-3xl font-['Oswald'] font-bold text-white uppercase tracking-tight">
              Administración
            </h1>
            <p className="text-gray-400 text-xs uppercase tracking-wider font-semibold">
              Men & Boys Reservaciones
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                Contraseña de Acceso
              </label>
              <input
                type="password"
                required
                className="w-full bg-black border border-white/15 rounded-xl px-4 py-4 focus:outline-none focus:border-mbRed transition-all text-white placeholder-gray-700 text-center tracking-widest text-lg font-bold"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {loginError && (
              <div className="bg-red-500/10 text-mbRed p-4 rounded-xl text-center font-bold text-xs flex items-center justify-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-mbRed hover:bg-red-700 text-white font-bold py-4 rounded-xl transition uppercase tracking-widest font-['Oswald'] shadow-xl shadow-mbRed/20"
            >
              Ingresar al Panel
            </button>
          </form>
        </div>
      </div>
    );
  }

  // LOADING SCREEN
  if (loading || !config) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-mbRed animate-spin" />
        <p className="text-gray-400 font-semibold tracking-wider text-sm uppercase">Cargando base de datos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-16">
      {/* HEADER */}
      <header className="bg-[#111] border-b border-white/15 px-4 py-5 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="bg-mbRed text-white text-xs font-bold px-3 py-1.5 rounded-md uppercase tracking-wider font-['Oswald']">
              ADMIN
            </span>
            <h1 className="text-xl font-['Oswald'] font-bold uppercase tracking-wide">
              Panel de Control
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-mbRed transition uppercase tracking-widest"
          >
            <LogOut className="w-4.5 h-4.5" />
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
        {errorMessage && (
          <div className="bg-red-500/10 text-mbRed p-4 rounded-xl font-bold text-sm flex items-center space-x-2 border border-mbRed/10 max-w-md mx-auto">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {actionLoading && (
          <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center space-y-3 z-50">
            <RefreshCw className="w-10 h-10 text-mbRed animate-spin" />
            <span className="text-sm font-bold uppercase tracking-widest text-gray-400">Procesando cambio...</span>
          </div>
        )}

        {/* TAB BUTTONS */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 bg-[#111] p-1.5 rounded-2xl border border-white/10 max-w-4xl mx-auto">
          {[
            { id: "appointments", label: "Citas", icon: CalendarIcon },
            { id: "staff", label: "Estilistas", icon: Users },
            { id: "services", label: "Servicios", icon: Scissors },
            { id: "schedules", label: "Horarios", icon: Clock },
            { id: "blocks", label: "Bloqueos", icon: Slash }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col md:flex-row items-center justify-center gap-1.5 md:gap-2.5 py-3.5 px-2 rounded-xl text-xs font-bold font-['Oswald'] uppercase tracking-wider transition ${
                  isActive ? "bg-mbRed text-white shadow-lg shadow-mbRed/10" : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* SECTION: APPOINTMENTS */}
        {activeTab === "appointments" && (
          <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-['Oswald'] font-bold uppercase">Citas Registradas</h2>
              <span className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-gray-400">
                {`${reservations.length - 1 > 0 ? reservations.length - 1 : 0} citas en total`}
              </span>
            </div>

            <div className="space-y-3">
              {reservations.slice(1).length === 0 ? (
                <div className="bg-[#111] border border-white/5 p-12 text-center text-gray-500 rounded-2xl">
                  No hay reservaciones activas en este momento.
                </div>
              ) : (
                reservations.slice(1).map((appt, idx) => {
                  const isCancelled = appt[11]?.toLowerCase() === "cancelada" || appt.status?.toLowerCase() === "cancelada";
                  
                  // Handle index mappings from array (Google sheets returned array rows, DB returns mapped objects)
                  const id = appt.id || appt[0];
                  const date = appt.date || appt[1];
                  const time = appt.time || appt[2];
                  const branch = appt.branch || appt[3];
                  const staffName = appt.staff || appt[5];
                  const serviceName = appt.service || appt[6];
                  const price = appt.price || appt[8];
                  const clientName = appt.clientName || appt[9];
                  const clientPhone = appt.clientPhone || appt[10];

                  return (
                    <div
                      key={id || idx}
                      className={`p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition ${
                        isCancelled ? "bg-[#111]/30 border-white/5 opacity-50" : "bg-[#111] border-white/10"
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                            isCancelled ? "bg-gray-600 text-white" : "bg-green-600 text-white"
                          }`}>
                            {isCancelled ? "Cancelada" : "Confirmada"}
                          </span>
                          <span className="text-gray-500 text-xs font-semibold">{`ID: ${id}`}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-sm">
                          <div>
                            <span className="text-gray-500 block text-[10px] uppercase font-bold">Cliente</span>
                            <span className="font-semibold text-white uppercase">{clientName}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[10px] uppercase font-bold">Teléfono</span>
                            <span className="font-mono text-gray-300">{clientPhone}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[10px] uppercase font-bold">Servicio</span>
                            <span className="font-semibold text-mbRed uppercase">{serviceName}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[10px] uppercase font-bold">Sucursal / Barber</span>
                            <span className="font-semibold text-gray-300 uppercase">{`${branch} - ${staffName}`}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 border-t border-white/5 pt-3 md:pt-0 md:border-0">
                        <div className="text-right">
                          <span className="block text-xs font-bold text-white">{date}</span>
                          <span className="text-xs text-gray-400 font-semibold">{time} HS</span>
                        </div>
                        
                        {!isCancelled && (
                          <button
                            onClick={() => handleCancelAppointment(id)}
                            className="bg-red-500/10 hover:bg-mbRed text-mbRed hover:text-white p-2.5 rounded-xl border border-mbRed/20 hover:border-transparent transition"
                            title="Cancelar cita"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* SECTION: STAFF */}
        {activeTab === "staff" && (
          <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
            {/* Add Staff form */}
            <div className="bg-[#111] border border-white/10 rounded-3xl p-6 space-y-4">
              <h3 className="text-lg font-['Oswald'] font-bold uppercase flex items-center gap-2">
                <Plus className="w-5 h-5 text-mbRed" /> Dar de Alta Nuevo Estilista / Barbero
              </h3>
              <form onSubmit={handleAddStaff} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nombre del Barbero</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Carlos Vera"
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-mbRed text-white"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Teléfono</label>
                    <input
                      type="tel"
                      required
                      placeholder="10 dígitos"
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-mbRed text-white font-mono"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sucursal(es) donde trabaja</label>
                  <div className="flex flex-wrap gap-6 mt-1 bg-black/40 p-4 border border-white/5 rounded-xl">
                    {(config.branches || []).map(b => (
                      <label key={b.id} className="flex items-center gap-2.5 text-sm text-gray-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="rounded border-white/10 bg-black text-mbRed focus:ring-mbRed w-4.5 h-4.5"
                          checked={newStaff.branchIds.includes(b.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setNewStaff(prev => {
                              const branchIds = checked 
                                ? [...prev.branchIds, b.id]
                                : prev.branchIds.filter(id => id !== b.id);
                              return { ...prev, branchIds };
                            });
                          }}
                        />
                        <span>{b.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="bg-mbRed hover:bg-red-700 text-white font-bold py-3.5 px-8 rounded-xl transition uppercase text-xs tracking-wider font-['Oswald'] shadow-lg shadow-mbRed/10 mt-2 w-full md:w-auto"
                >
                  Agregar Estilista
                </button>
              </form>
            </div>

            {/* List Staff */}
            <div className="space-y-4">
              <h3 className="text-xl font-['Oswald'] font-bold uppercase">Estilistas Activos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(config.staff || []).map((st) => (
                  <div key={st.id} className="bg-[#111] border border-white/10 rounded-2xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img
                        src={st.img}
                        alt={st.name}
                        className="w-12 h-12 rounded-full object-cover border border-white/10 bg-black"
                        onError={(e) => {
                          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(st.name)}&background=222&color=cc0000`;
                        }}
                      />
                      <div>
                        <h4 className="font-bold text-white text-base uppercase font-['Oswald'] tracking-wide">{st.name}</h4>
                        <p className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {st.phone}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteStaff(st.id, st.name)}
                      className="bg-red-500/10 hover:bg-mbRed text-mbRed hover:text-white p-2.5 rounded-xl border border-mbRed/20 hover:border-transparent transition"
                      title="Eliminar estilista"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SECTION: SERVICES */}
        {activeTab === "services" && (
          <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
            {/* Add Service form */}
            <div className="bg-[#111] border border-white/10 rounded-3xl p-6 space-y-4">
              <h3 className="text-lg font-['Oswald'] font-bold uppercase flex items-center gap-2">
                <Plus className="w-5 h-5 text-mbRed" /> Dar de Alta Nuevo Servicio
              </h3>
              <form onSubmit={handleAddService} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nombre del Servicio</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Hidratación Facial"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white"
                    value={newService.name}
                    onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Categoría</label>
                  <select
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white"
                    value={newService.category}
                    onChange={(e) => setNewService(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="HAIRSTUDIO">✂️ Corte y Peinado</option>
                    <option value="GROOMING">✨ Estética y Aseo</option>
                    <option value="AFEITADO">🪒 Barba y Afeitado</option>
                    <option value="SPA">🧖 Tratamientos & SPA</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Precio</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. $280"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white font-mono"
                    value={newService.price}
                    onChange={(e) => setNewService(prev => ({ ...prev, price: e.target.value }))}
                  />
                </div>
                <button
                  type="submit"
                  className="bg-mbRed hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl transition uppercase text-xs tracking-wider font-['Oswald'] shadow-lg shadow-mbRed/10 w-full"
                >
                  Agregar Servicio
                </button>
              </form>
            </div>

            {/* List Services */}
            <div className="space-y-6">
              {["HAIRSTUDIO", "GROOMING", "AFEITADO", "SPA"].map((cat) => {
                const services = config.services.filter(s => s.category === cat);
                if (services.length === 0) return null;
                
                const catNames = {
                  HAIRSTUDIO: "✂️ Corte y Peinado",
                  GROOMING: "✨ Estética y Aseo",
                  AFEITADO: "🪒 Barba y Afeitado",
                  SPA: "🧖 Tratamientos & SPA",
                };

                return (
                  <div key={cat} className="space-y-3">
                    <h4 className="text-lg font-['Oswald'] font-bold uppercase text-gray-400 tracking-wider">{catNames[cat]}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {services.map((srv) => (
                        <div key={srv.id} className="bg-[#111] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm text-white uppercase tracking-wide">{srv.name}</span>
                            <span className="text-xs text-gray-500 block font-semibold">{`${srv.durationMins} min`}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-bold text-mbRed text-base font-['Oswald']">{srv.price}</span>
                            <button
                              onClick={() => handleDeleteService(srv.id, srv.name)}
                              className="bg-red-500/10 hover:bg-mbRed text-mbRed hover:text-white p-2.5 rounded-xl border border-mbRed/20 hover:border-transparent transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION: SCHEDULES */}
        {activeTab === "schedules" && (
          <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-['Oswald'] font-bold uppercase">Horarios de Trabajo</h2>
            </div>
            
            <div className="bg-[#111] p-6 rounded-3xl border border-white/10 space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">1. Selecciona Sucursal</label>
                <select
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-mbRed text-white uppercase font-bold"
                  value={selectedBranchSchedule}
                  onChange={(e) => {
                    setSelectedBranchSchedule(e.target.value);
                    setSelectedStaffSchedule(""); // Reset selected stylist when branch changes
                  }}
                >
                  <option value="">-- Elige Sucursal --</option>
                  {(config.branches || []).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedBranchSchedule && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">2. Estilistas en esta Sucursal</h3>
                {getStylistsForSelectedBranch().length === 0 ? (
                  <div className="bg-[#111]/30 border border-white/5 rounded-2xl p-8 text-center text-gray-500">
                    No hay estilistas vinculados a esta sucursal. Puedes vincularlos desde la pestaña Estilistas.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {getStylistsForSelectedBranch().map(st => {
                      const isSelected = selectedStaffSchedule === st.id;
                      return (
                        <button
                          key={st.id}
                          onClick={() => setSelectedStaffSchedule(st.id)}
                          className={`flex flex-col items-center p-4 rounded-2xl border text-center transition-all ${
                            isSelected 
                              ? "bg-mbRed/10 border-mbRed shadow-lg shadow-mbRed/10 scale-[1.03]" 
                              : "bg-[#111] border-white/10 hover:border-white/20"
                          }`}
                        >
                          <img
                            src={st.img}
                            alt={st.name}
                            className="w-16 h-16 rounded-full object-cover border border-white/10 bg-black mb-2"
                            onError={(e) => {
                              e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(st.name)}&background=222&color=cc0000`;
                            }}
                          />
                          <span className="font-bold text-sm text-white uppercase font-['Oswald'] tracking-wide">{st.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {selectedStaffSchedule && selectedBranchSchedule ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Side: Weekly Hours */}
                <div className="bg-[#111] border border-white/10 rounded-3xl p-6 space-y-4 lg:col-span-7">
                  <h3 className="font-['Oswald'] font-bold text-lg uppercase tracking-wide border-b border-white/5 pb-2 text-mbRed flex items-center justify-between">
                    <span>Horario Semanal</span>
                    <span className="text-xs text-gray-400 font-normal normal-case">
                      {config.staff.find(s => s.id === selectedStaffSchedule)?.name}
                    </span>
                  </h3>
                  <div className="space-y-4 divide-y divide-white/5">
                    {["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"].map((day) => {
                      const sched = editingSchedules[day] || { startTime: "09:00", endTime: "19:00", active: true };
                      return (
                        <div key={day} className="flex items-center justify-between gap-4 py-4 first:pt-0">
                          <span className="font-bold text-xs uppercase text-gray-200 w-24">{day}</span>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-gray-500">Entrada</span>
                              <input
                                type="text"
                                className="w-14 bg-black border border-white/10 rounded-lg px-1.5 py-1 text-center font-mono focus:border-mbRed text-xs"
                                value={sched.startTime || "09:00"}
                                onChange={(e) => handleLocalScheduleChange(day, "startTime", e.target.value)}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-gray-500">Salida</span>
                              <input
                                type="text"
                                className="w-14 bg-black border border-white/10 rounded-lg px-1.5 py-1 text-center font-mono focus:border-mbRed text-xs"
                                value={sched.endTime || "19:00"}
                                onChange={(e) => handleLocalScheduleChange(day, "endTime", e.target.value)}
                              />
                            </div>
                            
                            <button
                              onClick={() => handleLocalScheduleChange(day, "active", !sched.active)}
                              className={`px-2.5 py-1 rounded-md font-bold text-[10px] uppercase transition ${
                                sched.active ? "bg-green-600/10 text-green-500 border border-green-500/20" : "bg-red-500/10 text-mbRed border border-mbRed/20"
                              }`}
                            >
                              {sched.active ? "Laborable" : "Descanso"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={handleSaveAllSchedules}
                    className="bg-mbRed hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition uppercase text-xs tracking-wider font-['Oswald'] shadow-lg shadow-mbRed/10 w-full mt-4"
                  >
                    Guardar Horarios
                  </button>
                </div>

                {/* Right Side: Blocks for this stylist */}
                <div className="space-y-6 lg:col-span-5">
                  {/* Quick Block Creation Form */}
                  <div className="bg-[#111] border border-white/10 rounded-3xl p-6 space-y-4">
                    <h3 className="font-['Oswald'] font-bold text-lg uppercase tracking-wide border-b border-white/5 pb-2 text-mbRed">
                      Bloquear Agenda
                    </h3>
                    <form onSubmit={handleQuickAddBlock} className="space-y-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha a Bloquear</label>
                        <input
                          type="date"
                          required
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white [color-scheme:dark]"
                          value={quickBlock.date}
                          onChange={(e) => setQuickBlock(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo de Bloqueo</label>
                        <select
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white font-bold"
                          value={quickBlock.type}
                          onChange={(e) => setQuickBlock(prev => ({ ...prev, type: e.target.value }))}
                        >
                          <option value="Completo">Todo el día</option>
                          <option value="Parcial">Rango de Horas</option>
                        </select>
                      </div>

                      {quickBlock.type === "Parcial" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hora Inicio</label>
                            <input
                              type="text"
                              required
                              placeholder="Ej. 13:00"
                              className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-mbRed text-white font-mono"
                              value={quickBlock.startTime}
                              onChange={(e) => setQuickBlock(prev => ({ ...prev, startTime: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hora Fin</label>
                            <input
                              type="text"
                              required
                              placeholder="Ej. 15:00"
                              className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-mbRed text-white font-mono"
                              value={quickBlock.endTime}
                              onChange={(e) => setQuickBlock(prev => ({ ...prev, endTime: e.target.value }))}
                            />
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Motivo / Descripción</label>
                        <input
                          type="text"
                          placeholder="Ej. Descanso / Vacaciones"
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white"
                          value={quickBlock.reason}
                          onChange={(e) => setQuickBlock(prev => ({ ...prev, reason: e.target.value }))}
                        />
                      </div>

                      <button
                        type="submit"
                        className="bg-mbRed hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl transition uppercase text-xs tracking-wider font-['Oswald'] shadow-lg shadow-mbRed/10 w-full"
                      >
                        Aplicar Bloqueo
                      </button>
                    </form>
                  </div>

                  {/* Active Blocks List for this Stylist */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Bloqueos de esta estilista</h4>
                    {config.blocks.filter(b => b.staffId === selectedStaffSchedule && b.branchId === selectedBranchSchedule).length === 0 ? (
                      <p className="text-xs text-gray-500 italic bg-[#111]/30 p-4 border border-white/5 rounded-xl text-center">
                        No hay bloqueos activos para esta estilista en esta sucursal.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {config.blocks
                          .filter(b => b.staffId === selectedStaffSchedule && b.branchId === selectedBranchSchedule)
                          .map(block => (
                            <div key={block.id} className="bg-[#111] border border-white/10 rounded-xl p-3.5 flex items-center justify-between text-xs">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-[9px] px-1.5 py-0.5 rounded bg-mbRed/20 text-mbRed uppercase">
                                    {block.type === "Completo" ? "Completo" : "Parcial"}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-semibold">{block.date}</span>
                                </div>
                                {block.type === "Parcial" && (
                                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">{`${block.startTime} - ${block.endTime} HS`}</p>
                                )}
                                {block.reason && <p className="text-[10px] text-gray-500 mt-0.5 italic">{`Motivo: ${block.reason}`}</p>}
                              </div>
                              <button
                                onClick={() => handleDeleteBlock(block.id)}
                                className="bg-red-500/10 hover:bg-mbRed text-mbRed hover:text-white p-2 rounded-lg border border-mbRed/20 hover:border-transparent transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#111]/30 border border-white/5 rounded-2xl p-12 text-center text-gray-500">
                Selecciona una sucursal y luego haz clic en una estilista para poder gestionar sus horarios de trabajo y bloqueos.
              </div>
            )}
          </div>
        )}

        {/* SECTION: BLOCKS */}
        {activeTab === "blocks" && (
          <div className="space-y-8 max-w-4xl mx-auto animate-fade-in">
            {/* Add Block Form */}
            <div className="bg-[#111] border border-white/10 rounded-3xl p-6 space-y-4">
              <h3 className="text-lg font-['Oswald'] font-bold uppercase flex items-center gap-2">
                <Plus className="w-5 h-5 text-mbRed" /> Crear Nuevo Bloqueo de Agenda
              </h3>
              <form onSubmit={handleAddBlock} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sucursal</label>
                  <select
                    required
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white uppercase font-bold"
                    value={newBlock.branchId}
                    onChange={(e) => setNewBlock(prev => ({ ...prev, branchId: e.target.value }))}
                  >
                    <option value="">-- Seleccionar --</option>
                    {(config.branches || []).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estilista (Opcional)</label>
                  <select
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white uppercase font-bold"
                    value={newBlock.staffId}
                    onChange={(e) => setNewBlock(prev => ({ ...prev, staffId: e.target.value }))}
                  >
                    <option value="">-- Toda la Sucursal --</option>
                    {(config.staff || []).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white [color-scheme:dark]"
                    value={newBlock.date}
                    onChange={(e) => setNewBlock(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo de Bloqueo</label>
                  <select
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white font-bold"
                    value={newBlock.type}
                    onChange={(e) => setNewBlock(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="Completo">Todo el día</option>
                    <option value="Parcial">Rango de Horas</option>
                  </select>
                </div>

                {newBlock.type === "Parcial" && (
                  <>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hora Inicio</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. 13:00"
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white font-mono"
                        value={newBlock.startTime}
                        onChange={(e) => setNewBlock(prev => ({ ...prev, startTime: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hora Fin</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej. 15:00"
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white font-mono"
                        value={newBlock.endTime}
                        onChange={(e) => setNewBlock(prev => ({ ...prev, endTime: e.target.value }))}
                      />
                    </div>
                  </>
                )}

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Motivo / Descripción</label>
                  <input
                    type="text"
                    placeholder="Ej. Junta Mensual / Vacaciones"
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-mbRed text-white"
                    value={newBlock.reason}
                    onChange={(e) => setNewBlock(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>

                <button
                  type="submit"
                  className="bg-mbRed hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl transition uppercase text-xs tracking-wider font-['Oswald'] shadow-lg shadow-mbRed/10 w-full"
                >
                  Bloquear Agenda
                </button>
              </form>
            </div>

            {/* List Blocks */}
            <div className="space-y-4">
              <h3 className="text-xl font-['Oswald'] font-bold uppercase">Bloqueos Activos</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.blocks.length === 0 ? (
                  <div className="bg-[#111]/30 border border-white/5 rounded-2xl p-8 text-center text-gray-500 md:col-span-2">
                    No hay bloqueos activos actualmente.
                  </div>
                ) : (
                  config.blocks.map((block) => {
                    const stylist = (config.staff || []).find(s => s.id === block.staffId);
                    const branch = (config.branches || []).find(b => b.id === block.branchId);
                    
                    return (
                      <div key={block.id} className="bg-[#111] border border-white/10 rounded-xl p-5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-mbRed/20 text-mbRed uppercase">
                              {block.type === "Completo" ? "Día Completo" : "Rango Horas"}
                            </span>
                            <span className="text-xs text-gray-400 font-semibold">{block.date}</span>
                          </div>
                          <h4 className="font-bold text-white text-sm uppercase mt-2">
                            {stylist ? `${stylist.name} (${branch?.name})` : `Toda la Sucursal: ${branch?.name}`}
                          </h4>
                          {block.type === "Parcial" && (
                            <p className="text-xs text-gray-500 font-mono mt-1">
                              {`${block.startTime} - ${block.endTime} HS`}
                            </p>
                          )}
                          {block.reason && <p className="text-xs text-gray-500 mt-1 italic">{`Motivo: ${block.reason}`}</p>}
                        </div>
                        <button
                          onClick={() => handleDeleteBlock(block.id)}
                          className="bg-red-500/10 hover:bg-mbRed text-mbRed hover:text-white p-2.5 rounded-xl border border-mbRed/20 hover:border-transparent transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
