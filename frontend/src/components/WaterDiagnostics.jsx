import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  Droplets,
  Zap,
  Thermometer,
  BookOpen,
  Filter,
  RefreshCw,
  Lightbulb
} from "lucide-react";
import { fmt } from "../utils/helpers";

/**
 * Coherent, paired diagnostic scenarios.
 * Each scenario bundles ONE exact cause, ONE matched solution, and ONE matched preventive measure.
 */
export const TARGETED_SCENARIOS = {
  ph_low: [
    {
      id: "ph_low_pipes",
      title: "Metallic Pipework Leaching & Internal Corrosion",
      source: "Aging galvanized iron or copper distribution pipes corroding due to acidic standing water.",
      impact: "Pinhole pipe leaks, bitter metallic taste, and hazardous heavy metal (lead, copper) leaching into drinking water.",
      solution: "Immediately dose food-grade Sodium Bicarbonate (baking soda, 60–80 mg/L) into the feed stream to elevate pH above 6.8, and flush all stagnant line dead-ends.",
      prevention: "Replace degrading metal distribution lines with NSF/ANSI-61 certified Schedule 80 PVC, CPVC, or cross-linked polyethylene (PEX) piping."
    },
    {
      id: "ph_low_peat",
      title: "Acid Rain Runoff & Decomposing Peat Ingress",
      source: "Atmospheric acid precipitation or forest organic decomposition leaching humic and fulvic acids into the intake catchment.",
      impact: "Depressed buffering capacity, tea-colored tint, and accelerated degradation of metallic pump components.",
      solution: "Route raw intake water through a sacrificial Calcite (calcium carbonate) or Corosex (magnesium oxide) neutralizing filter bed.",
      prevention: "Construct crushed limestone riprap buffer zones along upstream catchment drainage ditches to passively neutralize acidic runoff."
    },
    {
      id: "ph_low_effluent",
      title: "Industrial Acid Washdown or Mine Drainage Seepage",
      source: "Chemical rinse effluent, battery acid runoff, or industrial acid washdown infiltrating shallow groundwater near the source.",
      impact: "Severe chemical corrosion of fittings and immediate toxicity hazard to humans and livestock.",
      solution: "Immediately halt primary intake pumps, switch to reserve storage, and initiate air-sparging aeration combined with automated soda ash injection.",
      prevention: "Establish physical concrete containment berms and configure an automated solenoid emergency shutoff switch triggered when pH drops below 5.5."
    }
  ],

  ph_high: [
    {
      id: "ph_high_algae",
      title: "Cyanobacteria & Algal Photosynthetic Bloom",
      source: "Microscopic algae and cyanobacteria consuming dissolved carbon dioxide during peak daytime sunlight, driving pH rapidly upward.",
      impact: "Soapy alkaline taste, skin irritation, and severe impairment of chlorine and UV disinfection efficacy.",
      solution: "Immediately cover storage cistern to starve algae of sunlight, and dose low-concentration Alum (aluminum sulfate) coagulation to precipitate algal cells.",
      prevention: "Install heavy-duty, UV-resistant light-blocking covers and 0.5mm stainless steel insect/debris mesh on all cistern vents and inspection hatches."
    },
    {
      id: "ph_high_mineral",
      title: "Subterranean Limestone / Alkaline Bedrock Seepage",
      source: "Raw water percolation through natural dolomite, limestone, and calcium carbonate subterranean aquifers.",
      impact: "Heavy scale encrustation in water heaters, boiler tubes, showerheads, and pump impellers.",
      solution: "Inject controlled dilute food-grade citric acid (or weak food-grade hydrochloric acid) via a metering pump to restore pH to the 7.2–7.6 target range.",
      prevention: "Construct drainage diversion swales to channel heavily mineralized surface runoff away from the primary wellhead."
    },
    {
      id: "ph_high_concrete",
      title: "Cementitious Leaching from Unsealed Concrete Tank",
      source: "Uncarbonated calcium hydroxide leaching from newly poured, uncured, or unsealed concrete holding cistern walls.",
      impact: "High alkalinity spikes and bitter, astringent taste with a slimy surface water tactile feel.",
      solution: "Sparge compressed carbon dioxide gas into the holding reservoir to carbonate free alkali, followed by a complete freshwater flush.",
      prevention: "Apply a potable-water certified 2-part food-grade epoxy barrier coating to all concrete cistern interiors before filling."
    }
  ],

  turbidity: [
    {
      id: "turb_stormwater",
      title: "Torrential Stormwater Runoff & Topsoil Erosion",
      source: "Heavy rainfall washing loose colloidal clay, silt, and sand into the raw water collection intake.",
      impact: "Murky, cloudy water that shields pathogenic bacteria, viruses, and microbial cysts from UV sterilization and chlorination.",
      solution: "Dose Alum (aluminum sulfate) or organic Moringa oleifera seed extract at 25 mg/L to bind micro-particles into flocs, followed by 90 minutes quiescent settling in a sediment basin.",
      prevention: "Plant dense vetiver grass and native riparian vegetation buffer strips along catchment edges to naturally intercept and filter sediment runoff."
    },
    {
      id: "turb_pump",
      title: "Suction Strainer Bottom Sediment Resuspension",
      source: "Intake pump suction velocity stirring up settled silt from placing the intake strainer too close to the reservoir sludge floor.",
      impact: "Rapidly clogs fine cartridge filters, abrades pump mechanical seals, and causes turbid discharge surges.",
      solution: "Throttle pump discharge flow by 30% and switch filtration stream to the secondary multi-media sand/anthracite depth filter.",
      prevention: "Elevate the intake foot-valve and strainer at least 0.5 meters above the reservoir bed, or convert to a floating surface intake."
    },
    {
      id: "turb_organic",
      title: "Agricultural Manure & Livestock Inflow Contamination",
      source: "Surface wash from nearby livestock paddocks or agricultural compost piles carrying suspended organic particulates.",
      impact: "Severe biological contamination risk, coliform bacterial spikes, and elevated organic disinfection byproducts.",
      solution: "Direct water through a 5-micron spun polypropylene cartridge followed by a 1-micron polished block, followed by shock chlorination or UV treatment.",
      prevention: "Erect a 20-meter sanitary exclusion fence and watertight diversion curbs around the perimeter of the collection wellhead."
    }
  ],

  ec: [
    {
      id: "ec_fertilizer",
      title: "Agricultural Fertilizer Nutrient Runoff & Leaching",
      source: "Excessive dissolved nitrate, phosphate, and potassium salts percolating from over-fertilized surrounding agricultural lands.",
      impact: "High salinity, root burn in crops, and health risks from elevated nitrate ingestion (methemoglobinemia).",
      solution: "Route stream through a high-pressure Reverse Osmosis (RO) membrane system to reject 95–99% of dissolved ionic mineral salts.",
      prevention: "Coordinate precision split-fertilizer application schedules with local growers and construct perimeter retention swales to intercept agricultural percolation."
    },
    {
      id: "ec_saline",
      title: "Aquifer Saltwater Intrusion from Over-Pumping",
      source: "Excessive extraction rates drawing marine or brackish water into shallow coastal freshwater aquifer layers.",
      impact: "Salty, brackish taste, severe mineral hardness, and accelerated galvanic corrosion of hot water equipment.",
      solution: "Blend high-EC borehole water 1:1 with collected low-conductivity rainwater (EC < 80 µS/cm) to dilute conductivity below 500 µS/cm.",
      prevention: "Curtail daily continuous pumping hours to reduce cone of depression, and install piezometer monitoring wells to track saline interface levels."
    },
    {
      id: "ec_minerals",
      title: "Subsurface Gypsum & Rock Mineral Dissolution",
      source: "Natural dissolution of subterranean gypsum, rock salt, and calcium sulfate rock formations along the water table.",
      impact: "High Total Dissolved Solids (TDS), soap scum formation, and crusty white mineral rings on sanitary fixtures.",
      solution: "Install an automated strong-acid cation (SAC) ion-exchange water softener regenerated with food-grade sodium chloride brine.",
      prevention: "Extend and pressure-grout sanitary well casing to seal out mineralized upper strata and draw from deeper, cleaner freshwater layers."
    }
  ],

  temperature: [
    {
      id: "temp_pipe",
      title: "Direct Solar Heating of Above-Ground HDPE Piping",
      source: "Unshaded black plastic conveyance pipes running exposed along the ground absorbing direct midday solar irradiance.",
      impact: "Drastically lowers dissolved oxygen (DO) saturation capacity and accelerates biofilm and Legionella growth in distribution lines.",
      solution: "Wrap all exposed pipe runs with reflective aluminum-backed elastomeric thermal insulation foam jackets.",
      prevention: "Trench and bury all primary water conveyance pipelines at least 0.6–0.8 meters underground below the solar heating layer."
    },
    {
      id: "temp_tank",
      title: "Shallow Unshaded Cistern Thermal Absorption",
      source: "Uninsulated, dark-colored holding tanks sitting under direct tropical sunlight without overhead shade.",
      impact: "Accelerated chemical reaction rates, rapid chlorine disinfectant decay, and stale lukewarm discharge.",
      solution: "Engage cascade fountain aeration or diffused micro-bubble aerator to induce evaporative cooling and restore dissolved oxygen levels.",
      prevention: "Erect high-density 80% UV shade cloth canopies over storage tanks and coat tank exteriors with high-albedo solar-reflective white paint."
    }
  ]
};

