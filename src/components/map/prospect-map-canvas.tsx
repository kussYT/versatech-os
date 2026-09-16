"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useEffect, useRef } from "react";
import { COMPANY_LIFECYCLE_LABELS } from "@/lib/crm/constants";
import { formatDateTime } from "@/lib/dates";
import { externalItineraryUrl } from "@/lib/prospection/itinerary";
import {
  MAP_MARKER_HEX,
  formatCompanyAddress,
  hasUsableCoordinates,
  markerColorForLifecycle,
  type MapCompany,
} from "@/lib/prospection/map-model";

type ProspectMapCanvasProps = {
  companies: MapCompany[];
};

export function ProspectMapCanvas({ companies }: ProspectMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    let cancelled = false;
    let map: import("leaflet").Map | undefined;

    void (async () => {
      const leaflet = await import("leaflet");
      await import("leaflet.markercluster");
      const L = leaflet.default;
      if (cancelled || !el) {
        return;
      }

      map = L.map(el, {
        scrollWheelZoom: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const plottable = companies.filter(hasUsableCoordinates);
      const bounds = L.latLngBounds([]);
      const cluster = L.markerClusterGroup();

      for (const company of plottable) {
        const color = MAP_MARKER_HEX[markerColorForLifecycle(company.lifecycleStatus)];
        const marker = L.circleMarker([company.latitude as number, company.longitude as number], {
          radius: plottable.length > 80 ? 6 : 8,
          color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: 2,
        });

        const address = formatCompanyAddress(company) || "Adresse non renseignée";
        const next = company.nextFollowUpTitle
          ? `${company.nextFollowUpTitle}${company.nextFollowUpAt ? ` · ${formatDateTime(company.nextFollowUpAt)}` : ""}`
          : "Aucune prochaine action";
        const website = company.website
          ? `<a href="${company.website}" target="_blank" rel="noreferrer">Site</a>`
          : "";

        marker.bindPopup(
          `<div class="vt-map-popup">
            <strong>${escapeHtml(company.name)}</strong>
            <p>${escapeHtml(company.industry ?? "Activité non renseignée")}</p>
            <p>${escapeHtml(COMPANY_LIFECYCLE_LABELS[company.lifecycleStatus])}</p>
            <p>${escapeHtml(address)}</p>
            <p>${escapeHtml(next)}</p>
            <p>${website}</p>
            <p>
              <a href="/entreprises/${company.id}">Voir la fiche</a>
              · <a href="${externalItineraryUrl(company)}" target="_blank" rel="noreferrer">Itinéraire</a>
            </p>
          </div>`,
        );

        cluster.addLayer(marker);
        bounds.extend([company.latitude as number, company.longitude as number]);
      }

      cluster.addTo(map);

      if (plottable.length === 1) {
        map.setView(
          [plottable[0].latitude as number, plottable[0].longitude as number],
          13,
        );
      } else if (plottable.length > 1 && bounds.isValid()) {
        map.fitBounds(bounds.pad(0.18));
      } else {
        map.setView([46.6, 2.2], 6);
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [companies]);

  return <div ref={containerRef} className="h-[min(70vh,40rem)] w-full rounded-xl bg-surface-high" />;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
