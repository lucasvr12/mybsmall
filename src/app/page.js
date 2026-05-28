"use client";

import { useState, useEffect } from "react";
import {
  MapPin,
  Clock,
  User,
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronRight,
  ArrowLeft,
  Phone,
  Scissors,
  Check,
  AlertTriangle,
} from "lucide-react";

export default function Home() {
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState("");

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    branch: "",
    stylist: "",
    service: "",
    date: "",
    time: "",
    name: "",
    phone: "",
  });

  const [expandedCategory, setExpandedCategory] = useState("HAIRSTUDIO");
  const [availableTimes, setAvailableTimes] = useState([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [timesError, setTimesError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [confirmedRes, setConfirmedRes] = useState(null);

  // 1. Fetch Google Sheets active configuration
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch("/api/config");
        if (!res.ok) throw new Error("Fallo al obtener la configuración");
        const data = await res.json();
        setConfig(data);
      } catch (err) {
        console.error(err);
        setConfigError("No se pudo cargar la configuración del sistema. Intenta más tarde.");
      } finally {
        setLoadingConfig(false);
      }
    }
    loadConfig();
  }, []);

  // 2. Fetch slots when date or dependent selections change
  useEffect(() => {
    if (formData.date && formData.branch && formData.service && formData.stylist) {
      fetchAvailability();
    }
  }, [formData.date, formData.branch, formData.service, formData.stylist]);

  const fetchAvailability = async () => {
    setLoadingTimes(true);
    setTimesError("");
    setFormData((prev) => ({ ...prev, time: "" })); // Reset time
    try {
      const res = await fetch(
        `/api/availability?date=${formData.date}&branch=${formData.branch}&service=${formData.service}&stylist=${encodeURIComponent(
          formData.stylist
        )}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al buscar horarios");
      setAvailableTimes(data.availableSlots || []);
    } catch (err) {
      console.error(err);
      setTimesError(err.message || "Error al consultar los horarios disponibles.");
    } finally {
      setLoadingTimes(false);
    }
  };

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  // 3. Confirm appointment submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setBookingError("");

    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.status === 409) {
        // Double booking collision
        setBookingError("Este horario acaba de ser reservado por otro cliente. Por favor selecciona otro horario.");
        setFormData((prev) => ({ ...prev, time: "" }));
        // Roll back step to date/time selection
        setStep(4);
        fetchAvailability();
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "No pudimos registrar tu cita en este momento. Por favor intenta nuevamente.");
      }

      setConfirmedRes(data.reservation);
      setStep(6); // Success screen
    } catch (err) {
      console.error(err);
      setBookingError(err.message || "Ocurrió un error al registrar la cita.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. WhatsApp automatic prefill redirect
  const handleWhatsAppConfirm = () => {
    if (!confirmedRes) return;
    const { whatsapp, branch, address, staff, service, date, time, durationMins, clientName, clientPhone } = confirmedRes;

    if (!whatsapp) {
      alert("No hay WhatsApp configurado para esta sucursal. Por favor comunícate directamente con Men & Boys.");
      return;
    }

    // Format date beautifully
    const dateFormatted = new Date(date + "T00:00:00").toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const cleanWhatsapp = whatsapp.replace(/[+\s]/g, "");

    const whatsappMessage = `Hola, quiero confirmar mi cita en Men & Boys.

Datos de mi cita:

Nombre: ${clientName}
Teléfono: ${clientPhone}
Sucursal: ${branch}
Dirección: ${address}
Estilista: ${staff}
Servicio: ${service}
Fecha: ${dateFormatted}
Hora: ${time}
Duración: ${durationMins} minutos

Quedo atento a la confirmación.
Gracias.`;

    const url = `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, "_blank");
  };

  // --- RENDERING HELPERS FOR CLIENT FILTERING ---

  // Get active stylists for the selected branch
  const getEligibleStylists = () => {
    if (!config || !formData.branch) return [];
    return config.staff.filter((st) =>
      config.staffBranches.some((sb) => sb.staffId === st.id && sb.branchId === formData.branch && sb.active)
    );
  };

  // Get active services that the selected stylist can perform
  const getEligibleServices = () => {
    if (!config || !formData.branch) return [];

    const isAny =
      formData.stylist.toLowerCase() === "sin preferencia" ||
      formData.stylist === "Cualquiera disponible";

    if (isAny) {
      // Find all stylists working at the branch and aggregate their services
      const branchStylistIds = config.staff
        .filter((st) =>
          config.staffBranches.some((sb) => sb.staffId === st.id && sb.branchId === formData.branch && sb.active)
        )
        .map((st) => st.id);

      const branchServiceIds = new Set();
      config.staffServices
        .filter((ss) => branchStylistIds.includes(ss.staffId) && ss.active)
        .forEach((ss) => branchServiceIds.add(ss.serviceId));

      return config.services.filter((se) => branchServiceIds.has(se.id));
    } else {
      // Find specific stylist ID
      const stObj = config.staff.find((s) => s.name === formData.stylist);
      if (!stObj) return [];

      const staffServiceIds = config.staffServices
        .filter((ss) => ss.staffId === stObj.id && ss.active)
        .map((ss) => ss.serviceId);

      return config.services.filter((se) => staffServiceIds.includes(se.id));
    }
  };

  // UI loading state
  if (loadingConfig) {
    return (
      <div className="max-w-md mx-auto px-4 py-32 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-mbRed border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium tracking-wide">Cargando catálogo...</p>
      </div>
    );
  }

  // UI error state
  if (configError) {
    return (
      <div className="max-w-md mx-auto px-4 py-32 flex flex-col items-center justify-center text-center space-y-6">
        <AlertTriangle className="w-16 h-16 text-mbRed animate-bounce-subtle" />
        <h2 className="text-2xl font-bold font-['Oswald'] uppercase text-white">Error de Conexión</h2>
        <p className="text-gray-400 max-w-sm">{configError}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-mbRed text-white font-bold py-3 px-8 rounded-xl hover:bg-red-700 transition"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Monterrey" });
  const selectedBranchObj = config.branches.find((b) => b.id === formData.branch);
  const selectedServiceObj = config.services.find((s) => s.id === formData.service);
  const eligibleStylists = getEligibleStylists();
  const eligibleServices = getEligibleServices();

  // Group services by category
  const servicesByCategory = eligibleServices.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {});

  return (
    <div className="max-w-md mx-auto px-4 py-8 md:py-12 relative animate-fade-in">
      {/* 0. Progress Tracker */}
      {step >= 1 && step <= 5 && (
        <div className="mb-8">
          <div className="flex justify-between items-center text-xs font-bold text-mbRed mb-2 font-['Oswald'] tracking-widest uppercase">
            <span>{`PASO ${step} DE 5`}</span>
            <span>
              {step === 1 && "SUCURSAL"}
              {step === 2 && "BARBERO / ESTILISTA"}
              {step === 3 && "SERVICIO"}
              {step === 4 && "FECHA Y HORA"}
              {step === 5 && "DATOS DE CONTACTO"}
            </span>
          </div>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-mbRed transition-all duration-500 ease-out"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* STEP 1: BRANCH SELECTION */}
      {step === 1 && (
        <div className="space-y-6 animate-step-in">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-['Oswald'] font-bold uppercase tracking-tight text-white mb-2">
              Elige tu sucursal
            </h1>
            <p className="text-gray-400 text-sm">Selecciona la ubicación donde deseas agendar tu cita.</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {config.branches.map((branch) => {
              const isSelected = formData.branch === branch.id;
              const branchImages = {
                carrizalejo: "/branches/carrizalejo.jpg",
                mision: "/branches/mision.jpg",
                nacional: "/branches/nacional.jpg",
              };
              const imgSrc = branchImages[branch.id];

              return (
                <button
                  key={branch.id}
                  onClick={() => updateField("branch", branch.id)}
                  className={`relative overflow-hidden flex flex-col items-start justify-end p-5 border rounded-2xl transition-all duration-300 h-36 text-left ${
                    isSelected
                      ? "border-mbRed shadow-lg shadow-mbRed/20 scale-[1.01]"
                      : "border-white/10 hover:border-white/20"
                  }`}
                  style={
                    imgSrc ? { backgroundImage: `url(${imgSrc})`, backgroundSize: "cover", backgroundPosition: "center" } : {}
                  }
                >
                  <div
                    className={`absolute inset-0 transition-opacity duration-300 ${
                      isSelected
                        ? "bg-gradient-to-t from-black/95 via-black/60 to-black/10"
                        : "bg-gradient-to-t from-black/85 via-black/45 to-black/5 hover:opacity-90"
                    }`}
                  />
                  <div className="relative z-10 flex items-end justify-between w-full">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className={`w-4 h-4 ${isSelected ? "text-mbRed" : "text-white/70"}`} />
                        <h3 className="text-lg font-bold font-['Oswald'] uppercase text-white">{branch.name}</h3>
                      </div>
                      <p className="text-xs text-gray-400 max-w-[280px] truncate">{branch.address}</p>
                    </div>
                    {isSelected && (
                      <div className="bg-mbRed rounded-full p-1 shadow">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {formData.branch && (
            <button
              onClick={nextStep}
              className="w-full bg-mbRed text-white font-bold py-4 rounded-xl hover:bg-red-700 transition uppercase tracking-widest font-['Oswald'] shadow-xl shadow-mbRed/20 mt-6"
            >
              Continuar
            </button>
          )}
        </div>
      )}

      {/* STEP 2: STYLIST SELECTION */}
      {step === 2 && (
        <div className="space-y-6 animate-step-in">
          <button
            onClick={prevStep}
            className="flex items-center text-sm font-bold text-mbRed hover:text-white transition group mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Volver
          </button>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-['Oswald'] font-bold uppercase tracking-tight text-white mb-2">
              ¿Quién te atenderá?
            </h2>
            <p className="text-gray-400 text-sm">Selecciona tu barbero o estilista de preferencia.</p>
          </div>

          <div className="grid gap-3">
            {/* Sin Preferencia option */}
            <button
              onClick={() => {
                updateField("stylist", "Sin preferencia");
                nextStep();
              }}
              className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                formData.stylist === "Sin preferencia"
                  ? "bg-mbRed/10 border-mbRed"
                  : "bg-white/5 border-white/10 hover:border-white/20"
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                <User className="w-6 h-6 text-gray-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-['Oswald'] font-bold uppercase tracking-wider text-base">Cualquiera disponible</h4>
                <p className="text-xs text-gray-400">Asignación automática al estilista libre</p>
              </div>
              {formData.stylist === "Sin preferencia" && <Check className="w-5 h-5 text-mbRed" />}
            </button>

            {eligibleStylists.map((st) => {
              const isSelected = formData.stylist === st.name;
              return (
                <button
                  key={st.id}
                  onClick={() => {
                    updateField("stylist", st.name);
                    nextStep();
                  }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                    isSelected ? "bg-mbRed/10 border-mbRed" : "bg-white/5 border-white/10 hover:border-white/20"
                  }`}
                >
                  <img
                    src={st.img}
                    alt={st.name}
                    className="w-14 h-14 rounded-full object-cover border border-white/10 bg-[#222]"
                    onError={(e) => {
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(st.name)}&background=222&color=cc0000`;
                    }}
                  />
                  <div className="flex-1">
                    <h4 className="font-['Oswald'] font-bold uppercase tracking-wider text-base">{st.name}</h4>
                    <p className="text-xs text-gray-400">Disponible</p>
                  </div>
                  {isSelected && <Check className="w-5 h-5 text-mbRed" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3: SERVICE SELECTION */}
      {step === 3 && (
        <div className="space-y-6 animate-step-in">
          <button
            onClick={prevStep}
            className="flex items-center text-sm font-bold text-mbRed hover:text-white transition group mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Volver
          </button>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-['Oswald'] font-bold uppercase tracking-tight text-white mb-2">
              Elige tu servicio
            </h2>
            <p className="text-gray-400 text-sm">Explora las opciones de cortes y tratamientos disponibles.</p>
          </div>

          <div className="space-y-4">
            {Object.entries(servicesByCategory).map(([category, sList]) => {
              const isExpanded = expandedCategory === category;
              const catNames = {
                HAIRSTUDIO: "✂️ Corte y Peinado",
                GROOMING: "✨ Estética y Aseo",
                AFEITADO: "🪒 Barba y Afeitado",
                SPA: "🧖 Tratamientos & SPA",
              };
              const title = catNames[category] || category;

              return (
                <div key={category} className="space-y-2">
                  <button
                    onClick={() => setExpandedCategory(isExpanded ? "" : category)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                      isExpanded ? "bg-mbRed border-mbRed shadow-lg" : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}
                  >
                    <span className="font-['Oswald'] font-bold uppercase tracking-wider text-base">{title}</span>
                    <ChevronRight className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="grid gap-2 animate-fade-in pl-1">
                      {sList.map((service) => {
                        const isSelected = formData.service === service.id;
                        return (
                          <button
                            key={service.id}
                            onClick={() => {
                              updateField("service", service.id);
                              nextStep();
                            }}
                            className={`flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                              isSelected ? "bg-mbRed/10 border-mbRed" : "bg-black/35 border-white/5 hover:border-white/10"
                            }`}
                          >
                            <div className="flex-1 pr-4">
                              <h4 className="font-bold text-sm text-white uppercase tracking-wide">{service.name}</h4>
                              <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                                <Clock className="w-3.5 h-3.5 text-gray-500" />
                                {`${service.durationMins} minutos`}
                              </p>
                            </div>
                            <span className="font-['Oswald'] font-bold text-mbRed text-lg">{service.price}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 4: DATE & TIME SELECTION */}
      {step === 4 && (
        <div className="space-y-6 animate-step-in">
          <button
            onClick={prevStep}
            className="flex items-center text-sm font-bold text-mbRed hover:text-white transition group mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Volver
          </button>

          <div className="text-center mb-6">
            <h2 className="text-3xl font-['Oswald'] font-bold uppercase tracking-tight text-white mb-2">
              Agenda tu espacio
            </h2>
            <p className="text-gray-400 text-sm">Selecciona una fecha y un horario conveniente.</p>
          </div>

          {/* Date Picker */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-2">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Selecciona el día</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <CalendarIcon className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="date"
                required
                min={todayStr}
                className="w-full bg-black/50 border border-white/15 rounded-xl pl-10 pr-4 py-3.5 text-white focus:outline-none focus:border-mbRed transition-all [color-scheme:dark]"
                value={formData.date}
                onChange={(e) => updateField("date", e.target.value)}
              />
            </div>
          </div>

          {/* Time Picker */}
          {formData.date && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Horarios Disponibles</h3>

              {loadingTimes ? (
                <div className="flex items-center justify-center py-10 text-gray-400 space-x-2">
                  <div className="w-5 h-5 border-2 border-mbRed border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Buscando espacios...</span>
                </div>
              ) : timesError ? (
                <div className="bg-red-500/10 text-mbRed p-4 rounded-xl text-center font-bold text-xs">
                  {timesError}
                </div>
              ) : availableTimes.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                  No hay horarios disponibles para esta fecha. Por favor selecciona otro día.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {availableTimes.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => updateField("time", slot.time)}
                      className={`py-3 px-1 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center ${
                        formData.time === slot.time
                          ? "bg-mbRed text-white shadow-lg shadow-mbRed/20 scale-[1.05]"
                          : !slot.available
                          ? "bg-white/5 border border-white/5 text-gray-600 cursor-not-allowed"
                          : "bg-white/5 border border-white/10 hover:border-mbRed/50 hover:bg-mbRed/10 text-gray-300"
                      }`}
                    >
                      <span>{slot.time}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {formData.time && (
            <button
              onClick={nextStep}
              className="w-full bg-mbRed text-white font-bold py-4 rounded-xl hover:bg-red-700 transition uppercase tracking-widest font-['Oswald'] shadow-xl shadow-mbRed/20 mt-6"
            >
              Continuar con este horario
            </button>
          )}
        </div>
      )}

      {/* STEP 5: PERSONAL DATA */}
      {step === 5 && (
        <div className="space-y-6 animate-step-in">
          <button
            onClick={prevStep}
            className="flex items-center text-sm font-bold text-mbRed hover:text-white transition group mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Volver
          </button>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-['Oswald'] font-bold uppercase tracking-tight text-white mb-2">
              Tus datos
            </h2>
            <p className="text-gray-400 text-sm">Completa tu información para agendar la reservación.</p>
          </div>

          {/* Selection Review */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <h4 className="font-['Oswald'] uppercase text-gray-400 text-xs font-bold tracking-widest mb-2 border-b border-white/5 pb-2">
              Resumen de Reserva
            </h4>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              <span className="text-gray-500">Sucursal:</span>
              <span className="font-semibold text-right text-white uppercase">{selectedBranchObj?.name}</span>

              <span className="text-gray-500">Estilista:</span>
              <span className="font-semibold text-right text-white uppercase">{formData.stylist}</span>

              <span className="text-gray-500">Servicio:</span>
              <span className="font-semibold text-right text-white uppercase">{selectedServiceObj?.name}</span>

              <span className="text-gray-500">Precio / Duración:</span>
              <span className="font-bold text-right text-mbRed">
                {`${selectedServiceObj?.price} / ${selectedServiceObj?.durationMins} min`}
              </span>

              <span className="text-gray-500">Fecha y Hora:</span>
              <span className="font-bold text-right text-white">
                {`${formData.date} - ${formData.time}`}
              </span>
            </div>
          </div>

          {/* Submission Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">Nombre Completo</label>
              <input
                type="text"
                required
                className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-3.5 focus:outline-none focus:border-mbRed transition-all text-white placeholder-gray-600 text-sm"
                placeholder="Ingresa tu nombre y apellido"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest">
                Teléfono de Contacto (SMS / WhatsApp)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-4.5 w-4.5 text-gray-500" />
                </div>
                <input
                  type="tel"
                  required
                  pattern="[0-9]{10}"
                  className="w-full bg-black/50 border border-white/15 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:border-mbRed transition-all text-white placeholder-gray-600 text-sm"
                  placeholder="8112345678 (10 dígitos)"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
                />
              </div>
            </div>

            {bookingError && (
              <div className="bg-red-500/10 text-mbRed p-4 rounded-xl text-center font-bold text-xs animate-shake flex items-center justify-center space-x-2">
                <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !formData.name || formData.phone.length !== 10}
              className="w-full bg-mbRed hover:bg-red-700 text-white font-bold py-4.5 rounded-xl transition uppercase tracking-widest font-['Oswald'] shadow-xl shadow-mbRed/20 mt-6 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Confirmando...</span>
                </div>
              ) : (
                "Confirmar mi Cita"
              )}
            </button>
          </form>
        </div>
      )}

      {/* STEP 6: SUCCESS SCREEN */}
      {step === 6 && confirmedRes && (
        <div className="text-center py-12 animate-scale-in space-y-8">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto shadow-inner border border-green-500/20">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>

          <div className="space-y-3">
            <h2 className="text-4xl font-['Oswald'] font-bold text-white uppercase tracking-tight">
              ¡Cita Registrada!
            </h2>
            <p className="text-gray-400 text-sm max-w-sm mx-auto">
              Tu reservación ha quedado registrada en la hoja de control de Men & Boys.
            </p>
          </div>

          {/* Reservation Receipt */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left max-w-md mx-auto space-y-4 shadow-xl">
            <h3 className="font-['Oswald'] uppercase text-mbRed font-bold text-xs tracking-widest border-b border-white/5 pb-2">
              {`CITA #${confirmedRes.id}`}
            </h3>
            <div className="grid grid-cols-2 gap-y-3.5 text-sm">
              <span className="text-gray-500">Cliente:</span>
              <span className="font-bold text-right text-white uppercase">{confirmedRes.clientName}</span>

              <span className="text-gray-500">Sucursal:</span>
              <span className="font-bold text-right text-white uppercase">{confirmedRes.branch}</span>

              <span className="text-gray-500">Dirección:</span>
              <span className="font-semibold text-right text-gray-400 text-xs">{confirmedRes.address}</span>

              <span className="text-gray-500">Estilista:</span>
              <span className="font-bold text-right text-white uppercase">{confirmedRes.staff}</span>

              <span className="text-gray-500">Servicio:</span>
              <span className="font-bold text-right text-white uppercase">{confirmedRes.service}</span>

              <span className="text-gray-500">Horario:</span>
              <span className="font-bold text-right text-mbRed">{`${confirmedRes.date} - ${confirmedRes.time}`}</span>

              <span className="text-gray-500">Precio / Duración:</span>
              <span className="font-bold text-right text-white">
                {`${confirmedRes.price} / ${confirmedRes.durationMins} min`}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 max-w-xs mx-auto">
            <button
              onClick={handleWhatsAppConfirm}
              className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-bold py-4 rounded-xl transition uppercase tracking-widest font-['Oswald'] shadow-xl shadow-green-500/10 flex items-center justify-center gap-2 text-sm"
            >
              <Scissors className="w-5 h-5" />
              Confirmar por WhatsApp
            </button>

            <button
              onClick={() => {
                setFormData({
                  branch: "",
                  stylist: "",
                  service: "",
                  date: "",
                  time: "",
                  name: "",
                  phone: "",
                });
                setConfirmedRes(null);
                setBookingError("");
                setStep(1);
              }}
              className="text-gray-500 hover:text-white transition font-['Oswald'] uppercase tracking-widest text-xs font-bold py-2"
            >
              Agendar otra cita
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