export default function WaterDiagnostics({ latest, thresholds, fullView = false }) {
  // Scenario selector indices for each condition (allows clicking "Re-diagnose" to get another scenario)
  const [scenarioOffsets, setScenarioOffsets] = useState({
    ph_low: 0,
    ph_high: 0,
    turbidity: 0,
    ec: 0,
    temperature: 0
  });

  // Cycle to next scenario for a specific parameter
  const cycleScenario = (conditionKey) => {
    setScenarioOffsets(prev => ({
      ...prev,
      [conditionKey]: (prev[conditionKey] + 1) % (TARGETED_SCENARIOS[conditionKey]?.length || 1)
    }));
  };

  // Evaluate active issues from latest telemetry
  const activeIssues = useMemo(() => {
    if (!latest) return [];
    const issues = [];
    const phLow = thresholds?.ph_low ?? 5.5;
    const phHigh = thresholds?.ph_high ?? 8.5;
    const turbLimit = thresholds?.turbidity ?? 12.0;
    const ecLimit = thresholds?.ec ?? 800.0;

    const ph = typeof latest.ph === "number" ? latest.ph : null;
    const turb = typeof latest.turbidity === "number" ? latest.turbidity : null;
    const ec = typeof latest.ec === "number" ? latest.ec : null;
    const temp = typeof latest.temperature === "number" ? latest.temperature : null;

    if (ph !== null && ph < phLow) {
      const scenarios = TARGETED_SCENARIOS.ph_low;
      const idx = scenarioOffsets.ph_low % scenarios.length;
      issues.push({
        conditionKey: "ph_low",
        paramName: "pH",
        currentValue: `${fmt(ph, 2)}`,
        limitStr: `< ${phLow}`,
        severity: "critical",
        icon: Droplets,
        color: "var(--red)",
        scenario: scenarios[idx],
        totalScenarios: scenarios.length,
        currentIndex: idx + 1
      });
    } else if (ph !== null && ph > phHigh) {
      const scenarios = TARGETED_SCENARIOS.ph_high;
      const idx = scenarioOffsets.ph_high % scenarios.length;
      issues.push({
        conditionKey: "ph_high",
        paramName: "pH",
        currentValue: `${fmt(ph, 2)}`,
        limitStr: `> ${phHigh}`,
        severity: "critical",
        icon: Droplets,
        color: "var(--amber)",
        scenario: scenarios[idx],
        totalScenarios: scenarios.length,
        currentIndex: idx + 1
      });
    }

    if (turb !== null && turb > turbLimit) {
      const scenarios = TARGETED_SCENARIOS.turbidity;
      const idx = scenarioOffsets.turbidity % scenarios.length;
      issues.push({
        conditionKey: "turbidity",
        paramName: "Turbidity",
        currentValue: `${fmt(turb, 1)} NTU`,
        limitStr: `> ${turbLimit} NTU`,
        severity: "critical",
        icon: Filter,
        color: "var(--amber)",
        scenario: scenarios[idx],
        totalScenarios: scenarios.length,
        currentIndex: idx + 1
      });
    }

    if (ec !== null && ec > ecLimit) {
      const scenarios = TARGETED_SCENARIOS.ec;
      const idx = scenarioOffsets.ec % scenarios.length;
      issues.push({
        conditionKey: "ec",
        paramName: "Electrical Conductivity",
        currentValue: `${fmt(ec, 0)} µS/cm`,
        limitStr: `> ${ecLimit} µS/cm`,
        severity: "warning",
        icon: Zap,
        color: "var(--purple)",
        scenario: scenarios[idx],
        totalScenarios: scenarios.length,
        currentIndex: idx + 1
      });
    }

    if (temp !== null && temp > 30.0) {
      const scenarios = TARGETED_SCENARIOS.temperature;
      const idx = scenarioOffsets.temperature % scenarios.length;
      issues.push({
        conditionKey: "temperature",
        paramName: "Temperature",
        currentValue: `${fmt(temp, 1)} °C`,
        limitStr: `> 30.0 °C`,
        severity: "warning",
        icon: Thermometer,
        color: "var(--cyan)",
        scenario: scenarios[idx],
        totalScenarios: scenarios.length,
        currentIndex: idx + 1
      });
    }

    return issues;
  }, [latest, thresholds, scenarioOffsets]);

  const hasActiveIssues = activeIssues.length > 0;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      {/* Card Header */}
      <div className="card-header" style={{ marginBottom: 16 }}>
        <div>
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Wrench size={18} color="var(--accent)" />
            Targeted Water Quality Remediation & Advisory
          </div>
          <div className="card-subtitle">
            Dynamic cause identification, matched corrective action, and targeted preventive measure for current readings
          </div>
        </div>

        {hasActiveIssues ? (
          <span className="status-badge error" style={{ fontSize: 11 }}>
            <AlertTriangle size={12} /> {activeIssues.length} Active Concern{activeIssues.length > 1 ? "s" : ""}
          </span>
        ) : (
          <span className="status-badge ok" style={{ fontSize: 11 }}>
            <CheckCircle2 size={12} /> All Parameters In Safe Range
          </span>
        )}
      </div>

      {/* SECTION 1: DYNAMIC SPECIFIC SCENARIO FOR CURRENT READINGS */}
      {hasActiveIssues ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
          {activeIssues.map((issue) => {
            const Icon = issue.icon;
            const sc = issue.scenario;

            return (
              <div
                key={issue.conditionKey}
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${issue.severity === "critical" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "18px 20px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.12)"
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: issue.severity === "critical" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                      display: "grid",
                      placeItems: "center",
                      color: issue.color
                    }}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          padding: "2px 7px",
                          borderRadius: 4,
                          fontSize: 10.5,
                          fontWeight: 700,
                          background: issue.severity === "critical" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
                          color: issue.severity === "critical" ? "var(--red)" : "var(--amber)"
                        }}>
                          {issue.severity.toUpperCase()} ALERT
                        </span>
                        <strong style={{ fontSize: 14.5, color: "var(--text)" }}>
                          {issue.paramName}: {issue.currentValue}
                        </strong>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          (Threshold: {issue.limitStr})
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 2 }}>
                        Diagnosed Issue: <strong>{sc.title}</strong> (Scenario {issue.currentIndex} of {issue.totalScenarios})
                      </div>
                    </div>
                  </div>

                  {/* Button to cycle to next scenario for this reading */}
                  <button
                    onClick={() => cycleScenario(issue.conditionKey)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11, padding: "5px 10px", display: "flex", alignItems: "center", gap: 5 }}
                    title="Generate alternate cause and matching treatment"
                  >
                    <RefreshCw size={12} /> Alternate Cause ({issue.currentIndex}/{issue.totalScenarios})
                  </button>
                </div>

                {/* 3 Matched Direct Cards (Cause -> Exact Solution -> Targeted Prevention) */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: 14
                }}>
                  {/* 1. Diagnosed Cause / Source */}
                  <div style={{
                    background: "var(--surface2)",
                    borderRadius: 8,
                    padding: "14px",
                    borderLeft: "3px solid var(--red)"
                  }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--red)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      🔍 IDENTIFIED SOURCE / CAUSE
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, fontWeight: 600, marginBottom: 8 }}>
                      {sc.source}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      <strong>Impact:</strong> {sc.impact}
                    </div>
                  </div>

                  {/* 2. Specific Corrective Solution */}
                  <div style={{
                    background: "var(--surface2)",
                    borderRadius: 8,
                    padding: "14px",
                    borderLeft: "3px solid var(--cyan)"
                  }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--cyan)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      ⚡ HOW TO SOLVE CURRENT ISSUE
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, fontWeight: 600 }}>
                      {sc.solution}
                    </div>
                  </div>

                  {/* 3. Targeted Preventive Measure */}
                  <div style={{
                    background: "var(--surface2)",
                    borderRadius: 8,
                    padding: "14px",
                    borderLeft: "3px solid var(--green)"
                  }}>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--green)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      🛡️ PREVENTIVE MEASURE
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {sc.prevention}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          background: "rgba(16, 185, 129, 0.06)",
          border: "1px solid rgba(16, 185, 129, 0.22)",
          borderRadius: "var(--radius-md)",
          padding: "18px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 16
        }}>
          <ShieldCheck size={36} color="var(--green)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--green)", marginBottom: 3 }}>
              Water Meets All Safe Thresholds
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              All 4 live sensor readings (pH, Turbidity, EC, Temperature) are currently in optimal condition.
              Should any parameter exceed its alarm limit, the system will instantly identify the probable cause and provide a targeted solution right here.
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: ADVISORY KNOWLEDGE EXPLORER (Available in full-page mode or on demand) */}
      <div style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Lightbulb size={16} color="var(--amber)" />
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
            Tip: Click <strong>"Alternate Cause"</strong> on any alert card to toggle between industrial, natural, and agricultural diagnostic scenarios.
          </span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          Active Reference: WHO Guidelines for Drinking-water Quality (4th Ed.)
        </div>
      </div>
    </div>
  );
}
